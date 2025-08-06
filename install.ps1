# DriveBox PowerShell Installer
# Usage: irm https://raw.githubusercontent.com/TeoSushi1014/drivebox/main/install.ps1 | iex
#
# Parameters:
# -InstallPath "C:\Custom\Path"  : Custom installation directory
# -Silent                        : No user interaction, no banner, no launch
# -Force                         : Reinstall over existing installation
# -CreateShortcut:$false         : Skip desktop shortcut creation
# -NoLaunch                      : Don't auto-launch after installation

param(
    [string]$InstallPath = "$env:LOCALAPPDATA\DriveBox",
    [string]$Version = "latest",
    [switch]$Force,
    [switch]$Silent,
    [switch]$CreateShortcut = $true,
    [switch]$NoLaunch
)

# Configuration
$AppName = "DriveBox"
$GitHubRepo = "TeoSushi1014/drivebox"
$ExecutableName = "DriveBox.exe"

# Display banner
if (-not $Silent) {
    Write-Host ""
    Write-Host "🚀 " -NoNewline -ForegroundColor Green
    Write-Host "DriveBox Installer " -NoNewline -ForegroundColor Cyan
    Write-Host "v2.0.0" -ForegroundColor Gray
    Write-Host "   Modern Software Management for Windows" -ForegroundColor Gray
    Write-Host ""
}

# Function to write colored output
function Write-StatusMsg {
    param([string]$Message, [string]$Status = "INFO")
    
    $color = switch ($Status) {
        "SUCCESS" { "Green" }
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "INFO" { "Cyan" }
        default { "White" }
    }
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] " -ForegroundColor Gray -NoNewline
    Write-Host "[$Status] " -ForegroundColor $color -NoNewline
    Write-Host $Message
}

# Function to check admin privileges
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Function to get latest release info from GitHub
function Get-LatestRelease {
    try {
        Write-StatusMsg "Fetching latest release information..."
        $apiUrl = "https://api.github.com/repos/$GitHubRepo/releases/latest"
        $response = Invoke-RestMethod -Uri $apiUrl -Headers @{"User-Agent" = "DriveBox-Installer"}
        
        return @{
            Version = $response.tag_name
            DownloadUrl = ($response.assets | Where-Object { $_.name -like "*win-x64*" -or $_.name -like "*Windows*" -or $_.name -like "*.exe" -or $_.name -like "*.zip" }).browser_download_url | Select-Object -First 1
            ReleaseNotes = $response.body
        }
    }
    catch {
        Write-StatusMsg "Failed to fetch release info: $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Function to download file with progress
function Download-FileWithProgress {
    param(
        [string]$Url,
        [string]$OutFile
    )
    
    try {
        Write-StatusMsg "Downloading from: $Url"
        
        # Create webclient for progress tracking
        $webClient = New-Object System.Net.WebClient
        
        # Register progress event
        Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -Action {
            $Global:DownloadProgress = $Event.SourceEventArgs.ProgressPercentage
            Write-Progress -Activity "Downloading DriveBox" -Status "$($Global:DownloadProgress)% Complete" -PercentComplete $Global:DownloadProgress
        } | Out-Null
        
        # Download the file
        $webClient.DownloadFile($Url, $OutFile)
        $webClient.Dispose()
        
        Write-Progress -Activity "Downloading DriveBox" -Completed
        Write-StatusMsg "Download completed successfully" "SUCCESS"
    }
    catch {
        Write-StatusMsg "Download failed: $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Function to extract files
function Expand-ArchiveIfNeeded {
    param(
        [string]$FilePath,
        [string]$Destination
    )
    
    $extension = [System.IO.Path]::GetExtension($FilePath).ToLower()
    
    if ($extension -eq ".zip") {
        Write-StatusMsg "Extracting archive..."
        try {
            if (Test-Path $Destination) {
                Remove-Item $Destination -Recurse -Force
            }
            New-Item -ItemType Directory -Path $Destination -Force | Out-Null
            Expand-Archive -Path $FilePath -DestinationPath $Destination -Force
            Write-StatusMsg "Archive extracted successfully" "SUCCESS"
        }
        catch {
            Write-StatusMsg "Failed to extract archive: $($_.Exception.Message)" "ERROR"
            throw
        }
    }
    elseif ($extension -eq ".exe") {
        Write-StatusMsg "Moving executable to destination..."
        try {
            if (-not (Test-Path $Destination)) {
                New-Item -ItemType Directory -Path $Destination -Force | Out-Null
            }
            $destFile = Join-Path $Destination $ExecutableName
            Move-Item -Path $FilePath -Destination $destFile -Force
            Write-StatusMsg "Executable moved successfully" "SUCCESS"
        }
        catch {
            Write-StatusMsg "Failed to move executable: $($_.Exception.Message)" "ERROR"
            throw
        }
    }
}

# Function to create desktop shortcut
function New-DesktopShortcut {
    param(
        [string]$TargetPath,
        [string]$ShortcutName = $AppName
    )
    
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $DesktopPath = $WshShell.SpecialFolders("Desktop")
        $ShortcutPath = Join-Path $DesktopPath "$ShortcutName.lnk"
        
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = $TargetPath
        $Shortcut.WorkingDirectory = Split-Path $TargetPath
        $Shortcut.Description = "Modern software management and download application"
        $Shortcut.Save()
        
        Write-StatusMsg "Desktop shortcut created" "SUCCESS"
    }
    catch {
        Write-StatusMsg "Failed to create desktop shortcut: $($_.Exception.Message)" "WARNING"
    }
}

# Function to add to PATH
function Add-ToPath {
    param([string]$PathToAdd)
    
    try {
        $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        if ($currentPath -notlike "*$PathToAdd*") {
            $newPath = "$currentPath;$PathToAdd"
            [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
            Write-StatusMsg "Added to PATH: $PathToAdd" "SUCCESS"
        }
        else {
            Write-StatusMsg "Path already exists in PATH" "INFO"
        }
    }
    catch {
        Write-StatusMsg "Failed to add to PATH: $($_.Exception.Message)" "WARNING"
    }
}

# Function to check if app is already installed
function Test-InstallationExists {
    param([string]$Path)
    
    $exePath = Join-Path $Path $ExecutableName
    return (Test-Path $exePath)
}

# Main installation function
function Install-DriveBox {
    try {
        # Check if already installed
        if ((Test-InstallationExists $InstallPath) -and (-not $Force)) {
            Write-StatusMsg "DriveBox is already installed at: $InstallPath" "WARNING"
            Write-StatusMsg "Use -Force parameter to reinstall" "INFO"
            
            if (-not $Silent) {
                $choice = Read-Host "Do you want to reinstall? (y/N)"
                if ($choice.ToLower() -ne "y") {
                    Write-StatusMsg "Installation cancelled by user" "INFO"
                    return
                }
            }
            else {
                return
            }
        }
        
        # Get release information
        $release = Get-LatestRelease
        if (-not $release.DownloadUrl) {
            throw "No suitable download found for Windows x64"
        }
        
        Write-StatusMsg "Latest version: $($release.Version)" "INFO"
        
        # Create temp directory
        $tempDir = Join-Path $env:TEMP "DriveBoxInstaller"
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force
        }
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        
        # Download file
        $fileName = Split-Path $release.DownloadUrl -Leaf
        $downloadPath = Join-Path $tempDir $fileName
        Download-FileWithProgress -Url $release.DownloadUrl -OutFile $downloadPath
        
        # Create installation directory
        if (Test-Path $InstallPath) {
            Remove-Item $InstallPath -Recurse -Force
        }
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        
        # Extract or move files
        Expand-ArchiveIfNeeded -FilePath $downloadPath -Destination $InstallPath
        
        # Verify installation
        $exePath = Join-Path $InstallPath $ExecutableName
        if (-not (Test-Path $exePath)) {
            # Try to find executable in subdirectories
            $exePath = Get-ChildItem -Path $InstallPath -Name $ExecutableName -Recurse | Select-Object -First 1
            if ($exePath) {
                $exePath = Join-Path $InstallPath $exePath
            }
            else {
                throw "Executable not found after installation"
            }
        }
        
        Write-StatusMsg "DriveBox installed successfully to: $InstallPath" "SUCCESS"
        
        # Create shortcuts and PATH entry
        if ($CreateShortcut) {
            New-DesktopShortcut -TargetPath $exePath
        }
        
        Add-ToPath -PathToAdd $InstallPath
        
        # Create uninstaller
        $uninstallScript = @"
# DriveBox Uninstaller
Write-Host "Removing DriveBox..." -ForegroundColor Yellow
if (Test-Path "$InstallPath") {
    Remove-Item "$InstallPath" -Recurse -Force
    Write-Host "DriveBox uninstalled successfully" -ForegroundColor Green
}
else {
    Write-Host "DriveBox not found" -ForegroundColor Yellow
}
"@
        $uninstallPath = Join-Path $InstallPath "uninstall.ps1"
        Set-Content -Path $uninstallPath -Value $uninstallScript
        
        # Clean up temp files
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        
        # Display completion message
        Write-StatusMsg "Installation completed successfully!" "SUCCESS"
        Write-Host ""
        Write-Host "✓ DriveBox has been installed to: " -ForegroundColor Green -NoNewline
        Write-Host $InstallPath -ForegroundColor White
        Write-Host "✓ Desktop shortcut created" -ForegroundColor Green
        Write-Host "✓ Added to PATH" -ForegroundColor Green
        Write-Host ""
        Write-Host "To start DriveBox:" -ForegroundColor Cyan
        Write-Host "  • Double-click the desktop shortcut" -ForegroundColor White
        Write-Host "  • Run 'DriveBox' from any command prompt" -ForegroundColor White
        Write-Host "  • Navigate to $InstallPath and run DriveBox.exe" -ForegroundColor White
        Write-Host ""
        Write-Host "To uninstall: " -ForegroundColor Cyan -NoNewline
        Write-Host "irm https://yourdomain.com/uninstall.ps1 | iex" -ForegroundColor White
        Write-Host ""
        
        # Auto-launch application (unless Silent mode or NoLaunch specified)
        if (-not $Silent -and -not $NoLaunch) {
            Write-StatusMsg "Launching DriveBox..." "INFO"
            try {
                Start-Process -FilePath $exePath -ErrorAction Stop
                Write-StatusMsg "DriveBox launched successfully" "SUCCESS"
            }
            catch {
                Write-StatusMsg "Failed to launch DriveBox: $($_.Exception.Message)" "WARNING"
                Write-StatusMsg "You can manually launch it from: $exePath" "INFO"
            }
        }
        
    }
    catch {
        Write-StatusMsg "Installation failed: $($_.Exception.Message)" "ERROR"
        throw
    }
}

# Main execution
try {
    # Check PowerShell version
    if ($PSVersionTable.PSVersion.Major -lt 5) {
        Write-StatusMsg "PowerShell 5.0 or higher is required" "ERROR"
        exit 1
    }
    
    # Check .NET requirements
    try {
        $dotnetVersions = dotnet --list-runtimes 2>$null | Where-Object { $_ -like "*Microsoft.WindowsDesktop.App*" }
        $hasNet9 = $dotnetVersions | Where-Object { $_ -like "*9.*" }
        
        if (-not $hasNet9) {
            Write-StatusMsg ".NET 9.0 Desktop Runtime is required but not found" "WARNING"
            Write-StatusMsg "DriveBox may not run properly without .NET 9.0" "WARNING"
            Write-StatusMsg "Download from: https://dotnet.microsoft.com/download/dotnet/9.0" "INFO"
            
            if (-not $Silent) {
                $choice = Read-Host "Continue installation anyway? (y/N)"
                if ($choice.ToLower() -ne "y") {
                    exit 1
                }
            }
        }
    }
    catch {
        Write-StatusMsg "Unable to check .NET version, continuing..." "WARNING"
    }
    
    # Run installation
    Install-DriveBox
    
}
catch {
    Write-StatusMsg "Script execution failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
