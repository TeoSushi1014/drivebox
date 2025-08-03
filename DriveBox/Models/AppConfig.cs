

namespace DriveBox.Models
{
    public class AppConfig
    {
        public string ConfigurationsFolder { get; set; } = string.Empty;

        public string AppPropertiesFileName { get; set; } = string.Empty;
        
        public string DownloadPath { get; set; } = string.Empty;


        public DownloadSettings Download { get; set; } = new DownloadSettings();
    }

    public class DownloadSettings
    {
        /// <summary>
        /// Timeout for individual downloads in minutes (default: 60 minutes for large files)
        /// </summary>
        public int TimeoutMinutes { get; set; } = 60;

        /// <summary>
        /// Buffer size for file downloads in KB (default: 512KB for better performance with large video files)
        /// </summary>
        public int BufferSizeKB { get; set; } = 512;

        /// <summary>
        /// Maximum number of retry attempts for failed downloads (default: 3)
        /// </summary>
        public int MaxRetryAttempts { get; set; } = 3;

        /// <summary>
        /// Enable resume download capability for interrupted downloads (default: true)
        /// </summary>
        public bool EnableResumeDownload { get; set; } = true;

        /// <summary>
        /// Preserve partial downloads on cancellation (default: true)
        /// </summary>
        public bool PreservePartialDownloads { get; set; } = true;

        /// <summary>
        /// Frequency of cancellation checks in KB (default: 512KB)
        /// </summary>
        public int CancellationCheckFrequencyKB { get; set; } = 512;

        /// <summary>
        /// Maximum concurrent downloads to prevent resource exhaustion (default: 2)
        /// </summary>
        public int MaxConcurrentDownloads { get; set; } = 2;
    }
}
