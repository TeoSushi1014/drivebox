using System;

namespace DriveBox.Models.Download
{

    public class DownloadProgressInfo
    {
        private DateTime _startTime;
        private DateTime _lastUpdateTime;
        private long _lastBytesDownloaded;
        private readonly object _lockObject = new();

        public DownloadProgressInfo()
        {
            _startTime = DateTime.Now;
            _lastUpdateTime = DateTime.Now;
            _lastBytesDownloaded = 0;
        }


        public double ProgressPercentage { get; private set; }


        public long BytesDownloaded { get; private set; }


        public long TotalBytes { get; private set; }


        public double SpeedBytesPerSecond { get; private set; }


        public TimeSpan EstimatedTimeRemaining { get; private set; }


        public string CurrentFileName { get; set; } = string.Empty;


        public string CurrentModule { get; set; } = string.Empty;


        public string StatusMessage { get; set; } = string.Empty;


        public string FormattedSpeed => FormatSpeed(SpeedBytesPerSecond);


        public string FormattedEta => FormatEta(EstimatedTimeRemaining);


        public string FormattedSize => $"{FormatFileSize(BytesDownloaded)} / {FormatFileSize(TotalBytes)}";


        public void UpdateProgress(long bytesDownloaded, long totalBytes)
        {
            lock (_lockObject)
            {
                var now = DateTime.Now;
                var timeDiff = (now - _lastUpdateTime).TotalSeconds;


                if (timeDiff >= 0.5)
                {
                    var bytesDiff = bytesDownloaded - _lastBytesDownloaded;
                    
                    if (timeDiff > 0 && bytesDiff > 0)
                    {

                        var currentSpeed = bytesDiff / timeDiff;
                        

                        if (SpeedBytesPerSecond == 0)
                        {
                            SpeedBytesPerSecond = currentSpeed;
                        }
                        else
                        {
                            const double smoothingFactor = 0.3;
                            SpeedBytesPerSecond = (smoothingFactor * currentSpeed) + ((1 - smoothingFactor) * SpeedBytesPerSecond);
                        }
                    }

                    _lastUpdateTime = now;
                    _lastBytesDownloaded = bytesDownloaded;
                }


                BytesDownloaded = bytesDownloaded;
                TotalBytes = totalBytes;
                
                if (totalBytes > 0)
                {
                    ProgressPercentage = Math.Min(100.0, (double)bytesDownloaded / totalBytes * 100.0);
                }


                if (SpeedBytesPerSecond > 0 && totalBytes > bytesDownloaded)
                {
                    var remainingBytes = totalBytes - bytesDownloaded;
                    var remainingSeconds = remainingBytes / SpeedBytesPerSecond;
                    EstimatedTimeRemaining = TimeSpan.FromSeconds(remainingSeconds);
                }
                else
                {
                    EstimatedTimeRemaining = TimeSpan.Zero;
                }
            }
        }


        public void Reset()
        {
            lock (_lockObject)
            {
                _startTime = DateTime.Now;
                _lastUpdateTime = DateTime.Now;
                _lastBytesDownloaded = 0;
                
                ProgressPercentage = 0;
                BytesDownloaded = 0;
                TotalBytes = 0;
                SpeedBytesPerSecond = 0;
                EstimatedTimeRemaining = TimeSpan.Zero;
                CurrentFileName = string.Empty;
                CurrentModule = string.Empty;
                StatusMessage = string.Empty;
            }
        }


        private static string FormatSpeed(double bytesPerSecond)
        {
            if (bytesPerSecond == 0) return "-- B/s";

            string[] sizes = { "B/s", "KB/s", "MB/s", "GB/s" };
            int order = 0;
            double speed = bytesPerSecond;

            while (speed >= 1024 && order < sizes.Length - 1)
            {
                order++;
                speed /= 1024;
            }

            return $"{speed:0.##} {sizes[order]}";
        }


        private static string FormatEta(TimeSpan timeRemaining)
        {
            if (timeRemaining == TimeSpan.Zero || timeRemaining.TotalSeconds < 1)
                return "-- còn lại";

            if (timeRemaining.TotalDays >= 1)
                return $"còn {timeRemaining.Days} ngày {timeRemaining.Hours} giờ";

            if (timeRemaining.TotalHours >= 1)
                return $"còn {timeRemaining.Hours} giờ {timeRemaining.Minutes} phút";

            if (timeRemaining.TotalMinutes >= 1)
                return $"còn {timeRemaining.Minutes} phút {timeRemaining.Seconds} giây";

            return $"còn {timeRemaining.Seconds} giây";
        }


        private static string FormatFileSize(long bytes)
        {
            if (bytes == 0) return "0 B";

            string[] sizes = { "B", "KB", "MB", "GB", "TB" };
            int order = 0;
            double size = bytes;

            while (size >= 1024 && order < sizes.Length - 1)
            {
                order++;
                size /= 1024;
            }

            return $"{size:0.##} {sizes[order]}";
        }


        public TimeSpan ElapsedTime => DateTime.Now - _startTime;


        public double AverageSpeedBytesPerSecond
        {
            get
            {
                var elapsed = ElapsedTime.TotalSeconds;
                return elapsed > 0 ? BytesDownloaded / elapsed : 0;
            }
        }


        public string FormattedAverageSpeed => FormatSpeed(AverageSpeedBytesPerSecond);
    }
}