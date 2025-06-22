# 🚗 DriveBox - App Installer & Updater

<div align="center">

![DriveBox](https://img.shields.io/badge/DriveBox-v1.2.0-blue?style=for-the-badge&logo=electron)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey?style=for-the-badge&logo=windows)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)

**Portable App Installer & Updater with Beautiful Liquid Glass UI**

[📱 Zalo](https://zalo.me/0838696697) • [📘 Facebook](https://www.facebook.com/boboiboy.gala.7/) • [🐙 GitHub](https://github.com/TeoSushi1014/) • [🚗 DriveBox](https://github.com/TeoSushi1014/drivebox)

</div>

## ✨ Features

### 🎨 **Liquid Glass UI Design**
- **Glass Morphism Effects** - Beautiful backdrop-filter and translucent design
- **Always-Visible Contact Footer** - No more hidden modal, contact info always accessible
- **Responsive Design** - Works perfectly on all screen sizes
- **Dark/Light Theme** - Seamless theme switching with glass effects
- **Smooth Animations** - Fluid transitions and hover effects

### 🔄 **Auto-Update System**
- **GitHub Integration** - Automatic version checking from releases
- **Smart Update Notifications** - Toast notifications and status indicators
- **Background Download** - Download updates without blocking UI
- **Version Badge** - Click to access update information
- **Footer Update Button** - Quick access to check for updates

### 📱 **Contact & Support**
- **Zalo Integration** - Direct link to Zalo chat (0838 696 697)
- **Social Media Links** - Facebook, GitHub, and project repositories
- **Always Accessible** - Contact information permanently visible in footer
- **Quick Links** - One-click access to all support channels

### 🚀 **App Management**
- **One-Click Installation** - Download and install apps automatically
- **Progress Tracking** - Real-time download progress with speed indicators
- **Desktop Shortcuts** - Automatic shortcut creation
- **Windows Registry** - Full integration with Add/Remove Programs
- **Uninstall Support** - Clean removal of installed applications

### 🛠️ **Technical Features**
- **Electron Framework** - Cross-platform desktop application
- **Streaming Downloads** - Memory-efficient large file handling
- **MediaFire Support** - Direct download from MediaFire links
- **Setup Steps** - Automated post-install configuration
- **Unicode Support** - Proper Vietnamese character handling

## 🖼️ Screenshots

### Light Theme with Liquid Glass Footer
![Light Theme](path/to/screenshot-light.png)

### Dark Theme with Glass Effects
![Dark Theme](path/to/screenshot-dark.png)

## 🚀 Quick Start

### Installation
1. Download the latest release from [GitHub Releases](https://github.com/TeoSushi1014/drivebox/releases)
2. Run `DriveBox-Setup.exe`
3. Follow the installation wizard
4. Launch DriveBox from desktop shortcut

### Development
```bash
# Clone repository
git clone https://github.com/TeoSushi1014/drivebox.git
cd drivebox

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production (with code signing disabled)
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"; $env:WIN_CSC_LINK=""; npm run build
```

## 🎮 Usage

### Installing Apps
1. Browse available apps in the main grid
2. Click **Download** button on desired app
3. Monitor progress in the glass progress bar
4. App will be automatically installed and shortcuts created

### Managing Apps
- **Open App**: Click the 🚀 **Open** button
- **Open Folder**: Click 📂 **Open Folder** to browse files
- **Update**: Click 🔄 **Update** when new version available
- **Uninstall**: Click 🗑️ **Uninstall** to remove completely

### Getting Updates
- **Automatic Check**: App checks for updates on startup
- **Manual Check**: Click version badge or footer update button
- **Download**: Click download button when update is available
- **Install**: Restart app to apply updates

### Contact Support
Contact information is always visible in the footer:
- **Zalo**: 0838 696 697 (instant messaging)
- **Facebook**: boboiboy.gala.7
- **GitHub**: TeoSushi1014 (issues and discussions)
- **Project**: DriveBox repository

## 🛠️ Configuration
s
### App Configuration
Apps are configured in `data/apps.json`:
```json
{
  "id": "app-id",
  "name": "App Name",
  "description": "App description",
  "version": "1.0.0",
  "downloadUrl": "https://example.com/download",
  "icon": "path/to/icon.png",
  "executablePath": "relative/path/to/exe"
}
```

### Setup Steps
Configure post-install steps:
```json
{
  "setupSteps": [
    {
      "type": "runAsAdmin",
      "file": "setup.exe",
      "description": "Install required components"
    }
  ]
}
```

## 🎨 Customization

### Themes
- Switch between light and dark themes using the 🌙/☀️ button
- Glass effects automatically adapt to current theme
- Custom CSS variables for easy color customization

### Glass Effects
```css
/* Customize glass morphism */
.contact-footer {
  backdrop-filter: blur(20px);
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.15), 
    rgba(255, 255, 255, 0.08));
}
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📊 Changelog

### Version 1.1.0
- ✨ Added liquid glass contact footer
- 🎨 Implemented glass morphism design
- 🔄 Enhanced auto-update system
- 📱 Always-visible contact information
- 🌓 Improved dark/light theme support
- 📱 Responsive design for all screens

### Version 1.0.0
- 🚀 Initial release
- 📦 Basic app installation
- 🔄 Update checking
- 🎨 Modern UI design

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

Need help? Contact us through any of these channels:

- **Zalo**: [0838 696 697](https://zalo.me/0838696697) (Fastest response)
- **Facebook**: [boboiboy.gala.7](https://www.facebook.com/boboiboy.gala.7/)
- **GitHub Issues**: [Create an issue](https://github.com/TeoSushi1014/drivebox/issues)
- **Email**: Available through GitHub profile

## 🙏 Acknowledgments

- **Electron Team** - For the amazing framework
- **Community** - For feedback and suggestions
- **Contributors** - For making this project better

---

<div align="center">

**Made with ❤️ by [Hoàng Việt Quang (Tèo Sushi)](https://github.com/TeoSushi1014)**

*Download faster, install easier, manage better*

</div>