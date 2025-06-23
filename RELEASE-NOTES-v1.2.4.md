# DriveBox v1.2.4 Release Notes

**Release Date:** June 23, 2025  
**Version:** 1.2.4 ← 1.2.3

## 🚀 New Features

- **Multi-source Update System**: GitHub API + fallback sources for reliability
- **Automatic Updates**: Background checking with rate limiting (5min intervals)
- **File Validation**: PE header + size validation (5MB-500MB)
- **Self-Update Process**: Automatic backup, rollback capability, update history
- **Custom Download Path**: Configurable location (`C:\Tèo Sushi` default)

## 🔧 Improvements

- Optimized update checking with caching
- Enhanced error handling for network failures
- Automatic cleanup of old files (24h retention)
- Download progress tracking

## 🐛 Bug Fixes

- Fixed silent update check failures
- Resolved memory leaks in downloads
- Corrected file cleanup timing
- Improved error messaging

## ⚙️ New Settings

- `autoCheck`, `autoDownload`, `autoInstall` options
- Custom `downloadPath` configuration
- Configurable check intervals

---

**Download:** [DriveBox v1.2.4](https://github.com/TeoSushi1014/drivebox/releases/tag/v1.2.4)
