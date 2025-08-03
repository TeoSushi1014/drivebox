using DriveBox.Models;
using System.IO;
using System.Text.Json;

namespace DriveBox.Services
{
    public class AppConfigService
    {
        private const string ConfigFileName = "appsettings.json";
        private readonly string _configFilePath;
        private AppConfig _config;

        public AppConfigService()
        {
            var appDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "DriveBox"
            );
            
            Directory.CreateDirectory(appDataPath);
            _configFilePath = Path.Combine(appDataPath, ConfigFileName);
            
            _config = LoadConfig();
        }

        public AppConfig GetConfig() => _config;

        public void UpdateConfig(AppConfig config)
        {
            _config = config;
            SaveConfig();
        }

        public void UpdateDownloadPath(string downloadPath)
        {

            if (!downloadPath.Contains("TeoSushi") || !downloadPath.Contains("DriveBox"))
            {
                downloadPath = Path.Combine(downloadPath, "TeoSushi", "DriveBox");
            }
            
            _config.DownloadPath = downloadPath;
            SaveConfig();
        }

        private AppConfig LoadConfig()
        {
            try
            {
                if (File.Exists(_configFilePath))
                {
                    var json = File.ReadAllText(_configFilePath);
                    var config = JsonSerializer.Deserialize<AppConfig>(json);
                    
                    if (config != null)
                    {
                        // Ensure DownloadPath has a value
                        if (string.IsNullOrEmpty(config.DownloadPath))
                        {
                            config.DownloadPath = GetDefaultDownloadPath();
                        }
                        // Validate download path still includes required structure
                        else if (!config.DownloadPath.Contains("TeoSushi") || !config.DownloadPath.Contains("DriveBox"))
                        {
                            config.DownloadPath = GetDefaultDownloadPath();
                        }
                        
                        return config;
                    }
                }
            }
            catch (Exception)
            {
                // If loading fails, use default config
            }

            return new AppConfig
            {
                DownloadPath = GetDefaultDownloadPath()
            };
        }

        public void SaveConfig()
        {
            try
            {
                var json = JsonSerializer.Serialize(_config, new JsonSerializerOptions 
                { 
                    WriteIndented = true 
                });
                File.WriteAllText(_configFilePath, json);
            }
            catch (Exception)
            {
                // Handle save errors silently
            }
        }

        public string GetAppInstallPath(AppInfo app)
        {
            var basePath = string.IsNullOrEmpty(_config.DownloadPath) 
                ? GetDefaultDownloadPath() 
                : _config.DownloadPath;
            
            return Path.Combine(basePath, app.Id);
        }

        private static string GetDefaultDownloadPath()
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "TeoSushi",
                "DriveBox"
            );
        }
    }
}