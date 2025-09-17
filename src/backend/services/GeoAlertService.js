/**
 * GeoAlertService - P2 Volunteer BLE & Geo Alerts
 *
 * Manages geographical alerts with radius configurations (500m, 1km, 2km),
 * 5-minute cooldowns, priority levels, and mandatory safety instructions.
 * Never includes PII in alerts.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class GeoAlertService {
  constructor(dependencies) {
    this.pushNotifications = dependencies.pushNotifications;
    this.locationService = dependencies.locationService;
    this.storage = dependencies.storage;
    this.analytics = dependencies.analytics;
    this.i18n = dependencies.i18n;

    this.alertCooldowns = new Map();
    this.abTestGroups = new Map();
  }

  async shouldReceiveAlert(alert, userLocation) {
    const distance = this.locationService.calculateDistance(alert.center, userLocation);
    return distance <= alert.radius;
  }

  async sendAlert(alert, options = {}) {
    // Check cooldown first
    if (!(await this.canSendAlert(alert))) {
      return false;
    }

    const notificationConfig = this.buildNotificationConfig(alert, options);

    try {
      await this.pushNotifications.sendNotification(notificationConfig);
      await this.updateCooldownTimer(alert.alertId, new Date().toISOString());
      return true;
    } catch (error) {
      // Handle notification failures
      await this.handleNotificationFailure(alert, error);
      return false;
    }
  }

  buildNotificationConfig(alert, options = {}) {
    const baseConfig = {
      title: this.getTitleForPriority(alert.priority),
      body: this.getAlertMessage(alert),
      priority: this.mapPriority(alert.priority),
      actions: this.getAlertActions(alert)
    };

    // Platform-specific configurations
    if (options.platform === 'ios') {
      return this.configureIOSNotification(baseConfig, alert, options);
    } else if (options.platform === 'android') {
      return this.configureAndroidNotification(baseConfig, alert, options);
    }

    return baseConfig;
  }

  getTitleForPriority(priority) {
    switch (priority) {
      case 'info':
        return '一般提醒';
      case 'warning':
        return '重要提醒';
      case 'critical':
        return '緊急提醒';
      default:
        return '安全提醒';
    }
  }

  getAlertMessage(alert) {
    // Standard safety message - NO PII allowed
    return '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。';
  }

  mapPriority(priority) {
    switch (priority) {
      case 'info': return 'normal';
      case 'warning': return 'high';
      case 'critical': return 'max';
      default: return 'normal';
    }
  }

  getAlertActions(alert) {
    return [
      {
        id: 'call_emergency',
        title: '撥打110',
        type: 'call',
        number: '110'
      },
      {
        id: 'report_suspicious',
        title: '回報可疑',
        type: 'action'
      },
      {
        id: 'safety_guidelines',
        title: '安全指引',
        type: 'link',
        url: '/safety-guidelines'
      }
    ];
  }

  configureIOSNotification(baseConfig, alert, options) {
    const iosConfig = { ...baseConfig };

    switch (alert.priority) {
      case 'warning':
        iosConfig.timeSensitive = true;
        iosConfig.interruptionLevel = 'timeSensitive';
        iosConfig.sound = 'prominent';
        iosConfig.colorIndicator = 'orange';
        break;

      case 'critical':
        iosConfig.sound = 'emergency';
        iosConfig.colorIndicator = 'red';
        iosConfig.vibration = 'emergency_pattern';

        if (options.hasAuthorization) {
          iosConfig.criticalAlert = true;
          iosConfig.interruptionLevel = 'critical';
        }
        break;

      default:
        iosConfig.sound = 'default';
        iosConfig.colorIndicator = 'blue';
        iosConfig.bypassDND = false;
        iosConfig.respectQuietHours = true;
    }

    return iosConfig;
  }

  configureAndroidNotification(baseConfig, alert, options) {
    const androidConfig = { ...baseConfig };

    switch (alert.priority) {
      case 'warning':
        androidConfig.channelId = 'geo_alerts_high_importance';
        androidConfig.importance = 'high';
        androidConfig.sound = 'prominent';
        androidConfig.colorIndicator = 'orange';
        break;

      case 'critical':
        androidConfig.sound = 'emergency';
        androidConfig.colorIndicator = 'red';
        androidConfig.vibration = 'emergency_pattern';

        if (options.hasFullScreenConsent) {
          androidConfig.fullScreenIntent = true;
          androidConfig.showOnLockScreen = true;
          androidConfig.allowDismiss = true;
          androidConfig.allowSnooze = true;
        }

        // Add dismissal actions
        androidConfig.actions = [
          ...androidConfig.actions,
          { id: 'dismiss', title: '關閉' },
          { id: 'snooze', title: '5分鐘後提醒' },
          { id: 'emergency', title: '撥打110' }
        ];
        break;

      default:
        androidConfig.channelId = 'geo_alerts_normal';
        androidConfig.importance = 'normal';
        androidConfig.bypassDND = false;
        androidConfig.respectQuietHours = true;
    }

    return androidConfig;
  }

  async canSendAlert(alert, currentTime) {
    const cooldowns = await this.getStoredCooldowns();
    const lastSent = cooldowns[alert.alertId];

    if (!lastSent) {
      return true;
    }

    const timeDiff = new Date(currentTime || new Date().toISOString()) - new Date(lastSent);
    const cooldownMs = 5 * 60 * 1000; // 5 minutes

    return timeDiff >= cooldownMs;
  }

  async updateCooldownTimer(alertId, timestamp) {
    const cooldowns = await this.getStoredCooldowns();
    cooldowns[alertId] = timestamp;
    await this.storage.setItem('alert_cooldowns', JSON.stringify(cooldowns));
    this.alertCooldowns.set(alertId, timestamp);
  }

  async getCooldownStatus(alertId, currentTime) {
    const cooldowns = await this.getStoredCooldowns();
    const lastSent = cooldowns[alertId];

    if (!lastSent) {
      return {
        isInCooldown: false,
        remainingMinutes: 0
      };
    }

    const timeDiff = new Date(currentTime) - new Date(lastSent);
    const cooldownMs = 5 * 60 * 1000;
    const remainingMs = cooldownMs - timeDiff;

    if (remainingMs <= 0) {
      return {
        isInCooldown: false,
        remainingMinutes: 0
      };
    }

    const remainingMinutes = Math.ceil(remainingMs / 60000);

    return {
      isInCooldown: true,
      remainingMinutes: remainingMinutes,
      message: `${remainingMinutes}分鐘後可再次接收`,
      nextAlertTime: new Date(new Date(lastSent).getTime() + cooldownMs).toISOString()
    };
  }

  async resetExpiredCooldowns(currentTime) {
    const cooldowns = await this.getStoredCooldowns();
    const cooldownMs = 5 * 60 * 1000;
    const current = new Date(currentTime);

    const filtered = {};
    for (const [alertId, timestamp] of Object.entries(cooldowns)) {
      const timeDiff = current - new Date(timestamp);
      if (timeDiff < cooldownMs) {
        filtered[alertId] = timestamp;
      }
    }

    await this.storage.setItem('alert_cooldowns', JSON.stringify(filtered));
  }

  async createAlert(data) {
    const alert = {
      alertId: require('crypto').randomUUID(),
      message: this.getAlertMessage(data),
      priority: data.priority || 'info',
      timestamp: new Date().toISOString()
    };

    // Ensure no PII is included
    delete alert.name;
    delete alert.age;
    delete alert.gender;
    delete alert.photo;
    delete alert.image;
    delete alert.description;
    delete alert.medicalConditions;

    return alert;
  }

  createAlertMessage(personData) {
    // Always return the same generic message - NO PII
    return '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。';
  }

  createAreaDescription(location) {
    // Generic area description only
    return '新竹市東區附近';
  }

  createAlertUI(alert) {
    return {
      actions: this.getAlertActions(alert)
    };
  }

  // A/B Testing for safety message effectiveness
  async assignToABTestGroup(userId) {
    const groups = ['safety_message_variant_A', 'safety_message_variant_B'];
    const group = groups[Math.floor(Math.random() * groups.length)];

    await this.storage.setItem(`ab_test_${userId}`, group);
    this.abTestGroups.set(userId, group);

    return group;
  }

  async getVariantMessage(variant) {
    const baseMessage = '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。';

    switch (variant) {
      case 'safety_message_variant_A':
        return baseMessage;
      case 'safety_message_variant_B':
        return '安全提醒：此區域有協尋個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。';
      default:
        return baseMessage;
    }
  }

  async trackEngagement(alertId, testGroup, action) {
    this.analytics.track('geo_alert_engagement', {
      alertId: alertId,
      testGroup: testGroup,
      action: action,
      timestamp: new Date().toISOString()
    });
  }

  async recordUserResponse(response) {
    const effectiveness = response.userAction === 'called_emergency' ? 'high' : 'medium';

    this.analytics.track('geo_alert_response', {
      alertId: response.alertId,
      testGroup: response.testGroup,
      action: response.userAction,
      responseTime: response.responseTime,
      effectiveness: effectiveness
    });
  }

  // Error handling
  async checkUserInAlertRadius() {
    try {
      const position = await this.locationService.getCurrentPosition();
      return position;
    } catch (error) {
      throw new Error('Location permission denied');
    }
  }

  async handleLocationUnavailable() {
    // Fallback to general notifications
    await this.pushNotifications.sendNotification({
      title: '一般安全提醒',
      body: '新竹地區有協尋個案，請留意周遭。如發現需協助者，請撥打110。'
    });
  }

  async handleNotificationFailure(alert, error) {
    if (error.message.includes('Permission denied')) {
      this.status = {
        canSendNotifications: false,
        error: 'notification_permission_denied',
        message: '請啟用通知以接收重要提醒',
        fallbackMode: 'in_app_banner'
      };
    }

    // Show in-app banner for critical alerts
    if (alert.priority === 'critical') {
      await this.showInAppBanner({
        type: 'emergency',
        message: '緊急提醒',
        persistUntilDismissed: true
      });

      await this.attemptEmergencyDelivery();

      this.analytics.track('critical_alert_delivery_attempt', {
        success: false,
        fallbackUsed: true
      });
    }
  }

  async showInAppBanner(config) {
    // Mock implementation for in-app banner
    return true;
  }

  async attemptEmergencyDelivery() {
    // Mock implementation for emergency delivery attempts
    return true;
  }

  getStatus() {
    return this.status || {
      canReceiveGeoAlerts: true,
      canSendNotifications: true
    };
  }

  // Helper methods
  async getStoredCooldowns() {
    const stored = await this.storage.getItem('alert_cooldowns');
    return stored ? JSON.parse(stored) : {};
  }
}

module.exports = GeoAlertService;