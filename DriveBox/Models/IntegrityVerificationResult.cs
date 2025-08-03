using System.Collections.Generic;

namespace DriveBox.Models
{
    /// <summary>
    /// Result of integrity verification for an installed application
    /// Focuses on file completeness and dependency validation rather than security
    /// </summary>
    public class IntegrityVerificationResult
    {
        public string AppId { get; set; } = string.Empty;
        public string AppName { get; set; } = string.Empty;
        public bool IsComplete { get; set; } = true;
        public DateTime VerificationTimestamp { get; set; } = DateTime.UtcNow;

    
        public int TotalFiles { get; set; } = 0;
        public int ExistingFiles { get; set; } = 0;
        public int MissingFiles { get; set; } = 0;
        public int CorruptedFiles { get; set; } = 0;

      
        public int TotalDependencies { get; set; } = 0;
        public int InstalledDependencies { get; set; } = 0;
        public int MissingDependencies { get; set; } = 0;

    
        public List<string> MissingComponents { get; set; } = new();
        public List<string> CorruptedComponents { get; set; } = new();
        public List<string> MissingDependencyComponents { get; set; } = new();

    
        public List<FileIntegrityResult> FileResults { get; set; } = new();
        public List<DependencyIntegrityResult> DependencyResults { get; set; } = new();

        public string Summary => IsComplete 
            ? "Tất cả file và dependencies đã đầy đủ"
            : $"Thiếu {MissingComponents.Count} thành phần, {CorruptedFiles} file bị hỏng";
    }

    /// <summary>
    /// Individual file integrity check result
    /// </summary>
    public class FileIntegrityResult
    {
        public string FilePath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public bool Exists { get; set; } = false;
        public bool ChecksumValid { get; set; } = false;
        public string ExpectedChecksum { get; set; } = string.Empty;
        public string ActualChecksum { get; set; } = string.Empty;
        public long ExpectedSize { get; set; } = 0;
        public long ActualSize { get; set; } = 0;
        public string Status { get; set; } = string.Empty;
    }

    /// <summary>
    /// Dependency integrity check result
    /// </summary>
    public class DependencyIntegrityResult
    {
        public string DependencyName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public bool IsInstalled { get; set; } = false;
        public string InstallPath { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public bool CanAutoInstall { get; set; } = true;
    }
}