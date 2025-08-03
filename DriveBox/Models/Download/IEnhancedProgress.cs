using System;

namespace DriveBox.Models.Download
{

    public interface IEnhancedProgress<in T> : IProgress<T>
    {

        void Report(T value, DownloadProgressInfo progressInfo);


        void Report(T value, string fileName, string moduleName, string statusMessage);
    }


    public class EnhancedProgress<T> : IEnhancedProgress<T>
    {
        private readonly Action<T> _basicHandler;
        private readonly Action<T, DownloadProgressInfo> _detailedHandler;


        public EnhancedProgress(Action<T> handler)
        {
            _basicHandler = handler ?? throw new ArgumentNullException(nameof(handler));
        }


        public EnhancedProgress(Action<T, DownloadProgressInfo> detailedHandler)
        {
            _detailedHandler = detailedHandler ?? throw new ArgumentNullException(nameof(detailedHandler));
        }


        public EnhancedProgress(Action<T> basicHandler, Action<T, DownloadProgressInfo> detailedHandler)
        {
            _basicHandler = basicHandler;
            _detailedHandler = detailedHandler;
        }


        public void Report(T value)
        {
            _basicHandler?.Invoke(value);
        }


        public void Report(T value, DownloadProgressInfo progressInfo)
        {
            _basicHandler?.Invoke(value);
            _detailedHandler?.Invoke(value, progressInfo);
        }


        public void Report(T value, string fileName, string moduleName, string statusMessage)
        {
            _basicHandler?.Invoke(value);
            
            if (_detailedHandler != null)
            {
                var progressInfo = new DownloadProgressInfo
                {
                    CurrentFileName = fileName,
                    CurrentModule = moduleName,
                    StatusMessage = statusMessage
                };
                _detailedHandler.Invoke(value, progressInfo);
            }
        }
    }
}