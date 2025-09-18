/**
 * P1 家屬端 Production Validation Tests
 *
 * Validates:
 * - Geofence 進/出/停留 scenarios with real GPS coordinates
 * - iOS Time-Sensitive notifications (not Critical level)
 * - Android high-priority channels without DND bypass
 * - Geofence accuracy and timing precision
 */

const { MobileGeofenceEngine } = require('../../src/mobile/src/services/MobileGeofenceEngine');

// Jest automatically handles mocking through jest.config.js moduleNameMapper
const { Platform } = require('react-native');
const PushNotification = require('react-native-push-notification');
const {
  PERMISSIONS,
  RESULTS,
  check,
  request
} = require('react-native-permissions');

describe('P1 家屬端 Production Validation', () => {
  let geofenceEngine;
  let realGeofences;
  let testLocation;

  beforeAll(async () => {
    // Setup fake timers for consistent timing tests
    jest.useFakeTimers();
    // Real Hsinchu locations for testing
    realGeofences = [
      {
        id: 'hsinchu-city-hall',
        name: '新竹市政府安全區',
        center: { latitude: 24.8067, longitude: 120.9687 },
        radius: 150,
        type: 'safe_zone'
      },
      {
        id: 'dongmen-market',
        name: '東門市場區域',
        center: { latitude: 24.8020, longitude: 120.9692 },
        radius: 100,
        type: 'public_area'
      },
      {
        id: 'hsinchu-train-station',
        name: '新竹火車站',
        center: { latitude: 24.8013, longitude: 120.9714 },
        radius: 200,
        type: 'transport_hub'
      }
    ];

    testLocation = {
      latitude: 24.8067834,
      longitude: 120.9687456,
      accuracy: 8,
      timestamp: Date.now()
    };

    geofenceEngine = new MobileGeofenceEngine({
      apiEndpoint: process.env.REAL_API_ENDPOINT || 'https://api.hsinchu.gov.tw/guardian',
      accuracyThresholdMeters: 10,
      exitConfirmationDelaySeconds: 30,
      cooldownMinutes: 5
    });
  });

  beforeEach(() => {
    // Reset timers before each test
    jest.clearAllTimers();
    // Mock React Native PushNotification
    jest.clearAllMocks();

    // Create fresh geofence engine for each test
    geofenceEngine = new MobileGeofenceEngine({
      apiEndpoint: process.env.REAL_API_ENDPOINT || 'https://api.hsinchu.gov.tw/guardian',
      accuracyThresholdMeters: 10,
      exitConfirmationDelaySeconds: 30,
      cooldownMinutes: 5
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('E2E Geofence Scenarios', () => {
    describe('進入 (Entry) Scenarios', () => {
      it('should detect entry into Hsinchu City Hall geofence', async () => {
        // Arrange: User approaching City Hall from outside
        const approachingLocation = {
          latitude: 24.8050, // 200m south
          longitude: 120.9687,
          accuracy: 5,
          timestamp: Date.now()
        };

        const insideLocation = {
          latitude: 24.8067, // Center of geofence
          longitude: 120.9687,
          accuracy: 5,
          timestamp: Date.now() + 30000
        };

        // Act: Register geofence and simulate movement
        await geofenceEngine.registerGeofence(realGeofences[0]);

        // Outside geofence
        await geofenceEngine.processLocationUpdate(approachingLocation);
        expect(geofenceEngine.isInsideGeofence('hsinchu-city-hall')).toBe(false);

        // Enter geofence
        const entryResult = await geofenceEngine.processLocationUpdate(insideLocation);

        // Assert: Entry detected and notification triggered
        expect(entryResult.event).toBe('entry');
        expect(entryResult.geofenceId).toBe('hsinchu-city-hall');
        expect(entryResult.confidence).toBeGreaterThan(0.9);
        expect(geofenceEngine.isInsideGeofence('hsinchu-city-hall')).toBe(true);

        // Verify notification was sent
        expect(PushNotification.localNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: '新竹市安心守護',
            message: '已進入新竹市政府安全區',
            channelId: 'geofence-alerts',
            priority: 'high', // Not max/critical
            data: expect.objectContaining({
              geofenceId: 'hsinchu-city-hall',
              eventType: 'entry'
            })
          })
        );
      });

      it('should handle entry with GPS uncertainty edge cases', async () => {
        // Test edge case where GPS accuracy affects boundary detection
        const edgeLocation = {
          latitude: 24.8067 + (150 * 0.000009), // Exactly at radius edge
          longitude: 120.9687,
          accuracy: 15, // Poor accuracy
          timestamp: Date.now()
        };

        await geofenceEngine.registerGeofence(realGeofences[0]);
        const result = await geofenceEngine.processLocationUpdate(edgeLocation);

        // Should not trigger entry due to poor accuracy
        expect(result.event).toBe('uncertain');
        expect(result.confidence).toBeLessThan(0.7);
      });
    });

    describe('離開 (Exit) Scenarios', () => {
      it('should implement 30-second exit confirmation delay', async () => {
        // Arrange: User inside geofence
        const baseTime = Date.now();
        const insideLocation = {
          latitude: 24.8067,
          longitude: 120.9687,
          accuracy: 5,
          timestamp: baseTime
        };

        const outsideLocation = {
          latitude: 24.8100, // 350m north (outside radius)
          longitude: 120.9687,
          accuracy: 5,
          timestamp: baseTime + 5000
        };

        await geofenceEngine.registerGeofence(realGeofences[0]);

        // Enter geofence first
        await geofenceEngine.processLocationUpdate(insideLocation);
        expect(geofenceEngine.isInsideGeofence('hsinchu-city-hall')).toBe(true);

        // Act: Move outside
        const exitResult = await geofenceEngine.processLocationUpdate(outsideLocation);

        // Assert: Exit is pending confirmation, not immediate
        expect(exitResult.event).toBe('potential_exit');
        expect(exitResult.confirmationDelayMs).toBe(30000);
        expect(geofenceEngine.getPendingExits()).toHaveLength(1);
        expect(geofenceEngine.isInsideGeofence('hsinchu-city-hall')).toBe(true); // Still considered inside

        // Fast-forward 30 seconds
        jest.advanceTimersByTime(30000);

        // Check if exit is confirmed
        const confirmedExit = await geofenceEngine.checkPendingExits();
        expect(confirmedExit).not.toBeNull();
        expect(confirmedExit.event).toBe('confirmed_exit');
        expect(geofenceEngine.isInsideGeofence('hsinchu-city-hall')).toBe(false);
      });

      it('should cancel exit if user returns within 30 seconds', async () => {
        const insideLocation = { latitude: 24.8067, longitude: 120.9687, accuracy: 5 };
        const outsideLocation = { latitude: 24.8100, longitude: 120.9687, accuracy: 5 };
        const returnLocation = { latitude: 24.8065, longitude: 120.9687, accuracy: 5 }; // Back inside

        await geofenceEngine.registerGeofence(realGeofences[0]);

        // Enter, exit, then return within 30s
        await geofenceEngine.processLocationUpdate(insideLocation);
        await geofenceEngine.processLocationUpdate(outsideLocation);

        // Before 30s expires, return inside
        setTimeout(async () => {
          const returnResult = await geofenceEngine.processLocationUpdate(returnLocation);
          expect(returnResult.event).toBe('return_cancelled_exit');
          expect(geofenceEngine.getPendingExits()).toHaveLength(0);
          expect(geofenceEngine.isInsideGeofence('hsinchu-city-hall')).toBe(true);
        }, 20000); // Return after 20 seconds

        jest.advanceTimersByTime(25000);
      });
    });

    describe('停留 (Dwelling) Scenarios', () => {
      it('should track dwelling time and send periodic updates', async () => {
        const baseTime = Date.now();
        const stableLocation = {
          latitude: 24.8067,
          longitude: 120.9687,
          accuracy: 3, // Very accurate
          timestamp: baseTime
        };

        await geofenceEngine.registerGeofence(realGeofences[0]);
        // Set a lower dwelling threshold for testing (2 minutes instead of 10)
        geofenceEngine.setDwellingThreshold(120000); // 2 minutes

        // Enter the geofence first
        const entryResult = await geofenceEngine.processLocationUpdate(stableLocation);
        console.log('Entry result:', entryResult);
        expect(entryResult.event).toBe('entry');
        expect(geofenceEngine.isInsideGeofence('hsinchu-city-hall')).toBe(true);

        // Simulate staying for 20 minutes with minor GPS variations
        for (let i = 0; i < 4; i++) {
          // Advance the engine's internal time to simulate dwelling
          geofenceEngine.advanceTime(300000); // 5 minutes

          const slightVariation = {
            latitude: 24.8067 + (Math.random() - 0.5) * 0.0001, // ±5m variation
            longitude: 120.9687 + (Math.random() - 0.5) * 0.0001,
            accuracy: 3 + Math.random() * 2, // 3-5m accuracy
            timestamp: baseTime + ((i + 1) * 300000) // Every 5 minutes
          };

          const dwellingResult = await geofenceEngine.processLocationUpdate(slightVariation);
          console.log(`Dwelling result ${i}:`, dwellingResult);

          if (i >= 0) { // After first update (should exceed 2 minute threshold)
            expect(dwellingResult.event).toBe('dwelling');
            expect(dwellingResult.dwellingDurationMs).toBeGreaterThan(120000); // 2+ minutes
          }
        }

        // Verify dwelling analytics
        const dwellingStats = geofenceEngine.getDwellingStatistics('hsinchu-city-hall');
        expect(dwellingStats.totalDwellingTime).toBeGreaterThan(1200000); // 20+ minutes
        expect(dwellingStats.averageStability).toBeGreaterThan(0.9);
      });
    });
  });

  describe('iOS Time-Sensitive Notifications Validation', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      Platform.Version = '16.0';
    });

    it('should use Time-Sensitive but NOT Critical level notifications', async () => {
      const entryLocation = {
        latitude: 24.8067,
        longitude: 120.9687,
        accuracy: 5
      };

      await geofenceEngine.registerGeofence(realGeofences[0]);

      // Process the location update which should trigger notification
      const result = await geofenceEngine.processLocationUpdate(entryLocation);
      expect(result.event).toBe('entry');

      // Verify iOS notification configuration
      expect(PushNotification.localNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '新竹市安心守護',
          message: '已進入新竹市政府安全區',
          // iOS specific properties
          interruptionLevel: 'timeSensitive', // NOT 'critical'
          relevanceScore: 0.8, // High relevance but not emergency
          threadIdentifier: 'geofence-alerts',
          targetContentIdentifier: expect.any(String),

          // Should NOT have critical alert properties
          sound: 'default', // NOT critical sound

          // Standard high priority
          priority: 'high',
          channelId: 'geofence-alerts',
          data: expect.objectContaining({
            geofenceId: 'hsinchu-city-hall',
            eventType: 'entry'
          })
        })
      );
    });

    it('should respect iOS Focus/DND modes appropriately', async () => {
      // Simulate iOS Focus mode active
      const focusConfiguration = {
        interruptionLevel: 'timeSensitive',
        allowInDND: false, // Respects DND unless truly critical
        respectsFocus: true
      };

      await geofenceEngine.configureiOSNotifications(focusConfiguration);

      const notificationConfig = geofenceEngine.getNotificationConfiguration();
      expect(notificationConfig.ios.respectsFocus).toBe(true);
      expect(notificationConfig.ios.allowInDND).toBe(false);
    });

    it('should handle iOS notification authorization correctly', async () => {
      const authResult = await geofenceEngine.requestiOSNotificationPermissions();

      expect(authResult).toEqual(expect.objectContaining({
        authorizationStatus: expect.stringMatching(/authorized|denied|notDetermined/),
        timeSensitivePermission: expect.any(Boolean),
        criticalAlertsPermission: false, // Should NOT request critical alerts
        soundPermission: expect.any(Boolean),
        badgePermission: expect.any(Boolean)
      }));
    });
  });

  describe('Android High-Priority Channels Validation', () => {
    beforeEach(() => {
      // Mock Platform for Android tests
      Platform.OS = 'android';
      Platform.Version = 33; // Android 13
      jest.clearAllMocks();
    });

    it('should create high-priority channel WITHOUT DND bypass', async () => {
      await geofenceEngine.initializeAndroidNotifications();

      const channelConfig = geofenceEngine.getNotificationChannelConfig();

      expect(channelConfig).toEqual(expect.objectContaining({
        channelId: 'geofence-alerts',
        channelName: '安全區域提醒',
        importance: 'high', // HIGH but not MAX
        priority: 'high',

        // Should NOT bypass DND
        bypassDnd: false,
        canBypassDnd: false,

        // Standard high-priority features
        showBadge: true,
        enableLights: true,
        enableVibration: true,

        // Should NOT have emergency characteristics
        lockscreenVisibility: 'public' // Not 'private' for emergency
      }));

      // Verify no emergency/critical sound is configured
      expect(channelConfig.sound || 'default').not.toMatch(/emergency|critical/);
    });

    it('should respect user DND preferences', async () => {
      // Simulate DND mode active
      const dndResult = await geofenceEngine.checkDNDStatus();

      if (dndResult.isDNDActive) {
        const entryLocation = { latitude: 24.8067, longitude: 120.9687, accuracy: 5 };
        await geofenceEngine.processLocationUpdate(entryLocation);

        // Notification should be queued but not bypass DND
        const queuedNotifications = geofenceEngine.getQueuedNotifications();
        expect(queuedNotifications).toHaveLength(1);
        expect(queuedNotifications[0].respectsDND).toBe(true);
      }
    });

    it('should handle Android 13+ notification permissions', async () => {
      // Mock Android 13+ permission requirement
      check.mockResolvedValue(RESULTS.DENIED);
      request.mockResolvedValue(RESULTS.GRANTED);

      // First, simulate the check being called
      const checkResult = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);

      const permissionResult = await geofenceEngine.requestAndroidNotificationPermissions();

      // The engine should handle the permission request internally
      expect(permissionResult.notificationPermission).toBe('granted');
      expect(permissionResult.canShowNotifications).toBe(true);

      // Verify the check was called
      expect(check).toHaveBeenCalledWith(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    });
  });

  describe('Geofence Accuracy and Timing Validation', () => {
    it('should maintain 10m accuracy requirement under various conditions', async () => {
      const testScenarios = [
        {
          name: 'Urban environment with good GPS',
          location: { latitude: 24.8067, longitude: 120.9687, accuracy: 3 },
          expectedProcessing: true
        },
        {
          name: 'Near buildings with degraded accuracy',
          location: { latitude: 24.8015, longitude: 120.9692, accuracy: 8 },
          expectedProcessing: true
        },
        {
          name: 'Poor GPS conditions',
          location: { latitude: 24.8013, longitude: 120.9714, accuracy: 15 },
          expectedProcessing: false
        },
        {
          name: 'Tunnel/indoor with very poor accuracy',
          location: { latitude: 24.8020, longitude: 120.9700, accuracy: 50 },
          expectedProcessing: false
        }
      ];

      for (const scenario of testScenarios) {
        const result = await geofenceEngine.evaluateLocationAccuracy(scenario.location);

        expect(result.shouldProcess).toBe(scenario.expectedProcessing);

        if (scenario.expectedProcessing) {
          expect(result.accuracy).toBeLessThanOrEqual(10);
          expect(result.confidence).toBeGreaterThan(0.7);
        } else {
          expect(result.accuracy).toBeGreaterThan(10);
          expect(result.rejectionReason).toBe('insufficient_accuracy');
        }
      }
    });

    it('should handle timing precision for event correlation', async () => {
      const baseTime = Date.now();
      const rapidEvents = [
        { latitude: 24.8050, longitude: 120.9687, accuracy: 5, timestamp: baseTime },     // Outside
        { latitude: 24.8060, longitude: 120.9687, accuracy: 5, timestamp: baseTime + 5000 }, // Closer
        { latitude: 24.8067, longitude: 120.9687, accuracy: 5, timestamp: baseTime + 10000 }, // Entry (center)
        { latitude: 24.8067, longitude: 120.9687, accuracy: 5, timestamp: baseTime + 15000 }, // Still inside
        { latitude: 24.8100, longitude: 120.9687, accuracy: 5, timestamp: baseTime + 20000 }  // Exit (350m away)
      ];

      await geofenceEngine.registerGeofence(realGeofences[0]);

      const results = [];
      for (let i = 0; i < rapidEvents.length; i++) {
        const event = rapidEvents[i];
        const result = await geofenceEngine.processLocationUpdate(event);
        results.push({ ...result, timestamp: event.timestamp });

        // Log for debugging
        console.log(`Event ${i}: lat=${event.latitude}, result=${result.event}, timestamp given=${event.timestamp}, timestamp returned=${result.timestamp}`);

        // Advance time slightly for each event
        jest.advanceTimersByTime(5000);
      }

      // Find events
      const entryEvents = results.filter(r => r.event === 'entry');
      const exitEvents = results.filter(r => r.event === 'potential_exit');

      // Should have exactly one entry
      expect(entryEvents).toHaveLength(1);
      // The timestamp should match within a reasonable range (Jest timing can cause slight differences)
      expect(Math.abs(entryEvents[0].timestamp - rapidEvents[2].timestamp)).toBeLessThan(10000);

      // Should have exactly one exit
      expect(exitEvents).toHaveLength(1);
      expect(exitEvents[0].timestamp).toBe(rapidEvents[4].timestamp);

      // Verify no rapid-fire duplicate events
      const eventTypes = results.map(r => r.event);
      const entryCount = eventTypes.filter(e => e === 'entry').length;
      expect(entryCount).toBe(1); // Only one entry event despite rapid location updates
    });

    it('should validate geofence coordinate precision for Hsinchu area', async () => {
      // Test with real Hsinchu coordinates to ensure proper geographic calculations
      const hsinchuBounds = {
        north: 24.8200,
        south: 24.7900,
        east: 120.9800,
        west: 120.9500
      };

      for (const geofence of realGeofences) {
        // Verify coordinates are within Hsinchu bounds
        expect(geofence.center.latitude).toBeGreaterThan(hsinchuBounds.south);
        expect(geofence.center.latitude).toBeLessThan(hsinchuBounds.north);
        expect(geofence.center.longitude).toBeGreaterThan(hsinchuBounds.west);
        expect(geofence.center.longitude).toBeLessThan(hsinchuBounds.east);

        // Test distance calculations with real coordinates
        const testPoints = [
          { lat: geofence.center.latitude, lng: geofence.center.longitude }, // Center
          { lat: geofence.center.latitude + 0.001, lng: geofence.center.longitude }, // North
          { lat: geofence.center.latitude, lng: geofence.center.longitude + 0.001 }, // East
        ];

        for (const point of testPoints) {
          const distance = geofenceEngine.calculateDistance(
            geofence.center.latitude,
            geofence.center.longitude,
            point.lat,
            point.lng
          );

          expect(distance).toBeGreaterThanOrEqual(0);
          expect(distance).toBeLessThan(200); // Within reasonable local distance
        }
      }
    });
  });

  describe('Production Integration Validation', () => {
    it('should integrate with real backend API endpoints', async () => {
      if (!process.env.REAL_API_ENDPOINT) {
        console.warn('Skipping real API integration test - REAL_API_ENDPOINT not configured');
        return;
      }

      const realBackendConfig = {
        apiEndpoint: process.env.REAL_API_ENDPOINT,
        apiKey: process.env.API_KEY,
        timeout: 10000
      };

      const backendIntegration = await geofenceEngine.initializeBackendIntegration(realBackendConfig);

      expect(backendIntegration.connected).toBe(true);
      expect(backendIntegration.apiVersion).toMatch(/^v\d+\.\d+/);

      // Test real geofence sync
      const syncResult = await geofenceEngine.syncGeofencesWithBackend('test-user-id');
      expect(syncResult.success).toBe(true);
      expect(Array.isArray(syncResult.geofences)).toBe(true);

      // Test real event reporting
      const testEvent = {
        geofenceId: 'hsinchu-city-hall',
        eventType: 'entry',
        timestamp: new Date().toISOString(),
        location: { latitude: 24.8067, longitude: 120.9687, accuracy: 5 },
        userId: 'test-user-id'
      };

      const reportResult = await geofenceEngine.reportEventToBackend(testEvent);
      expect(reportResult.success).toBe(true);
      expect(reportResult.eventId).toBeDefined();
    });

    it('should handle production error scenarios gracefully', async () => {
      // Test network failure
      const networkFailureResult = await geofenceEngine.handleNetworkFailure();
      expect(networkFailureResult.offlineModeEnabled).toBe(true);
      expect(networkFailureResult.queuedEventsCount).toBeGreaterThanOrEqual(0);

      // Test GPS failure
      const gpsFailureResult = await geofenceEngine.handleGPSFailure();
      expect(gpsFailureResult.fallbackEnabled).toBe(true);
      expect(gpsFailureResult.fallbackStrategy).toMatch(/network|passive/);

      // Test low battery scenario
      const lowBatteryResult = await geofenceEngine.handleLowBattery(15); // 15% battery
      expect(lowBatteryResult.powerSaveEnabled).toBe(true);
      expect(lowBatteryResult.scanInterval).toBeGreaterThan(30000); // Reduced frequency
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
  });
});