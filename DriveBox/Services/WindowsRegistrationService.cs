using System;
using System.IO;
using Microsoft.Win32;
using DriveBox.Models;

namespace DriveBox.Services
{
    /// <summary>
    /// Service để đăng ký ứng dụng với Windows Registry
    /// Đảm bảo app xuất hiện trong Control Panel > Programs and Features
    /// </summary>
    public class WindowsRegistrationService
    {
        private readonly AppConfigService _configService;
        private const string UNINSTALL_REGISTRY_KEY = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";

        public WindowsRegistrationService(AppConfigService configService)
        {
            _configService = configService;
        }

        /// <summary>
        /// Đăng ký ứng dụng với Windows Registry để hiển thị trong Control Panel
        /// </summary>
        public async Task<bool> RegisterAppWithWindowsAsync(AppInfo app)
        {
            try
            {
                var installPath = _configService.GetAppInstallPath(app);
                if (!Directory.Exists(installPath))
                {
        
                    return false;
                }


                var uninstallerPath = await CreateUninstallerAsync(app, installPath);
                if (string.IsNullOrEmpty(uninstallerPath))
                {
        
                    return false;
                }


                return await Task.Run(() => RegisterInWindowsRegistry(app, installPath, uninstallerPath));
            }
            catch (Exception)
            {
    
                return false;
            }
        }

        /// <summary>
        /// Tạo uninstaller script cho ứng dụng
        /// </summary>
        private async Task<string> CreateUninstallerAsync(AppInfo app, string installPath)
        {
            try
            {
                var uninstallerPath = Path.Combine(installPath, "DriveBox_Uninstaller.exe");
                
    
                var batchContent = $@"@echo off
echo Đang gỡ cài đặt {app.TenHienThi}...
echo.

REM Xóa shortcuts
del ""%USERPROFILE%\Desktop\{SanitizeFileName(app.TenHienThi)}.lnk"" >nul 2>&1
del ""%ALLUSERSPROFILE%\Microsoft\Windows\Start Menu\Programs\DriveBox\{SanitizeFileName(app.TenHienThi)}.lnk"" >nul 2>&1
rmdir ""%ALLUSERSPROFILE%\Microsoft\Windows\Start Menu\Programs\DriveBox"" >nul 2>&1

REM Xóa registry entry
reg delete ""HKEY_LOCAL_MACHINE\{UNINSTALL_REGISTRY_KEY}\{app.Id}"" /f >nul 2>&1

REM Xóa install directory (self-delete)
cd /d ""%TEMP%""
(
  timeout /t 2 /nobreak >nul
  rmdir /s /q ""{installPath}""
) >nul 2>&1

echo Đã gỡ cài đặt thành công {app.TenHienThi}
pause
";

                var batchPath = Path.Combine(installPath, "uninstall.bat");
                await File.WriteAllTextAsync(batchPath, batchContent);

    
                var exeContent = await CreateUninstallerExecutableAsync(app, batchPath);
                await File.WriteAllBytesAsync(uninstallerPath, exeContent);

                return uninstallerPath;
            }
            catch (Exception)
            {
    
                return string.Empty;
            }
        }

        /// <summary>
        /// Tạo executable wrapper cho uninstaller (simple approach)
        /// </summary>
        private async Task<byte[]> CreateUninstallerExecutableAsync(AppInfo app, string batchPath)
        {

            var wrapperContent = $@"@echo off
title Gỡ cài đặt {app.TenHienThi}
""{batchPath}""
";
            

            var cmdPath = Path.ChangeExtension(batchPath, ".cmd");
            await File.WriteAllTextAsync(cmdPath, wrapperContent);
            

            return System.Text.Encoding.UTF8.GetBytes(wrapperContent);
        }

        /// <summary>
        /// Đăng ký ứng dụng trong Windows Registry
        /// </summary>
        private bool RegisterInWindowsRegistry(AppInfo app, string installPath, string uninstallerPath)
        {
            try
            {
                using var key = Registry.LocalMachine.CreateSubKey($@"{UNINSTALL_REGISTRY_KEY}\{app.Id}");
                if (key == null)
                {
    
                    return false;
                }


                key.SetValue("DisplayName", app.TenHienThi);
                key.SetValue("DisplayVersion", app.PhienBan ?? "1.0.0");
                key.SetValue("Publisher", "TeoSushi - DriveBox");
                key.SetValue("InstallLocation", installPath);
                key.SetValue("InstallDate", DateTime.Now.ToString("yyyyMMdd"));
                

                var uninstallerCmd = Path.Combine(installPath, "uninstall.cmd");
                key.SetValue("UninstallString", uninstallerCmd);
                key.SetValue("QuietUninstallString", $@"""{uninstallerCmd}"" /S");
                

                var installSize = CalculateInstallSize(installPath);
                key.SetValue("EstimatedSize", installSize); // KB
                

                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                

                var mainExe = Path.Combine(installPath, app.FileThucThiChinh);
                if (File.Exists(mainExe))
                {
                    key.SetValue("DisplayIcon", $@"""{mainExe}"",0");
                }


                key.SetValue("URLInfoAbout", "https://github.com/TeoSushi1014/DriveBox");
                key.SetValue("HelpLink", "https://github.com/TeoSushi1014/DriveBox/issues");


                return true;
            }
            catch (Exception ex)
            {

                return false;
            }
        }

        /// <summary>
        /// Tính kích thước cài đặt (KB)
        /// </summary>
        private long CalculateInstallSize(string installPath)
        {
            try
            {
                var dirInfo = new DirectoryInfo(installPath);
                long totalSize = 0;

                foreach (var file in dirInfo.GetFiles("*", SearchOption.AllDirectories))
                {
                    totalSize += file.Length;
                }

                return totalSize / 1024; // Convert to KB
            }
            catch
            {
                return 0;
            }
        }

        /// <summary>
        /// Gỡ đăng ký ứng dụng khỏi Windows Registry
        /// </summary>
        public async Task<bool> UnregisterAppFromWindowsAsync(AppInfo app)
        {
            try
            {
                return await Task.Run(() =>
                {
                    try
                    {
                        Registry.LocalMachine.DeleteSubKey($@"{UNINSTALL_REGISTRY_KEY}\{app.Id}", false);
        
                        return true;
                    }
                    catch (Exception ex)
                    {
        
                        return false;
                    }
                });
            }
            catch (Exception ex)
            {

                return false;
            }
        }

        /// <summary>
        /// Kiểm tra xem ứng dụng đã được đăng ký với Windows chưa
        /// </summary>
        public bool IsAppRegisteredWithWindows(AppInfo app)
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey($@"{UNINSTALL_REGISTRY_KEY}\{app.Id}");
                return key != null;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// Làm sạch tên file để tránh ký tự không hợp lệ
        /// </summary>
        private static string SanitizeFileName(string fileName)
        {
            var invalidChars = Path.GetInvalidFileNameChars();
            foreach (char c in invalidChars)
            {
                fileName = fileName.Replace(c, '_');
            }
            return fileName;
        }
    }
}