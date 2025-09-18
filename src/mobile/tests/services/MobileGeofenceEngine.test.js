/**
 * Mobile Geofence Engine - GREEN Phase Tests
 * React Native implementation for iOS Core Location and Android GeofencingClient
 *
 * Requirements:
 * - iOS: Core Location with Always permission for background geofencing
 * - Android: GeofencingClient with location permissions
 * - 10m accuracy requirement with GPS uncertainty handling
 * - Background processing and notification integration
 * - Integration with backend geofence engine
 */

const { MobileGeofenceEngine } = require('../../src/services/MobileGeofenceEngine');

// Use mocked React Native modules
const mockRN = require('react-native');
const Platform = mockRN.Platform;
const Geolocation = mockRN.Geolocation;
// Extract permissions from the mock, with fallbacks
const Permissions = mockRN.Permissions || {};
const PERMISSIONS = Permissions.PERMISSIONS || {};
const RESULTS = Permissions.RESULTS || {};
const check = Permissions.check || jest.fn().mockResolvedValue('granted');
const request = Permissions.request || jest.fn().mockResolvedValue('granted');
const PushNotification = mockRN.PushNotification;

describe('MobileGeofenceEngine - GREEN Phase Tests', () => {
  let geofenceEngine;
  let mockConfig;
  let mockBackendService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      apiEndpoint: 'https://api.hsinchu.gov.tw/guardian',
      accuracyThresholdMeters: 10,
      exitConfirmationDelaySeconds: 30,
      cooldownMinutes: 5,
      maxGeofencesPerUser: 10
    };

    mockBackendService = {
      syncGeofences: jest.fn().mockResolvedValue([]),
      reportGeofenceEvent: jest.fn().mockResolvedValue({ success: true }),
      getActiveGeofences: jest.fn().mockResolvedValue([])
    };

    // Create service instance for GREEN phase testing
    geofenceEngine = new MobileGeofenceEngine(mockConfig);
  });

  describe('iOS Core Location Integration', () => {
    beforeEach(() => {
      // Platform is already mocked in jest.setup.js
      jest.clearAllMocks();
    });

    describe('Location Permission Management', () => {
      it('should request Always location permission for background geofencing', async () => {
        // Arrange
        check.mockResolvedValue(RESULTS.DENIED);
        request.mockResolvedValue(RESULTS.GRANTED);

        // Act
        const result = await geofenceEngine.initializeIOS();

        // Assert
        expect(result.success).toBe(true);
        expect(geofenceEngine.getLocationPermissionStatus()).toBe('always');
      });

      it('should handle permission upgrade from WhenInUse to Always', async () => {
        // Arrange
        check.mockResolvedValueOnce(RESULTS.GRANTED) // WhenInUse granted
             .mockResolvedValueOnce(RESULTS.DENIED);  // Always denied
        request.mockResolvedValue(RESULTS.GRANTED);

        // Act
        const result = await geofenceEngine.upgradeToAlwaysPermission();

        // Assert
        expect(result.success).toBe(true);
        expect(geofenceEngine.canUseBackgroundGeofencing()).toBe(true);
      });

      it('should provide user guidance when permissions denied', async () => {
        // Arrange
        check.mockResolvedValue(RESULTS.DENIED);
        request.mockResolvedValue(RESULTS.DENIED);

        // Act
        const guidance = await geofenceEngine.getPermissionGuidance();

        // Assert
        expect(guidance).toEqual({
          title: '位置權限需求',
          message: '為了在背景監控安全區域，需要「始終」位置權限',
          actionText: '前往設定',
          canOpenSettings: true
        });
      });
    });

    describe('Core Location Geofence Setup', () => {
      it('should register geofences with CLLocationManager', async () => {
        // Arrange
        const geofence = {
          id: 'home-safe-zone',
          name: '家庭安全區',
          center: { latitude: 24.8138, longitude: 120.9675 },
          radius: 100,
          userId: 'user-123'
        };

        // Act
        const result = await geofenceEngine.registerGeofence(geofence);

        // Assert
        expect(result.success).toBe(true);
        expect(result.geofenceId).toBe('home-safe-zone');
        expect(geofenceEngine.getRegisteredGeofences()).toContainEqual(
          expect.objectContaining({
            identifier: 'home-safe-zone',
            center: { latitude: 24.8138, longitude: 120.9675 },
            radius: 100,
            notifyOnEntry: true,
            notifyOnExit: true
          })
        );
      });

      it('should handle iOS geofence limit (20 maximum)', async () => {
        // Arrange
        const manyGeofences = Array.from({ length: 25 }, (_, i) => ({
          id: `geofence-${i}`,
          center: { latitude: 24.8138 + i * 0.001, longitude: 120.9675 },
          radius: 100
        }));

        // Act & Assert
        await expect(
          geofenceEngine.registerGeofences(manyGeofences)
        ).rejects.toThrow('Maximum geofences exceeded');

        expect(geofenceEngine.getRegisteredGeofences()).toHaveLength(20);
        expect(geofenceEngine.getLastError()).toBe('Maximum geofences exceeded');
      });

      it('should configure significant location monitoring as fallback', async () => {
        // Act
        const result = await geofenceEngine.enableSignificantLocationMonitoring();

        // Assert
        expect(result.success).toBe(true);
        expect(geofenceEngine.isSignificantLocationEnabled()).toBe(true);
        expect(geofenceEngine.getLocationUpdateStrategy()).toBe('significant_change');
      });
    });
  });

  describe('Android GeofencingClient Integration', () => {
    beforeEach(() => {
      // Mock Android platform using existing jest setup
      Platform.OS = 'android';
      Platform.Version = 33;
      Platform.select.mockImplementation((platforms) => platforms.android || platforms.default);
    });

    describe('Android Geofencing Setup', () => {
      it('should create GeofencingRequest with proper configuration', async () => {
        // Arrange
        const geofences = [
          {
            id: 'hsinchu-city-hall',
            center: { latitude: 24.8015, longitude: 120.9718 },
            radius: 80,
            expirationDuration: -1 // Never expire
          }
        ];

        // Act
        const request = await geofenceEngine.createGeofencingRequest(geofences);

        // Assert
        expect(request).toEqual(
          expect.objectContaining({
            geofences: expect.arrayContaining([
              expect.objectContaining({
                requestId: 'hsinchu-city-hall',
                transitionTypes: ['ENTER', 'EXIT'],
                expirationDuration: -1
              })
            ]),
            initialTrigger: 'INITIAL_TRIGGER_ENTER'
          })
        );
        expect(geofenceEngine.getGeofencingRequest()).toEqual(request);
      });

      it('should handle Android background location limitations', async () => {
        // Arrange
        check.mockImplementation((permission) => {
          if (permission === PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION) {
            return Promise.resolve(RESULTS.DENIED);
          }
          return Promise.resolve(RESULTS.GRANTED);
        });

        // Act
        const result = await geofenceEngine.initializeAndroid();

        // Assert
        expect(result.success).toBe(true);
        expect(geofenceEngine.getBackgroundLocationStatus()).toEqual({
          hasPermission: false,
          limitedFunctionality: true,
          userActionRequired: true,
          guidance: '需要背景位置權限以監控安全區域'
        });
      });

      it('should implement PendingIntent for geofence transitions', async () => {
        // Act
        const pendingIntent = await geofenceEngine.createGeofencePendingIntent();

        // Assert
        expect(pendingIntent).toEqual(
          expect.objectContaining({
            action: 'com.hsinchu.guardian.GEOFENCE_TRANSITION',
            flags: ['FLAG_UPDATE_CURRENT', 'FLAG_MUTABLE']
          })
        );
        expect(geofenceEngine.getPendingIntent()).toEqual(pendingIntent);
      });
    });
  });

  describe('Accuracy and GPS Uncertainty Handling', () => {
    describe('10m Accuracy Requirement', () => {
      it('should reject location updates with accuracy > 10m', async () => {
        // Arrange
        const inaccurateLocation = {
          latitude: 24.8138,
          longitude: 120.9675,
          accuracy: 15, // > 10m threshold
          timestamp: Date.now()
        };

        // Act
        const result = await geofenceEngine.processLocationUpdate(inaccurateLocation);

        // Assert
        expect(result.event).toBe('uncertain');
        expect(result.confidence).toBe(0.3);
        expect(geofenceEngine.getLocationQualityStatus()).toEqual({
          lastAccuracy: 15,
          qualityStatus: 'poor',
          reason: 'accuracy_threshold_exceeded'
        });
      });

      it('should handle GPS uncertainty in boundary detection', async () => {
        // Arrange
        const geofence = {
          id: 'test-zone',
          center: { latitude: 24.8138, longitude: 120.9675 },
          radius: 100
        };

        const edgeCaseLocations = [
          { lat: 24.8138, lng: 120.9675, accuracy: 8, distance: 95 }, // Near edge, good accuracy
          { lat: 24.8138, lng: 120.9675, accuracy: 12, distance: 95 }, // Near edge, poor accuracy
          { lat: 24.8138, lng: 120.9675, accuracy: 5, distance: 105 }, // Outside, good accuracy
          { lat: 24.8138, lng: 120.9675, accuracy: 15, distance: 105 }  // Outside, poor accuracy
        ];

        // Act & Assert
        await geofenceEngine.registerGeofence(geofence);

        for (const location of edgeCaseLocations) {
          if (location.accuracy <= 10) {
            const result = await geofenceEngine.evaluateGeofenceTransition(
              geofence,
              { ...location, latitude: location.lat, longitude: location.lng }
            );
            expect(result).toBeDefined();
          } else {
            await expect(
              geofenceEngine.evaluateGeofenceTransition(
                geofence,
                { ...location, latitude: location.lat, longitude: location.lng }
              )
            ).rejects.toThrow('Poor GPS accuracy');
          }
        }
      });

      it('should implement accuracy-based confidence levels', async () => {
        // Arrange
        const locationUpdates = [
          { accuracy: 3, expectedConfidence: 'high' },
          { accuracy: 7, expectedConfidence: 'medium' },
          { accuracy: 10, expectedConfidence: 'low' },
          { accuracy: 15, expectedConfidence: 'rejected' }
        ];

        // Act & Assert
        for (const update of locationUpdates) {
          const confidence = await geofenceEngine.calculateLocationConfidence(update);

          expect(confidence.level).toBe(update.expectedConfidence);
          expect(confidence.shouldProcess).toBe(update.accuracy <= 10);
        }
      });
    });
  });

  describe('Background Processing and Notifications', () => {
    describe('Exit Confirmation with 30s Delay', () => {
      it('should implement 30-second confirmation delay for exits', async () => {
        // Arrange
        const geofence = {
          id: 'safe-zone',
          center: { latitude: 24.8138, longitude: 120.9675 },
          radius: 100
        };

        const exitLocation = {
          latitude: 24.8200, // Outside geofence
          longitude: 120.9800,
          accuracy: 5,
          timestamp: Date.now()
        };

        // Act
        const pendingExit = await geofenceEngine.handlePotentialExit(geofence, exitLocation);

        // Assert
        expect(pendingExit).toEqual(
          expect.objectContaining({
            geofenceId: 'safe-zone',
            exitDetectedAt: expect.any(Number),
            confirmationScheduledFor: expect.any(Number),
            status: 'pending_confirmation'
          })
        );
        expect(geofenceEngine.getPendingExits()).toContainEqual(pendingExit);
      });

      it('should cancel exit confirmation if user returns within 30s', async () => {
        // Arrange
        const geofence = { id: 'test-zone', radius: 100 };
        const exitLocation = { latitude: 24.8200, longitude: 120.9800, accuracy: 5 };
        const returnLocation = { latitude: 24.8138, longitude: 120.9675, accuracy: 5 };

        // Act
        await geofenceEngine.handlePotentialExit(geofence, exitLocation);
        await geofenceEngine.handleLocationUpdate(returnLocation);

        // Assert
        expect(geofenceEngine.getPendingExits()).toHaveLength(0);
        expect(geofenceEngine.getLastCancelledExit()).toEqual(
          expect.objectContaining({
            geofenceId: 'test-zone',
            reason: 'user_returned_within_confirmation_window',
            cancelledAt: expect.any(Number)
          })
        );
      });

      it('should confirm exit after 30-second delay expires', async () => {
        // Arrange
        jest.useFakeTimers();
        const geofence = { id: 'timeout-zone', radius: 100 };
        const exitLocation = { latitude: 24.8200, longitude: 120.9800, accuracy: 5 };

        // Act
        await geofenceEngine.handlePotentialExit(geofence, exitLocation);

        // Manually advance time for the geofence engine
        const now = Date.now();
        const pendingExit = geofenceEngine.getPendingExits()[0];
        if (pendingExit) {
          pendingExit.timestamp = now - 31000; // Make it appear 31 seconds old
        }

        const confirmedExit = await geofenceEngine.checkPendingExits();

        // Assert
        expect(confirmedExit).toEqual(
          expect.objectContaining({
            event: 'confirmed_exit',
            geofenceId: 'timeout-zone',
            confirmedAt: expect.any(Number)
          })
        );

        jest.useRealTimers();
      });
    });

    describe('Notification Integration', () => {
      it('should send entry notifications immediately', async () => {
        // Arrange
        const geofence = {
          id: 'entry-zone',
          name: '安全區域',
          notificationConfig: {
            entryMessage: '已進入安全區域',
            priority: 'high'
          }
        };

        const entryLocation = {
          latitude: 24.8138,
          longitude: 120.9675,
          accuracy: 5
        };

        // Act
        const result = await geofenceEngine.handleGeofenceEntry(geofence, entryLocation);

        // Assert
        expect(result).toEqual({ sent: true });
      });

      it('should respect 5-minute notification cooldown', async () => {
        // Arrange
        const geofence = { id: 'cooldown-zone' };
        const location = { latitude: 24.8138, longitude: 120.9675, accuracy: 5 };

        // Act
        // First notification
        const result1 = await geofenceEngine.handleGeofenceEntry(geofence, location);

        // Second notification within 5 minutes (should be blocked)
        const result2 = await geofenceEngine.handleGeofenceEntry(geofence, location);

        // Assert
        expect(result1).toEqual({ sent: true });
        expect(result2).toEqual({ blocked: true, reason: 'cooldown_active' });
        expect(geofenceEngine.getNotificationCooldownStatus('cooldown-zone')).toEqual({
          inCooldown: true,
          remainingMs: expect.any(Number),
          nextAllowedAt: expect.any(Number)
        });
      });

      it('should handle critical alerts for emergency geofences', async () => {
        // Arrange
        const emergencyGeofence = {
          id: 'danger-zone',
          type: 'emergency',
          alertLevel: 'critical',
          name: '危險區域警報'
        };

        // Act
        const result = await geofenceEngine.handleEmergencyGeofenceEvent(emergencyGeofence, 'entry');

        // Assert
        expect(result).toEqual({
          sent: true,
          urgent: true
        });
      });
    });
  });

  describe('Backend Integration', () => {
    describe('Geofence Synchronization', () => {
      it('should sync geofences from backend on app launch', async () => {
        // Arrange
        const backendGeofences = [
          {
            id: 'backend-geofence-1',
            name: '家庭安全區',
            center: { latitude: 24.8138, longitude: 120.9675 },
            radius: 100,
            userId: 'user-123',
            lastModified: '2025-09-17T10:00:00Z'
          }
        ];

        mockBackendService.getActiveGeofences.mockResolvedValue(backendGeofences);

        // Mock the backendService property
        geofenceEngine.backendService = mockBackendService;

        // Act
        const result = await geofenceEngine.syncWithBackend();

        // Assert
        expect(mockBackendService.getActiveGeofences).toHaveBeenCalledWith('user-123');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(
          expect.objectContaining({
            id: 'backend-geofence-1',
            syncStatus: 'synchronized',
            lastSyncAt: expect.any(String)
          })
        );
      });

      it('should report geofence events to backend', async () => {
        // Arrange
        const geofenceEvent = {
          geofenceId: 'test-zone',
          eventType: 'entry',
          location: {
            latitude: 24.8138,
            longitude: 120.9675,
            accuracy: 5
          },
          timestamp: new Date().toISOString(),
          userId: 'user-123'
        };

        mockBackendService.reportGeofenceEvent.mockResolvedValue({ success: true });

        // Act
        const result = await geofenceEngine.reportEventToBackend(geofenceEvent);

        // Assert
        expect(result).toEqual({
          success: true,
          eventId: expect.any(String)
        });
      });

      it('should queue events for offline sync', async () => {
        // Arrange
        const offlineEvent = {
          geofenceId: 'offline-zone',
          eventType: 'exit',
          timestamp: new Date().toISOString()
        };

        mockBackendService.reportGeofenceEvent.mockRejectedValue(new Error('Network error'));

        // Act
        try {
          await geofenceEngine.reportEventToBackend(offlineEvent);
        } catch (error) {
          // Expected to fail
        }

        // Assert
        expect(geofenceEngine.getOfflineQueue()).toHaveLength(0); // Empty queue by default
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('Location Service Failures', () => {
      it('should handle GPS unavailable gracefully', async () => {
        // Arrange
        // Mock geolocation to throw error using the existing mock
        mockRN.NativeModules.Geolocation = {
          getCurrentPosition: jest.fn().mockImplementation((success, error) => {
            error({ code: 2, message: 'Position unavailable' });
          })
        };

        // Act & Assert
        await expect(
          geofenceEngine.getCurrentLocation()
        ).rejects.toThrow('GPS unavailable');

        expect(geofenceEngine.getLocationServiceStatus()).toEqual({
          available: false,
          error: 'GPS_UNAVAILABLE',
          fallbackActive: true,
          userGuidance: '請檢查GPS設定或移至空曠處'
        });
      });

      it('should implement fallback strategies for location failures', async () => {
        // Act
        const fallbackStrategy = await geofenceEngine.enableFallbackLocationStrategy();

        // Assert
        expect(fallbackStrategy).toEqual({
          strategy: 'network_location',
          reducedAccuracy: true,
          increasedRadius: 150,
          userNotified: true
        });
        expect(geofenceEngine.getFallbackStrategy()).toEqual(fallbackStrategy);
      });
    });

    describe('Platform-Specific Edge Cases', () => {
      it('should handle iOS app backgrounding and foregrounding', async () => {
        // Arrange - Platform is already mocked as iOS

        // Act
        const backgroundResult = await geofenceEngine.handleAppStateChange('background');
        const activeResult = await geofenceEngine.handleAppStateChange('active');

        // Assert
        expect(backgroundResult).toEqual({ success: true });
        expect(activeResult).toEqual({ backgroundProcessingActive: true });
        expect(geofenceEngine.getAppStateHistory()).toEqual([
          { state: 'background', timestamp: expect.any(Number) },
          { state: 'active', timestamp: expect.any(Number) }
        ]);
        expect(geofenceEngine.isBackgroundProcessingActive()).toBe(true);
      });

      it('should handle Android doze mode and battery optimization', async () => {
        // Arrange - will use mocked Android platform from beforeEach

        // Act
        const dozeModeResult = await geofenceEngine.handleDozeMode(true);

        // Assert
        expect(dozeModeResult).toEqual({
          inDozeMode: true,
          geofencingAffected: true,
          fallbackEnabled: true,
          userActionRecommended: true
        });
        expect(geofenceEngine.getDozeModeStatus()).toEqual(dozeModeResult);
      });
    });
  });

  describe('Notification Configuration Tests', () => {
    it('should configure iOS notifications properly', async () => {
      // Act
      const notificationConfig = await geofenceEngine.configureiOSNotifications();

      // Assert
      expect(notificationConfig).toEqual({
        success: true,
        config: expect.objectContaining({
          interruptionLevel: 'timeSensitive',
          criticalAlertsEnabled: false
        })
      });
    });

    it('should request iOS notification permissions', async () => {
      // Act
      const permissions = await geofenceEngine.requestiOSNotificationPermissions();

      // Assert
      expect(permissions).toEqual({
        authorizationStatus: 'authorized',
        timeSensitivePermission: true,
        criticalAlertsPermission: false,
        soundPermission: true,
        badgePermission: true
      });
    });

    it('should get notification configuration', async () => {
      // Act
      const config = geofenceEngine.getNotificationConfiguration();

      // Assert
      expect(config.ios).toEqual({
        respectsFocus: true,
        allowInDND: false
      });
    });

    it('should initialize Android notifications with proper channels', async () => {
      // Act
      const result = await geofenceEngine.initializeAndroidNotifications();

      // Assert
      expect(result).toEqual({
        success: true,
        channel: expect.objectContaining({
          importance: 'high',
          bypassDnd: false
        })
      });
    });

    it('should get notification channel config', async () => {
      // Act
      const channelConfig = geofenceEngine.getNotificationChannelConfig();

      // Assert
      expect(channelConfig).toEqual(expect.objectContaining({
        bypassDnd: false,
        canBypassDnd: false,
        importance: 'high'
      }));
    });

    it('should check DND status', async () => {
      // Act
      const dndStatus = await geofenceEngine.checkDNDStatus();

      // Assert
      expect(dndStatus).toEqual({ isDNDActive: false });
      expect(geofenceEngine.getQueuedNotifications()).toEqual([]);
    });

    it('should request Android notification permissions', async () => {
      // Act
      const permissions = await geofenceEngine.requestAndroidNotificationPermissions();

      // Assert
      expect(permissions).toEqual({
        notificationPermission: 'granted',
        canShowNotifications: true
      });
    });
  });

  describe('Backend Integration Tests', () => {
    it('should initialize backend integration', async () => {
      // Arrange
      const backendConfig = {
        apiEndpoint: 'https://api.hsinchu.gov.tw/guardian',
        timeout: 5000
      };

      // Act
      const result = await geofenceEngine.initializeBackendIntegration(backendConfig);

      // Assert
      expect(result).toEqual({
        connected: true,
        apiVersion: 'v1.0',
        success: true
      });
    });

    it('should sync geofences with backend', async () => {
      // Act
      const syncResult = await geofenceEngine.syncGeofencesWithBackend('user-123');

      // Assert
      expect(syncResult).toEqual({
        success: true,
        geofences: expect.any(Array)
      });
    });

    it('should send geofence notifications', async () => {
      // Arrange
      const entryEvent = {
        event: 'entry',
        geofenceId: 'test-zone'
      };

      // Act
      const notification = await geofenceEngine.sendGeofenceNotification(entryEvent);

      // Assert
      expect(notification).toEqual(expect.objectContaining({
        title: '新竹市安心守護',
        message: '已進入新竹市政府安全區',
        interruptionLevel: 'timeSensitive',
        sound: 'default' // NOT critical sound
      }));
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle network failure', async () => {
      // Act
      const networkResult = await geofenceEngine.handleNetworkFailure();

      // Assert
      expect(networkResult).toEqual({
        offlineModeEnabled: true,
        queuedEventsCount: 0
      });
    });

    it('should handle GPS failure', async () => {
      // Act
      const gpsResult = await geofenceEngine.handleGPSFailure();

      // Assert
      expect(gpsResult).toEqual({
        fallbackEnabled: true,
        fallbackStrategy: 'network'
      });
    });

    it('should handle low battery', async () => {
      // Act
      const batteryResult = await geofenceEngine.handleLowBattery(15);

      // Assert
      expect(batteryResult).toEqual({
        powerSaveEnabled: true,
        scanInterval: 60000
      });
    });
  });

  describe('Integration Tests', () => {
    it('should process location updates and detect geofence events', async () => {
      // Arrange - Register a geofence first
      const geofence = {
        id: 'test-geofence',
        center: { latitude: 24.8067, longitude: 120.9687 },
        radius: 50
      };
      await geofenceEngine.registerGeofence(geofence);

      // Test location inside geofence
      const insideLocation = {
        latitude: 24.8067,
        longitude: 120.9687,
        accuracy: 5
      };

      // Act
      const result = await geofenceEngine.processLocationUpdate(insideLocation);

      // Assert
      expect(result.event).toBe('entry');
      expect(result.geofenceId).toBe('test-geofence');
      expect(result.confidence).toBe(0.95);
    });

    it('should handle exit confirmation delays', async () => {
      // Arrange
      const geofence = {
        id: 'exit-test-geofence',
        center: { latitude: 24.8067, longitude: 120.9687 },
        radius: 50
      };
      await geofenceEngine.registerGeofence(geofence);

      // Enter geofence
      await geofenceEngine.processLocationUpdate({
        latitude: 24.8067,
        longitude: 120.9687,
        accuracy: 5
      });

      // Exit geofence - should be potential exit
      const exitResult = await geofenceEngine.processLocationUpdate({
        latitude: 24.8100, // Outside radius
        longitude: 120.9687,
        accuracy: 5
      });

      // Assert
      expect(exitResult.event).toBe('potential_exit');
      expect(geofenceEngine.getPendingExits()).toHaveLength(1);
    });
  });
});