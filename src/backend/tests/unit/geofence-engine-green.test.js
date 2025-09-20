/**
 * Geofence Engine Tests - GREEN Phase
 * Tests that pass with the implementation
 */

const GeofenceEngine = require('../../src/services/safety/geofence-engine-simple.service');

describe('GeofenceEngine', () => {
  let geofenceEngine;

  beforeEach(() => {
    geofenceEngine = new GeofenceEngine();
  });

  afterEach(async () => {
    // Clean up any timers or resources
    if (geofenceEngine && typeof geofenceEngine.cleanup === 'function') {
      await geofenceEngine.cleanup();
    }
    geofenceEngine = null;
  });

  afterAll(() => {
    // Force cleanup of any remaining handles
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Boundary Event Detection', () => {
    test('should detect entry within 10m accuracy', async () => {
      const geofence = {
        id: 'home-fence',
        center: { lat: 24.8138, lng: 120.9675 },
        radius: 100,
        accuracy: 10
      };

      await geofenceEngine.addGeofence(geofence);

      // Device entering geofence (90m from center, within 100m + 10m accuracy)
      const event = await geofenceEngine.detectEntry('device-001', {
        lat: 24.8146,
        lng: 120.9675
      }, 'home-fence');

      expect(event).toBeDefined();
      expect(event.event).toBe('entry');
      expect(event.deviceId).toBe('device-001');
      expect(event.geofenceId).toBe('home-fence');
      expect(event.accuracy).toBe(10);
    });

    test('should detect exit with 30 second delay', async () => {
      const geofence = {
        id: 'school-fence',
        center: { lat: 24.8050, lng: 120.9700 },
        radius: 150,
        accuracy: 10
      };

      await geofenceEngine.addGeofence(geofence);

      // Device outside geofence (200m from center)
      const startTime = Date.now();
      const exitPromise = geofenceEngine.detectExit('device-002', {
        lat: 24.8070,
        lng: 120.9700
      }, 'school-fence', 100); // Using 100ms delay for testing

      const event = await exitPromise;
      const elapsed = Date.now() - startTime;

      expect(event).toBeDefined();
      expect(event.event).toBe('exit');
      expect(event.delay).toBe(100);
      expect(elapsed).toBeGreaterThanOrEqual(99); // Allow 1ms tolerance for timing variance
    });

    test('should not trigger entry if outside radius + accuracy', async () => {
      const geofence = {
        id: 'park-fence',
        center: { lat: 24.8000, lng: 120.9600 },
        radius: 50,
        accuracy: 10
      };

      await geofenceEngine.addGeofence(geofence);

      // Device outside (100m from center, > 50m + 10m)
      const event = await geofenceEngine.detectEntry('device-003', {
        lat: 24.8009,
        lng: 120.9600
      }, 'park-fence');

      expect(event).toBeNull();
    });
  });

  describe('Dwell Time Monitoring', () => {
    test('should track dwell time after 5+ minutes', async () => {
      const geofence = {
        id: 'library-fence',
        center: { lat: 24.8100, lng: 120.9650 },
        radius: 75
      };

      await geofenceEngine.addGeofence(geofence);

      // Simulate entry
      await geofenceEngine.detectEntry('device-004', {
        lat: 24.8100,
        lng: 120.9650
      }, 'library-fence');

      // Check dwell immediately (should be null)
      let dwellEvent = geofenceEngine.checkDwellTime('device-004', 'library-fence');
      expect(dwellEvent).toBeNull();

      // Simulate 5+ minutes passing
      const key = 'device-004-library-fence';
      geofenceEngine.dwellTimers.set(key, Date.now() - 6 * 60 * 1000);

      // Check dwell after 5 minutes
      dwellEvent = geofenceEngine.checkDwellTime('device-004', 'library-fence');
      expect(dwellEvent).toBeDefined();
      expect(dwellEvent.event).toBe('dwell');
      expect(dwellEvent.dwellMinutes).toBeGreaterThanOrEqual(5);
    });

    test('should not trigger dwell alert before 5 minutes', () => {
      const key = 'device-005-store-fence';
      geofenceEngine.dwellTimers.set(key, Date.now() - 3 * 60 * 1000); // 3 minutes

      const dwellEvent = geofenceEngine.checkDwellTime('device-005', 'store-fence');
      expect(dwellEvent).toBeNull();
    });

    test('should reset dwell time on exit', async () => {
      const geofence = {
        id: 'gym-fence',
        center: { lat: 24.8200, lng: 120.9700 },
        radius: 100
      };

      await geofenceEngine.addGeofence(geofence);

      // Enter geofence
      await geofenceEngine.detectEntry('device-006', {
        lat: 24.8200,
        lng: 120.9700
      }, 'gym-fence');

      // Exit geofence
      const exitPromise = geofenceEngine.detectExit('device-006', {
        lat: 24.8220,
        lng: 120.9700
      }, 'gym-fence', 10);

      await exitPromise;

      // Check dwell timer is cleared
      const key = 'device-006-gym-fence';
      expect(geofenceEngine.dwellTimers.has(key)).toBe(false);
    });
  });

  describe('Performance & Scalability', () => {
    test('should handle 100+ simultaneous geofences efficiently', async () => {
      // Create 100 geofences
      const geofenceIds = [];
      for (let i = 0; i < 100; i++) {
        const geofence = {
          id: `fence-${i}`,
          center: { lat: 24.8000 + i * 0.001, lng: 120.9600 + i * 0.001 },
          radius: 100
        };
        await geofenceEngine.addGeofence(geofence);
        geofenceIds.push(geofence.id);
      }

      const startTime = Date.now();
      const result = await geofenceEngine.handleSimultaneousGeofences('device-007', {
        lat: 24.8000,
        lng: 120.9600
      }, geofenceIds);

      const elapsed = Date.now() - startTime;

      expect(result.processed).toBe(100);
      expect(elapsed).toBeLessThan(1000); // Should process in under 1 second
    });

    test('should maintain stable memory with many geofences', async () => {
      // Add 500 geofences
      for (let i = 0; i < 500; i++) {
        await geofenceEngine.addGeofence({
          id: `heavy-fence-${i}`,
          center: { lat: 24.8000 + i * 0.0001, lng: 120.9600 + i * 0.0001 },
          radius: 50
        });
      }

      const metrics = geofenceEngine.getPerformanceMetrics();
      expect(metrics.activeGeofences).toBe(500);
      expect(metrics.canHandle100Plus).toBe(true);
      expect(metrics.currentLoad).toBeLessThan(100);
    });

    test('should process batch location updates efficiently', async () => {
      // Setup geofences
      for (let i = 0; i < 20; i++) {
        await geofenceEngine.addGeofence({
          id: `batch-fence-${i}`,
          center: { lat: 24.8000 + i * 0.01, lng: 120.9600 },
          radius: 100
        });
      }

      const startTime = Date.now();
      const results = [];

      // Process 50 location updates
      for (let j = 0; j < 50; j++) {
        const event = await geofenceEngine.detectEntry(`device-batch-${j}`, {
          lat: 24.8000,
          lng: 120.9600
        }, 'batch-fence-0');
        if (event) results.push(event);
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(500);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});