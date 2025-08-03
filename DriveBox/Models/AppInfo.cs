using System.Collections.ObjectModel;
using System.Linq;
using CommunityToolkit.Mvvm.ComponentModel;

namespace DriveBox.Models
{
    public partial class AppInfo : ObservableObject
    {
        public string Id { get; set; } = string.Empty;
        public string TenHienThi { get; set; } = string.Empty;
        public string FileThucThiChinh { get; set; } = string.Empty;
        public string MoTa { get; set; } = string.Empty;
        public string PhienBan { get; set; } = string.Empty;
        public string ThuMucCaiDat { get; set; } = string.Empty;
        public string PhanLoai { get; set; } = string.Empty;
        public string IconPath { get; set; } = string.Empty;
        public ObservableCollection<AppModule> Modules { get; set; } = new();
        

        [ObservableProperty]
        private bool _isInstalled;
        
        [ObservableProperty]
        private bool _isUninstalling;
        
        [ObservableProperty]
        private bool _isDownloading;
        
        [ObservableProperty]
        private string _status = string.Empty;
        
        [ObservableProperty]
        private string _errorMessage = string.Empty;

        [ObservableProperty]
        private string _installPath = string.Empty;

        [ObservableProperty]
        private long _installedSize;


        public AppVerificationResult? VerificationResult { get; set; }
        
        [ObservableProperty]
        private long _totalSize;
        public string TotalSizeFormatted => TotalSize > 0 ? FormatFileSize(TotalSize) : "Không tính được";
        
        public string DetailedSizeInfo => TotalSize > 0 ? 
            $"{FormatFileSize(TotalSize)} ({TotalSize:N0} bytes)" : "Đang tính toán...";
            
        public string ModuleCountInfo => $"{Modules.Count} thành phần";
        

        public string ModuleInfoDisplay => Modules.Count > 1 
            ? $" • {Modules.Count} thành phần" 
            : string.Empty;
        
        public bool HasRealSize => TotalSize > 0;
        
        public bool CanUninstall => IsInstalled && !IsUninstalling;
        public bool CanOpen => IsInstalled;
        public bool CanVerify => IsInstalled;
        
        public bool ShowInstalledStatus => IsInstalled;
        
        public string InstalledSizeFormatted => InstalledSize > 0 ? FormatFileSize(InstalledSize) : "Chưa cài đặt";
        
        partial void OnTotalSizeChanged(long value)
        {
            OnPropertyChanged(nameof(TotalSizeFormatted));
            OnPropertyChanged(nameof(DetailedSizeInfo));
            OnPropertyChanged(nameof(HasRealSize));
        }
        
        partial void OnInstalledSizeChanged(long value)
        {
            OnPropertyChanged(nameof(InstalledSizeFormatted));
        }
        
        partial void OnIsInstalledChanged(bool value)
        {
            OnPropertyChanged(nameof(CanUninstall));
            OnPropertyChanged(nameof(CanOpen));
            OnPropertyChanged(nameof(CanVerify));
            OnPropertyChanged(nameof(ShowInstalledStatus));
            
            if (value)
            {
                Status = "Đã cài đặt ✓";
            }
            else if (!IsUninstalling)
            {
                Status = "Chưa cài đặt";
            }
        }
        
        partial void OnIsUninstallingChanged(bool value)
        {
            OnPropertyChanged(nameof(CanUninstall));
            OnPropertyChanged(nameof(CanOpen));
            OnPropertyChanged(nameof(CanVerify));
            
            if (value)
            {
                Status = "Đang gỡ cài đặt...";
            }
            else if (!IsInstalled)
            {
                Status = "Chưa cài đặt";
            }
        }
        
        private static string FormatFileSize(long bytes)
        {
            if (bytes == 0) return "0 B";
            
            string[] sizes = { "B", "KB", "MB", "GB" };
            int order = 0;
            double size = bytes;
            
            while (size >= 1024 && order < sizes.Length - 1)
            {
                order++;
                size /= 1024;
            }
            
            return $"{size:0.##} {sizes[order]}";
        }
    }

    public partial class AppModule : ObservableObject
    {
        public string Id { get; set; } = string.Empty;
        public string TenModule { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public string ChecksumSha256 { get; set; } = string.Empty;
        
        [ObservableProperty]
        private string _status = string.Empty;
        
        [ObservableProperty]
        private bool _isDownloaded = false;
        
        public long Size { get; set; }
        public string SizeFormatted => Size > 0 ? FormatFileSize(Size) : "Đang tính...";
        
        public ModulePriority Priority => GetModulePriority();
        public LoadPhase LoadPhase => GetLoadPhase();
        public bool IsRequired => Priority == ModulePriority.Critical || Priority == ModulePriority.Essential;
        public bool IsOptional => Priority == ModulePriority.Optional;
        public bool ShouldLoadImmediately => LoadPhase == LoadPhase.Immediate;
        public bool ShouldLoadProgressively => LoadPhase == LoadPhase.Progressive;
        public bool ShouldLoadOnDemand => LoadPhase == LoadPhase.OnDemand;
        public string PriorityDescription => Priority switch 
        {
            ModulePriority.Critical => "Cần thiết",
            ModulePriority.Essential => "Quan trọng", 
            ModulePriority.Optional => "Tùy chọn",
            _ => "Không xác định"
        };
        
        private ModulePriority GetModulePriority()
        {
            if (Type == "dependency_installer") 
                return ModulePriority.Critical;
                
            if (Id.Contains("core") || Id.Contains("app_") && !Id.Contains("videos")) 
                return ModulePriority.Essential;
                
            if (Id.Contains("videos_pack") || Id.Contains("content_")) 
                return ModulePriority.Optional;
                
            return ModulePriority.Essential;
        }

        private LoadPhase GetLoadPhase()
        {
            switch (Priority)
            {
                case ModulePriority.Critical:
                    return LoadPhase.Immediate;
                    
                case ModulePriority.Essential:
                    return Size < 50 * 1024 * 1024 ? LoadPhase.Immediate : LoadPhase.Progressive;
                    
                case ModulePriority.Optional:
                    return LoadPhase.OnDemand;
                    
                default:
                    return LoadPhase.Progressive;
            }
        }
        
        private static string FormatFileSize(long bytes)
        {
            if (bytes == 0) return "0 B";
            
            string[] sizes = { "B", "KB", "MB", "GB" };
            int order = 0;
            double size = bytes;
            
            while (size >= 1024 && order < sizes.Length - 1)
            {
                order++;
                size /= 1024;
            }
            
            return $"{size:0.##} {sizes[order]}";
        }
    }
    
    public enum ModulePriority
    {
        Critical = 1,    // Dependencies - must install first, sequential
        Essential = 2,   // Core app - install after dependencies 
        Optional = 3     // Content - can install separately
    }

    public enum LoadPhase
    {
        Immediate = 1,    // Load immediately on startup
        Progressive = 2,  // Load in background after UI is ready
        OnDemand = 3     // Load only when user requests
    }

    public class AppCatalog
    {
        public List<AppInfo> Applications { get; set; } = new();
    }
}