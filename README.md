# 📦 DriveBox - Trình Cài Đặt & Cập Nhật Ứng Dụng

<div align="center">

![DriveBox Logo](assets/icon.ico)

**Ứng dụng Electron portable cho việc cài đặt và cập nhật các ứng dụng một cách dễ dàng**

[![Version](https://img.shields.io/badge/version-1.2.5-blue.svg)](package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/electron-latest-brightgreen.svg)](https://electronjs.org/)
[![Node.js](https://img.shields.io/badge/node.js-16+-brightgreen.svg)](https://nodejs.org/)

[🚀 Tải xuống](#-cài-đặt) • [📖 Hướng dẫn](#-sử-dụng) • [🔧 Phát triển](#-phát-triển) • [🐛 Báo lỗi](https://github.com/TeoSushi1014/drivebox/issues)

</div>

## ✨ Tính năng chính

### 🎯 **Quản lý ứng dụng thông minh**
- 📥 **Tải xuống tự động** - Hỗ trợ MediaFire và các nguồn khác
- 🔄 **Cập nhật thông minh** - Kiểm tra và cập nhật ứng dụng tự động
- 📂 **Quản lý thư mục** - Tổ chức ứng dụng trong `C:\Tèo Sushi`
- 🗂️ **Giải nén tự động** - Hỗ trợ ZIP và RAR

### 🎨 **Giao diện hiện đại**
- 🌙 **Chế độ Dark/Light** - Chuyển đổi giao diện linh hoạt
- 📱 **Responsive Design** - Tối ưu cho mọi kích thước màn hình
- ⚡ **Hiệu ứng mượt mà** - Animated background với particles
- 🎮 **Trải nghiệm UX tốt** - Toast notifications và progress bars

### 🛠️ **Tính năng nâng cao**
- ⏸️ **Điều khiển tải xuống** - Tạm dừng, tiếp tục, hủy bỏ
- 📊 **Theo dõi tiến độ** - Hiển thị tốc độ, thời gian còn lại
- 🔍 **Tìm kiếm thông minh** - Hỗ trợ tiếng Việt có dấu
- 🚀 **Cập nhật tự động** - Auto-update cho chính ứng dụng

## 🎯 Ứng dụng được hỗ trợ

DriveBox hiện tại hỗ trợ các ứng dụng học tập:

| Ứng dụng | Mô tả | Kích thước |
|----------|-------|------------|
| 🚗 **600 câu lý thuyết bằng B** | Ôn tập lý thuyết bằng lái xe B2 | ~5-10 MB |
| 🚙 **200 câu mô phỏng bằng B** | Luyện tập thực hành bằng lái xe B2 | ~10-20 MB |

## 🚀 Cài đặt

### Tải xuống phiên bản mới nhất

```bash
# Clone repository
git clone https://github.com/TeoSushi1014/drivebox.git
cd drivebox

# Cài đặt dependencies
npm install

# Chạy ứng dụng
npm start
```

### Build từ source

```bash
# Build ứng dụng
npm run build

# Tạo file cài đặt
npm run dist
```

## 📖 Sử dụng

### 🎮 Các thao tác cơ bản

1. **Tải xuống ứng dụng**
   - Nhấp vào nút "Tải xuống" trên thẻ ứng dụng
   - Theo dõi tiến độ qua thanh progress bar
   - Ứng dụng sẽ được lưu trong `C:\Tèo Sushi`

2. **Quản lý ứng dụng**
   - 🚀 **Mở**: Chạy ứng dụng đã cài đặt
   - 📂 **Mở thư mục**: Truy cập thư mục chứa ứng dụng
   - 🔄 **Cập nhật**: Cập nhật lên phiên bản mới
   - 🗑️ **Gỡ cài đặt**: Xóa ứng dụng khỏi hệ thống

3. **Điều khiển tải xuống**
   - ⏸️ **Tạm dừng**: `Ctrl + Space` hoặc nút Pause
   - ▶️ **Tiếp tục**: Nút Resume
   - ❌ **Hủy bỏ**: `Esc` hoặc nút Cancel

### ⌨️ Phím tắt

| Phím tắt | Chức năng |
|----------|-----------|
| `Ctrl + Space` | Tạm dừng/Tiếp tục tải xuống |
| `Esc` | Hủy tải xuống (có xác nhận) |
| `Ctrl + D` | Hiển thị thông tin debug |

## 🔧 Phát triển

### 📋 Yêu cầu hệ thống

- **Node.js** 16.0 hoặc cao hơn
- **npm** 7.0 hoặc cao hơn
- **Windows** 10/11 (khuyến nghị)

### 🛠️ Scripts phát triển

```bash
# Chạy ở chế độ development
npm run dev

# Chạy tests
npm test

# Kiểm tra code style
npm run lint

# Format code
npm run format

# Kiểm tra bảo mật
npm run security-check

# Build CSS
npm run build:css

# Dọn dẹp
npm run clean
```

### 📁 Cấu trúc dự án

```
drivebox/
├── 📂 src/
│   ├── 📄 main.js              # Main process (Electron)
│   ├── 📄 main-new.js          # New features testing
│   ├── 📄 preload.js           # Preload script
│   ├── 📂 renderer/
│   │   ├── 📄 index.html       # Main UI
│   │   ├── 📄 renderer.js      # Renderer process
│   │   └── 📄 styles.css       # Styles
│   ├── 📂 auth/
│   │   └── 📄 authManager.js   # Authentication
│   ├── 📂 config/
│   │   └── 📄 configManager.js # Configuration
│   ├── 📂 providers/
│   │   ├── 📄 dropbox.js       # Dropbox integration
│   │   └── 📄 googleDrive.js   # Google Drive integration
│   └── 📂 utils/
│       └── 📄 logger.js        # Logging utilities
├── 📂 data/
│   └── 📄 apps.json            # App definitions
├── 📂 assets/
│   ├── 📄 icon.ico             # App icon
│   └── 📂 icons/               # Social icons
├── 📂 tests/
│   └── 📂 unit/                # Unit tests
└── 📄 package.json             # Dependencies & scripts
```

### 🔌 API chính

#### Main Process APIs

```javascript
// Tải xuống ứng dụng
ipcMain.handle('download-app', async (event, app) => { ... })

// Lấy danh sách ứng dụng
ipcMain.handle('get-apps', async () => { ... })

// Kiểm tra cập nhật
ipcMain.handle('check-app-updates', async () => { ... })
```

#### Renderer Process APIs

```javascript
// DriveBoxApp class - Main application controller
class DriveBoxApp {
    // Tải xuống ứng dụng
    async downloadApp(app) { ... }
    
    // Cập nhật giao diện
    updateAppCard(card, app) { ... }
    
    // Kiểm tra cập nhật
    async checkForUpdates(silent = false) { ... }
}
```

## 🌐 Tích hợp

### 📁 Thêm ứng dụng mới

Chỉnh sửa file [`data/apps.json`](data/apps.json):

```json
{
    "id": "my-app",
    "name": "Tên ứng dụng",
    "description": "Mô tả chi tiết",
    "version": "1.0.0",
    "downloadUrl": "https://mediafire.com/...",
    "fileName": "MyApp.zip",
    "icon": "🎯",
    "category": "Danh mục",
    "size": "~50 MB",
    "developer": "Tên nhà phát triển",
    "requiresSetup": true,
    "setupSteps": [
        {
            "type": "runAsAdmin",
            "file": "install.bat",
            "description": "Cài đặt components"
        }
    ]
}
```

### 🔧 Custom Setup Steps

```javascript
// Các loại setup steps hỗ trợ
const setupTypes = {
    "runAsAdmin": "Chạy với quyền admin",
    "runSilent": "Chạy im lặng",
    "extract": "Giải nén file",
    "copy": "Sao chép file"
};
```

## 🤝 Đóng góp

Chúng tôi luôn chào đón các đóng góp từ cộng đồng!

### 📝 Quy trình đóng góp

1. **Fork** repository này
2. **Tạo branch** cho tính năng mới: `git checkout -b feature/amazing-feature`
3. **Commit** thay đổi: `git commit -m 'Add some amazing feature'`
4. **Push** lên branch: `git push origin feature/amazing-feature`
5. **Tạo Pull Request**

### 🐛 Báo cáo lỗi

Khi báo cáo lỗi, vui lòng bao gồm:

- 🖥️ **Hệ điều hành** và phiên bản
- 📱 **Phiên bản DriveBox**
- 📝 **Mô tả chi tiết** lỗi
- 🔄 **Cách tái tạo** lỗi
- 📸 **Screenshots** (nếu có)

## 📞 Liên hệ & Hỗ trợ

<div align="center">

### 👨‍💻 **Tác giả: Hoàng Việt Quang (Tèo Sushi)**

[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://www.facebook.com/boboiboy.gala.7)
[![Zalo](https://img.shields.io/badge/Zalo-0084FF?style=for-the-badge&logo=zalo&logoColor=white)](https://zalo.me/0869006307)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/TeoSushi1014)

📧 **Email hỗ trợ**: [Tạo issue trên GitHub](https://github.com/TeoSushi1014/drivebox/issues)

</div>

## 📄 Giấy phép

Dự án này được phân phối dưới giấy phép **MIT License**. Xem file [LICENSE](LICENSE) để biết thêm chi tiết.

```
MIT License - Bạn có thể tự do sử dụng, sửa đổi và phân phối
```

## 🙏 Cảm ơn

- 🎨 **Electron** - Framework để xây dựng ứng dụng desktop
- 📦 **Node.js** - Runtime environment
- 🎯 **MediaFire** - File hosting service
- 🌟 **Cộng đồng mã nguồn mở** - Những thư viện tuyệt vời

---

<div align="center">

**⭐ Nếu dự án này hữu ích, hãy cho tôi một Star trên GitHub! ⭐**

</div>