import { NavLinkItem, Project, Translations, Language, Theme } from './types';

export const GOOGLE_CLIENT_ID = '517061452831-hmaet2m3e596uqsatouu1k79t1tkcl63.apps.googleusercontent.com';
export const ADMIN_EMAIL = 'teosushi1014@gmail.com';

export const NAV_LINKS: NavLinkItem[] = [
  { href: '#home', textKey: 'home' },
  { href: '#install', textKey: 'install' },
  { href: '#demo', textKey: 'demo' },
  { href: '#troubleshooting', textKey: 'troubleshooting' },
  { href: '#faq', textKey: 'faq' },
];

export const ADMIN_NAV_LINKS: NavLinkItem[] = [
  { href: '/admin', textKey: 'title' }, 
];

export const PROJECTS_DATA: Project[] = [];

export const SOCIAL_LINKS = [
  { href: 'https://github.com/TeoSushi1014/drivebox', iconClass: 'fab fa-github' },
  { href: 'https://www.facebook.com/teosushi1014z', iconClass: 'fab fa-facebook' },
  { href: 'https://zalo.me/0792007137', iconClass: 'fab fa-zalo' },
];

export const TRANSLATIONS_CONTENT: { en: Translations; vi: Translations } = {
  en: {
    nav: { home: "Home", install: "Install", demo: "Demo", troubleshooting: "Troubleshooting", faq: "FAQ" },
    langToggle: "EN",
    profile: { name: "Hoang Viet Quang", email: "teosushi1014@gmail.com" },
    login: { 
        signInWithGoogle: "Sign in with Google", 
        signOut: "Sign Out", 
        myProfile: "My Profile",
        tryAlternativeSignIn: "Try alternate method",
        adminMode: "Admin Mode",
        exitAdminMode: "Exit Admin Mode",
        adminPageLink: "Admin Page"
    },
    home: { 
      title: "DriveBox", 
      subtitle: "Your Ultimate Driving License Training Software Manager", 
      downloadNow: "Download Now", 
      installGuide: "Installation Guide",
      systemRequirements: "System Requirements",
      windowsOnly: "Windows 10/11 Only"
    },
    install: {
      title: "Installation Guide",
      subtitle: "Get DriveBox up and running in 4 simple steps",
      step1Title: "Step 1: Open PowerShell as Administrator",
      step1Desc: "Right-click on 'Start' button → select 'Terminal (Admin)' or 'Windows PowerShell (Administrator)'",
      step2Title: "Step 2: Run Installation Command",
      step2Desc: "Copy and paste the command below into PowerShell, then press Enter",
      step3Title: "Step 3: Allow Administrator Permissions",
      step3Desc: "Click 'Yes' when prompted for administrator access and .NET Runtime installation",
      step4Title: "Step 4: Launch DriveBox",
      step4Desc: "Once installed, launch DriveBox from Start Menu or desktop shortcut",
      copyCommand: "Copy Command",
      copied: "Copied!",
      installCommand: "irm drivebox.teosushi.com/install.ps1 | iex"
    },
    demo: {
      title: "See DriveBox in Action",
      subtitle: "Watch how DriveBox simplifies your driving license training software management",
      watchVideo: "Watch Demo Video",
      features: "Key Features"
    },
    troubleshooting: {
      title: "Troubleshooting",
      subtitle: "Common issues and their solutions",
      dotnetIssue: ".NET Runtime Not Found",
      dotnetSolution: "The installer automatically downloads and installs .NET 9.0 Desktop Runtime. If it fails, download manually from Microsoft's website.",
      adminIssue: "Administrator Rights Required",
      adminSolution: "Right-click PowerShell and select 'Run as Administrator' to ensure proper installation.",
      networkIssue: "Download Failed",
      networkSolution: "Check your internet connection and try again. You can also download the installer manually."
    },
    faq: {
      title: "Frequently Asked Questions",
      q1: "What operating systems are supported?",
      a1: "DriveBox currently supports Windows 10 and Windows 11. macOS and Linux support is planned for future releases.",
      q2: "Do I need administrator rights?",
      a2: "Yes, administrator rights are required for initial installation to register system paths and shortcuts.",
      q3: "How much disk space does DriveBox require?",
      a3: "DriveBox requires approximately 100MB of disk space, plus additional space for downloaded training software.",
      q4: "Is DriveBox free to use?",
      a4: "Yes, DriveBox is completely free and open-source software."
    },
    footer: { copyright: "© 2024 DriveBox. All rights reserved." },
    admin: {
      title: "Admin",
      dashboard: "Dashboard",
      analytics: "Analytics",
      messages: "Messages", 
      settings: "Settings",
      noAccess: "No admin access",
      adminPanelTitle: "Admin Panel",
      welcomeAdmin: "Welcome Admin!",
      quickStats: "Quick Stats",
      visitors: "Visitors",
      pageViews: "Page Views",
      recentMessages: "Recent Messages",
      visitorAnalytics: "Visitor Analytics",
      avgTime: "Avg. Time",
      bounceRate: "Bounce Rate",
      topCountries: "Top Countries",
      name: "Name",
      email: "Email",
      message: "Message",
      date: "Date",
      actions: "Actions",
      view: "View",
      websiteSettings: "Website Settings",
      siteTitle: "Site Title",
      metaDescription: "Meta Description",
      saveSettings: "Save Settings",
      viewMessageTitle: "View Message",
      backToList: "Back to List",
      delete: "Delete",
      reply: "Reply",
      saving: "Saving...",
      settingsSaved: "Settings saved!",
      settingsSaveFailed: "Save failed",
      advancedOptions: "Advanced Options",
      enableMaintenance: "Enable maintenance mode",
      backupFrequency: "Backup frequency",
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly", 
      backupNow: "Backup Now",
      trafficChart: "Traffic Chart",
      chartPlaceholder: "Chart will be displayed here",
      noMessages: "No messages",
      noNewMessages: "No new messages",
      loadingAdminDashboard: "Loading...",
      projectsManagement: "Project Management",
      addProject: "Add Project",
      editProject: "Edit Project",
      projectFormTitleLabel: "Title",
      projectFormDescriptionLabel: "Description",
      imageUrlLabel: "Image URL",
      liveLinkLabel: "Live Link",
      repoLinkLabel: "Repo Link",
      tagsLabel: "Tags",
      commaSeparatedHint: "Comma-separated",
      visibilityLabel: "Visibility",
      visibleStatus: "Visible",
      hiddenStatus: "Hidden",
      cancelButton: "Cancel",
      saveProjectButton: "Save",
      projectSavedSuccess: "Project saved!",
      projectSaveError: "Save failed",
      deleteConfirmMessage: "Confirm delete?",
      deleteButton: "Delete",
      projectTableTitle: "Title",
      imageThumbnail: "Image"
    }
  },
  vi: {
    nav: { home: "Trang Chủ", install: "Cài Đặt", demo: "Demo", troubleshooting: "Khắc Phục", faq: "FAQ" },
    langToggle: "VI",
    profile: { name: "Hoàng Việt Quang", email: "teosushi1014@gmail.com" },
    login: { 
        signInWithGoogle: "Đăng nhập với Google", 
        signOut: "Đăng Xuất", 
        myProfile: "Hồ Sơ Của Tôi",
        tryAlternativeSignIn: "Thử phương thức khác",
        adminMode: "Chế độ Admin",
        exitAdminMode: "Thoát Chế độ Admin",
        adminPageLink: "Trang Quản Trị"
    },
    home: { 
      title: "DriveBox", 
      subtitle: "Phần Mềm Quản Lý Thi Bằng Lái Xe Hàng Đầu", 
      downloadNow: "Tải Ngay", 
      installGuide: "Hướng Dẫn Cài Đặt",
      systemRequirements: "Yêu Cầu Hệ Thống",
      windowsOnly: "Chỉ Windows 10/11"
    },
    install: {
      title: "Hướng Dẫn Cài Đặt",
      subtitle: "Cài đặt DriveBox chỉ trong 4 bước đơn giản",
      step1Title: "Bước 1: Mở PowerShell với quyền Administrator",
      step1Desc: "Chuột phải vào nút 'Start' → chọn 'Terminal (Admin)' hoặc 'Windows PowerShell (Administrator)'",
      step2Title: "Bước 2: Chạy Lệnh Cài Đặt",
      step2Desc: "Sao chép và dán lệnh bên dưới vào PowerShell, sau đó nhấn Enter",
      step3Title: "Bước 3: Cho Phép Quyền Administrator",
      step3Desc: "Nhấn 'Yes' khi được yêu cầu cấp quyền administrator và cài đặt .NET Runtime",
      step4Title: "Bước 4: Khởi Chạy DriveBox",
      step4Desc: "Sau khi cài đặt, khởi chạy DriveBox từ Start Menu hoặc shortcut desktop",
      copyCommand: "Sao Chép Lệnh",
      copied: "Đã Sao Chép!",
      installCommand: "irm drivebox.teosushi.com/install.ps1 | iex"
    },
    demo: {
      title: "Xem DriveBox Hoạt Động",
      subtitle: "Xem cách DriveBox đơn giản hóa việc quản lý phần mềm thi bằng lái xe",
      watchVideo: "Xem Video Demo",
      features: "Tính Năng Chính"
    },
    troubleshooting: {
      title: "Khắc Phục Sự Cố",
      subtitle: "Các vấn đề thường gặp và cách giải quyết",
      dotnetIssue: "Không Tìm Thấy .NET Runtime",
      dotnetSolution: "Trình cài đặt sẽ tự động tải và cài .NET 9.0 Desktop Runtime. Nếu thất bại, tải thủ công từ website Microsoft.",
      adminIssue: "Yêu Cầu Quyền Administrator",
      adminSolution: "Nhấn chuột phải PowerShell và chọn 'Run as Administrator' để đảm bảo cài đặt đúng cách.",
      networkIssue: "Tải Về Thất Bại",
      networkSolution: "Kiểm tra kết nối internet và thử lại. Bạn cũng có thể tải trình cài đặt thủ công."
    },
    faq: {
      title: "Câu Hỏi Thường Gặp",
      q1: "DriveBox hỗ trợ hệ điều hành nào?",
      a1: "DriveBox hiện hỗ trợ Windows 10 và Windows 11. Hỗ trợ macOS và Linux đang được lên kế hoạch cho các phiên bản tương lai.",
      q2: "Tôi có cần quyền administrator không?",
      a2: "Có, quyền administrator cần thiết để cài đặt ban đầu nhằm đăng ký system paths và shortcuts.",
      q3: "DriveBox cần bao nhiêu dung lượng ổ cứng?",
      a3: "DriveBox cần khoảng 100MB dung lượng ổ cứng, cộng thêm dung lượng cho các phần mềm thi được tải về.",
      q4: "DriveBox có miễn phí không?",
      a4: "Có, DriveBox hoàn toàn miễn phí và là phần mềm mã nguồn mở."
    },
    contact: { title: "Nhận Hỗ Trợ", namePlaceholder: "Họ và tên", emailPlaceholder: "Email của bạn", messagePlaceholder: "Mô tả vấn đề của bạn", sendMessage: "Gửi Tin Nhắn", messageSent: "Đã gửi tin nhắn thành công!", messageFailed: "Gửi tin nhắn thất bại." },
    footer: { copyright: "© 2024 DriveBox. Mọi quyền được bảo lưu." },
    admin: {
      title: "Admin",
      dashboard: "Tổng Quan",
      analytics: "Phân Tích", 
      messages: "Tin Nhắn",
      settings: "Cài Đặt",
      noAccess: "Không có quyền truy cập",
      adminPanelTitle: "Bảng Điều Khiển Admin",
      welcomeAdmin: "Chào mừng Admin!",
      quickStats: "Thống Kê Nhanh",
      visitors: "Lượt truy cập",
      pageViews: "Lượt xem",
      recentMessages: "Tin Nhắn Gần Đây",
      visitorAnalytics: "Phân Tích Khách Truy Cập",
      avgTime: "TG Trung bình",
      bounceRate: "Tỷ Lệ Thoát",
      topCountries: "Quốc Gia Hàng Đầu",
      name: "Tên",
      email: "Email",
      message: "Tin Nhắn",
      date: "Ngày",
      actions: "Hành Động",
      view: "Xem",
      websiteSettings: "Cài Đặt Website",
      siteTitle: "Tiêu Đề Trang",
      metaDescription: "Mô Tả Meta",
      saveSettings: "Lưu Cài Đặt",
      viewMessageTitle: "Xem Tin Nhắn",
      backToList: "Quay Lại",
      delete: "Xóa",
      reply: "Phản Hồi",
      saving: "Đang lưu...",
      settingsSaved: "Đã lưu thành công!",
      settingsSaveFailed: "Lưu thất bại",
      advancedOptions: "Tùy Chọn Nâng Cao",
      enableMaintenance: "Bật chế độ bảo trì",
      backupFrequency: "Tần suất sao lưu",
      daily: "Hàng ngày",
      weekly: "Hàng tuần", 
      monthly: "Hàng tháng",
      backupNow: "Sao Lưu Ngay",
      trafficChart: "Biểu Đồ Truy Cập",
      chartPlaceholder: "Biểu đồ sẽ hiển thị ở đây",
      noMessages: "Không có tin nhắn",
      noNewMessages: "Không có tin nhắn mới",
      loadingAdminDashboard: "Đang tải...",
      projectsManagement: "Quản Lý Dự Án",
      addProject: "Thêm Dự Án",
      editProject: "Sửa Dự Án",
      projectFormTitleLabel: "Tiêu Đề",
      projectFormDescriptionLabel: "Mô Tả",
      imageUrlLabel: "URL Hình Ảnh",
      liveLinkLabel: "Link Demo",
      repoLinkLabel: "Link Repo", 
      tagsLabel: "Tags",
      commaSeparatedHint: "Cách nhau bởi dấu phẩy",
      visibilityLabel: "Hiển Thị",
      visibleStatus: "Hiển Thị",
      hiddenStatus: "Ẩn",
      cancelButton: "Hủy",
      saveProjectButton: "Lưu",
      projectSavedSuccess: "Đã lưu thành công!",
      projectSaveError: "Lưu thất bại",
      deleteConfirmMessage: "Xác nhận xóa?",
      deleteButton: "Xóa",
      projectTableTitle: "Tiêu Đề",
      imageThumbnail: "Hình Ảnh"
    }
  }
};

export const getTranslation = <K1 extends keyof Translations, K2 extends keyof Translations[K1]>(
  lang: Language,
  key1: K1,
  key2: K2
): string => {
  const mainKey = TRANSLATIONS_CONTENT[lang][key1];
  if (typeof mainKey === 'object' && mainKey !== null && key2 in mainKey) {
    return mainKey[key2 as keyof typeof mainKey] as string;
  }
  return `Missing translation: ${String(key1)}.${String(key2)}`;
};

export const DEFAULT_LANG: Language = 'vi';
export const DEFAULT_THEME: Theme = 'dark';
