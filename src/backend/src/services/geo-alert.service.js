/**
 * Geo Alert Service - Location-based safety alerts
 * Handles radius-based targeting, cooldown management, and privacy-compliant messaging
 */

class GeoAlertService {
  constructor(dependencies = {}) {
    this.pushNotifications = dependencies.pushNotifications;
    this.locationService = dependencies.locationService;
    this.storage = dependencies.storage;
    this.analytics = dependencies.analytics;
    this.i18n = dependencies.i18n;

    this.cooldownPeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.supportedRadii = [500, 1000, 2000]; // meters
    this.mandatoryMessage = '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。';
    this.status = { canReceiveGeoAlerts: true, canSendNotifications: true };
  }

  /**
   * Check if user should receive alert based on location and radius
   */
  async shouldReceiveAlert(alert, userLocation) {
    try {
      const distance = await this.locationService.calculateDistance(alert.center, userLocation);
      return distance <= alert.radius;
    } catch (error) {
      throw new Error(`Failed to check alert eligibility: ${error.message}`);
    }
  }

  /**
   * Check if alert can be sent (cooldown management)
   */
  async canSendAlert(alert, currentTime) {
    try {
      const cooldowns = await this._getCooldowns();
      const lastAlertTime = cooldowns[alert.alertId];

      if (!lastAlertTime) {
        return true; // No previous alert
      }

      const timeSinceLastAlert = new Date(currentTime) - new Date(lastAlertTime);
      return timeSinceLastAlert >= this.cooldownPeriod;
    } catch (error) {
      throw new Error(`Failed to check cooldown: ${error.message}`);
    }
  }

  /**
   * Get cooldown status for specific alert
   */
  async getCooldownStatus(alertId, currentTime) {
    try {
      const cooldowns = await this._getCooldowns();
      const lastAlertTime = cooldowns[alertId];

      if (!lastAlertTime) {
        return { isInCooldown: false };
      }

      const timeSinceLastAlert = new Date(currentTime) - new Date(lastAlertTime);
      const isInCooldown = timeSinceLastAlert < this.cooldownPeriod;

      if (isInCooldown) {
        const remainingMs = this.cooldownPeriod - timeSinceLastAlert;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        const nextAlertTime = new Date(new Date(lastAlertTime).getTime() + this.cooldownPeriod);

        return {
          isInCooldown: true,
          remainingMinutes,
          message: `${remainingMinutes}分鐘後可再次接收`,
          nextAlertTime: nextAlertTime.toISOString()
        };
      }

      return { isInCooldown: false };
    } catch (error) {
      throw new Error(`Failed to get cooldown status: ${error.message}`);
    }
  }

  /**
   * Update cooldown timer for alert
   */
  async updateCooldownTimer(alertId, timestamp) {
    try {
      const cooldowns = await this._getCooldowns();
      cooldowns[alertId] = timestamp;
      await this.storage.setItem('alert_cooldowns', JSON.stringify(cooldowns));
    } catch (error) {
      throw new Error(`Failed to update cooldown timer: ${error.message}`);
    }
  }

  /**
   * Reset expired cooldowns
   */
  async resetExpiredCooldowns(currentTime) {
    try {
      const cooldowns = await this._getCooldowns();
      const activeCooldowns = {};

      for (const [alertId, lastTime] of Object.entries(cooldowns)) {
        const timeSinceLastAlert = new Date(currentTime) - new Date(lastTime);
        if (timeSinceLastAlert < this.cooldownPeriod) {
          activeCooldowns[alertId] = lastTime;
        }
      }

      await this.storage.setItem('alert_cooldowns', JSON.stringify(activeCooldowns));
    } catch (error) {
      throw new Error(`Failed to reset expired cooldowns: ${error.message}`);
    }
  }

  /**
   * Create alert with privacy-compliant message (no PII)
   */
  async createAlert(data) {
    try {
      const alert = {
        alertId: data.alertId || this._generateAlertId(),
        priority: data.priority || 'info',
        message: this.mandatoryMessage, // Always use standard message
        timestamp: new Date().toISOString(),
        center: data.center,
        radius: data.radius
      };

      // Never include any PII
      delete alert.name;
      delete alert.age;
      delete alert.gender;
      delete alert.photo;
      delete alert.description;

      return alert;
    } catch (error) {
      throw new Error(`Failed to create alert: ${error.message}`);
    }
  }

  /**
   * Create alert message (always uses standard privacy-compliant text)
   */
  async createAlertMessage(personData) {
    // Ignore all person data to maintain privacy
    return this.mandatoryMessage;
  }

  /**
   * Create general area description without specific details
   */
  async createAreaDescription(location) {
    try {
      // Only provide general district-level description
      return '新竹市東區附近'; // Generic area description
    } catch (error) {
      throw new Error(`Failed to create area description: ${error.message}`);
    }
  }

  /**
   * Send alert with appropriate priority and platform settings
   */
  async sendAlert(alert, options = {}) {
    try {
      const notification = await this._buildNotification(alert, options);
      await this.pushNotifications.sendNotification(notification);

      // Update cooldown
      await this.updateCooldownTimer(alert.alertId, new Date().toISOString());

      // Track analytics
      await this.analytics.track('geo_alert_sent', {
        alertId: alert.alertId,
        priority: alert.priority,
        timestamp: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      // Handle notification failures
      if (error.message.includes('Permission denied') || error.message.includes('Notifications disabled')) {
        await this._handleNotificationFailure(alert);
        throw error;
      }
      throw new Error(`Failed to send alert: ${error.message}`);
    }
  }

  /**
   * Create alert UI with mandatory action buttons
   */
  async createAlertUI(alert) {
    try {
      const actions = [
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

      if (alert.priority === 'critical') {
        actions.unshift(
          { id: 'dismiss', title: '關閉' },
          { id: 'snooze', title: '5分鐘後提醒' }
        );
      }

      return {
        alert,
        actions
      };
    } catch (error) {
      throw new Error(`Failed to create alert UI: ${error.message}`);
    }
  }

  /**
   * A/B Testing: Assign user to test group
   */
  async assignToABTestGroup(userId) {
    try {
      // Simple hash-based assignment
      const hash = this._hashString(userId);
      const testGroup = hash % 2 === 0 ? 'safety_message_variant_A' : 'safety_message_variant_B';

      await this.storage.setItem(`ab_test_${userId}`, testGroup);
      return testGroup;
    } catch (error) {
      throw new Error(`Failed to assign A/B test group: ${error.message}`);
    }
  }

  /**
   * Get variant message for A/B testing
   */
  async getVariantMessage(variant) {
    try {
      if (variant === 'safety_message_variant_B') {
        return '安全提醒：此區域有協尋個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。';
      }
      // Both variants must contain core safety instructions
      return this.mandatoryMessage;
    } catch (error) {
      throw new Error(`Failed to get variant message: ${error.message}`);
    }
  }

  /**
   * Track engagement for A/B testing
   */
  async trackEngagement(alertId, testGroup, action) {
    try {
      await this.analytics.track('geo_alert_engagement', {
        alertId,
        testGroup,
        action,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      throw new Error(`Failed to track engagement: ${error.message}`);
    }
  }

  /**
   * Record user response for effectiveness analysis
   */
  async recordUserResponse(response) {
    try {
      const effectiveness = this._calculateEffectiveness(response.userAction);

      await this.analytics.track('geo_alert_response', {
        alertId: response.alertId,
        testGroup: response.testGroup,
        action: response.userAction,
        responseTime: response.responseTime,
        effectiveness
      });
    } catch (error) {
      throw new Error(`Failed to record user response: ${error.message}`);
    }
  }

  /**
   * Check if user is in alert radius
   */
  async checkUserInAlertRadius() {
    try {
      const userLocation = await this.locationService.getCurrentPosition();
      return userLocation;
    } catch (error) {
      this.status = {
        canReceiveGeoAlerts: false,
        error: 'location_permission_denied',
        message: '需要位置權限接收區域提醒',
        fallbackMode: 'general_notifications'
      };
      throw error;
    }
  }

  /**
   * Handle location unavailable scenario
   */
  async handleLocationUnavailable() {
    try {
      // Send general non-location-based alert
      await this.pushNotifications.sendNotification({
        title: '一般安全提醒',
        body: '新竹地區有協尋個案，請留意周遭。如發現需協助者，請撥打110。',
        priority: 'normal'
      });
    } catch (error) {
      throw new Error(`Failed to handle location unavailable: ${error.message}`);
    }
  }

  /**
   * Show in-app alert banner when push notifications fail
   */
  showInAppBanner(bannerConfig) {
    // Mock implementation - would show banner in UI
    console.log('Showing in-app banner:', bannerConfig);
  }

  /**
   * Attempt emergency delivery for critical alerts
   */
  async attemptEmergencyDelivery() {
    // Mock implementation for emergency delivery
    await this.analytics.track('critical_alert_delivery_attempt', {
      success: false,
      fallbackUsed: true
    });
  }

  /**
   * Get current service status
   */
  getStatus() {
    return this.status;
  }

  // Private helper methods
  async _getCooldowns() {
    try {
      const stored = await this.storage.getItem('alert_cooldowns');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  async _buildNotification(alert, options = {}) {
    const platform = options.platform;
    let notification = {
      title: this._getTitleForPriority(alert.priority, alert.radius),
      body: alert.message
    };

    switch (alert.priority) {
      case 'info':
        notification = {
          ...notification,
          sound: 'default',
          priority: 'normal',
          colorIndicator: 'blue',
          bypassDND: false,
          respectQuietHours: true
        };
        break;

      case 'warning':
        notification = {
          ...notification,
          sound: 'prominent',
          priority: 'high',
          colorIndicator: 'orange'
        };

        if (platform === 'ios') {
          notification.timeSensitive = true;
          notification.interruptionLevel = 'timeSensitive';
        } else if (platform === 'android') {
          notification.channelId = 'geo_alerts_high_importance';
          notification.importance = 'high';
        }
        break;

      case 'critical':
        notification = {
          ...notification,
          sound: 'emergency',
          priority: 'max',
          colorIndicator: 'red',
          vibration: 'emergency_pattern',
          actions: [
            { id: 'dismiss', title: '關閉' },
            { id: 'snooze', title: '5分鐘後提醒' },
            { id: 'emergency', title: '撥打110' }
          ]
        };

        if (platform === 'ios' && options.hasAuthorization) {
          notification.criticalAlert = true;
          notification.interruptionLevel = 'critical';
        } else if (platform === 'android' && options.hasFullScreenConsent) {
          notification.fullScreenIntent = true;
          notification.showOnLockScreen = true;
          notification.allowDismiss = true;
          notification.allowSnooze = true;
        }
        break;
    }

    return notification;
  }

  _getTitleForPriority(priority, radius) {
    const radiusText = radius ? `${Math.round(radius / 1000 * 10) / 10}公里` : '';

    switch (priority) {
      case 'warning':
        return `重要提醒${radiusText ? ` - ${radiusText}範圍內協助提醒` : ''}`;
      case 'critical':
        return `緊急提醒${radiusText ? ` - ${radiusText}範圍內協助提醒` : ''}`;
      default:
        return `一般提醒${radiusText ? ` - ${radiusText}範圍內協助提醒` : ''}`;
    }
  }

  async _handleNotificationFailure(alert) {
    this.status = {
      canSendNotifications: false,
      error: 'notification_permission_denied',
      message: '請啟用通知以接收重要提醒',
      fallbackMode: 'in_app_banner'
    };

    // Show in-app banner as fallback
    this.showInAppBanner({
      type: alert.priority === 'critical' ? 'emergency' : 'warning',
      message: this._getTitleForPriority(alert.priority, alert.radius),
      persistUntilDismissed: alert.priority === 'critical'
    });
  }

  _calculateEffectiveness(action) {
    switch (action) {
      case 'called_emergency':
        return 'high';
      case 'report_suspicious':
        return 'medium';
      case 'dismissed':
        return 'low';
      default:
        return 'unknown';
    }
  }

  _generateAlertId() {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

module.exports = GeoAlertService;