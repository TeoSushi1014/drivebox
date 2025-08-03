using System.Net.Http;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using DriveBox.Models;
using DriveBox.Models.Download;
using Wpf.Ui.Controls;

namespace DriveBox.Services.Download
{
    public class DownloadService
    {
        private readonly HttpClient _httpClient;
        private readonly AppConfigService _configService;
        private readonly WindowsRegistrationService _windowsRegistrationService;
        private readonly SemaphoreSlim _downloadSemaphore;

        public DownloadService(AppConfigService configService, WindowsRegistrationService windowsRegistrationService)
        {
            _configService = configService;
            _windowsRegistrationService = windowsRegistrationService;
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "DriveBox-Downloader");
            
            // Use configurable timeout for large files
            var config = _configService.GetConfig();
            _httpClient.Timeout = TimeSpan.FromMinutes(config.Download.TimeoutMinutes);
            
            // Initialize semaphore for concurrent download limiting
            _downloadSemaphore = new SemaphoreSlim(config.Download.MaxConcurrentDownloads, config.Download.MaxConcurrentDownloads);
        }

        public async Task<bool> DownloadAppAsync(AppInfo app, IProgress<int>? progress = null)
        {
            // Use basic progress for backward compatibility
            return await DownloadAppAsync(app, progress, null, CancellationToken.None);
        }

        public async Task<bool> DownloadAppAsync(AppInfo app, IProgress<int>? basicProgress = null, IEnhancedProgress<int>? enhancedProgress = null, CancellationToken cancellationToken = default, DownloadItem? downloadItem = null)
        {
            if (app == null || !app.Modules.Any())
            {
                throw new ArgumentException("App or modules are invalid");
            }

            try
            {
                // Create app installation directory
                var installPath = _configService.GetAppInstallPath(app);
                Directory.CreateDirectory(installPath);

                // Create videos subdirectory only if app has video modules
                var hasVideoModules = app.Modules.Any(m => m.Id.Contains("videos_pack") || m.Type.Contains("video"));
                var videosPath = Path.Combine(installPath, "videos");
                if (hasVideoModules)
                {
                    Directory.CreateDirectory(videosPath);
                }

                // Phase 1: Download all modules first
                var totalModules = app.Modules.Count;
                var processedModules = 0;

                foreach (var module in app.Modules.OrderBy(m => (int)m.Priority))
                {
                    // Check for cancellation before processing each module
                    cancellationToken.ThrowIfCancellationRequested();

                    await DownloadModuleAsync(module, installPath, videosPath, basicProgress, enhancedProgress, cancellationToken, downloadItem, hasVideoModules);
                    
                    processedModules++;
                    var overallProgress = (processedModules * 90) / totalModules; // Reserve 10% for installation
                    basicProgress?.Report(overallProgress);
                    enhancedProgress?.Report(overallProgress, module.TenModule, app.TenHienThi, 
                        $"Đã hoàn thành {processedModules}/{totalModules} modules");
                }

                // Phase 2: Install dependencies silently (only for mo_phong_lai_xe app)
                if (app.Id == "mo_phong_lai_xe")
                {
                    basicProgress?.Report(95);
                    enhancedProgress?.Report(95, "", app.TenHienThi, "Đang cài đặt dependencies...");
                    await InstallDependenciesAsync(app, installPath);
                }

                // Phase 3: Validate file structure and register with Windows
                basicProgress?.Report(97);
                enhancedProgress?.Report(97, "", app.TenHienThi, "Đang xác thực file structure...");
                
                var structureValid = await ValidateAppStructureAsync(app, installPath);
                if (!structureValid)
                {
                    // Structure validation failed - continue installation anyway
                }

                // Phase 4: Register with Windows (Control Panel)
                basicProgress?.Report(99);
                enhancedProgress?.Report(99, "", app.TenHienThi, "Đang đăng ký với Windows...");
                
                var registrationSuccess = await _windowsRegistrationService.RegisterAppWithWindowsAsync(app);
                if (!registrationSuccess)
                {
                    // Windows registration failed - continue anyway
                }

                basicProgress?.Report(100);
                enhancedProgress?.Report(100, "", app.TenHienThi, "Hoàn tất cài đặt");
                return true;
            }
            catch (OperationCanceledException)
            {
                // Handle cancellation gracefully - preserve partial downloads by only cleaning temp files
                await CleanupPartialDownloadsAsync(app);

                // Re-throw original OperationCanceledException to maintain cancellation semantics
                throw;
            }
            catch (Exception ex)
            {
                // For non-cancellation errors, preserve successfully downloaded modules
                await CleanupPartialDownloadsAsync(app);

                throw new Exception($"Download failed: {ex.Message}", ex);
            }
        }

        private async Task DownloadModuleAsync(AppModule module, string installPath, string videosPath, 
            IProgress<int>? basicProgress = null, IEnhancedProgress<int>? enhancedProgress = null, CancellationToken cancellationToken = default, DownloadItem? downloadItem = null, bool hasVideoModules = false)
        {
            if (string.IsNullOrEmpty(module.Url))
            {
                throw new ArgumentException($"Module {module.TenModule} has no download URL");
            }

            var fileName = Path.GetFileName(new Uri(module.Url).LocalPath);
            if (string.IsNullOrEmpty(fileName))
            {
                fileName = $"{module.TenModule}.zip";
            }

            var filePath = Path.Combine(installPath, fileName);

            // Limit concurrent downloads to prevent resource exhaustion
            await _downloadSemaphore.WaitAsync(cancellationToken);
            try
            {
    
                
                // Try resumable download with retry logic
                await DownloadFileWithRetryAsync(module.Url, filePath, basicProgress, enhancedProgress, cancellationToken, downloadItem, module);

                // Extract if it's a zip file - handle different module types
                if (fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                {
                    string extractPath = GetExtractionPath(module, installPath, videosPath, hasVideoModules);
                    await ExtractZipFileWithRetryAsync(filePath, extractPath, cancellationToken);
                    await DeleteFileWithRetryAsync(filePath);
                    
                    // Force garbage collection after large file operations to free memory
                    if (module.Id.Contains("videos_pack"))
                    {
                        GC.Collect();
                        GC.WaitForPendingFinalizers();
    
                    }
                }

                module.IsDownloaded = true;

            }
            finally
            {
                _downloadSemaphore.Release();
            }
        }

        /// <summary>
        /// Download file with resume capability and retry logic
        /// </summary>
        private async Task DownloadFileWithRetryAsync(string url, string filePath, 
            IProgress<int>? basicProgress, IEnhancedProgress<int>? enhancedProgress, 
            CancellationToken cancellationToken, DownloadItem? downloadItem, AppModule module)
        {
            var config = _configService.GetConfig();
            var maxRetries = config.Download.MaxRetryAttempts;
            var tempFilePath = filePath + ".tmp";
            
            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    await DownloadFileWithResumeAsync(url, tempFilePath, filePath, basicProgress, enhancedProgress, cancellationToken, downloadItem, module);
                    return; // Success
                }
                catch (OperationCanceledException)
                {
                    // Don't retry on cancellation, just throw
                    throw;
                }
                catch (Exception) when (attempt < maxRetries)
                {

                    
                    // Wait before retry with exponential backoff
                    var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt)); // 2s, 4s, 8s
                    await Task.Delay(delay, cancellationToken);
                }
            }
        }

        /// <summary>
        /// Download file with resume capability using HTTP Range requests
        /// </summary>
        private async Task DownloadFileWithResumeAsync(string url, string tempFilePath, string finalFilePath,
            IProgress<int>? basicProgress, IEnhancedProgress<int>? enhancedProgress, 
            CancellationToken cancellationToken, DownloadItem? downloadItem, AppModule module)
        {
            // Check if partial file exists and get its size (if resume is enabled)
            var config = _configService.GetConfig();
            long resumePosition = 0;
            if (config.Download.EnableResumeDownload && File.Exists(tempFilePath))
            {
                resumePosition = new FileInfo(tempFilePath).Length;

            }

            // Get total file size first
            long totalBytes = await GetFileSizeAsync(url);
            
            // If we already have the complete file, just move it
            if (resumePosition > 0 && resumePosition >= totalBytes)
            {
                File.Move(tempFilePath, finalFilePath);
                return;
            }

            // Initialize enhanced progress tracking
            var progressInfo = new DownloadProgressInfo();
            progressInfo.CurrentFileName = Path.GetFileName(finalFilePath);
            progressInfo.CurrentModule = module.TenModule;
            progressInfo.StatusMessage = resumePosition > 0 ? $"Đang tiếp tục tải {module.TenModule}..." : $"Đang tải {module.TenModule}...";

            // Create HTTP request with Range header for resume
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (resumePosition > 0)
            {
                request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(resumePosition, null);
            }

            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            response.EnsureSuccessStatusCode();

            // Handle both full and partial content responses
            var contentLength = response.Content.Headers.ContentLength ?? (totalBytes - resumePosition);
            var downloadedBytes = resumePosition;

            using var contentStream = await response.Content.ReadAsStreamAsync();
            
            // Open file for append if resuming, create new if starting fresh
            using var fileStream = new FileStream(tempFilePath, 
                resumePosition > 0 ? FileMode.Append : FileMode.Create, 
                FileAccess.Write, FileShare.None);
            
            var bufferSize = config.Download.BufferSizeKB * 1024; // Convert KB to bytes
            var buffer = new byte[bufferSize]; // Configurable buffer size
                int bytesRead;

                while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length, cancellationToken)) > 0)
                {
                    // Check for cancellation before writing
                    cancellationToken.ThrowIfCancellationRequested();
                    
                // Wait if paused
                    if (downloadItem != null)
                        await downloadItem.WaitIfPausedAsync(cancellationToken);

                    await fileStream.WriteAsync(buffer, 0, bytesRead, cancellationToken);
                    downloadedBytes += bytesRead;

                    // Update enhanced progress with speed and ETA calculation
                    progressInfo.UpdateProgress(downloadedBytes, totalBytes);

                    if (totalBytes > 0)
                    {
                        var progressPercentage = (int)((downloadedBytes * 100) / totalBytes);
                        
                        // Report basic progress
                        basicProgress?.Report(progressPercentage);
                        
                        // Report enhanced progress with detailed info
                        enhancedProgress?.Report(progressPercentage, progressInfo);
                    }

                // Check for cancellation and pause based on configuration
                var checkFrequency = config.Download.CancellationCheckFrequencyKB * 1024;
                if (downloadedBytes % checkFrequency == 0) // Configurable frequency
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        if (downloadItem != null)
                            await downloadItem.WaitIfPausedAsync(cancellationToken);
                        await Task.Delay(1, cancellationToken);
                    }
                }
                
                // Ensure all data is written to disk
                await fileStream.FlushAsync();
            
            // Move temp file to final location
            if (File.Exists(finalFilePath))
                File.Delete(finalFilePath);
            File.Move(tempFilePath, finalFilePath);
        }

        /// <summary>
        /// Get file size without downloading the entire file
        /// </summary>
        private async Task<long> GetFileSizeAsync(string url)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Head, url);
                using var response = await _httpClient.SendAsync(request);
                response.EnsureSuccessStatusCode();
                return response.Content.Headers.ContentLength ?? 0;
            }
            catch
            {
                // Fallback: try GET with range header
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);
                using var response = await _httpClient.SendAsync(request);
                return response.Content.Headers.ContentRange?.Length ?? 0;
            }
        }

        /// <summary>
        /// Cleanup only temporary and incomplete files, preserve successfully downloaded modules
        /// </summary>
        private async Task CleanupPartialDownloadsAsync(AppInfo app)
        {
            try
            {
                var installPath = _configService.GetAppInstallPath(app);
                if (!Directory.Exists(installPath))
                    return;

                // Clean up temporary files (.tmp extension)
                var tempFiles = Directory.GetFiles(installPath, "*.tmp", SearchOption.AllDirectories);
                foreach (var tempFile in tempFiles)
                {
                    try
                    {
                        File.Delete(tempFile);
    
                    }
                    catch (Exception)
                    {

                    }
                }

                // Only delete the entire directory if no modules were successfully downloaded
                var hasSuccessfulDownloads = app.Modules.Any(m => m.IsDownloaded);
                if (!hasSuccessfulDownloads)
                {
                    // Check if directory has any content (files that aren't temp files)
                    var allFiles = Directory.GetFiles(installPath, "*", SearchOption.AllDirectories)
                        .Where(f => !f.EndsWith(".tmp"))
                        .ToArray();
                    
                    if (allFiles.Length == 0)
                    {
                                            Directory.Delete(installPath, true);
                    }
                }
                else
                {
                    // Preserving directory - contains successfully downloaded modules
                }
            }
            catch (Exception)
            {
                // Error during cleanup - don't throw exceptions during cleanup
            }

            await Task.CompletedTask; // Make method properly async
        }

        /// <summary>
        /// Xác thực file structure sau khi extract hoàn tất
        /// Đảm bảo có OnTapMoPhong.exe, Qt5 DLLs, videos folder, etc.
        /// </summary>
        private async Task<bool> ValidateAppStructureAsync(AppInfo app, string installPath)
        {
            try
            {
                return await Task.Run(() =>
                {
        

                    // Validate main executable
                    if (!string.IsNullOrEmpty(app.FileThucThiChinh))
                    {
                        var mainExe = Path.Combine(installPath, app.FileThucThiChinh);
                        if (!File.Exists(mainExe))
                        {
    
                            return false;
                        }

                    }

                    // For mo_phong_lai_xe app, validate expected Qt5 structure
                    if (app.Id == "mo_phong_lai_xe")
                    {
                        return ValidateOnTapMoPhongStructure(installPath);
                    }

                    // Generic validation: check if any executable exists
                    var exeFiles = Directory.GetFiles(installPath, "*.exe", SearchOption.TopDirectoryOnly);
                    var hasValidExe = exeFiles.Any(f => 
                    {
                        var fileName = Path.GetFileName(f).ToLowerInvariant();
                        return !fileName.Contains("setup") && 
                               !fileName.Contains("install") && 
                               !fileName.Contains("uninstall");
                    });

                    if (!hasValidExe)
                    {

                        return false;
                    }

                    
                    return true;
                });
            }
            catch (Exception)
            {

                return false;
            }
        }

        /// <summary>
        /// Validate OnTapMoPhong specific file structure
        /// </summary>
        private bool ValidateOnTapMoPhongStructure(string installPath)
        {
            var requiredFiles = new[]
            {
                "OnTapMoPhong.exe",
                "Qt5Core.dll",
                "Qt5Gui.dll",
                "Qt5Widgets.dll"
            };

            var requiredDirectories = new[]
            {
                "platforms",
                "videos"
            };

            // Check required files
            foreach (var file in requiredFiles)
            {
                var filePath = Path.Combine(installPath, file);
                if (!File.Exists(filePath))
                {
                    
                    return false;
                }
            }

            // Check required directories
            foreach (var dir in requiredDirectories)
            {
                var dirPath = Path.Combine(installPath, dir);
                if (!Directory.Exists(dirPath))
                {
                    
                    return false;
                }
            }

                        // Check videos directory has content
            var videosPath = Path.Combine(installPath, "videos");
            var videoFiles = Directory.GetFiles(videosPath, "*", SearchOption.AllDirectories);
            if (videoFiles.Length == 0)
            {
                return false;
            }

            return true;
        }

        private async Task ExtractZipFileWithRetryAsync(string zipFilePath, string extractPath, CancellationToken cancellationToken = default)
        {
            const int maxRetries = 3;
            const int baseDelayMs = 500;

            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    // Check if file is locked before attempting extraction
                    if (IsFileLocked(zipFilePath))
                    {
                        if (attempt == maxRetries)
                            throw new IOException($"File {zipFilePath} is locked and cannot be extracted after {maxRetries} attempts");
                        
                        await Task.Delay(baseDelayMs * attempt);
                        continue;
                    }

                    // Use async extraction with memory pressure handling for large video files
                    using (var archive = ZipFile.OpenRead(zipFilePath))
                    {
                        foreach (var entry in archive.Entries)
                        {
                            // Check for cancellation during extraction
                            cancellationToken.ThrowIfCancellationRequested();
                            
                            var destinationPath = Path.Combine(extractPath, entry.FullName);
                            
                            // Create directory if needed
                            var destinationDir = Path.GetDirectoryName(destinationPath);
                            if (!string.IsNullOrEmpty(destinationDir) && !Directory.Exists(destinationDir))
                            {
                                Directory.CreateDirectory(destinationDir);
                            }
                            
                            // Extract file with proper async handling
                            if (!string.IsNullOrEmpty(entry.Name))
                            {
                                using var entryStream = entry.Open();
                                using var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write);
                                await entryStream.CopyToAsync(fileStream);
                            }
                        }
                    }
                    
                    return; // Success
                }
                catch (IOException) when (attempt < maxRetries)
                {
                    // Wait before retry with exponential backoff based on .NET Ustad best practices
                    // Reference: https://www.dotnetustad.com/c-sharp/file-exceptions-and-error-handling
                    await Task.Delay(baseDelayMs * attempt);
                }
                catch (Exception ex)
                {
                    // Provide detailed error information for debugging
                    var errorDetails = ex switch
                    {
                        UnauthorizedAccessException => "Không có quyền truy cập file. Vui lòng chạy với quyền Administrator.",
                        DirectoryNotFoundException => "Thư mục đích không tồn tại hoặc đã bị xóa.",
                        IOException ioEx when ioEx.Message.Contains("used by another process") => 
                            "File đang được sử dụng bởi chương trình khác. Vui lòng đóng các ứng dụng liên quan và thử lại.",
                        _ => $"Lỗi không xác định: {ex.Message}"
                    };
                    
                    throw new Exception($"Không thể giải nén {Path.GetFileName(zipFilePath)}: {errorDetails}", ex);
                }
            }
        }

        private async Task DeleteFileWithRetryAsync(string filePath)
        {
            const int maxRetries = 3;
            const int baseDelayMs = 200;

            for (int attempt = 1; attempt <= maxRetries; attempt++)
            {
                try
                {
                    if (File.Exists(filePath))
                    {
                        File.Delete(filePath);
                        return;
                    }
                }
                catch (IOException) when (attempt < maxRetries)
                {
                    await Task.Delay(baseDelayMs * attempt);
                }
                catch (UnauthorizedAccessException) when (attempt < maxRetries)
                {
                    await Task.Delay(baseDelayMs * attempt);
                }
            }
        }

        private static bool IsFileLocked(string filePath)
        {
            try
            {
                using var stream = File.Open(filePath, FileMode.Open, FileAccess.Read, FileShare.None);
                return false;
            }
            catch (IOException)
            {
                return true;
            }
            catch (UnauthorizedAccessException)
            {
                return true;
            }
        }

        /// <summary>
        /// Xác định đường dẫn giải nén dựa trên loại module
        /// Đảm bảo structure: installPath/OnTapMoPhong.exe, installPath/videos/, etc.
        /// </summary>
        private string GetExtractionPath(AppModule module, string installPath, string videosPath, bool hasVideoModules)
        {

            
            // Videos pack: extract vào thư mục videos
            if ((module.Id.Contains("videos_pack") || module.Type.Contains("video")) && hasVideoModules)
            {
                // Đảm bảo videos folder tồn tại
                if (!Directory.Exists(videosPath))
                {
                    Directory.CreateDirectory(videosPath);

                }
                return videosPath;
            }
            
            // App core: extract vào thư mục gốc để có structure đúng
            // OnTapMoPhong.exe, Qt5*.dll, platforms/, audio/, etc. ở root level
            if (module.Id.Contains("app_core") || module.Type == "app_files")
            {

                return installPath;
            }
            
            // Dependencies: extract vào thư mục gốc (sẽ được xử lý riêng sau đó)
            if (module.Type == "dependency_installer")
            {

                return installPath;
            }
            
            // Default: extract vào thư mục gốc
            return installPath;
        }

        /// <summary>
        /// Cài đặt dependencies (VC++ Redist và K-Lite Codec) một cách silent
        /// </summary>
        private async Task InstallDependenciesAsync(AppInfo app, string installPath)
        {
            var dependencyModules = app.Modules
                .Where(m => m.Type.Equals("dependency_installer", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var dependency in dependencyModules)
            {
                await InstallDependencyAsync(dependency, installPath);
            }
        }

        /// <summary>
        /// Cài đặt một dependency cụ thể
        /// </summary>
        private async Task InstallDependencyAsync(AppModule dependency, string installPath)
        {
            try
            {
                // Tìm file .exe trong thư mục cài đặt
                var exeFiles = Directory.GetFiles(installPath, "*.exe", SearchOption.AllDirectories);
                
                // Lọc file .exe tương ứng với dependency
                var targetExe = FindTargetExecutable(dependency, exeFiles);
                
                if (string.IsNullOrEmpty(targetExe) || !File.Exists(targetExe))
                {
    
                    return;
                }

                // Chạy silent installation
                await RunSilentInstallationAsync(dependency, targetExe);
            }
            catch (Exception)
            {

                // Không throw exception để không làm fail toàn bộ quá trình
            }
        }

        /// <summary>
        /// Tìm file .exe phù hợp cho dependency
        /// </summary>
        private string FindTargetExecutable(AppModule dependency, string[] exeFiles)
        {
            // Mapping dependency ID với pattern file name
            var dependencyPatterns = new Dictionary<string, string[]>
            {
                { "dependency_vc_redist", new[] { "vc_redist", "vcredist", "VC_redist", "VC" } },
                { "dependency_klite", new[] { "K-Lite", "klite", "codec", "KLCP" } }
            };


                                // Debug file enumeration removed

            if (dependencyPatterns.TryGetValue(dependency.Id, out var patterns))
            {
                foreach (var pattern in patterns)
                {
                    var matchingFile = exeFiles.FirstOrDefault(file => 
                        Path.GetFileName(file).Contains(pattern, StringComparison.OrdinalIgnoreCase));
                    
                    if (!string.IsNullOrEmpty(matchingFile))
                    {
        
                        return matchingFile;
                    }
                }
            }

            // Fallback: return first .exe file found
            var fallbackFile = exeFiles.FirstOrDefault() ?? string.Empty;
            
            return fallbackFile;
        }

        /// <summary>
        /// Chạy silent installation cho dependency
        /// </summary>
        private async Task RunSilentInstallationAsync(AppModule dependency, string executablePath)
        {
            var silentArgs = GetSilentInstallationArguments(dependency);
            
            var processInfo = new ProcessStartInfo
            {
                FileName = executablePath,
                Arguments = silentArgs,
                UseShellExecute = true, // Changed to true for better compatibility with installers
                CreateNoWindow = true,
                Verb = "runas" // Run as administrator for installer permissions
            };



            try
            {
            using var process = new Process { StartInfo = processInfo };
            process.Start();

                // Chờ tối đa 10 phút cho quá trình cài đặt (tăng thời gian cho dependencies)
                var completed = await Task.Run(() => process.WaitForExit(600000)); // 10 minutes

            if (!completed)
            {
                    try { process.Kill(); } catch { }
                    throw new TimeoutException($"Cài đặt {dependency.TenModule} bị timeout sau 10 phút");
            }

            if (process.ExitCode != 0)
            {

                    // Many installers return non-zero exit codes even on successful silent install
                    // Log warning but don't treat as fatal error
            }
            else
            {

                }
            }
            catch (System.ComponentModel.Win32Exception ex) when (ex.NativeErrorCode == 1223)
            {
                // User declined UAC prompt

            }
            catch (Exception)
            {

            }
        }

        /// <summary>
        /// Lấy arguments cho silent installation dựa trên loại dependency
        /// </summary>
        private string GetSilentInstallationArguments(AppModule dependency)
        {
            return dependency.Id switch
            {
                "dependency_vc_redist" => "/quiet /norestart",
                "dependency_klite" => "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /NOCANCEL /FORCECLOSEAPPLICATIONS",
                _ => "/S" // Default silent argument
            };
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
            _downloadSemaphore?.Dispose();
        }
    }
}