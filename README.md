# DriveBox

A Flutter Desktop application designed to download and install driving simulation software, with a focus on handling large file downloads efficiently.

## Features

- **Modular Architecture**: Handles multi-part application downloads in a structured way
- **Resume Downloads**: Automatically resumes interrupted downloads where they left off
- **Dependency Management**: Intelligently handles system dependencies
- **Checksum Validation**: Ensures file integrity through SHA256 checksum verification
- **Cross-Platform**: Built with Flutter for Windows, with potential for Mac and Linux support

## Development

### Prerequisites

- Flutter SDK 3.19.0 or higher
- Windows 10 or 11 with Visual Studio installed (for Windows builds)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/TeoSushi1014/drivebox.git
```

2. Install dependencies:
```bash
flutter pub get
```

3. Run the application:
```bash
flutter run -d windows
```

### Building for Production

To build the application for production:

```bash
flutter build windows --release
```

## Security Notes

This application downloads and installs executable files. Users may need to:

1. Temporarily disable antivirus or Windows Defender
2. Allow the application through the firewall
3. Accept security warnings during installation

## Project Structure

```
lib/
├── blocs/           # State management
├── models/          # Data models
├── screens/         # UI screens
├── services/        # Core services
│   ├── file_service.dart        # File downloading and handling
│   ├── installation_service.dart # Installation orchestration
│   ├── manifest_service.dart    # Manifest parsing
│   ├── platform_service.dart    # OS-specific operations
│   └── process_service.dart     # External process execution
└── widgets/         # Reusable UI components
```

## Contact

- Developer: Hoang Viet Quang (TeoSushi)
- Facebook: https://www.facebook.com/boboiboy.gala.7/
- GitHub: https://github.com/TeoSushi1014/drivebox
- Zalo (Support): 0838696697 