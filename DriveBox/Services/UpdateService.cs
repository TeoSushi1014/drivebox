using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.IO;
using DriveBox.Models;
using DriveBox.Models.Download;

namespace DriveBox.Services
{
    public class UpdateService : IDisposable
    {
        private const string GITHUB_API_URL = "https://api.github.com/repos/TeoSushi1014/DriveBox/releases/latest";
        private const string GITHUB_RELEASE_URL = "https://github.com/TeoSushi1014/DriveBox/releases/latest";
        private readonly HttpClient _httpClient;
        private readonly SemaphoreSlim _downloadSemaphore = new(1, 1); // Only allow one download at a time



        public UpdateService()
        {
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "DriveBox-UpdateChecker");
        }

        public async Task<UpdateInfo?> CheckForUpdatesAsync()
        {
            try
            {
                var response = await _httpClient.GetStringAsync(GITHUB_API_URL);
                
                var releaseInfo = JsonSerializer.Deserialize<GitHubRelease>(response);

                if (releaseInfo == null)
                {
                    return null;
                }

                var currentVersion = GetCurrentVersion();
                var latestVersion = ParseVersion(releaseInfo.TagName);

                if (latestVersion > currentVersion)
                {
                    return new UpdateInfo
                    {
                        CurrentVersion = currentVersion.ToString(),
                        LatestVersion = latestVersion.ToString(),
                        ReleaseNotes = releaseInfo.Body,
                        DownloadUrl = GITHUB_RELEASE_URL,
                        IsUpdateAvailable = true
                    };
                }

                return new UpdateInfo
                {
                    CurrentVersion = currentVersion.ToString(),
                    LatestVersion = latestVersion.ToString(),
                    IsUpdateAvailable = false
                };
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        public async Task<bool> DownloadAndInstallUpdateAsync(IProgress<int>? progress = null, bool autoExit = true)
        {
            return await DownloadAndInstallUpdateAsync(progress, null, autoExit);
        }

        public async Task<bool> DownloadAndInstallUpdateAsync(IProgress<int>? basicProgress = null, IEnhancedProgress<int>? enhancedProgress = null, bool autoExit = true)
        {
            // Check if another download is already in progress
            if (!await _downloadSemaphore.WaitAsync(100)) // Wait max 100ms
            {
                return false;
            }

            try
            {
                var updateInfo = await CheckForUpdatesAsync();
                if (updateInfo == null || !updateInfo.IsUpdateAvailable)
                {
                    return false;
                }

                var installerUrl = await GetInstallerDownloadUrlAsync();
                if (string.IsNullOrEmpty(installerUrl))
                {
                    return false;
                }

                var tempPath = Path.GetTempPath();
                // Use unique filename to avoid conflicts between multiple download attempts
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var installerPath = Path.Combine(tempPath, $"DriveBox-{updateInfo.LatestVersion}-Setup-{timestamp}.exe");

                // Check if we have write permissions to temp directory
                try
                {
                    var testFile = Path.Combine(tempPath, "driveBox_test.tmp");
                    await File.WriteAllTextAsync(testFile, "test");
                    File.Delete(testFile);
                }
                catch (Exception ex)
                {
                    return false;
                }

                await DownloadFileAsync(installerUrl, installerPath, basicProgress, enhancedProgress);

                // Verify file was downloaded successfully
                if (!File.Exists(installerPath))
                {
                    return false;
                }

                var fileInfo = new FileInfo(installerPath);

                if (fileInfo.Length == 0)
                {
                    return false;
                }

                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = installerPath,
                        UseShellExecute = true,
                        Arguments = "/SILENT /CLOSEAPPLICATIONS"
                    }
                };

                var started = process.Start();
                if (!started)
                {
                    return false;
                }
                
                if (autoExit)
                {
                    // Give the installer a moment to start, then exit the current application
                    await Task.Delay(2000);
                    Environment.Exit(0);
                }
                
                return true;
            }
            catch (Exception ex)
            {
                return false;
            }
            finally
            {
                _downloadSemaphore.Release();
            }
        }

        private async Task<string?> GetInstallerDownloadUrlAsync()
        {
            try
            {
                var response = await _httpClient.GetStringAsync(GITHUB_API_URL);
                var releaseInfo = JsonSerializer.Deserialize<GitHubRelease>(response);
                
                if (releaseInfo?.Assets == null || releaseInfo.Assets.Count == 0)
                {
                    return null;
                }

                var installerAsset = releaseInfo.Assets.FirstOrDefault(a => 
                    a.Name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ||
                    a.Name.EndsWith(".msi", StringComparison.OrdinalIgnoreCase));

                if (installerAsset != null)
                {
                    return installerAsset.BrowserDownloadUrl;
                }
                else
                {
                    return null;
                }
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        private async Task DownloadFileAsync(string url, string filePath, IProgress<int>? basicProgress, IEnhancedProgress<int>? enhancedProgress = null)
        {
            try
            {
                // Delete existing file if it exists
                if (File.Exists(filePath))
                {
                    try
                    {
                        File.Delete(filePath);
                    }
                    catch (Exception ex)
                    {
                        throw new IOException($"Cannot overwrite existing file at {filePath}: {ex.Message}", ex);
                    }
                }

                using var response = await _httpClient.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();

                var totalBytes = response.Content.Headers.ContentLength ?? 0;
                var downloadedBytes = 0L;

                // Initialize progress tracking for enhanced progress
                DownloadProgressInfo? progressInfo = null;
                if (enhancedProgress != null)
                {
                    progressInfo = new DownloadProgressInfo();
                    progressInfo.CurrentFileName = Path.GetFileName(filePath);
                    progressInfo.CurrentModule = "DriveBox Update";
                    progressInfo.StatusMessage = "Đang tải cập nhật DriveBox...";
                }

                using var contentStream = await response.Content.ReadAsStreamAsync();
                
                // Create file stream with proper error handling
                FileStream? fileStream = null;
                try
                {
                    fileStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize: 8192, useAsync: true);
                }
                catch (Exception ex)
                {
                    throw new IOException($"Cannot create file at {filePath}: {ex.Message}", ex);
                }

                using (fileStream)
                {
                    var buffer = new byte[8192];
                    int bytesRead;

                    while ((bytesRead = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        try
                        {
                            await fileStream.WriteAsync(buffer, 0, bytesRead);
                            downloadedBytes += bytesRead;

                            if (totalBytes > 0)
                            {
                                var percentage = (int)((downloadedBytes * 100) / totalBytes);
                                
                                // Report basic progress
                                basicProgress?.Report(percentage);
                                
                                // Report enhanced progress with detailed info
                                if (enhancedProgress != null && progressInfo != null)
                                {
                                    progressInfo.UpdateProgress(downloadedBytes, totalBytes);
                                    enhancedProgress.Report(percentage, progressInfo);
                                }
                            }
                        }
                        catch (IOException ex)
                        {
                            throw new IOException($"Failed to write data to {filePath}: {ex.Message}", ex);
                        }
                    }
                    
                    // Ensure all data is written to disk
                    await fileStream.FlushAsync();
                }
            }
            catch (HttpRequestException ex)
            {
                throw new IOException($"Network error downloading from {url}: {ex.Message}", ex);
            }
            catch (IOException)
            {
                // Re-throw IOException as-is (already has good context)
                throw;
            }
            catch (Exception ex)
            {
                throw new IOException($"Unexpected error downloading file: {ex.Message}", ex);
            }
        }

        private Version GetCurrentVersion()
        {
            return System.Reflection.Assembly.GetExecutingAssembly().GetName().Version ?? new Version(1, 0, 0, 0);
        }

        private Version ParseVersion(string versionString)
        {
            try
            {
                var cleanVersion = versionString.TrimStart('v');
                
                if (string.IsNullOrEmpty(cleanVersion))
                {
                    return new Version(1, 0, 0, 0);
                }

                if (Version.TryParse(cleanVersion, out var version))
                {
                    return version;
                }

                if (cleanVersion.Contains('.') && cleanVersion.Split('.').Length == 2)
                {
                    cleanVersion += ".0.0";
                    if (Version.TryParse(cleanVersion, out var version2))
                    {
                        return version2;
                    }
                }

                if (!cleanVersion.Contains('.'))
                {
                    cleanVersion += ".0.0.0";
                    if (Version.TryParse(cleanVersion, out var version3))
                    {
                        return version3;
                    }
                }


                return new Version(1, 0, 0, 0);
            }
            catch (Exception)
            {

                return new Version(1, 0, 0, 0);
            }
        }

        public void OpenGitHubReleases()
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = GITHUB_RELEASE_URL,
                    UseShellExecute = true
                });
            }
            catch (Exception)
            {

            }
        }

        public Task<UpdateInfo?> TestUpdateCheckAsync()
        {
            try
            {
                var testResponse = @"{
                    ""tag_name"": ""v2.1.0"",
                    ""body"": ""Test release notes"",
                    ""html_url"": ""https://github.com/TeoSushi1014/DriveBox/releases/tag/v2.1.0""
                }";

                var releaseInfo = JsonSerializer.Deserialize<GitHubRelease>(testResponse);
                
                if (releaseInfo == null) return Task.FromResult<UpdateInfo?>(null);

                var currentVersion = GetCurrentVersion();
                var latestVersion = ParseVersion(releaseInfo.TagName);

    

                if (latestVersion > currentVersion)
                {
                    return Task.FromResult<UpdateInfo?>(new UpdateInfo
                    {
                        CurrentVersion = currentVersion.ToString(),
                        LatestVersion = latestVersion.ToString(),
                        ReleaseNotes = releaseInfo.Body,
                        DownloadUrl = GITHUB_RELEASE_URL,
                        IsUpdateAvailable = true
                    });
                }

                return Task.FromResult<UpdateInfo?>(new UpdateInfo
                {
                    CurrentVersion = currentVersion.ToString(),
                    LatestVersion = latestVersion.ToString(),
                    IsUpdateAvailable = false
                });
            }
            catch (Exception)
            {

                return Task.FromResult<UpdateInfo?>(null);
            }
        }

        public void Dispose()
        {
            _httpClient?.Dispose();
            _downloadSemaphore?.Dispose();
        }
    }

    public class GitHubRelease
    {
        [System.Text.Json.Serialization.JsonPropertyName("tag_name")]
        public string TagName { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("body")]
        public string Body { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("html_url")]
        public string HtmlUrl { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("assets")]
        public List<GitHubAsset> Assets { get; set; } = new();
    }

    public class GitHubAsset
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("browser_download_url")]
        public string BrowserDownloadUrl { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("size")]
        public long Size { get; set; }
    }
} 