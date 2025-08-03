namespace DriveBox.Models
{
    public class UpdateInfo
    {
        public string CurrentVersion { get; set; } = string.Empty;
        public string LatestVersion { get; set; } = string.Empty;
        public string ReleaseNotes { get; set; } = string.Empty;
        public string DownloadUrl { get; set; } = string.Empty;
        public bool IsUpdateAvailable { get; set; }
    }

    public class UpdateProgressEventArgs : EventArgs
    {
        public int ProgressPercentage { get; set; }
        public string Status { get; set; } = string.Empty;
    }
} 