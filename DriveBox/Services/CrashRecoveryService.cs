using System.IO;
using System.Text.Json;
using DriveBox.Models;

namespace DriveBox.Services
{

    public class CrashRecoveryService
    {
        private readonly string _crashRecoveryFile;
        private readonly AppConfigService _configService;
        
        public CrashRecoveryService(AppConfigService configService)
        {
            _configService = configService;
            _crashRecoveryFile = Path.Combine(AppContext.BaseDirectory, "recovery_session.json");
        }
        

        public void SaveSessionState(IEnumerable<AppInfo> apps, IEnumerable<object> activeDownloads)
        {
            try
            {
                var sessionData = new SessionRecoveryData
                {
                    SavedAt = DateTime.UtcNow,
                    Apps = apps.Where(a => a.IsInstalled).ToList(),
                    LastConfig = _configService.GetConfig()
                };
                
                var json = JsonSerializer.Serialize(sessionData, new JsonSerializerOptions 
                { 
                    WriteIndented = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });
                
                File.WriteAllText(_crashRecoveryFile, json);

            }
            catch (Exception)
            {

            }
        }
        
        /// <summary>
        /// Load previous session state if application crashed
        /// </summary>
        public SessionRecoveryData? LoadSessionState()
        {
            try
            {
                if (!File.Exists(_crashRecoveryFile))
                    return null;
                    
                var json = File.ReadAllText(_crashRecoveryFile);
                var sessionData = JsonSerializer.Deserialize<SessionRecoveryData>(json, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });
                

                if (sessionData != null && DateTime.UtcNow - sessionData.SavedAt < TimeSpan.FromHours(2))
                {

                    return sessionData;
                }
                else
                {

                    CleanupRecoveryFile();
                    return null;
                }
            }
            catch (Exception)
            {

                CleanupRecoveryFile();
                return null;
            }
        }
        

        public bool ShouldOfferRecovery()
        {
            var sessionData = LoadSessionState();
            return sessionData != null && sessionData.Apps?.Any(a => a.IsInstalled) == true;
        }
        

        public void CleanupRecoveryFile()
        {
            try
            {
                if (File.Exists(_crashRecoveryFile))
                {
                    File.Delete(_crashRecoveryFile);

                }
            }
            catch (Exception)
            {

            }
        }
        

        public async Task SaveSessionStateAsync(IEnumerable<AppInfo> apps, IEnumerable<object> activeDownloads)
        {
            await Task.Run(() => SaveSessionState(apps, activeDownloads));
        }
        
        public async Task<SessionRecoveryData?> LoadSessionStateAsync()
        {
            return await Task.Run(() => LoadSessionState());
        }
        
        public async Task ClearSessionStateAsync()
        {
            await Task.Run(() => CleanupRecoveryFile());
        }
    }
    

    public class SessionRecoveryData
    {
        public DateTime SavedAt { get; set; }
        public List<AppInfo>? Apps { get; set; }
        public AppConfig? LastConfig { get; set; }
    }
}