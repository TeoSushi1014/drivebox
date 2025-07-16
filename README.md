# DriveBox

DriveBox is a Flutter Desktop application for downloading and installing driving simulation software. It manages the installation of dependencies and application files, ensuring a smooth user experience.

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (latest stable version)
- [Visual Studio](https://visualstudio.microsoft.com/downloads/) with Desktop Development with C++ workload (required for Windows development)
- Windows Developer Mode enabled

## Enable Windows Developer Mode

DriveBox requires symlink support, which needs Windows Developer Mode to be enabled:

1. Press `Windows + I` to open Settings
2. Navigate to `Privacy & Security > For developers`
3. Toggle on `Developer Mode`
4. Restart your computer

Alternatively, run this command to open the developer settings directly:
```
start ms-settings:developers
```

## Setup

1. Clone this repository:
```
git clone https://github.com/TeoSushi1014/drivebox.git
```

2. Navigate to the project directory:
```
cd drivebox
```

3. Install dependencies:
```
flutter pub get
```

## Running the Application

To run the application in development mode:
```
flutter run -d windows
```

## Building for Production

To build a release version of the application:
```
flutter build windows
```

The built application will be located in `build/windows/runner/Release/`.

## Project Structure

- `lib/models/` - Data models
- `lib/services/` - Core services (manifest, file, process, platform)
- `lib/screens/` - UI screens
- `lib/widgets/` - Reusable UI components
- `lib/blocs/` - State management using BLoC pattern

## Features

- Download and install driving simulation software
- Verify checksums for data integrity
- Automatically install required dependencies
- Track installation progress with detailed UI
- Launch installed applications

## Developer Information

- **Developer:** Hoang Viet Quang (TeoSushi)
- **GitHub (Project):** https://github.com/TeoSushi1014/drivebox
- **Assets Repository:** https://github.com/TeoSushi1014/drivebox-assets
