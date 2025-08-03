using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Threading.Tasks;
using DriveBox.Models;

namespace DriveBox.Services
{
    /// <summary>
    /// App Verification Service implementing security features similar to Windows Smart App Control
    /// Provides digital signature verification, enhanced checksum validation, and trust assessment
    /// </summary>
    public class AppVerificationService
    {
        private readonly AppConfigService _configService;
        private readonly List<string> _trustedPublishers;
        private readonly Dictionary<string, VerificationResult> _verificationCache;

        public AppVerificationService(AppConfigService configService)
        {
            _configService = configService;
            _trustedPublishers = InitializeTrustedPublishers();
            _verificationCache = new Dictionary<string, VerificationResult>();
        }

        /// <summary>
        /// Comprehensive app verification combining multiple security checks
        /// </summary>
        /// <param name="appInfo">Application information</param>
        /// <param name="filePaths">List of file paths to verify</param>
        /// <returns>Verification result with trust level and details</returns>
        public async Task<AppVerificationResult> VerifyAppAsync(AppInfo appInfo, List<string> filePaths)
        {
            var result = new AppVerificationResult
            {
                AppId = appInfo.Id,
                AppName = appInfo.TenHienThi,
                VerificationTimestamp = DateTime.UtcNow,
                TrustLevel = TrustLevel.Unknown
            };

            try
            {
                var verificationTasks = new List<Task<VerificationResult>>();

                foreach (var filePath in filePaths.Where(File.Exists))
                {
                    // Check cache first
                    var fileHash = await ComputeFileHashAsync(filePath);
                    if (_verificationCache.TryGetValue(fileHash, out var cachedResult))
                    {
                        result.FileVerifications.Add(cachedResult);
                        continue;
                    }

                    // Perform verification
                    var verificationTask = VerifyFileAsync(filePath, appInfo);
                    verificationTasks.Add(verificationTask);
                }

                // Wait for all verifications to complete
                var fileResults = await Task.WhenAll(verificationTasks);
                foreach (var fileResult in fileResults)
                {
                    result.FileVerifications.Add(fileResult);
                    
                    // Cache the result
                    _verificationCache[fileResult.FileHash] = fileResult;
                }

                // Calculate overall trust level
                result.TrustLevel = CalculateOverallTrustLevel(result.FileVerifications);
                result.IsVerified = result.TrustLevel >= TrustLevel.Trusted;
                result.VerificationMessage = GenerateVerificationMessage(result);

                LogVerificationResult(result);
                return result;
            }
            catch (Exception ex)
            {
                result.TrustLevel = TrustLevel.Blocked;
                result.IsVerified = false;
                result.VerificationMessage = $"Verification failed: {ex.Message}";
                result.SecurityWarnings.Add($"Verification error: {ex.Message}");
                

                return result;
            }
        }

        /// <summary>
        /// Verify individual file with multiple security checks
        /// </summary>
        private async Task<VerificationResult> VerifyFileAsync(string filePath, AppInfo appInfo)
        {
            var result = new VerificationResult
            {
                FilePath = filePath,
                FileName = Path.GetFileName(filePath),
                FileHash = await ComputeFileHashAsync(filePath),
                VerificationTimestamp = DateTime.UtcNow
            };

            try
            {
                // 1. Digital Signature Verification (Primary security check)
                await VerifyDigitalSignatureAsync(result);

                // 2. Enhanced Checksum Verification  
                await VerifyEnhancedChecksumAsync(result, appInfo);

                // 3. File Reputation Check (simulated cloud-based check)
                await CheckFileReputationAsync(result);

                // 4. Malware Scan Integration
                await ScanForMalwareAsync(result);

                // 5. Installation Source Verification
                VerifyInstallationSource(result, appInfo);

                // Calculate file-level trust
                result.TrustLevel = CalculateFileTrustLevel(result);
                result.IsValid = result.TrustLevel >= TrustLevel.Trusted;

            }
            catch (Exception ex)
            {
                result.TrustLevel = TrustLevel.Blocked;
                result.IsValid = false;
                result.SecurityWarnings.Add($"File verification error: {ex.Message}");

            }

            return result;
        }

        /// <summary>
        /// Digital signature verification - Primary security mechanism like Windows Smart App Control
        /// </summary>
        private async Task VerifyDigitalSignatureAsync(VerificationResult result)
        {
            await Task.Run(() =>
            {
                try
                {
                    // Check if file has a digital signature
                    var certificate = GetFileCertificate(result.FilePath);
                    
                    if (certificate != null)
                    {
                        result.HasDigitalSignature = true;
                        result.Publisher = certificate.Subject;
                        result.IssuerName = certificate.Issuer;
                        
                        // Verify certificate chain and validity
                        using (var chain = new X509Chain())
                        {
                            chain.ChainPolicy.RevocationMode = X509RevocationMode.Online;
                            chain.ChainPolicy.RevocationFlag = X509RevocationFlag.ExcludeRoot;
                            
                            var isValidChain = chain.Build(certificate);
                            result.IsSignatureValid = isValidChain;
                            
                            if (!isValidChain)
                            {
                                var chainErrors = string.Join(", ", chain.ChainStatus.Select(s => s.StatusInformation));
                                result.SecurityWarnings.Add($"Certificate chain invalid: {chainErrors}");
                            }
                        }

                        // Check if publisher is trusted
                        result.IsTrustedPublisher = _trustedPublishers.Any(tp => 
                            certificate.Subject.Contains(tp, StringComparison.OrdinalIgnoreCase));
                            
                        if (result.IsTrustedPublisher)
                        {
                            result.SecurityNotes.Add("Publisher is in trusted list");
                        }
                    }
                    else
                    {
                        result.HasDigitalSignature = false;
                        result.SecurityWarnings.Add("File is not digitally signed");
                    }
                }
                catch (Exception ex)
                {
                    result.SecurityWarnings.Add($"Signature verification failed: {ex.Message}");
                }
            });
        }

        /// <summary>
        /// Enhanced checksum verification with multiple hash algorithms
        /// </summary>
        private async Task VerifyEnhancedChecksumAsync(VerificationResult result, AppInfo appInfo)
        {
            try
            {
                var module = appInfo.Modules.FirstOrDefault(m => 
                    result.FileName.Contains(Path.GetFileNameWithoutExtension(m.Url), StringComparison.OrdinalIgnoreCase));

                if (module != null && !string.IsNullOrEmpty(module.ChecksumSha256))
                {
                    // SHA256 verification (existing)
                    var sha256Hash = await ComputeSHA256Async(result.FilePath);
                    result.ChecksumSHA256 = sha256Hash;
                    result.ExpectedChecksum = module.ChecksumSha256;
                    result.IsChecksumValid = string.Equals(sha256Hash, module.ChecksumSha256, StringComparison.OrdinalIgnoreCase);

                    if (result.IsChecksumValid)
                    {
                        result.SecurityNotes.Add("SHA256 checksum verified");
                    }
                    else
                    {
                        result.SecurityWarnings.Add("SHA256 checksum mismatch - file may be corrupted or tampered");
                    }

                    // Additional hash algorithms for enhanced security
                    result.ChecksumMD5 = await ComputeMD5Async(result.FilePath);
                    result.ChecksumSHA1 = await ComputeSHA1Async(result.FilePath);
                }
                else
                {
                    result.SecurityWarnings.Add("No expected checksum available for verification");
                }
            }
            catch (Exception ex)
            {
                result.SecurityWarnings.Add($"Checksum verification failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Simulated cloud-based file reputation check (like Smart App Control)
        /// </summary>
        private async Task CheckFileReputationAsync(VerificationResult result)
        {
            await Task.Delay(100); // Simulate network call

            try
            {
                // Simulate reputation scoring based on file characteristics
                var reputationScore = CalculateReputationScore(result);
                result.ReputationScore = reputationScore;

                if (reputationScore >= 80)
                {
                    result.SecurityNotes.Add("High reputation score - widely trusted file");
                }
                else if (reputationScore >= 60)
                {
                    result.SecurityNotes.Add("Medium reputation score - moderately trusted");
                }
                else if (reputationScore >= 40)
                {
                    result.SecurityWarnings.Add("Low reputation score - proceed with caution");
                }
                else
                {
                    result.SecurityWarnings.Add("Very low reputation - potential security risk");
                }
            }
            catch (Exception ex)
            {
                result.SecurityWarnings.Add($"Reputation check failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Malware scanning integration with Windows Defender
        /// </summary>
        private async Task ScanForMalwareAsync(VerificationResult result)
        {
            await Task.Run(() =>
            {
                try
                {
                    // Attempt to scan with Windows Defender via command line
                    var scanResult = RunWindowsDefenderScan(result.FilePath);
                    result.MalwareScanResult = scanResult;

                    if (scanResult == MalwareScanResult.Clean)
                    {
                        result.SecurityNotes.Add("Malware scan: Clean");
                    }
                    else if (scanResult == MalwareScanResult.Threat)
                    {
                        result.SecurityWarnings.Add("Malware scan: Threat detected");
                    }
                    else
                    {
                        result.SecurityWarnings.Add("Malware scan: Unable to complete scan");
                    }
                }
                catch (Exception ex)
                {
                    result.SecurityWarnings.Add($"Malware scan failed: {ex.Message}");
                    result.MalwareScanResult = MalwareScanResult.Error;
                }
            });
        }

        /// <summary>
        /// Verify installation source trustworthiness
        /// </summary>
        private void VerifyInstallationSource(VerificationResult result, AppInfo appInfo)
        {
            try
            {
                var module = appInfo.Modules.FirstOrDefault(m => 
                    result.FileName.Contains(Path.GetFileNameWithoutExtension(m.Url), StringComparison.OrdinalIgnoreCase));

                if (module != null)
                {
                    var sourceUri = new Uri(module.Url);
                    result.DownloadSource = sourceUri.Host;

                    // Check if source is from trusted domains
                    var trustedDomains = new[] { "github.com", "microsoft.com", "windows.com" };
                    result.IsTrustedSource = trustedDomains.Any(domain => 
                        sourceUri.Host.Contains(domain, StringComparison.OrdinalIgnoreCase));

                    if (result.IsTrustedSource)
                    {
                        result.SecurityNotes.Add($"Downloaded from trusted source: {result.DownloadSource}");
                    }
                    else
                    {
                        result.SecurityWarnings.Add($"Downloaded from untrusted source: {result.DownloadSource}");
                    }

                    // Check HTTPS usage
                    if (sourceUri.Scheme == "https")
                    {
                        result.SecurityNotes.Add("Secure HTTPS download");
                    }
                    else
                    {
                        result.SecurityWarnings.Add("Insecure HTTP download");
                    }
                }
            }
            catch (Exception ex)
            {
                result.SecurityWarnings.Add($"Source verification failed: {ex.Message}");
            }
        }

        #region Helper Methods

        private X509Certificate2? GetFileCertificate(string filePath)
        {
            try
            {
                // Use the new X509CertificateLoader instead of obsolete CreateFromSignedFile
                return X509CertificateLoader.LoadCertificateFromFile(filePath);
            }
            catch
            {
                return null;
            }
        }

        private async Task<string> ComputeFileHashAsync(string filePath)
        {
            return await ComputeSHA256Async(filePath);
        }

        private async Task<string> ComputeSHA256Async(string filePath)
        {
            using var sha256 = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            var hash = await sha256.ComputeHashAsync(stream);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }

        private async Task<string> ComputeMD5Async(string filePath)
        {
            using var md5 = MD5.Create();
            using var stream = File.OpenRead(filePath);
            var hash = await md5.ComputeHashAsync(stream);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }

        private async Task<string> ComputeSHA1Async(string filePath)
        {
            using var sha1 = SHA1.Create();
            using var stream = File.OpenRead(filePath);
            var hash = await sha1.ComputeHashAsync(stream);
            return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
        }

        private int CalculateReputationScore(VerificationResult result)
        {
            var score = 50; // Base score

            // Digital signature adds significant trust
            if (result.HasDigitalSignature && result.IsSignatureValid)
                score += 30;
            
            if (result.IsTrustedPublisher)
                score += 20;

            // Checksum verification
            if (result.IsChecksumValid)
                score += 15;

            // Trusted source
            if (result.IsTrustedSource)
                score += 10;

            // File age and size factors
            try
            {
                var fileInfo = new FileInfo(result.FilePath);
                var daysSinceCreation = (DateTime.Now - fileInfo.CreationTime).Days;
                
                // Newer files are slightly less trusted until proven
                if (daysSinceCreation > 30)
                    score += 5;
                
                // Very large or very small files may be suspicious
                if (fileInfo.Length > 1024 && fileInfo.Length < 500 * 1024 * 1024) // 1KB to 500MB
                    score += 5;
            }
            catch { /* Ignore file info errors */ }

            return Math.Min(100, Math.Max(0, score));
        }

        private TrustLevel CalculateFileTrustLevel(VerificationResult result)
        {
            // Blocking conditions
            if (result.MalwareScanResult == MalwareScanResult.Threat)
                return TrustLevel.Blocked;

            if (result.SecurityWarnings.Any(w => w.Contains("Threat detected") || w.Contains("tampered")))
                return TrustLevel.Blocked;

            // High trust conditions
            if (result.HasDigitalSignature && result.IsSignatureValid && 
                result.IsTrustedPublisher && result.IsChecksumValid)
                return TrustLevel.HighlyTrusted;

            // Trusted conditions
            if ((result.HasDigitalSignature && result.IsSignatureValid) || 
                (result.IsChecksumValid && result.IsTrustedSource))
                return TrustLevel.Trusted;

            // Enhanced low trust conditions - more lenient for common scenarios
            if (result.IsChecksumValid || result.IsTrustedSource || 
                (result.HasDigitalSignature && result.IsSignatureValid) ||
                (result.ReputationScore >= 60)) // Files with decent reputation
                return TrustLevel.LowTrust;

            // Enhanced Unknown -> LowTrust upgrade conditions
            if (result.HasDigitalSignature || 
                result.ReputationScore >= 50 ||
                result.MalwareScanResult == MalwareScanResult.Clean ||
                (result.SecurityWarnings.Count == 0 && result.MalwareScanResult != MalwareScanResult.Threat))
                return TrustLevel.LowTrust;

            // Default to unknown only for truly problematic files
            return TrustLevel.Unknown;
        }

        private TrustLevel CalculateOverallTrustLevel(List<VerificationResult> fileResults)
        {
            if (!fileResults.Any())
                return TrustLevel.Unknown;

            // If any file is blocked, block the entire app
            if (fileResults.Any(r => r.TrustLevel == TrustLevel.Blocked))
                return TrustLevel.Blocked;

            // Count files by trust level
            var highlyTrustedCount = fileResults.Count(r => r.TrustLevel == TrustLevel.HighlyTrusted);
            var trustedCount = fileResults.Count(r => r.TrustLevel == TrustLevel.Trusted);
            var lowTrustCount = fileResults.Count(r => r.TrustLevel == TrustLevel.LowTrust);
            var unknownCount = fileResults.Count(r => r.TrustLevel == TrustLevel.Unknown);
            var totalFiles = fileResults.Count;

            // If majority of files are highly trusted or trusted
            if ((highlyTrustedCount + trustedCount) >= totalFiles * 0.7)
            {
                return highlyTrustedCount >= totalFiles * 0.5 ? TrustLevel.HighlyTrusted : TrustLevel.Trusted;
            }

            // If majority are at least low trust
            if ((highlyTrustedCount + trustedCount + lowTrustCount) >= totalFiles * 0.6)
            {
                return TrustLevel.LowTrust;
            }

            // Enhanced logic: Even with some unknown files, if we have any trusted files and no malware detected
            if ((highlyTrustedCount + trustedCount) > 0 && 
                !fileResults.Any(r => r.MalwareScanResult == MalwareScanResult.Threat))
            {
                return TrustLevel.LowTrust;
            }

            // Default to unknown only if majority of files are truly unknown/problematic
            return TrustLevel.Unknown;
        }

        private MalwareScanResult RunWindowsDefenderScan(string filePath)
        {
            try
            {
                // Attempt to run Windows Defender scan
                var startInfo = new ProcessStartInfo
                {
                    FileName = "MpCmdRun.exe",
                    Arguments = $"-Scan -ScanType 3 -File \"{filePath}\"",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };

                using var process = Process.Start(startInfo);
                if (process != null)
                {
                    process.WaitForExit(30000); // 30 second timeout
                    
                    return process.ExitCode switch
                    {
                        0 => MalwareScanResult.Clean,
                        2 => MalwareScanResult.Threat,
                        _ => MalwareScanResult.Error
                    };
                }
            }
            catch
            {
                // Windows Defender command line might not be available
            }

            return MalwareScanResult.NotScanned;
        }

        private List<string> InitializeTrustedPublishers()
        {
            return new List<string>
            {
                "Microsoft Corporation",
                "Microsoft Windows",
                "Adobe Systems",
                "Google LLC",
                "Mozilla Corporation",
                "VLC media player",
                "7-Zip",
                "WinRAR GmbH"
            };
        }

        private string GenerateVerificationMessage(AppVerificationResult result)
        {
            return result.TrustLevel switch
            {
                            TrustLevel.HighlyTrusted => "Ứng dụng đã được xác thực hoàn toàn và an toàn",
            TrustLevel.Trusted => "Ứng dụng đã được xác thực và đáng tin cậy", 
                TrustLevel.LowTrust => "Ứng dụng có độ tin cậy thấp nhưng có thể sử dụng an toàn",
                TrustLevel.Unknown => "Ứng dụng thiếu thông tin xác thực nhưng không phát hiện mối đe dọa",
                TrustLevel.Blocked => "Ứng dụng bị chặn do phát hiện nguy cơ bảo mật cao",
                _ => "Trạng thái xác thực không xác định"
            };
        }

        private void LogVerificationResult(AppVerificationResult result)
        {
            var logMessage = $"App Verification: {result.AppName} ({result.AppId}) - Trust Level: {result.TrustLevel}";


            foreach (var fileResult in result.FileVerifications)
            {
                var fileLog = $"  File: {fileResult.FileName} - Trust: {fileResult.TrustLevel}, Signed: {fileResult.HasDigitalSignature}, Checksum: {fileResult.IsChecksumValid}";

            }
        }

        #endregion
    }
}