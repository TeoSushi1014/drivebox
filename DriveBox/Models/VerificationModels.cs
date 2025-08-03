using System;
using System.Collections.Generic;

namespace DriveBox.Models
{

    public enum TrustLevel
    {
        Blocked = 0,
        Unknown = 1,
        LowTrust = 2,
        Trusted = 3,
        HighlyTrusted = 4
    }


    public enum MalwareScanResult
    {
        NotScanned = 0,
        Clean = 1,
        Threat = 2,
        Error = 3
    }


    public class AppVerificationResult
    {
        public string AppId { get; set; } = string.Empty;
        public string AppName { get; set; } = string.Empty;
        public DateTime VerificationTimestamp { get; set; }
        public TrustLevel TrustLevel { get; set; }
        public bool IsVerified { get; set; }
        public string VerificationMessage { get; set; } = string.Empty;
        public List<VerificationResult> FileVerifications { get; set; } = new();
        public List<string> SecurityWarnings { get; set; } = new();
        public List<string> SecurityNotes { get; set; } = new();


        public string TrustLevelDescription => TrustLevel switch
        {
            TrustLevel.HighlyTrusted => "Hoàn toàn đáng tin cậy",
            TrustLevel.Trusted => "Đáng tin cậy",
            TrustLevel.LowTrust => "Độ tin cậy thấp",
            TrustLevel.Unknown => "Không xác định",
            TrustLevel.Blocked => "Bị chặn",
            _ => "Không xác định"
        };


        public string TrustLevelColor => TrustLevel switch
        {
            TrustLevel.HighlyTrusted => "#4CAF50",
            TrustLevel.Trusted => "#8BC34A",
            TrustLevel.LowTrust => "#FF9800",
            TrustLevel.Unknown => "#9E9E9E",
            TrustLevel.Blocked => "#F44336",
            _ => "#9E9E9E"
        };


        public string TrustLevelIcon => TrustLevel switch
        {
            TrustLevel.HighlyTrusted => "ShieldCheckmark24",
            TrustLevel.Trusted => "Shield24",
            TrustLevel.LowTrust => "Warning24",
            TrustLevel.Unknown => "Question24",
            TrustLevel.Blocked => "ShieldError24",
            _ => "Question24"
        };
    }


    public class VerificationResult
    {
        public string FilePath { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string FileHash { get; set; } = string.Empty;
        public DateTime VerificationTimestamp { get; set; }
        public TrustLevel TrustLevel { get; set; }
        public bool IsValid { get; set; }


        public bool HasDigitalSignature { get; set; }
        public bool IsSignatureValid { get; set; }
        public string Publisher { get; set; } = string.Empty;
        public string IssuerName { get; set; } = string.Empty;
        public bool IsTrustedPublisher { get; set; }


        public bool IsChecksumValid { get; set; }
        public string ChecksumSHA256 { get; set; } = string.Empty;
        public string ChecksumMD5 { get; set; } = string.Empty;
        public string ChecksumSHA1 { get; set; } = string.Empty;
        public string ExpectedChecksum { get; set; } = string.Empty;


        public int ReputationScore { get; set; }
        public string DownloadSource { get; set; } = string.Empty;
        public bool IsTrustedSource { get; set; }


        public MalwareScanResult MalwareScanResult { get; set; }


        public List<string> SecurityWarnings { get; set; } = new();
        public List<string> SecurityNotes { get; set; } = new();


        public string VerificationSummary
        {
            get
            {
                var details = new List<string>();
                
                if (HasDigitalSignature)
                {
                    details.Add(IsSignatureValid ? "Chữ ký số hợp lệ" : "Chữ ký số không hợp lệ");
                    if (IsTrustedPublisher)
                        details.Add("Nhà xuất bản đáng tin cậy");
                }
                else
                {
                    details.Add("Không có chữ ký số");
                }

                if (IsChecksumValid)
                    details.Add("Checksum hợp lệ");
                else if (!string.IsNullOrEmpty(ExpectedChecksum))
                    details.Add("Checksum không khớp");

                if (IsTrustedSource)
                    details.Add("Nguồn tải tin cậy");

                switch (MalwareScanResult)
                {
                    case MalwareScanResult.Clean:
                        details.Add("Sạch virus");
                        break;
                    case MalwareScanResult.Threat:
                        details.Add("Phát hiện mối đe dọa");
                        break;
                    case MalwareScanResult.Error:
                        details.Add("Lỗi quét virus");
                        break;
                }

                if (ReputationScore > 0)
                    details.Add($"Điểm uy tín: {ReputationScore}/100");

                return string.Join("\n", details);
            }
        }
    }


    public class VerificationSettings
    {
        public bool EnableDigitalSignatureCheck { get; set; } = true;
        public bool EnableChecksumVerification { get; set; } = true;
        public bool EnableMalwareScan { get; set; } = true;
        public bool EnableReputationCheck { get; set; } = true;
        public bool EnableSourceVerification { get; set; } = true;
        public bool BlockUntrustedApps { get; set; } = false;
        public bool WarnOnLowTrust { get; set; } = true;
        public int MinimumTrustLevel { get; set; } = (int)TrustLevel.LowTrust;
        public List<string> TrustedPublishers { get; set; } = new();
        public List<string> TrustedSources { get; set; } = new();
        public List<string> BlockedPublishers { get; set; } = new();
    }
}