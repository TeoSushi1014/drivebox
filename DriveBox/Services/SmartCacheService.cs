using System.IO;
using System.Text.Json;
using DriveBox.Models;

namespace DriveBox.Services
{
    /// <summary>
    /// Implements Google's Smart Caching Strategy with LRU eviction and size management
    /// Based on Android App Bundle and Dynamic Delivery best practices
    /// </summary>
    public class SmartCacheService
    {
        private const string CACHE_DIR = "smart_cache";
        private const string CACHE_INDEX_FILE = "cache_index.json";
        private const long MAX_CACHE_SIZE = 2L * 1024 * 1024 * 1024; // 2GB max cache
        private const long CRITICAL_CACHE_SIZE = 500L * 1024 * 1024; // 500MB always reserved for critical
        
        private readonly Dictionary<string, CacheEntry> _cacheIndex = new();
        private readonly object _cacheLock = new();
        private long _currentCacheSize = 0;

        public SmartCacheService()
        {
            InitializeCache();
        }

        private void InitializeCache()
        {
            try
            {
                if (!Directory.Exists(CACHE_DIR))
                {
                    Directory.CreateDirectory(CACHE_DIR);
                }

                LoadCacheIndex();
                CalculateCacheSize();
                

                CleanupOrphanedFiles();
            }
            catch (Exception)
            {
                // Cache initialization failed - continue without cache
            }
        }

        public async Task<T?> GetAsync<T>(string key, ModulePriority priority = ModulePriority.Essential) where T : class
        {
            CacheEntry? entry;
            lock (_cacheLock)
            {
                if (!_cacheIndex.TryGetValue(key, out entry))
                    return null;


                if (IsExpired(entry, priority))
                {
                    RemoveFromCache(key);
                    return null;
                }


                entry.LastAccessed = DateTime.UtcNow;
                entry.AccessCount++;
                
                SaveCacheIndex();
            }

            try
            {
                var filePath = Path.Combine(CACHE_DIR, entry.FileName);
                if (!File.Exists(filePath))
                {
                    lock (_cacheLock)
                    {
                        RemoveFromCache(key);
                    }
                    return null;
                }

                var json = await File.ReadAllTextAsync(filePath);
                return JsonSerializer.Deserialize<T>(json);
            }
            catch
            {
                lock (_cacheLock)
                {
                    RemoveFromCache(key);
                }
                return null;
            }
        }

        public async Task SetAsync<T>(string key, T value, ModulePriority priority = ModulePriority.Essential) where T : class
        {
            try
            {
                var json = JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = true });
                var data = System.Text.Encoding.UTF8.GetBytes(json);
                var size = data.Length;


                EnsureCacheSpace(size, priority);

                var fileName = GenerateFileName(key);
                var filePath = Path.Combine(CACHE_DIR, fileName);

                await File.WriteAllBytesAsync(filePath, data);

                lock (_cacheLock)
                {
    
                    if (_cacheIndex.TryGetValue(key, out var oldEntry))
                    {
                        _currentCacheSize -= oldEntry.Size;
                        var oldFilePath = Path.Combine(CACHE_DIR, oldEntry.FileName);
                        if (File.Exists(oldFilePath))
                        {
                            File.Delete(oldFilePath);
                        }
                    }

                    _cacheIndex[key] = new CacheEntry
                    {
                        Key = key,
                        FileName = fileName,
                        Size = size,
                        Priority = priority,
                        Created = DateTime.UtcNow,
                        LastAccessed = DateTime.UtcNow,
                        AccessCount = 1
                    };

                    _currentCacheSize += size;
                    SaveCacheIndex();
                }
            }
            catch (Exception)
            {
                // Cache set operation failed - skip caching for this request
            }
        }

        private void EnsureCacheSpace(long requiredSize, ModulePriority priority)
        {
            lock (_cacheLock)
            {
                var availableSpace = MAX_CACHE_SIZE - _currentCacheSize;
                
                if (availableSpace >= requiredSize)
                    return;

    
                var spaceToFree = requiredSize - availableSpace;
                
    
                var candidates = _cacheIndex.Values
                    .Where(entry => priority == ModulePriority.Critical || entry.Priority != ModulePriority.Critical)
                    .OrderBy(entry => entry.Priority) // Remove optional first
                    .ThenBy(entry => entry.LastAccessed) // Then by LRU
                    .ToList();

                long freedSpace = 0;
                var toRemove = new List<string>();

                foreach (var candidate in candidates)
                {
                    if (freedSpace >= spaceToFree)
                        break;

                    toRemove.Add(candidate.Key);
                    freedSpace += candidate.Size;
                }

    
                foreach (var key in toRemove)
                {
                    RemoveFromCache(key);
                }
            }
        }

        private void RemoveFromCache(string key)
        {
            if (_cacheIndex.TryGetValue(key, out var entry))
            {
                var filePath = Path.Combine(CACHE_DIR, entry.FileName);
                if (File.Exists(filePath))
                {
                    try
                    {
                        File.Delete(filePath);
                    }
                    catch { /* Ignore file deletion errors */ }
                }

                _currentCacheSize -= entry.Size;
                _cacheIndex.Remove(key);
                SaveCacheIndex();
            }
        }

        private bool IsExpired(CacheEntry entry, ModulePriority priority)
        {
            var maxAge = priority switch
            {
                ModulePriority.Critical => TimeSpan.FromDays(365), // Critical never expires
                ModulePriority.Essential => TimeSpan.FromDays(30), // Essential expires after 30 days
                ModulePriority.Optional => TimeSpan.FromDays(7),   // Optional expires after 7 days
                _ => TimeSpan.FromDays(7)
            };

            return DateTime.UtcNow - entry.Created > maxAge;
        }

        private void LoadCacheIndex()
        {
            var indexPath = Path.Combine(CACHE_DIR, CACHE_INDEX_FILE);
            if (!File.Exists(indexPath))
                return;

            try
            {
                var json = File.ReadAllText(indexPath);
                var entries = JsonSerializer.Deserialize<List<CacheEntry>>(json);
                
                if (entries != null)
                {
                    _cacheIndex.Clear();
                    foreach (var entry in entries)
                    {
                        _cacheIndex[entry.Key] = entry;
                    }
                }
            }
            catch (Exception)
            {
                // Failed to load cache index - reset to empty state
                _cacheIndex.Clear();
            }
        }

        private void SaveCacheIndex()
        {
            try
            {
                var indexPath = Path.Combine(CACHE_DIR, CACHE_INDEX_FILE);
                var entries = _cacheIndex.Values.ToList();
                var json = JsonSerializer.Serialize(entries, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(indexPath, json);
            }
            catch (Exception)
            {
                // Failed to save cache index - continue without persistence
            }
        }

        private void CalculateCacheSize()
        {
            _currentCacheSize = 0;
            foreach (var entry in _cacheIndex.Values)
            {
                var filePath = Path.Combine(CACHE_DIR, entry.FileName);
                if (File.Exists(filePath))
                {
                    var fileInfo = new FileInfo(filePath);
                    _currentCacheSize += fileInfo.Length;
                    entry.Size = fileInfo.Length; // Update size in case it changed
                }
            }
        }

        private void CleanupOrphanedFiles()
        {
            try
            {
                var cacheFiles = Directory.GetFiles(CACHE_DIR, "*", SearchOption.TopDirectoryOnly);
                var knownFiles = _cacheIndex.Values.Select(e => e.FileName).ToHashSet();
                knownFiles.Add(CACHE_INDEX_FILE);

                foreach (var file in cacheFiles)
                {
                    var fileName = Path.GetFileName(file);
                    if (!knownFiles.Contains(fileName))
                    {
                        File.Delete(file);
                    }
                }
            }
            catch (Exception)
            {
                // Cache cleanup failed - continue execution
            }
        }

        private static string GenerateFileName(string key)
        {
            var hash = key.GetHashCode().ToString("X8");
            var safeKey = string.Concat(key.Take(20).Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-'));
            return $"{safeKey}_{hash}.json";
        }

        public CacheStatistics GetStatistics()
        {
            lock (_cacheLock)
            {
                return new CacheStatistics
                {
                    TotalEntries = _cacheIndex.Count,
                    CurrentSize = _currentCacheSize,
                    MaxSize = MAX_CACHE_SIZE,
                    UsagePercentage = (double)_currentCacheSize / MAX_CACHE_SIZE * 100,
                    CriticalEntries = _cacheIndex.Values.Count(e => e.Priority == ModulePriority.Critical),
                    EssentialEntries = _cacheIndex.Values.Count(e => e.Priority == ModulePriority.Essential),
                    OptionalEntries = _cacheIndex.Values.Count(e => e.Priority == ModulePriority.Optional)
                };
            }
        }

        public void ClearCache(ModulePriority? priorityToClear = null)
        {
            lock (_cacheLock)
            {
                var keysToRemove = priorityToClear.HasValue
                    ? _cacheIndex.Where(kvp => kvp.Value.Priority == priorityToClear.Value).Select(kvp => kvp.Key).ToList()
                    : _cacheIndex.Keys.ToList();

                foreach (var key in keysToRemove)
                {
                    RemoveFromCache(key);
                }
            }
        }
    }

    public class CacheEntry
    {
        public string Key { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public long Size { get; set; }
        public ModulePriority Priority { get; set; }
        public DateTime Created { get; set; }
        public DateTime LastAccessed { get; set; }
        public int AccessCount { get; set; }
    }

    public class CacheStatistics
    {
        public int TotalEntries { get; set; }
        public long CurrentSize { get; set; }
        public long MaxSize { get; set; }
        public double UsagePercentage { get; set; }
        public int CriticalEntries { get; set; }
        public int EssentialEntries { get; set; }
        public int OptionalEntries { get; set; }
    }
}