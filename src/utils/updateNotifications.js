/**
 * Update Notification System
 * Provides user-friendly notifications for updates
 */

class UpdateNotificationSystem {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 5;
  }

  // Show update available notification
  showUpdateAvailable(updateInfo) {
    if (!updateInfo || !updateInfo.hasUpdate) return;

    const notification = {
      id: Date.now(),
      type: 'update-available',
      title: 'Cập nhật mới có sẵn',
      message: `DriveBox ${updateInfo.latestVersion} đã có sẵn. Bạn đang sử dụng phiên bản ${updateInfo.currentVersion}.`,
      updateInfo,
      timestamp: Date.now(),
      actions: [
        { id: 'download', text: 'Tải xuống ngay', primary: true },
        { id: 'later', text: 'Để sau', secondary: true },
        { id: 'skip', text: 'Bỏ qua phiên bản này', danger: true }
      ]
    };

    this.addNotification(notification);
    return notification;
  }

  // Show download progress notification
  showDownloadProgress(progress) {
    const existingNotification = this.findNotification('update-download');
    
    const notification = {
      id: existingNotification?.id || Date.now(),
      type: 'update-download',
      title: 'Đang tải xuống cập nhật',
      message: `Tiến độ: ${progress.progress}% (${progress.speed || 'N/A'})`,
      progress: progress.progress,
      timestamp: Date.now(),
      dismissible: false
    };

    if (existingNotification) {
      this.updateNotification(existingNotification.id, notification);
    } else {
      this.addNotification(notification);
    }

    return notification;
  }

  // Show download complete notification
  showDownloadComplete(updateInfo) {
    // Remove download progress notification
    this.removeNotificationsByType('update-download');

    const notification = {
      id: Date.now(),
      type: 'update-ready',
      title: 'Cập nhật sẵn sàng cài đặt',
      message: `DriveBox ${updateInfo.version} đã tải xuống thành công. Khởi động lại để cài đặt.`,
      updateInfo,
      timestamp: Date.now(),
      actions: [
        { id: 'restart', text: 'Khởi động lại ngay', primary: true },
        { id: 'later', text: 'Khởi động lại sau', secondary: true }
      ]
    };

    this.addNotification(notification);
    return notification;
  }

  // Show download error notification
  showDownloadError(error, updateInfo) {
    // Remove download progress notification
    this.removeNotificationsByType('update-download');

    const notification = {
      id: Date.now(),
      type: 'update-error',
      title: 'Lỗi tải xuống cập nhật',
      message: `Không thể tải xuống cập nhật: ${error}`,
      error,
      updateInfo,
      timestamp: Date.now(),
      actions: [
        { id: 'retry', text: 'Thử lại', primary: true },
        { id: 'dismiss', text: 'Đóng', secondary: true }
      ]
    };

    this.addNotification(notification);
    return notification;
  }

  // Show update check error notification
  showUpdateCheckError(error) {
    const notification = {
      id: Date.now(),
      type: 'update-check-error',
      title: 'Lỗi kiểm tra cập nhật',
      message: `Không thể kiểm tra cập nhật: ${error}`,
      error,
      timestamp: Date.now(),
      actions: [
        { id: 'retry', text: 'Thử lại', primary: true },
        { id: 'dismiss', text: 'Đóng', secondary: true }
      ]
    };

    this.addNotification(notification);
    return notification;
  }

  // Show no updates notification
  showNoUpdates(currentVersion) {
    const notification = {
      id: Date.now(),
      type: 'no-updates',
      title: 'Không có cập nhật',
      message: `Bạn đang sử dụng phiên bản mới nhất (${currentVersion}).`,
      timestamp: Date.now(),
      autoClose: 3000 // Auto close after 3 seconds
    };

    this.addNotification(notification);
    return notification;
  }

  // Add notification to the queue
  addNotification(notification) {
    this.notifications.unshift(notification);
    
    // Limit number of notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    // Emit notification event
    this.emitNotification('add', notification);
    
    // Auto-close if specified
    if (notification.autoClose) {
      setTimeout(() => {
        this.removeNotification(notification.id);
      }, notification.autoClose);
    }

    return notification;
  }

  // Update existing notification
  updateNotification(id, updates) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications[index] = { ...this.notifications[index], ...updates };
      this.emitNotification('update', this.notifications[index]);
      return this.notifications[index];
    }
    return null;
  }

  // Remove notification by ID
  removeNotification(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      const notification = this.notifications.splice(index, 1)[0];
      this.emitNotification('remove', notification);
      return notification;
    }
    return null;
  }

  // Remove notifications by type
  removeNotificationsByType(type) {
    const removed = this.notifications.filter(n => n.type === type);
    this.notifications = this.notifications.filter(n => n.type !== type);
    
    removed.forEach(notification => {
      this.emitNotification('remove', notification);
    });
    
    return removed;
  }

  // Find notification by type
  findNotification(type) {
    return this.notifications.find(n => n.type === type);
  }

  // Get all notifications
  getAllNotifications() {
    return [...this.notifications];
  }

  // Clear all notifications
  clearAll() {
    const cleared = [...this.notifications];
    this.notifications = [];
    
    cleared.forEach(notification => {
      this.emitNotification('remove', notification);
    });
    
    return cleared;
  }

  // Emit notification event (to be implemented by the renderer)
  emitNotification(action, notification) {
    // This will be handled by the main process to send to renderer
    console.log(`Notification ${action}:`, notification);
  }

  // Handle notification action
  handleAction(notificationId, actionId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) return null;

    const action = notification.actions?.find(a => a.id === actionId);
    if (!action) return null;

    // Emit action event
    this.emitNotification('action', { notification, action, actionId });

    // Handle common actions
    switch (actionId) {
      case 'dismiss':
        this.removeNotification(notificationId);
        break;
      case 'later':
        this.removeNotification(notificationId);
        break;
    }

    return { notification, action };
  }

  // Get notification statistics
  getStats() {
    const stats = {
      total: this.notifications.length,
      byType: {}
    };

    this.notifications.forEach(notification => {
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
    });

    return stats;
  }
}

module.exports = UpdateNotificationSystem;
