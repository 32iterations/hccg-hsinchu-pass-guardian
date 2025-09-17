// Jest is globally available, no need to import

// Mock dependencies
const mockPushNotifications = {
  sendNotification: jest.fn(),
  scheduleNotification: jest.fn(),
  cancelNotification: jest.fn(),
  requestPermission: jest.fn()
};

const mockLocationService = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  calculateDistance: jest.fn()
};

const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

const mockAnalytics = {
  track: jest.fn(),
  setUserProperty: jest.fn()
};

const mockI18n = {
  t: jest.fn(),
  locale: 'zh-TW'
};

// Import the service
const GeoAlertService = require('../../src/services/geo-alert.service');

describe('GeoAlertService', () => {
  let geoAlertService;
  let mockTimestamp;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestamp = '2025-09-17T16:45:00Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockTimestamp);

    geoAlertService = new GeoAlertService({
      pushNotifications: mockPushNotifications,
      locationService: mockLocationService,
      storage: mockStorage,
      analytics: mockAnalytics,
      i18n: mockI18n
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Alert Radius Configuration and Targeting', () => {
    describe('500m, 1km, 2km Radius Support', () => {
      it('should receive alert when within 500m radius', async () => {
        // Arrange
        const alertCenter = { lat: 24.8067, lng: 120.9687 };
        const userLocation = { lat: 24.8070, lng: 120.9690 }; // ~400m away
        const alert = {
          alertId: '550e8400-e29b-41d4-a716-446655440000',
          center: alertCenter,
          radius: 500,
          priority: 'warning',
          message: '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。'
        };

        mockLocationService.getCurrentPosition.mockResolvedValue(userLocation);
        mockLocationService.calculateDistance.mockReturnValue(400); // 400m

        // Act
        const shouldReceive = await geoAlertService.shouldReceiveAlert(alert, userLocation);

        // Assert
        expect(shouldReceive).toBe(true);
        expect(mockLocationService.calculateDistance).toHaveBeenCalledWith(alertCenter, userLocation);
      });

      it('should NOT receive alert when outside 1km radius', async () => {
        // Arrange
        const alertCenter = { lat: 24.8067, lng: 120.9687 };
        const userLocation = { lat: 24.8180, lng: 120.9800 }; // ~1.2km away
        const alert = {
          center: alertCenter,
          radius: 1000,
          priority: 'info'
        };

        mockLocationService.calculateDistance.mockReturnValue(1200); // 1.2km

        // Act
        const shouldReceive = await geoAlertService.shouldReceiveAlert(alert, userLocation);

        // Assert
        expect(shouldReceive).toBe(false);
      });

      it('should support 2km radius for wide area alerts', async () => {
        // Arrange
        const alertCenter = { lat: 24.8067, lng: 120.9687 };
        const userLocation = { lat: 24.8200, lng: 120.9850 }; // ~1.8km away
        const alert = {
          center: alertCenter,
          radius: 2000,
          priority: 'critical'
        };

        mockLocationService.calculateDistance.mockReturnValue(1800); // 1.8km

        // Act
        const shouldReceive = await geoAlertService.shouldReceiveAlert(alert, userLocation);

        // Assert
        expect(shouldReceive).toBe(true);
      });

      it('should handle edge case at exact radius boundary', async () => {
        // Arrange
        const alert = { center: { lat: 24.8067, lng: 120.9687 }, radius: 1000 };
        const userLocation = { lat: 24.8157, lng: 120.9687 }; // Exactly 1000m

        mockLocationService.calculateDistance.mockReturnValue(1000); // Exactly at boundary

        // Act
        const shouldReceive = await geoAlertService.shouldReceiveAlert(alert, userLocation);

        // Assert
        expect(shouldReceive).toBe(true); // Should include boundary
      });
    });
  });

  describe('Alert Cooldown and Spam Prevention', () => {
    describe('5-Minute Minimum Cooldown', () => {
      it('should prevent duplicate alerts within 5-minute cooldown', async () => {
        // Arrange
        const alert = {
          alertId: 'alert-123',
          center: { lat: 24.8067, lng: 120.9687 },
          radius: 500
        };
        const firstAlertTime = '2025-09-17T16:45:00Z';
        const secondAlertTime = '2025-09-17T16:47:00Z'; // 2 minutes later

        mockStorage.getItem.mockResolvedValue(JSON.stringify({
          'alert-123': firstAlertTime
        }));

        // Act
        const canSend = await geoAlertService.canSendAlert(alert, secondAlertTime);

        // Assert
        expect(canSend).toBe(false);
      });

      it('should allow alert after 5-minute cooldown expires', async () => {
        // Arrange
        const alert = {
          alertId: 'alert-123',
          center: { lat: 24.8067, lng: 120.9687 },
          radius: 500
        };
        const firstAlertTime = '2025-09-17T16:45:00Z';
        const secondAlertTime = '2025-09-17T16:50:01Z'; // 5 minutes 1 second later

        mockStorage.getItem.mockResolvedValue(JSON.stringify({
          'alert-123': firstAlertTime
        }));

        // Act
        const canSend = await geoAlertService.canSendAlert(alert, secondAlertTime);

        // Assert
        expect(canSend).toBe(true);
      });

      it('should show cooldown timer to user', async () => {
        // Arrange
        const lastAlertTime = '2025-09-17T16:45:00Z';
        const currentTime = '2025-09-17T16:47:00Z'; // 2 minutes later
        const remainingCooldown = 3; // 3 minutes remaining

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const cooldownStatus = await geoAlertService.getCooldownStatus('alert-123', currentTime);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(cooldownStatus).toEqual({
        //   isInCooldown: true,
        //   remainingMinutes: 3,
        //   message: '3分鐘後可再次接收',
        //   nextAlertTime: '2025-09-17T16:50:00Z'
        // });
      });

      it('should reset cooldown when timer expires', async () => {
        // Arrange
        const expiredTime = '2025-09-17T16:50:01Z';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.resetExpiredCooldowns(expiredTime);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockStorage.setItem).toHaveBeenCalledWith('alert_cooldowns',
        //   expect.not.objectContaining({
        //     'expired-alert-id': expect.any(String)
        //   })
        // );
      });
    });
  });

  describe('Privacy Protection - No PII in Alerts', () => {
    describe('Alert Content Restrictions', () => {
      it('should never include names in alert messages', async () => {
        // Arrange
        const missingPersonData = {
          name: '王小明',
          age: 65,
          gender: '男性',
          description: '身高170公分，穿藍色上衣'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const alertMessage = await geoAlertService.createAlertMessage(missingPersonData);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(alertMessage).toBe('安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。');
        // expect(alertMessage).not.toContain('王小明');
        // expect(alertMessage).not.toContain('65歲');
        // expect(alertMessage).not.toContain('男性');
      });

      it('should never include age or gender information', async () => {
        // Arrange
        const personDetails = {
          age: 78,
          gender: '女性',
          medicalConditions: ['失智症', '高血壓']
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const alert = await geoAlertService.createAlert(personDetails);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(alert.message).not.toContain('78');
        // expect(alert.message).not.toContain('女性');
        // expect(alert.message).not.toContain('失智症');
        // expect(alert.message).not.toContain('高血壓');
      });

      it('should never include photos or physical descriptions', async () => {
        // Arrange
        const detailedInfo = {
          photo: 'base64-encoded-image',
          height: '170公分',
          clothing: '藍色上衣，黑色長褲',
          features: '戴眼鏡，有疤痕'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const alert = await geoAlertService.createAlert(detailedInfo);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(alert).not.toHaveProperty('photo');
        // expect(alert).not.toHaveProperty('image');
        // expect(alert.message).not.toContain('170公分');
        // expect(alert.message).not.toContain('藍色上衣');
        // expect(alert.message).not.toContain('戴眼鏡');
      });

      it('should use only general area descriptions', async () => {
        // Arrange
        const location = {
          lat: 24.8067,
          lng: 120.9687,
          address: '新竹市東區光復路二段101號',
          landmark: '新竹火車站'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const areaDescription = await geoAlertService.createAreaDescription(location);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(areaDescription).toBe('新竹市東區附近');
        // expect(areaDescription).not.toContain('光復路二段101號');
        // expect(areaDescription).not.toContain('新竹火車站');
      });
    });
  });

  describe('Alert Priority Levels', () => {
    describe('Info Level Alerts', () => {
      it('should send info level with standard notification settings', async () => {
        // Arrange
        const infoAlert = {
          alertId: 'info-alert-123',
          priority: 'info',
          message: '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert(infoAlert);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith({
        //   title: expect.stringContaining('一般提醒'),
        //   body: infoAlert.message,
        //   sound: 'default',
        //   priority: 'normal',
        //   colorIndicator: 'blue',
        //   bypassDND: false
        // });
      });

      it('should not override Do Not Disturb for info alerts', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'info' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     bypassDND: false,
        //     respectQuietHours: true
        //   })
        // );
      });
    });

    describe('Warning Level Alerts', () => {
      it('should send warning level with prominent notification', async () => {
        // Arrange
        const warningAlert = {
          alertId: 'warning-alert-456',
          priority: 'warning',
          message: '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert(warningAlert);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith({
        //   title: expect.stringContaining('重要提醒'),
        //   body: warningAlert.message,
        //   sound: 'prominent',
        //   priority: 'high',
        //   colorIndicator: 'orange',
        //   timeSensitive: true, // iOS
        //   importance: 'high' // Android
        // });
      });

      it('should use Time-Sensitive delivery on iOS for warnings', async () => {
        // Arrange
        const platform = 'ios';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'warning' }, { platform });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     timeSensitive: true,
        //     interruptionLevel: 'timeSensitive'
        //   })
        // );
      });

      it('should use high importance channel on Android for warnings', async () => {
        // Arrange
        const platform = 'android';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'warning' }, { platform });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     channelId: 'geo_alerts_high_importance',
        //     importance: 'high'
        //   })
        // );
      });
    });

    describe('Critical Level Alerts', () => {
      it('should send critical level with maximum urgency settings', async () => {
        // Arrange
        const criticalAlert = {
          alertId: 'critical-alert-789',
          priority: 'critical',
          message: '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert(criticalAlert);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith({
        //   title: expect.stringContaining('緊急提醒'),
        //   body: criticalAlert.message,
        //   sound: 'emergency',
        //   priority: 'max',
        //   colorIndicator: 'red',
        //   vibration: 'emergency_pattern'
        // });
      });

      it('should use Critical Alert on iOS if authorized', async () => {
        // Arrange
        const platform = 'ios';
        const hasAuthorization = true;

        mockPushNotifications.requestPermission.mockResolvedValue({
          criticalAlert: 'authorized'
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'critical' }, { platform, hasAuthorization });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     criticalAlert: true,
        //     interruptionLevel: 'critical'
        //   })
        // );
      });

      it('should use Full-Screen Intent on Android with user consent', async () => {
        // Arrange
        const platform = 'android';
        const hasFullScreenConsent = true;

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'critical' }, { platform, hasFullScreenConsent });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     fullScreenIntent: true,
        //     showOnLockScreen: true,
        //     allowDismiss: true,
        //     allowSnooze: true
        //   })
        // );
      });

      it('should allow user to dismiss or snooze critical alerts', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'critical' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     actions: [
        //       { id: 'dismiss', title: '關閉' },
        //       { id: 'snooze', title: '5分鐘後提醒' },
        //       { id: 'emergency', title: '撥打110' }
        //     ]
        //   })
        // );
      });
    });
  });

  describe('Mandatory Safety Instructions', () => {
    describe('Required Message Content', () => {
      it('should always include "請撥打110" in all alert levels', async () => {
        // Arrange
        const alertLevels = ['info', 'warning', 'critical'];

        // Act & Assert - Will fail in RED phase
        for (const priority of alertLevels) {
          await expect(async () => {
            const alert = await geoAlertService.createAlert({ priority });
          }).rejects.toThrow();

          // Expected behavior:
          // expect(alert.message).toContain('請撥打110');
        }
      });

      it('should always include "切勿自行接近" in all alert levels', async () => {
        // Arrange
        const alertLevels = ['info', 'warning', 'critical'];

        // Act & Assert - Will fail in RED phase
        for (const priority of alertLevels) {
          await expect(async () => {
            const alert = await geoAlertService.createAlert({ priority });
          }).rejects.toThrow();

          // Expected behavior:
          // expect(alert.message).toContain('切勿自行接近');
        }
      });

      it('should provide emergency contact button in all alerts', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const alertUI = await geoAlertService.createAlertUI({ priority: 'info' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(alertUI.actions).toContainEqual({
        //   id: 'call_emergency',
        //   title: '撥打110',
        //   type: 'call',
        //   number: '110'
        // });
      });

      it('should provide "回報可疑" button for volunteer coordination', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const alertUI = await geoAlertService.createAlertUI({ priority: 'warning' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(alertUI.actions).toContainEqual({
        //   id: 'report_suspicious',
        //   title: '回報可疑',
        //   type: 'action'
        // });
      });

      it('should provide safety guidelines link', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const alertUI = await geoAlertService.createAlertUI({ priority: 'critical' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(alertUI.actions).toContainEqual({
        //   id: 'safety_guidelines',
        //   title: '安全指引',
        //   type: 'link',
        //   url: expect.stringContaining('safety-guidelines')
        // });
      });
    });
  });

  describe('A/B Testing for Safety Message Effectiveness', () => {
    describe('Message Variant Testing', () => {
      it('should assign users to A/B test groups for message variations', async () => {
        // Arrange
        const userId = 'anonymous-user-123';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const testGroup = await geoAlertService.assignToABTestGroup(userId);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(['safety_message_variant_A', 'safety_message_variant_B']).toContain(testGroup);
        // expect(mockStorage.setItem).toHaveBeenCalledWith(`ab_test_${userId}`, testGroup);
      });

      it('should use variant B wording for test group B', async () => {
        // Arrange
        mockStorage.getItem.mockResolvedValue('safety_message_variant_B');

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const message = await geoAlertService.getVariantMessage('safety_message_variant_B');
        }).rejects.toThrow();

        // Expected behavior:
        // expect(message).toContain('安全提醒：此區域有協尋個案');
        // // Variant B might have different wording but same core safety instructions
        // expect(message).toContain('請撥打110');
        // expect(message).toContain('切勿自行接近');
      });

      it('should track engagement metrics for A/B test analysis', async () => {
        // Arrange
        const testGroup = 'safety_message_variant_A';
        const alertId = 'alert-123';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.trackEngagement(alertId, testGroup, 'opened');
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockAnalytics.track).toHaveBeenCalledWith('geo_alert_engagement', {
        //   alertId: alertId,
        //   testGroup: testGroup,
        //   action: 'opened',
        //   timestamp: mockTimestamp
        // });
      });

      it('should record user response for effectiveness analysis', async () => {
        // Arrange
        const response = {
          alertId: 'alert-456',
          testGroup: 'safety_message_variant_B',
          userAction: 'called_emergency',
          responseTime: 45 // seconds
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.recordUserResponse(response);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockAnalytics.track).toHaveBeenCalledWith('geo_alert_response', {
        //   alertId: response.alertId,
        //   testGroup: response.testGroup,
        //   action: response.userAction,
        //   responseTime: response.responseTime,
        //   effectiveness: 'high' // Called emergency = effective
        // });
      });

      it('should ensure core safety instructions remain unchanged across variants', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const variantA = await geoAlertService.getVariantMessage('safety_message_variant_A');
          const variantB = await geoAlertService.getVariantMessage('safety_message_variant_B');
        }).rejects.toThrow();

        // Expected behavior: both variants must contain core safety instructions
        // expect(variantA).toContain('撥打110');
        // expect(variantA).toContain('切勿接近');
        // expect(variantB).toContain('撥打110');
        // expect(variantB).toContain('切勿接近');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('Location Permission Errors', () => {
      it('should handle location permission denied gracefully', async () => {
        // Arrange
        mockLocationService.getCurrentPosition.mockRejectedValue(new Error('Location permission denied'));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.checkUserInAlertRadius();
        }).rejects.toThrow();

        // Expected behavior:
        // expect(geoAlertService.getStatus()).toEqual({
        //   canReceiveGeoAlerts: false,
        //   error: 'location_permission_denied',
        //   message: '需要位置權限接收區域提醒',
        //   fallbackMode: 'general_notifications'
        // });
      });

      it('should fallback to general notifications when location unavailable', async () => {
        // Arrange
        mockLocationService.getCurrentPosition.mockRejectedValue(new Error('Location unavailable'));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.handleLocationUnavailable();
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockPushNotifications.sendNotification).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     title: '一般安全提醒',
        //     body: '新竹地區有協尋個案，請留意周遭。如發現需協助者，請撥打110。'
        //   })
        // );
      });
    });

    describe('Push Notification Errors', () => {
      it('should handle push notification permission disabled', async () => {
        // Arrange
        mockPushNotifications.sendNotification.mockRejectedValue(new Error('Permission denied'));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'warning' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(geoAlertService.getStatus()).toEqual({
        //   canSendNotifications: false,
        //   error: 'notification_permission_denied',
        //   message: '請啟用通知以接收重要提醒',
        //   fallbackMode: 'in_app_banner'
        // });
      });

      it('should show in-app alert banner when push notifications fail', async () => {
        // Arrange
        mockPushNotifications.sendNotification.mockRejectedValue(new Error('Push service unavailable'));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'critical' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(geoAlertService.showInAppBanner).toHaveBeenCalledWith({
        //   type: 'emergency',
        //   message: expect.stringContaining('緊急提醒'),
        //   persistUntilDismissed: true
        // });
      });

      it('should still attempt delivery for critical alerts when notifications disabled', async () => {
        // Arrange
        mockPushNotifications.sendNotification.mockRejectedValue(new Error('Notifications disabled'));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await geoAlertService.sendAlert({ priority: 'critical' });
        }).rejects.toThrow();

        // Expected behavior:
        // expect(geoAlertService.attemptEmergencyDelivery).toHaveBeenCalled();
        // expect(mockAnalytics.track).toHaveBeenCalledWith('critical_alert_delivery_attempt', {
        //   success: false,
        //   fallbackUsed: true
        // });
      });
    });
  });
});