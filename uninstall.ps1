# DriveBox PowerShell Uninstaller
# Usage: irm https://yourdomain.com/uninstall.ps1 | iex

param(
    [string]$InstallPath = "$env:LOCALAPPDATA\DriveBox",
    [switch]$Silent,
    [switch]$Force
)

$AppName = "DriveBox"

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

# Display banner
if (-not $Silent) {
    Write-Host ""
    Write-Host "DriveBox Uninstaller" -ForegroundColor Red
    Write-Host "Removing DriveBox from your system..." -ForegroundColor Gray
    Write-Host ""
}

try {
    # Check if DriveBox is running
    $processes = Get-Process -Name "DriveBox" -ErrorAction SilentlyContinue
    if ($processes) {
        Write-StatusMsg "DriveBox is currently running. Attempting to close..." "WARNING"
        
        foreach ($proc in $processes) {
            try {
                $proc.CloseMainWindow()
                if (-not $proc.WaitForExit(5000)) {
                    $proc.Kill()
                }
                Write-StatusMsg "Closed DriveBox process (PID: $($proc.Id))" "SUCCESS"
            }
            catch {
                Write-StatusMsg "Failed to close process (PID: $($proc.Id)): $($_.Exception.Message)" "WARNING"
            }
        }
        
        Start-Sleep -Seconds 2
    }
    
    # Remove installation directory
    if (Test-Path $InstallPath) {
        Write-StatusMsg "Removing installation directory: $InstallPath"
        Remove-Item $InstallPath -Recurse -Force
        Write-StatusMsg "Installation directory removed successfully" "SUCCESS"
    }
    else {
        Write-StatusMsg "Installation directory not found: $InstallPath" "WARNING"
    }
    
    # Remove desktop shortcut
    $desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$AppName.lnk"
    if (Test-Path $desktopShortcut) {
        Remove-Item $desktopShortcut -Force
        Write-StatusMsg "Desktop shortcut removed" "SUCCESS"
    }
    
    # Remove from PATH
    try {
        $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
        if ($currentPath -like "*$InstallPath*") {
            $newPath = ($currentPath -split ';' | Where-Object { $_ -ne $InstallPath }) -join ';'
            [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
            Write-StatusMsg "Removed from PATH" "SUCCESS"
        }
    }
    catch {
        Write-StatusMsg "Failed to remove from PATH: $($_.Exception.Message)" "WARNING"
    }
    
    Write-StatusMsg "DriveBox uninstalled successfully!" "SUCCESS"
    Write-Host ""
    Write-Host "Thank you for using DriveBox!" -ForegroundColor Green
    Write-Host ""
    
}
catch {
    Write-StatusMsg "Uninstallation failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
