# DriveBox - Multi-Cloud Sync Application

DriveBox is a secure, cross-platform desktop application that synchronizes files across multiple cloud storage providers including Google Drive, Dropbox, and OneDrive.

## Features

### ✨ Core Features
- **Multi-Cloud Sync**: Synchronize files across Google Drive, Dropbox, and OneDrive
- **Real-time Monitoring**: Automatic file change detection and sync
- **Conflict Resolution**: Smart conflict resolution with multiple strategies
- **File Versioning**: Keep track of file versions and changes
- **Offline Support**: Work offline and sync when connection is restored

### 🔒 Security Features
- **End-to-End Encryption**: Files encrypted using AES-256-GCM
- **Secure Authentication**: User authentication with optional 2FA
- **File Integrity**: SHA-256 hashing for file integrity verification
- **Code Signing**: Windows executables are digitally signed
- **Security Auditing**: Comprehensive logging and monitoring

### 🎯 User Experience
- **System Tray Integration**: Quick access from system tray
- **Progress Tracking**: Real-time sync progress and status
- **Smart Notifications**: Configurable notifications for events
- **Bandwidth Control**: Throttle bandwidth usage
- **Cross-Platform**: Windows, macOS, and Linux support

## Installation

### System Requirements
- **Windows**: Windows 10 or later
- **macOS**: macOS 10.14 or later
- **Linux**: Ubuntu 18.04+ or equivalent
- **Memory**: 512 MB RAM minimum, 1 GB recommended
- **Storage**: 100 MB free space for installation

### Quick Install
```bash
# Install dependencies
npm install

# Start the application
npm start

# Development mode
npm run dev

# Build for production
npm run build

# Create distribution packages
npm run dist
```

## Development

### Project Structure
```
src/
├── main.js              # Main process
├── auth/                # Authentication system
├── config/              # Configuration management
├── providers/           # Cloud provider integrations
├── utils/               # Utilities (security, sync, logging)
└── renderer/            # UI components

tests/
├── unit/                # Unit tests
└── integration/         # Integration tests
```

### Key Components Implemented

#### 🔐 Security Manager (`src/utils/security.js`)
- AES-256-GCM encryption/decryption
- SHA-256 file hashing for integrity
- RSA key pair generation
- bcrypt password hashing
- Secure token generation

#### 🔄 Sync Engine (`src/utils/syncEngine.js`)
- Real-time file watching with chokidar
- Multi-provider sync orchestration
- Conflict detection and resolution
- Queue-based sync processing
- Event-driven architecture

#### 🌐 Cloud Providers
- **Google Drive** (`src/providers/googleDrive.js`)
- **Dropbox** (`src/providers/dropbox.js`)
- OAuth 2.0 authentication
- File upload/download with chunking
- Delta sync for incremental updates

#### 🔑 Authentication (`src/auth/authManager.js`)
- User registration and login
- Session management
- Two-factor authentication (2FA)
- Account lockout protection
- Password security validation

#### 📝 Logging System (`src/utils/logger.js`)
- Winston-based structured logging
- Multiple log levels and categories
- Log rotation and cleanup
- Search and export functionality

#### ⚙️ Configuration (`src/config/configManager.js`)
- Electron-store based persistence
- Encrypted sensitive data storage
- Import/export functionality
- Validation and backup systems

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm test:integration

# Run all tests
npm run test:all

# Security audit
npm run security-check
```

## Building & Deployment

### Automated CI/CD
GitHub Actions workflow includes:
- Cross-platform testing (Windows, macOS, Linux)
- Security scanning with Snyk
- Code signing for Windows executables
- VirusTotal submission for malware scanning
- Automated releases with SHA-256 checksums

### Manual Build
```bash
# Clean build
npm run clean

# Install dependencies
npm ci

# Security audit
npm audit

# Build application
npm run build

# Package for distribution
npm run dist
```

## Security Best Practices

### To Avoid Antivirus False Positives:
1. **Code Signing**: Windows executables are signed with certificates
2. **Clean Build Environment**: Using GitHub Actions for trusted builds
3. **File Integrity**: SHA-256 hashes provided for verification
4. **VirusTotal Submission**: Automatic malware scanning
5. **Transparency**: Open source code for auditing

### Security Features:
- End-to-end encryption with AES-256-GCM
- Secure authentication with bcrypt
- File integrity verification
- Comprehensive audit logging
- No suspicious techniques (no process injection, memory manipulation)

## Architecture

### Event-Driven Design
```javascript
// Sync Engine Events
syncEngine.on('syncStarted', () => { ... });
syncEngine.on('conflictDetected', (conflict) => { ... });
syncEngine.on('fileDownloaded', (data) => { ... });

// Authentication Events
authManager.on('userLoggedIn', (user) => { ... });
authManager.on('sessionExpired', () => { ... });
```

### Provider Integration
```javascript
// Add cloud providers dynamically
const googleDrive = new GoogleDriveProvider(credentials);
const dropbox = new DropboxProvider(credentials);

syncEngine.addProvider('googleDrive', googleDrive);
syncEngine.addProvider('dropbox', dropbox);
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add comprehensive tests
5. Ensure security best practices
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/drivebox/issues)
- **Security**: Report to security@drivebox.com
- **Documentation**: [Wiki](https://github.com/your-org/drivebox/wiki)

---

**Built with security and reliability in mind** 🔒
