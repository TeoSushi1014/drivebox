using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using DriveBox.Models;

namespace DriveBox.Services
{
    public class ShortcutService
    {
        [ComImport]
        [Guid("00021401-0000-0000-C000-000000000046")]
        internal class ShellLink
        {
        }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("000214F9-0000-0000-C000-000000000046")]
        internal interface IShellLink
        {
            void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cchMaxPath, out IntPtr pfd, int fFlags);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cchMaxName);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cchMaxPath);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
            void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cchMaxArgs);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cchIconPath, out int piIcon);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
            void Resolve(IntPtr hwnd, int fFlags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
        }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("0000010b-0000-0000-C000-000000000046")]
        internal interface IPersistFile
        {
            void GetClassID(out Guid pClassID);
            void IsDirty();
            void Load([In, MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
            void Save([In, MarshalAs(UnmanagedType.LPWStr)] string pszFileName, [In, MarshalAs(UnmanagedType.Bool)] bool fRemember);
            void SaveCompleted([In, MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
            void GetCurFile([In, MarshalAs(UnmanagedType.LPWStr)] string ppszFileName);
        }

        [ComImport]
        [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        [Guid("45e2b4ae-b1c3-11d0-b92f-00a0c90312e1")]
        internal interface IShellLinkDataList
        {
            void AddDataBlock(IntPtr pDataBlock);
            void CopyDataBlock(uint dwSig, out IntPtr ppDataBlock);
            void RemoveDataBlock(uint dwSig);
            void GetFlags(out uint pdwFlags);
            void SetFlags(uint dwFlags);
        }

        // Constants for Run as Administrator flag
        private const uint SLDF_RUNAS_USER = 0x00002000;

        private readonly AppConfigService _configService;

        public ShortcutService(AppConfigService configService)
        {
            _configService = configService;
        }

        /// <summary>
        /// Tái tạo shortcut cho ứng dụng đã cài đặt (fix working directory issues)
        /// Recreates shortcuts for installed applications (fixes working directory issues)
        /// </summary>
        public async Task<bool> RecreateShortcutsAsync(AppInfo app)
        {
            try
            {
    
                await DeleteExistingShortcutsAsync(app);
                

                await EnsureAppDirectoryPermissionsAsync(app);
                

                return await CreateVietnameseShortcutsAsync(app);
            }
            catch (Exception ex)
            {

                return false;
            }
        }

        /// <summary>
        /// Đảm bảo thư mục ứng dụng có quyền ghi để tránh lỗi license file
        /// Ensures app directory has write permissions to prevent license file errors
        /// </summary>
        private async Task EnsureAppDirectoryPermissionsAsync(AppInfo app)
        {
            await Task.Run(() =>
            {
                try
                {
                    var installPath = _configService.GetAppInstallPath(app);
                    if (!Directory.Exists(installPath)) return;

        
                    var testFile = Path.Combine(installPath, "temp_permission_test.tmp");
                    
                    try
                    {
                        File.WriteAllText(testFile, "test");
                        File.Delete(testFile);
        
                    }
                    catch (UnauthorizedAccessException)
                    {
        
            
            
                    }
                }
                catch (Exception ex)
                {
    
                }
            });
        }

        /// <summary>
        /// Kiểm tra shortcut có "Run as Administrator" flag hay không
        /// Checks if shortcut has "Run as Administrator" flag
        /// </summary>
        public async Task<bool> CheckShortcutRunAsAdminAsync(AppInfo app)
        {
            return await Task.Run(() =>
            {
                try
                {
                    var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                    var shortcutName = SanitizeFileName(app.TenHienThi);
                    var shortcutPath = Path.Combine(desktopPath, $"{shortcutName}.lnk");

                    if (!File.Exists(shortcutPath))
                    {
        
                        return false;
                    }

                    // Load existing shortcut
                    var link = (IShellLink)new ShellLink();
                    var file = (IPersistFile)link;
                    file.Load(shortcutPath, 0);

                    // Check if Run as Administrator flag is set
                    var dataList = (IShellLinkDataList)link;
                    dataList.GetFlags(out uint flags);
                    
                    bool hasRunAsAdminFlag = (flags & SLDF_RUNAS_USER) == SLDF_RUNAS_USER;
    
                    
                    return hasRunAsAdminFlag;
                }
                catch (Exception ex)
                {
    
                    return false;
                }
            });
        }

        /// <summary>
        /// Xóa shortcuts cũ của ứng dụng
        /// Deletes existing shortcuts for the application
        /// </summary>
        private async Task DeleteExistingShortcutsAsync(AppInfo app)
        {
            await Task.Run(() =>
            {
                try
                {
                    var shortcutName = SanitizeFileName(app.TenHienThi);
                    
                    // Xóa desktop shortcut
                    var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                    var desktopShortcut = Path.Combine(desktopPath, $"{shortcutName}.lnk");
                    if (File.Exists(desktopShortcut))
                    {
                        File.Delete(desktopShortcut);
        
                    }
                    
                    // Xóa start menu shortcut
                    var startMenuPath = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
                        "Programs",
                        "DriveBox"
                    );
                    var startMenuShortcut = Path.Combine(startMenuPath, $"{shortcutName}.lnk");
                    if (File.Exists(startMenuShortcut))
                    {
                        File.Delete(startMenuShortcut);
        
                    }
                }
                catch (Exception ex)
                {
    
                }
            });
        }

        /// <summary>
        /// Tạo shortcut với tên tiếng Việt cho ứng dụng đã cài đặt
        /// Creates shortcuts with Vietnamese names for installed applications
        /// </summary>
        public async Task<bool> CreateVietnameseShortcutsAsync(AppInfo app)
        {
            try
            {
                var installPath = _configService.GetAppInstallPath(app);
                var executablePath = Path.Combine(installPath, app.FileThucThiChinh);

                if (!File.Exists(executablePath))
                {
                    throw new FileNotFoundException($"Không tìm thấy file thực thi: {executablePath}");
                }

                // Tạo shortcut trên Desktop với tên tiếng Việt
                var desktopSuccess = await CreateDesktopShortcutAsync(app, executablePath);
                
                // Tạo shortcut trong Start Menu với tên tiếng Việt
                var startMenuSuccess = await CreateStartMenuShortcutAsync(app, executablePath);

                return desktopSuccess && startMenuSuccess;
            }
            catch (Exception ex)
            {

                return false;
            }
        }

        /// <summary>
        /// Tạo shortcut trên Desktop với encoding UTF-8 cho tiếng Việt
        /// Creates desktop shortcut with UTF-8 encoding for Vietnamese
        /// </summary>
        private async Task<bool> CreateDesktopShortcutAsync(AppInfo app, string executablePath)
        {
            return await Task.Run(() =>
            {
                try
                {
                    var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                    
                    // Sử dụng tên tiếng Việt từ manifest
                    var shortcutName = SanitizeFileName(app.TenHienThi);
                    var shortcutPath = Path.Combine(desktopPath, $"{shortcutName}.lnk");

                    return CreateShortcutFile(shortcutPath, executablePath, app);
                }
                catch (Exception ex)
                {
    
                    return false;
                }
            });
        }

        /// <summary>
        /// Tạo shortcut trong Start Menu với encoding UTF-8 cho tiếng Việt
        /// Creates Start Menu shortcut with UTF-8 encoding for Vietnamese
        /// </summary>
        private async Task<bool> CreateStartMenuShortcutAsync(AppInfo app, string executablePath)
        {
            return await Task.Run(() =>
            {
                try
                {
                    var startMenuPath = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
                        "Programs",
                        "DriveBox"
                    );

                    // Tạo thư mục nếu chưa tồn tại
                    Directory.CreateDirectory(startMenuPath);

                    // Sử dụng tên tiếng Việt từ manifest
                    var shortcutName = SanitizeFileName(app.TenHienThi);
                    var shortcutPath = Path.Combine(startMenuPath, $"{shortcutName}.lnk");

                    return CreateShortcutFile(shortcutPath, executablePath, app);
                }
                catch (Exception ex)
                {
    
                    return false;
                }
            });
        }

        /// <summary>
        /// Tạo file shortcut sử dụng COM interface với hỗ trợ Unicode
        /// Creates shortcut file using COM interface with Unicode support
        /// </summary>
        private bool CreateShortcutFile(string shortcutPath, string executablePath, AppInfo app)
        {
            try
            {
                // Sử dụng COM để tạo shortcut với hỗ trợ Unicode đầy đủ
                var link = (IShellLink)new ShellLink();

                // Thiết lập đường dẫn file thực thi
                link.SetPath(executablePath);

                // Thiết lập thư mục làm việc
                var workingDirectory = Path.GetDirectoryName(executablePath);
                if (!string.IsNullOrEmpty(workingDirectory))
                {
                    link.SetWorkingDirectory(workingDirectory);
                }

                // Thiết lập mô tả bằng tiếng Việt
                if (!string.IsNullOrEmpty(app.MoTa))
                {
                    link.SetDescription(app.MoTa);
                }

                // Thiết lập icon nếu có
                SetApplicationIcon(link, app, executablePath);

                // Thiết lập "Run as Administrator" flag để tránh lỗi quyền truy cập
                var dataList = (IShellLinkDataList)link;
                dataList.GetFlags(out uint currentFlags);
                dataList.SetFlags(currentFlags | SLDF_RUNAS_USER);

                // Lưu shortcut với encoding Unicode
                var file = (IPersistFile)link;
                file.Save(shortcutPath, false);

                return true;
            }
            catch (Exception ex)
            {

                return false;
            }
        }

        /// <summary>
        /// Thiết lập icon cho shortcut
        /// Sets icon for the shortcut
        /// </summary>
        private void SetApplicationIcon(IShellLink link, AppInfo app, string executablePath)
        {
            try
            {
                // Ưu tiên sử dụng icon từ Assets nếu có
                var iconPath = GetApplicationIconPath(app);
                
                if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
                {
                    link.SetIconLocation(iconPath, 0);
                }
                else
                {
                    // Sử dụng icon từ file thực thi
                    link.SetIconLocation(executablePath, 0);
                }
            }
            catch (Exception ex)
            {
                
                // Tiếp tục tạo shortcut mà không có icon tùy chỉnh
            }
        }

        /// <summary>
        /// Lấy đường dẫn icon phù hợp cho ứng dụng
        /// Gets appropriate icon path for the application
        /// </summary>
        private string GetApplicationIconPath(AppInfo app)
        {
            var assetsPath = Path.Combine(AppContext.BaseDirectory, "Assets");
            
            // Map các ứng dụng với icon tương ứng
            var iconMapping = new Dictionary<string, string>
            {
                {"mo_phong_lai_xe", "120cau.ico"},
                {"tu_luyen_600_cau", "600cau.ico"}
            };

            if (iconMapping.TryGetValue(app.Id, out var iconFileName))
            {
                return Path.Combine(assetsPath, iconFileName);
            }

            return string.Empty;
        }

        /// <summary>
        /// Làm sạch tên file để tránh các ký tự không hợp lệ
        /// Sanitizes filename to avoid invalid characters
        /// </summary>
        private static string SanitizeFileName(string fileName)
        {
            var invalidChars = Path.GetInvalidFileNameChars();
            var result = new StringBuilder();

            foreach (char c in fileName)
            {
                if (!invalidChars.Contains(c))
                {
                    result.Append(c);
                }
                else
                {
                    result.Append('_');
                }
            }

            return result.ToString().Trim();
        }

        /// <summary>
        /// Xóa shortcuts của ứng dụng
        /// Removes application shortcuts
        /// </summary>
        public async Task<bool> RemoveShortcutsAsync(AppInfo app)
        {
            try
            {
                var shortcutName = SanitizeFileName(app.TenHienThi);
                
                // Run file operations on background thread to avoid blocking UI
                return await Task.Run(() =>
                {
                    try
                    {
                        // Xóa desktop shortcut
                        var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                        var desktopShortcut = Path.Combine(desktopPath, $"{shortcutName}.lnk");
                        
                        if (File.Exists(desktopShortcut))
                        {
                            File.Delete(desktopShortcut);
                        }

                        // Xóa start menu shortcut
                        var startMenuPath = Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu),
                            "Programs",
                            "DriveBox",
                            $"{shortcutName}.lnk"
                        );

                        if (File.Exists(startMenuPath))
                        {
                            File.Delete(startMenuPath);
                        }

                        return true;
                    }
                    catch (Exception innerEx)
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
    }
}