using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using DriveBox.Models;

namespace DriveBox.Services
{
    /// <summary>
    /// Service để đồng bộ hóa manifest.json với GitHub repository
    /// Đảm bảo version information và metadata luôn up-to-date
    /// </summary>
    public class ManifestSyncService
    {
        private readonly HttpClient _httpClient;
        private readonly string _manifestFilePath;
        private const string REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/TeoSushi1014/drivebox-assets/main/manifest.json";

        public ManifestSyncService()
        {
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "DriveBox-ManifestSync");
            _manifestFilePath = Path.Combine(AppContext.BaseDirectory, "manifest.json");
        }

        /// <summary>
        /// Đồng bộ manifest với GitHub repository
        /// </summary>
        public async Task<bool> SyncManifestAsync()
        {
            try
            {


                // Lấy manifest từ GitHub
                var remoteManifest = await FetchRemoteManifestAsync();
                if (remoteManifest == null)
                {

                    return false;
                }

                // Đọc manifest local hiện tại
                var localManifest = await LoadLocalManifestAsync();
                if (localManifest == null)
                {

                    return false;
                }

                // So sánh và cập nhật nếu cần
                var needsUpdate = CompareManifests(localManifest, remoteManifest);
                if (needsUpdate)
                {
                    var updateSuccess = await UpdateLocalManifestAsync(remoteManifest);
                    if (updateSuccess)
                    {

                        LogManifestChanges(localManifest, remoteManifest);
                        return true;
                    }
                    else
                    {

                        return false;
                    }
                }
                else
                {

                    return true;
                }
            }
            catch (Exception ex)
            {

                return false;
            }
        }

        /// <summary>
        /// Lấy manifest từ GitHub repository
        /// </summary>
        private async Task<AppCatalog?> FetchRemoteManifestAsync()
        {
            try
            {


                var response = await _httpClient.GetAsync(REMOTE_MANIFEST_URL);
                response.EnsureSuccessStatusCode();

                var jsonContent = await response.Content.ReadAsStringAsync();
                
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };

                var manifest = JsonSerializer.Deserialize<AppCatalog>(jsonContent, options);
                

                return manifest;
            }
            catch (Exception ex)
            {

                return null;
            }
        }

        /// <summary>
        /// Đọc manifest local
        /// </summary>
        private async Task<AppCatalog?> LoadLocalManifestAsync()
        {
            try
            {
                if (!File.Exists(_manifestFilePath))
                {
    
                    return null;
                }

                var jsonContent = await File.ReadAllTextAsync(_manifestFilePath);
                
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };

                var manifest = JsonSerializer.Deserialize<AppCatalog>(jsonContent, options);
                

                return manifest;
            }
            catch (Exception ex)
            {

                return null;
            }
        }

        /// <summary>
        /// So sánh hai manifest để xem có cần cập nhật không
        /// </summary>
        private bool CompareManifests(AppCatalog local, AppCatalog remote)
        {
            try
            {
                if (local.Applications?.Count != remote.Applications?.Count)
                {
    
                    return true;
                }

                for (int i = 0; i < local.Applications?.Count; i++)
                {
                    var localApp = local.Applications[i];
                    var remoteApp = remote.Applications[i];

                    // So sánh version
                    if (localApp.PhienBan != remoteApp.PhienBan)
                    {
    
                        return true;
                    }

                    // So sánh module count
                    if (localApp.Modules?.Count != remoteApp.Modules?.Count)
                    {
    
                        return true;
                    }

                    // So sánh checksum của các modules
                    for (int j = 0; j < localApp.Modules?.Count; j++)
                    {
                        var localModule = localApp.Modules[j];
                        var remoteModule = remoteApp.Modules[j];

                        if (localModule.ChecksumSha256 != remoteModule.ChecksumSha256)
                        {
    
                            return true;
                        }
                    }
                }

                return false; // No differences found
            }
            catch (Exception ex)
            {

                return true; // Err on side of caution - update if comparison fails
            }
        }

        /// <summary>
        /// Cập nhật manifest local với data từ remote
        /// </summary>
        private async Task<bool> UpdateLocalManifestAsync(AppCatalog remoteManifest)
        {
            try
            {
                // Create backup of current manifest
                var backupPath = _manifestFilePath + ".backup";
                if (File.Exists(_manifestFilePath))
                {
                    File.Copy(_manifestFilePath, backupPath, true);
    
                }

                // Serialize remote manifest với formatting đẹp
                var options = new JsonSerializerOptions
                {
                    WriteIndented = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };

                var jsonContent = JsonSerializer.Serialize(remoteManifest, options);
                await File.WriteAllTextAsync(_manifestFilePath, jsonContent);


                return true;
            }
            catch (Exception ex)
            {


                // Restore backup if update failed
                var backupPath = _manifestFilePath + ".backup";
                if (File.Exists(backupPath))
                {
                    try
                    {
                        File.Copy(backupPath, _manifestFilePath, true);

                    }
                    catch (Exception restoreEx)
                    {

                    }
                }

                return false;
            }
        }

        /// <summary>
        /// Log chi tiết các thay đổi
        /// </summary>
        private void LogManifestChanges(AppCatalog local, AppCatalog remote)
        {
            try
            {


                for (int i = 0; i < remote.Applications?.Count; i++)
                {
                    var remoteApp = remote.Applications[i];
                    var localApp = local.Applications?.Count > i ? local.Applications[i] : null;

                    if (localApp == null)
                    {

                        continue;
                    }

                    if (localApp.PhienBan != remoteApp.PhienBan)
                    {

                    }

                    if (localApp.Modules?.Count != remoteApp.Modules?.Count)
                    {

                    }
                }


            }
            catch (Exception ex)
            {

            }
        }

        /// <summary>
        /// Kiểm tra xem có cần sync manifest không
        /// </summary>
        public Task<bool> NeedsSyncAsync()
        {
            try
            {
                // Check if local manifest exists
                if (!File.Exists(_manifestFilePath))
                {
                    return Task.FromResult(true);
                }

                // Check file age (sync daily)
                var fileInfo = new FileInfo(_manifestFilePath);
                var daysSinceLastUpdate = (DateTime.Now - fileInfo.LastWriteTime).TotalDays;
                
                if (daysSinceLastUpdate > 1.0)
                {
    
                    return Task.FromResult(true);
                }

                return Task.FromResult(false);
            }
            catch (Exception ex)
            {

                return Task.FromResult(true); // Err on side of caution
            }
        }

        /// <summary>
        /// Cleanup resources
        /// </summary>
        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }
}