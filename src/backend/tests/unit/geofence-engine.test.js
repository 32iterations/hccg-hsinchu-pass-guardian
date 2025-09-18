/**
 * Geofence Engine Tests
 * P1 Family MVP - TDD RED Phase
 */

const GeofenceEngine = require('../../services/safety/geofence/GeofenceEngine');

describe('GeofenceEngine', () => {
  let geofenceEngine;
  let mockLocationProvider;

  beforeEach(() => {
    mockLocationProvider = {
      getCurrentLocation: jest.fn(),
      startMonitoring: jest.fn(),
      stopMonitoring: jest.fn()
    };
    geofenceEngine = new GeofenceEngine(mockLocationProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Boundary Events', () => {
    test('should detect entry within 10m accuracy', async () => {
      const geofence = {
        id: 'home-fence',
        center: { lat: 24.8138, lng: 120.9675 }, // Hsinchu coordinates
        radius: 100, // meters
        accuracy: 10 // required accuracy
      };

      await geofenceEngine.addGeofence(geofence);

      // Simulate location outside fence
      const outsideLocation = { lat: 24.8150, lng: 120.9690 };
      await geofenceEngine.updateLocation(outsideLocation);

      // Simulate entry into fence
      const insideLocation = { lat: 24.8138, lng: 120.9675 };
      const event = await geofenceEngine.updateLocation(insideLocation);

      expect(event.type).toBe('GEOFENCE_ENTRY');
      expect(event.geofenceId).toBe('home-fence');
      expect(event.accuracy).toBeLessThanOrEqual(10);
    });

    test('should detect exit with 30 second delay', async () => {
      const geofence = {
        id: 'school-fence',
        center: { lat: 24.8100, lng: 120.9700 },
        radius: 150,
        exitDelay: 30000 // 30 seconds
      };

      await geofenceEngine.addGeofence(geofence);

      // Start inside
      await geofenceEngine.updateLocation({ lat: 24.8100, lng: 120.9700 });

      // Move outside
      const exitTime = Date.now();
      await geofenceEngine.updateLocation({ lat: 24.8200, lng: 120.9800 });

      // Should not trigger immediately
      let events = await geofenceEngine.getPendingEvents();
      expect(events).toHaveLength(0);

      // Simulate 30 seconds passing
      jest.advanceTimersByTime(30000);
      await geofenceEngine.processPendingEvents();

      events = await geofenceEngine.getEvents();
      expect(events[0].type).toBe('GEOFENCE_EXIT');
      expect(events[0].timestamp - exitTime).toBeGreaterThanOrEqual(30000);
    });

    test('should track dwell time for 5+ minutes', async () => {
      const geofence = {
        id: 'park-fence',
        center: { lat: 24.8050, lng: 120.9650 },
        radius: 200,
        dwellTimeThreshold: 300000 // 5 minutes
      };

      await geofenceEngine.addGeofence(geofence);

      const entryTime = Date.now();
      await geofenceEngine.updateLocation({ lat: 24.8050, lng: 120.9650 });

      // Check dwell status before threshold
      jest.advanceTimersByTime(240000); // 4 minutes
      let status = await geofenceEngine.getDwellStatus('park-fence');
      expect(status.isDwelling).toBe(false);
      expect(status.timeInGeofence).toBe(240000);

      // Check after threshold
      jest.advanceTimersByTime(61000); // 1 more minute
      status = await geofenceEngine.getDwellStatus('park-fence');
      expect(status.isDwelling).toBe(true);
      expect(status.timeInGeofence).toBeGreaterThanOrEqual(300000);
      expect(status.dwellEvent).toBeDefined();
    });

    test('should calculate accurate distance using Haversine formula', () => {
      const point1 = { lat: 24.8138, lng: 120.9675 };
      const point2 = { lat: 24.8150, lng: 120.9690 };

      const distance = geofenceEngine.calculateDistance(point1, point2);
      // Expected distance ~170 meters
      expect(distance).toBeGreaterThan(150);
      expect(distance).toBeLessThan(200);
    });
  });

  describe('Cooldown Logic', () => {
    test('should prevent notification spam with 5 min cooldown', async () => {
      const geofence = {
        id: 'market-fence',
        center: { lat: 24.8080, lng: 120.9680 },
        radius: 100,
        cooldownPeriod: 300000 // 5 minutes
      };

      await geofenceEngine.addGeofence(geofence);

      // First entry
      await geofenceEngine.updateLocation({ lat: 24.8080, lng: 120.9680 });
      const firstEvent = await geofenceEngine.getLatestEvent('market-fence');
      expect(firstEvent.type).toBe('GEOFENCE_ENTRY');
      expect(firstEvent.notificationSent).toBe(true);

      // Quick exit and re-entry
      await geofenceEngine.updateLocation({ lat: 24.8200, lng: 120.9800 });
      await geofenceEngine.updateLocation({ lat: 24.8080, lng: 120.9680 });

      const secondEvent = await geofenceEngine.getLatestEvent('market-fence');
      expect(secondEvent.type).toBe('GEOFENCE_ENTRY');
      expect(secondEvent.notificationSent).toBe(false);
      expect(secondEvent.cooldownActive).toBe(true);
    });

    test('should handle multiple geofence priority correctly', async () => {
      const highPriority = {
        id: 'hospital-fence',
        center: { lat: 24.8070, lng: 120.9660 },
        radius: 100,
        priority: 1, // High priority
        cooldownPeriod: 60000
      };

      const lowPriority = {
        id: 'shop-fence',
        center: { lat: 24.8070, lng: 120.9660 }, // Same location
        radius: 150,
        priority: 3, // Low priority
        cooldownPeriod: 300000
      };

      await geofenceEngine.addGeofence(highPriority);
      await geofenceEngine.addGeofence(lowPriority);

      // Enter overlapping geofences
      await geofenceEngine.updateLocation({ lat: 24.8070, lng: 120.9660 });

      const events = await geofenceEngine.getEvents();
      const notifications = events.filter(e => e.notificationSent);

      // Only high priority should send notification
      expect(notifications).toHaveLength(1);
      expect(notifications[0].geofenceId).toBe('hospital-fence');
    });

    test('should reset cooldown after period expires', async () => {
      jest.useFakeTimers();

      const geofence = {
        id: 'test-fence',
        center: { lat: 24.8000, lng: 120.9600 },
        radius: 100,
        cooldownPeriod: 300000 // 5 minutes
      };

      await geofenceEngine.addGeofence(geofence);

      // First entry
      await geofenceEngine.updateLocation({ lat: 24.8000, lng: 120.9600 });

      // Exit
      await geofenceEngine.updateLocation({ lat: 24.8200, lng: 120.9800 });

      // Advance time past cooldown
      jest.advanceTimersByTime(301000);

      // Re-enter after cooldown
      await geofenceEngine.updateLocation({ lat: 24.8000, lng: 120.9600 });
      const event = await geofenceEngine.getLatestEvent('test-fence');

      expect(event.notificationSent).toBe(true);
      expect(event.cooldownActive).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Performance', () => {
    test('should handle 100+ simultaneous geofences', async () => {
      const startTime = Date.now();

      // Create 100 geofences
      const geofences = [];
      for (let i = 0; i < 100; i++) {
        geofences.push({
          id: `fence-${i}`,
          center: {
            lat: 24.8000 + (i * 0.001),
            lng: 120.9600 + (i * 0.001)
          },
          radius: 100 + (i % 50)
        });
      }

      // Add all geofences
      await Promise.all(geofences.map(g => geofenceEngine.addGeofence(g)));

      // Update location and check performance
      const updateStart = Date.now();
      await geofenceEngine.updateLocation({ lat: 24.8050, lng: 120.9650 });
      const updateTime = Date.now() - updateStart;

      expect(geofenceEngine.getGeofenceCount()).toBe(100);
      expect(updateTime).toBeLessThan(100); // Should process in < 100ms
    });

    test('should implement battery-efficient monitoring', async () => {
      const geofence = {
        id: 'battery-test',
        center: { lat: 24.8000, lng: 120.9600 },
        radius: 500,
        monitoringMode: 'battery_optimized'
      };

      await geofenceEngine.addGeofence(geofence);
      const config = await geofenceEngine.getMonitoringConfig();

      expect(config.locationUpdateInterval).toBeGreaterThanOrEqual(30000); // At least 30 seconds
      expect(config.accuracyMode).toBe('balanced');
      expect(config.significantChangesOnly).toBe(true);
      expect(config.batchUpdates).toBe(true);
    });

    test('should batch process location updates efficiently', async () => {
      const locations = [];
      for (let i = 0; i < 50; i++) {
        locations.push({
          lat: 24.8000 + (i * 0.0001),
          lng: 120.9600 + (i * 0.0001),
          timestamp: Date.now() + (i * 1000)
        });
      }

      const startTime = Date.now();
      await geofenceEngine.batchUpdateLocations(locations);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(200); // Process 50 updates in < 200ms

      const events = await geofenceEngine.getEvents();
      expect(events.length).toBeGreaterThan(0);
    });

    test('should cache geofence calculations for performance', async () => {
      const geofence = {
        id: 'cache-test',
        center: { lat: 24.8000, lng: 120.9600 },
        radius: 100
      };

      await geofenceEngine.addGeofence(geofence);

      // First calculation
      const location = { lat: 24.8001, lng: 120.9601 };
      const start1 = Date.now();
      await geofenceEngine.updateLocation(location);
      const time1 = Date.now() - start1;

      // Same location should use cache
      const start2 = Date.now();
      await geofenceEngine.updateLocation(location);
      const time2 = Date.now() - start2;

      expect(time2).toBeLessThan(time1 * 0.5); // Cached should be at least 2x faster
    });
  });

  describe('State Management', () => {
    test('should persist geofence state across restarts', async () => {
      const geofence = {
        id: 'persist-test',
        center: { lat: 24.8000, lng: 120.9600 },
        radius: 100,
        metadata: { name: 'Home', type: 'residence' }
      };

      await geofenceEngine.addGeofence(geofence);
      await geofenceEngine.updateLocation({ lat: 24.8000, lng: 120.9600 });

      // Simulate restart
      const state = await geofenceEngine.saveState();
      const newEngine = new GeofenceEngine(mockLocationProvider);
      await newEngine.restoreState(state);

      const restoredGeofence = await newEngine.getGeofence('persist-test');
      expect(restoredGeofence).toMatchObject(geofence);

      const status = await newEngine.getGeofenceStatus('persist-test');
      expect(status.isInside).toBe(true);
    });

    test('should clean up expired geofences', async () => {
      jest.useFakeTimers();

      const expiringGeofence = {
        id: 'temp-fence',
        center: { lat: 24.8000, lng: 120.9600 },
        radius: 100,
        expiresAt: Date.now() + 3600000 // 1 hour
      };

      await geofenceEngine.addGeofence(expiringGeofence);
      expect(geofenceEngine.getGeofenceCount()).toBe(1);

      // Advance time past expiry
      jest.advanceTimersByTime(3601000);
      await geofenceEngine.cleanupExpired();

      expect(geofenceEngine.getGeofenceCount()).toBe(0);

      jest.useRealTimers();
    });
  });
});