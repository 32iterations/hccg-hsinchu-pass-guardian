/**
 * Notification Service - Minimal implementation for TDD GREEN phase
 */

class NotificationService {
  // These methods are empty and will be mocked by jest
  async sendDeviceBindingNotification() {}
  async sendConnectionAlert() {}
  async sendGeofenceAlert() {}
  async sendDwellAlert() {}
  async sendEmergencyAlert() {}
  async sendGeofenceUpdateNotification() {}
}

module.exports = { NotificationService };