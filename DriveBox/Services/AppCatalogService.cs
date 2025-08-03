using System.Net.Http;
using System.Text.Json;
using System.IO;
using DriveBox.Models;

namespace DriveBox.Services
{
    public class AppCatalogService : IDisposable
    {
        private const string MANIFEST_URL = "https://raw.githubusercontent.com/TeoSushi1014/drivebox-assets/main/manifest.json";
        private const string LOCAL_MANIFEST_PATH = "manifest.json";
        
        private readonly HttpClient _httpClient;
        private readonly ManifestSyncService _manifestSyncService;
        private AppCatalog? _cachedCatalog;
        private DateTime _lastCacheTime = DateTime.MinValue;
        private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(30);
        private bool _isLoadingSizes = false;
        private Dictionary<string, long> _sizeCache = new();
        private const string SIZE_CACHE_FILE = "size_cache.json";

        public AppCatalogService()
        {
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "DriveBox-AppCatalog");

            _httpClient.Timeout = TimeSpan.FromSeconds(3);
            _manifestSyncService = new ManifestSyncService();
            LoadSizeCache();
        }

        public async Task<AppCatalog?> LoadAppCatalogAsync(bool loadSizes = false)
        {
            try
            {

                if (await _manifestSyncService.NeedsSyncAsync())
                {

                    var syncSuccess = await _manifestSyncService.SyncManifestAsync();
                    if (syncSuccess)
                    {

                        _cachedCatalog = null;
                        _lastCacheTime = DateTime.MinValue;

                    }
                    else
                    {

                    }
                }


                if (_cachedCatalog != null && DateTime.Now - _lastCacheTime < _cacheExpiration)
                {
                    if (loadSizes && !_isLoadingSizes)
                    {
                        await PopulateAppSizesAsync(_cachedCatalog);
                    }
                    
                    return _cachedCatalog;
                }

                string jsonContent;
                

                if (File.Exists(LOCAL_MANIFEST_PATH))
                {
                    jsonContent = await File.ReadAllTextAsync(LOCAL_MANIFEST_PATH);
                    

                    _ = Task.Run(async () => 
                    {
                        try
                        {
                            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                            var response = await _httpClient.GetStringAsync(MANIFEST_URL, cts.Token);
                            await File.WriteAllTextAsync(LOCAL_MANIFEST_PATH, response);

                            var freshCatalog = JsonSerializer.Deserialize<AppCatalog>(response, new JsonSerializerOptions
                            {
                                PropertyNameCaseInsensitive = true,
                                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                            });
                            if (freshCatalog != null)
                            {
                                SetAppIconPaths(freshCatalog);
                                _cachedCatalog = freshCatalog;
                                _lastCacheTime = DateTime.Now;
                            }
                        }
                        catch
                        {

                        }
                    });
                }
                else
                {

                    try
                    {
                        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                        var response = await _httpClient.GetStringAsync(MANIFEST_URL, cts.Token);
                        jsonContent = response;
                        

                        _ = Task.Run(async () => await File.WriteAllTextAsync(LOCAL_MANIFEST_PATH, response));
                    }
                    catch
                    {
                        return _cachedCatalog;
                    }
                }
                
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };

                var catalog = JsonSerializer.Deserialize<AppCatalog>(jsonContent, options);
                
                if (catalog != null)
                {

                    SetAppIconPaths(catalog);
                    
                    if (loadSizes)
                    {
                        await PopulateAppSizesAsync(catalog);
                    }
                    
                    _cachedCatalog = catalog;
                    _lastCacheTime = DateTime.Now;
                }

                return catalog;
            }
            catch
            {
                return _cachedCatalog;
            }
        }


        private async Task PopulateAppSizesAsync(AppCatalog catalog)
        {
            if (_isLoadingSizes) 
            {
                return;
            }
            
            try
            {
                _isLoadingSizes = true;
                

                var immediateModules = catalog.Applications.SelectMany(a => a.Modules)
                    .Where(m => m.ShouldLoadImmediately).Count();
                
                var concurrencyLimit = immediateModules > 20 ? 4 : 8;
                using var semaphore = new SemaphoreSlim(concurrencyLimit, concurrencyLimit);
                var tasks = new List<Task>();
                var moduleSizeTasks = new Dictionary<string, Task<long>>();
                
                foreach (var app in catalog.Applications)
                {
                    foreach (var module in app.Modules)
                    {
                        if (_sizeCache.TryGetValue(module.Url, out var cachedSize))
                        {
                            module.Size = cachedSize;
                            continue;
                        }
                        

                        if (!moduleSizeTasks.ContainsKey(module.Url))
                        {
                            var task = GetFileSizeWithSemaphoreAsync(module.Url, semaphore);
                            moduleSizeTasks[module.Url] = task;
                            tasks.Add(task);
                        }
                    }
                }
                

                var timeoutTask = Task.Delay(TimeSpan.FromSeconds(30));
                var completedTask = await Task.WhenAny(Task.WhenAll(tasks), timeoutTask).ConfigureAwait(false);
                
                if (completedTask == timeoutTask)
                {

                }
                

                foreach (var app in catalog.Applications)
                {
                    foreach (var module in app.Modules)
                    {
                        if (module.Size == 0 && moduleSizeTasks.TryGetValue(module.Url, out var sharedTask))
                        {
                            if (sharedTask.IsCompletedSuccessfully)
                            {
                                try
                                {
                                    module.Size = await sharedTask;
                                    if (module.Size > 0)
                                    {
                                        _sizeCache[module.Url] = module.Size;
                                    }
                                }
                                catch
                                {

                                }
                            }
                        }
                    }
                }


                var sizeResults = new Dictionary<string, long>();
                
                foreach (var app in catalog.Applications)
                {
                    long totalSize = 0;
                    int successfulModules = 0;
                    
                    foreach (var module in app.Modules)
                    {
                        try
                        {
                            if (module.Size > 0)
                            {
    
                                totalSize += module.Size;
                                successfulModules++;
                            }
                            else if (moduleSizeTasks.TryGetValue(module.Url, out var sizeTask))
                            {
                                if (sizeTask.IsCompletedSuccessfully)
                                {
                                    module.Size = await sizeTask;
                                    if (module.Size > 0)
                                    {
                                        totalSize += module.Size;
                                        successfulModules++;
                                        _sizeCache[module.Url] = module.Size;
                                    }
                                }
                            }
                        }
                        catch
                        {
                        }
                    }
                    
                    if (totalSize > 0 && successfulModules < app.Modules.Count)
                    {
                        var missingModules = app.Modules.Count - successfulModules;
                        var averageModuleSize = totalSize / successfulModules;
                        totalSize += missingModules * averageModuleSize;
                    }
                    
                    sizeResults[app.Id] = totalSize;
                }
                

                if (System.Windows.Application.Current?.Dispatcher != null)
                {
                    await System.Windows.Application.Current.Dispatcher.BeginInvoke(() =>
                    {
                        foreach (var app in catalog.Applications)
                        {
                            if (sizeResults.TryGetValue(app.Id, out var size))
                            {
                                app.TotalSize = size;
                            }
                        }
                    });
                }
                else
                {

                    foreach (var app in catalog.Applications)
                    {
                        if (sizeResults.TryGetValue(app.Id, out var size))
                        {
                            app.TotalSize = size;
                        }
                    }
                }
                

                SaveSizeCache();
            }
            catch
            {
            }
            finally
            {
                _isLoadingSizes = false;
            }
        }

        private void LoadSizeCache()
        {
            try
            {
                if (File.Exists(SIZE_CACHE_FILE))
                {
                    var json = File.ReadAllText(SIZE_CACHE_FILE);
                    var cache = JsonSerializer.Deserialize<Dictionary<string, long>>(json);
                    if (cache != null)
                    {
                        _sizeCache = cache;
                    }
                }
            }
            catch
            {

                _sizeCache = new Dictionary<string, long>();
            }
        }

        private void SaveSizeCache()
        {
            try
            {
                var json = JsonSerializer.Serialize(_sizeCache, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(SIZE_CACHE_FILE, json);
            }
            catch
            {

            }
        }

        private async Task<long> GetFileSizeWithSemaphoreAsync(string url, SemaphoreSlim semaphore)
        {
            await semaphore.WaitAsync();
            try
            {
                return await GetFileSizeFromUrlAsync(url);
            }
            finally
            {
                semaphore.Release();
            }
        }

        private async Task<long> GetFileSizeFromUrlAsync(string url)
        {
            try
            {

                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                using var headRequest = new HttpRequestMessage(HttpMethod.Head, url);
                var headResponse = await _httpClient.SendAsync(headRequest, cts.Token);
                
                if (headResponse.IsSuccessStatusCode && headResponse.Content.Headers.ContentLength.HasValue)
                {
                    var size = headResponse.Content.Headers.ContentLength.Value;
                    return size;
                }
                
                try
                {
                    using var getRequest = new HttpRequestMessage(HttpMethod.Get, url);
                    getRequest.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);
                    
                    using var getResponse = await _httpClient.SendAsync(getRequest, cts.Token);
                    
                    if (getResponse.IsSuccessStatusCode && getResponse.Content.Headers.ContentLength.HasValue)
                    {
                        var size = getResponse.Content.Headers.ContentLength.Value;
                        return size;
                    }
                    
                    if (getResponse.Headers.AcceptRanges?.Contains("bytes") == true)
                    {
                        var contentRange = getResponse.Content.Headers.ContentRange;
                        if (contentRange?.Length.HasValue == true)
                        {
                            var size = contentRange.Length.Value;
                            return size;
                        }
                    }
                }
                catch
                {
                }
                
                return 0;
            }
            catch
            {
                return 0;
            }
        }

        public async Task<List<AppInfo>> GetAppsAsync(bool loadSizes = false)
        {
            var catalog = await LoadAppCatalogAsync(loadSizes);
            return catalog?.Applications ?? new List<AppInfo>();
        }


        public async Task<List<AppInfo>> GetAppsProgressiveAsync(LoadPhase phase = LoadPhase.Immediate)
        {
            var catalog = await LoadAppCatalogAsync(loadSizes: false);
            if (catalog?.Applications == null) return new List<AppInfo>();


            var filteredApps = catalog.Applications.Where(app => 
            {
                var appLoadPhase = GetAppLoadPhase(app);
                return phase switch
                {
                    LoadPhase.Immediate => appLoadPhase == LoadPhase.Immediate,
                    LoadPhase.Progressive => appLoadPhase <= LoadPhase.Progressive,
                    LoadPhase.OnDemand => true,
                    _ => appLoadPhase == LoadPhase.Immediate
                };
            }).ToList();


            if (phase == LoadPhase.Immediate && filteredApps.Any())
            {
                await PopulateAppSizesAsync(new AppCatalog { Applications = filteredApps });
            }

            return filteredApps;
        }

        private LoadPhase GetAppLoadPhase(AppInfo app)
        {

            var criticalModules = app.Modules.Count(m => m.Priority == ModulePriority.Critical);
            var totalSize = app.Modules.Sum(m => m.Size);

            if (criticalModules > 0) return LoadPhase.Immediate;
            if (totalSize < 30 * 1024 * 1024) return LoadPhase.Immediate;
            if (app.PhanLoai?.Contains("Essential") == true) return LoadPhase.Progressive;
            
            return LoadPhase.OnDemand;
        }

        public async Task<AppInfo?> GetAppByIdAsync(string appId)
        {
            var apps = await GetAppsAsync();
            return apps.FirstOrDefault(a => a.Id == appId);
        }

        public async Task RefreshAppSizesAsync()
        {
            if (_cachedCatalog != null)
            {
                await PopulateAppSizesAsync(_cachedCatalog);
            }
        }

        public async Task<List<AppInfo>> SearchAppsAsync(string searchTerm)
        {
            var apps = await GetAppsAsync();
            if (string.IsNullOrWhiteSpace(searchTerm))
                return apps;

            return apps.Where(a => 
                a.TenHienThi.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                a.MoTa.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)
            ).ToList();
        }

        public void ClearCache()
        {
            _cachedCatalog = null;
            _lastCacheTime = DateTime.MinValue;
            _sizeCache.Clear();
        }

        private void SetAppIconPaths(AppCatalog catalog)
        {
            foreach (var app in catalog.Applications)
            {
                app.IconPath = app.Id switch
                {
                    "mo_phong_lai_xe" => "pack://application:,,,/Assets/120cau.png",
                    "tu_luyen_600_cau" => "pack://application:,,,/Assets/600cau.png",
                    _ => string.Empty
                };
            }
        }


        public void Dispose()
        {
            _httpClient?.Dispose();
            _manifestSyncService?.Dispose();
        }
    }
} 