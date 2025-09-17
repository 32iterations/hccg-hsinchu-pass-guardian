const { GeofenceEngine } = require('../../src/services/safety/geofence-engine.service');
const { GeofenceRepository } = require('../../src/repositories/geofence.repository');
const { LocationService } = require('../../src/services/location.service');
const { NotificationService } = require('../../src/services/notification.service');
const { EventEmitter } = require('../../src/services/event-emitter.service');
const {
  GeofenceViolationError,
  LocationAccuracyError,
  CooldownActiveError
} = require('../../src/services/safety/errors');

// Mock dependencies
jest.mock('../../src/repositories/geofence.repository');
jest.mock('../../src/services/location.service');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/services/event-emitter.service');

describe('GeofenceEngine - RED Phase Tests', () => {
  let geofenceEngine;
  let mockGeofenceRepository;
  let mockLocationService;
  let mockNotificationService;
  let mockEventEmitter;

  // Test coordinates for Hsinchu area
  const testCoordinates = {
    hsinchu_city_hall: { lat: 24.8138, lng: 120.9675 },
    hsinchu_park: { lat: 24.8015, lng: 120.9718 },
    hsinchu_station: { lat: 24.8018, lng: 120.9713 },
    outside_hsinchu: { lat: 25.0330, lng: 121.5654 } // Taipei
  };

  beforeEach(() => {
    mockGeofenceRepository = new GeofenceRepository();
    mockLocationService = new LocationService();
    mockNotificationService = new NotificationService();
    mockEventEmitter = new EventEmitter();

    geofenceEngine = new GeofenceEngine(
      mockGeofenceRepository,
      mockLocationService,
      mockNotificationService,
      mockEventEmitter
    );

    // Mock current time for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Boundary Detection with 10m Accuracy', () => {
    describe('detectEntry', () => {
      it('should detect entry within 10m accuracy threshold', async () => {
        const geofence = {
          id: 'geofence-123',
          name: '新竹市政府安全區',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100, // 100m radius
          userId: 'user-123',
          type: 'safe_zone'
        };

        // Position 8m from center (within threshold)
        const currentLocation = {
          lat: 24.8139, // ~8m north of center
          lng: 120.9675,
          accuracy: 5, // GPS accuracy in meters
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(8);
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);
        mockLocationService.getCurrentLocation.mockResolvedValue(currentLocation);

        const result = await geofenceEngine.checkGeofenceStatus('user-123', currentLocation);

        expect(result.entries).toHaveLength(1);
        expect(result.entries[0]).toEqual(expect.objectContaining({
          geofenceId: 'geofence-123',
          eventType: 'entry',
          distance: 8,
          accuracy: 5
        }));
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('geofence.entry', expect.any(Object));
      });

      it('should not detect entry when GPS accuracy exceeds 10m', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123'
        };

        const currentLocation = {
          lat: 24.8139,
          lng: 120.9675,
          accuracy: 15, // Poor GPS accuracy > 10m
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(8);
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);
        mockLocationService.getCurrentLocation.mockResolvedValue(currentLocation);

        await expect(geofenceEngine.checkGeofenceStatus('user-123', currentLocation))
          .rejects.toThrow(LocationAccuracyError);

        expect(mockEventEmitter.emit).not.toHaveBeenCalled();
      });

      it('should handle edge case at exact boundary with GPS uncertainty', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123'
        };

        // Test positions at boundary ± GPS accuracy
        const boundaryTestCases = [
          { distance: 95, accuracy: 8, shouldDetect: true, description: 'within boundary considering accuracy' },
          { distance: 105, accuracy: 8, shouldDetect: false, description: 'outside boundary considering accuracy' },
          { distance: 100, accuracy: 5, shouldDetect: true, description: 'at boundary with good accuracy' },
          { distance: 100, accuracy: 15, shouldDetect: false, description: 'at boundary with poor accuracy (should error)' }
        ];

        for (const testCase of boundaryTestCases) {
          jest.clearAllMocks();

          const currentLocation = {
            lat: 24.8139,
            lng: 120.9675,
            accuracy: testCase.accuracy,
            timestamp: new Date()
          };

          mockLocationService.calculateDistance.mockReturnValue(testCase.distance);
          mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);
          mockLocationService.getCurrentLocation.mockResolvedValue(currentLocation);

          if (testCase.accuracy > 10) {
            await expect(geofenceEngine.checkGeofenceStatus('user-123', currentLocation))
              .rejects.toThrow(LocationAccuracyError);
          } else {
            const result = await geofenceEngine.checkGeofenceStatus('user-123', currentLocation);

            if (testCase.shouldDetect) {
              expect(result.entries.length).toBeGreaterThan(0);
            } else {
              expect(result.entries).toHaveLength(0);
            }
          }
        }
      });
    });

    describe('detectExit', () => {
      it('should detect exit with 30s delay confirmation', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123'
        };

        // User was inside geofence
        mockGeofenceRepository.getUserGeofenceStatus.mockResolvedValue({
          userId: 'user-123',
          geofenceId: 'geofence-123',
          status: 'inside',
          lastEntry: new Date(Date.now() - 60000), // 1 minute ago
          confirmationRequired: false
        });

        // Now user is outside
        const outsideLocation = {
          lat: 24.8200, // Far from center
          lng: 120.9800,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(150); // 150m from center
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);

        // First check - should start exit confirmation
        const firstResult = await geofenceEngine.checkGeofenceStatus('user-123', outsideLocation);

        expect(firstResult.pendingExits).toHaveLength(1);
        expect(firstResult.pendingExits[0].confirmationStarted).toBeDefined();
        expect(firstResult.confirmedExits).toHaveLength(0);

        // Advance time by 30 seconds
        jest.advanceTimersByTime(30000);

        // Second check - should confirm exit
        const secondResult = await geofenceEngine.checkGeofenceStatus('user-123', outsideLocation);

        expect(secondResult.confirmedExits).toHaveLength(1);
        expect(secondResult.confirmedExits[0]).toEqual(expect.objectContaining({
          geofenceId: 'geofence-123',
          eventType: 'exit',
          confirmationDelay: 30000
        }));
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('geofence.exit', expect.any(Object));
      });

      it('should cancel exit confirmation if user returns within 30s', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123'
        };

        mockGeofenceRepository.getUserGeofenceStatus.mockResolvedValue({
          userId: 'user-123',
          geofenceId: 'geofence-123',
          status: 'inside',
          lastEntry: new Date(Date.now() - 60000)
        });

        // User moves outside
        const outsideLocation = {
          lat: 24.8200,
          lng: 120.9800,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(150);
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);

        // Start exit confirmation
        await geofenceEngine.checkGeofenceStatus('user-123', outsideLocation);

        // Advance time by 20 seconds (less than 30s delay)
        jest.advanceTimersByTime(20000);

        // User returns inside
        const insideLocation = {
          lat: 24.8138,
          lng: 120.9675,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(5); // Back inside

        const result = await geofenceEngine.checkGeofenceStatus('user-123', insideLocation);

        expect(result.confirmedExits).toHaveLength(0);
        expect(result.cancelledExits).toHaveLength(1);
        expect(result.cancelledExits[0].reason).toBe('user_returned');
        expect(mockEventEmitter.emit).toHaveBeenCalledWith('geofence.exit_cancelled', expect.any(Object));
      });

      it('should handle multiple geofences with independent exit delays', async () => {
        const geofences = [
          {
            id: 'geofence-1',
            name: '安全區域A',
            center: { lat: 24.8138, lng: 120.9675 },
            radius: 100,
            userId: 'user-123'
          },
          {
            id: 'geofence-2',
            name: '安全區域B',
            center: { lat: 24.8015, lng: 120.9718 },
            radius: 80,
            userId: 'user-123'
          }
        ];

        // User was inside both geofences
        mockGeofenceRepository.getUserGeofenceStatus
          .mockResolvedValueOnce({
            userId: 'user-123',
            geofenceId: 'geofence-1',
            status: 'inside',
            lastEntry: new Date(Date.now() - 120000) // 2 minutes ago
          })
          .mockResolvedValueOnce({
            userId: 'user-123',
            geofenceId: 'geofence-2',
            status: 'inside',
            lastEntry: new Date(Date.now() - 60000) // 1 minute ago
          });

        // User moves far outside both
        const outsideLocation = {
          lat: 24.8300,
          lng: 120.9900,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance
          .mockReturnValueOnce(200) // Distance from geofence-1
          .mockReturnValueOnce(180); // Distance from geofence-2

        mockGeofenceRepository.findActiveByUser.mockResolvedValue(geofences);

        const result = await geofenceEngine.checkGeofenceStatus('user-123', outsideLocation);

        expect(result.pendingExits).toHaveLength(2);
        expect(result.confirmedExits).toHaveLength(0);
      });
    });
  });

  describe('Cooldown Management (5-minute between notifications)', () => {
    describe('notificationCooldown', () => {
      it('should enforce 5-minute cooldown between notifications', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123',
          type: 'safe_zone'
        };

        const entryLocation = {
          lat: 24.8139,
          lng: 120.9675,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(8);
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);
        mockGeofenceRepository.getLastNotification.mockResolvedValue({
          geofenceId: 'geofence-123',
          userId: 'user-123',
          eventType: 'entry',
          timestamp: new Date(Date.now() - 60000) // 1 minute ago
        });

        await expect(geofenceEngine.checkGeofenceStatus('user-123', entryLocation))
          .rejects.toThrow(CooldownActiveError);

        expect(mockNotificationService.sendGeofenceAlert).not.toHaveBeenCalled();
      });

      it('should allow notifications after 5-minute cooldown expires', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123',
          type: 'safe_zone'
        };

        const entryLocation = {
          lat: 24.8139,
          lng: 120.9675,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(8);
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);
        mockGeofenceRepository.getLastNotification.mockResolvedValue({
          geofenceId: 'geofence-123',
          userId: 'user-123',
          eventType: 'entry',
          timestamp: new Date(Date.now() - 360000) // 6 minutes ago
        });

        mockNotificationService.sendGeofenceAlert.mockResolvedValue(true);

        const result = await geofenceEngine.checkGeofenceStatus('user-123', entryLocation);

        expect(result.entries).toHaveLength(1);
        expect(mockNotificationService.sendGeofenceAlert).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            type: 'geofence_entry',
            geofenceId: 'geofence-123'
          })
        );
      });

      it('should handle different cooldown periods for different event types', async () => {
        const eventTypeCooldowns = [
          { eventType: 'entry', cooldownMinutes: 5 },
          { eventType: 'exit', cooldownMinutes: 5 },
          { eventType: 'dwell_alert', cooldownMinutes: 15 }, // Longer cooldown for dwell alerts
          { eventType: 'emergency', cooldownMinutes: 0 }    // No cooldown for emergencies
        ];

        for (const { eventType, cooldownMinutes } of eventTypeCooldowns) {
          const lastNotificationTime = new Date(Date.now() - (cooldownMinutes - 1) * 60000); // 1 minute before cooldown expires

          mockGeofenceRepository.getLastNotification.mockResolvedValue({
            geofenceId: 'geofence-123',
            userId: 'user-123',
            eventType,
            timestamp: lastNotificationTime
          });

          const cooldownActive = await geofenceEngine.isCooldownActive('user-123', 'geofence-123', eventType);

          if (cooldownMinutes > 0) {
            expect(cooldownActive).toBe(true);
          } else {
            expect(cooldownActive).toBe(false);
          }
        }
      });

      it('should allow immediate notifications for different geofences', async () => {
        // Last notification was for geofence-1
        mockGeofenceRepository.getLastNotification.mockResolvedValue({
          geofenceId: 'geofence-1',
          userId: 'user-123',
          eventType: 'entry',
          timestamp: new Date(Date.now() - 60000) // 1 minute ago
        });

        // Check cooldown for different geofence-2 (should not be active)
        const cooldownActive = await geofenceEngine.isCooldownActive('user-123', 'geofence-2', 'entry');

        expect(cooldownActive).toBe(false);
      });
    });
  });

  describe('Dwell Time Tracking (5+ minutes)', () => {
    describe('trackDwellTime', () => {
      it('should track dwell time when user stays in geofence for 5+ minutes', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123',
          type: 'safe_zone',
          dwellTrackingEnabled: true
        };

        const stationaryLocation = {
          lat: 24.8138,
          lng: 120.9675,
          accuracy: 5,
          timestamp: new Date()
        };

        // User entered 6 minutes ago
        mockGeofenceRepository.getUserGeofenceStatus.mockResolvedValue({
          userId: 'user-123',
          geofenceId: 'geofence-123',
          status: 'inside',
          lastEntry: new Date(Date.now() - 360000), // 6 minutes ago
          dwellStartTime: new Date(Date.now() - 360000)
        });

        mockLocationService.calculateDistance.mockReturnValue(5); // Still inside
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);

        const result = await geofenceEngine.checkGeofenceStatus('user-123', stationaryLocation);

        expect(result.dwellUpdates).toHaveLength(1);
        expect(result.dwellUpdates[0]).toEqual(expect.objectContaining({
          geofenceId: 'geofence-123',
          dwellTimeMinutes: 6,
          dwellStatus: 'extended'
        }));
      });

      it('should trigger dwell alerts at specific intervals', async () => {
        const dwellAlertIntervals = [5, 15, 30, 60]; // minutes

        for (const intervalMinutes of dwellAlertIntervals) {
          jest.clearAllMocks();

          const geofence = {
            id: 'geofence-123',
            center: testCoordinates.hsinchu_city_hall,
            radius: 100,
            userId: 'user-123',
            dwellTrackingEnabled: true,
            dwellAlertIntervals: dwellAlertIntervals
          };

          mockGeofenceRepository.getUserGeofenceStatus.mockResolvedValue({
            userId: 'user-123',
            geofenceId: 'geofence-123',
            status: 'inside',
            lastEntry: new Date(Date.now() - intervalMinutes * 60000),
            dwellStartTime: new Date(Date.now() - intervalMinutes * 60000),
            lastDwellAlert: intervalMinutes > 5 ? new Date(Date.now() - (intervalMinutes - 5) * 60000) : null
          });

          const stationaryLocation = {
            lat: 24.8138,
            lng: 120.9675,
            accuracy: 5,
            timestamp: new Date()
          };

          mockLocationService.calculateDistance.mockReturnValue(5);
          mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);
          mockNotificationService.sendDwellAlert.mockResolvedValue(true);

          const result = await geofenceEngine.checkGeofenceStatus('user-123', stationaryLocation);

          expect(mockNotificationService.sendDwellAlert).toHaveBeenCalledWith(
            'user-123',
            expect.objectContaining({
              geofenceId: 'geofence-123',
              dwellTimeMinutes: intervalMinutes,
              alertType: `dwell_${intervalMinutes}min`
            })
          );
        }
      });

      it('should reset dwell time when user exits and re-enters', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123',
          dwellTrackingEnabled: true
        };

        // Simulate user exiting (this would reset dwell time)
        mockGeofenceRepository.getUserGeofenceStatus.mockResolvedValue({
          userId: 'user-123',
          geofenceId: 'geofence-123',
          status: 'outside',
          lastExit: new Date(Date.now() - 60000), // 1 minute ago
          dwellStartTime: null // Reset on exit
        });

        const outsideLocation = {
          lat: 24.8200,
          lng: 120.9800,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(150);
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);

        // Now user re-enters
        const reentryLocation = {
          lat: 24.8138,
          lng: 120.9675,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(5);
        mockGeofenceRepository.updateGeofenceStatus.mockResolvedValue({
          userId: 'user-123',
          geofenceId: 'geofence-123',
          status: 'inside',
          lastEntry: new Date(),
          dwellStartTime: new Date() // New dwell tracking starts
        });

        const result = await geofenceEngine.checkGeofenceStatus('user-123', reentryLocation);

        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].dwellTimeMinutes).toBe(0); // Reset dwell time
      });

      it('should handle movement within geofence without resetting dwell time', async () => {
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123',
          dwellTrackingEnabled: true
        };

        // User has been inside for 10 minutes
        mockGeofenceRepository.getUserGeofenceStatus.mockResolvedValue({
          userId: 'user-123',
          geofenceId: 'geofence-123',
          status: 'inside',
          lastEntry: new Date(Date.now() - 600000), // 10 minutes ago
          dwellStartTime: new Date(Date.now() - 600000)
        });

        // User moves to different location within geofence
        const newLocationInside = [
          { lat: 24.8140, lng: 120.9676, distance: 15 }, // 15m from center
          { lat: 24.8145, lng: 120.9680, distance: 35 }, // 35m from center
          { lat: 24.8150, lng: 120.9685, distance: 60 }  // 60m from center
        ];

        for (const location of newLocationInside) {
          mockLocationService.calculateDistance.mockReturnValue(location.distance);
          mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);

          const testLocation = {
            lat: location.lat,
            lng: location.lng,
            accuracy: 5,
            timestamp: new Date()
          };

          const result = await geofenceEngine.checkGeofenceStatus('user-123', testLocation);

          // Dwell time should continue, not reset
          expect(result.dwellUpdates[0].dwellTimeMinutes).toBe(10);
          expect(result.dwellUpdates[0].dwellStatus).toBe('extended');
        }
      });
    });
  });

  describe('Geofence Configuration and Management', () => {
    describe('createGeofence', () => {
      it('should validate geofence parameters before creation', async () => {
        const invalidGeofences = [
          {
            // Missing required fields
            name: '測試區域',
            userId: 'user-123'
            // Missing center, radius
          },
          {
            // Invalid coordinates
            name: '測試區域',
            center: { lat: 200, lng: 300 }, // Invalid lat/lng
            radius: 100,
            userId: 'user-123'
          },
          {
            // Invalid radius
            name: '測試區域',
            center: testCoordinates.hsinchu_city_hall,
            radius: -50, // Negative radius
            userId: 'user-123'
          },
          {
            // Radius too large
            name: '測試區域',
            center: testCoordinates.hsinchu_city_hall,
            radius: 5000, // 5km radius (too large for safety tracking)
            userId: 'user-123'
          }
        ];

        for (const invalidGeofence of invalidGeofences) {
          await expect(geofenceEngine.createGeofence(invalidGeofence))
            .rejects.toThrow();
        }
      });

      it('should enforce maximum number of geofences per user', async () => {
        const userId = 'user-123';
        const maxGeofences = 10;

        // Mock user already has maximum number of geofences
        mockGeofenceRepository.countUserGeofences.mockResolvedValue(maxGeofences);

        const newGeofence = {
          name: '第11個地理圍籬',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId,
          type: 'safe_zone'
        };

        await expect(geofenceEngine.createGeofence(newGeofence))
          .rejects.toThrow('Maximum number of geofences exceeded');

        expect(mockGeofenceRepository.countUserGeofences).toHaveBeenCalledWith(userId);
      });

      it('should validate geofence names are unique per user', async () => {
        const userId = 'user-123';
        const geofenceName = '家庭安全區';

        mockGeofenceRepository.findByUserAndName.mockResolvedValue({
          id: 'existing-geofence-id',
          name: geofenceName,
          userId
        });

        const duplicateGeofence = {
          name: geofenceName,
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId,
          type: 'safe_zone'
        };

        await expect(geofenceEngine.createGeofence(duplicateGeofence))
          .rejects.toThrow('Geofence name already exists');
      });
    });

    describe('updateGeofence', () => {
      it('should handle geofence boundary updates and notify affected users', async () => {
        const originalGeofence = {
          id: 'geofence-123',
          name: '安全區域',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId: 'user-123'
        };

        const updatedGeofence = {
          ...originalGeofence,
          radius: 150 // Expanded radius
        };

        mockGeofenceRepository.findById.mockResolvedValue(originalGeofence);
        mockGeofenceRepository.update.mockResolvedValue(updatedGeofence);
        mockNotificationService.sendGeofenceUpdateNotification.mockResolvedValue(true);

        const result = await geofenceEngine.updateGeofence('geofence-123', {
          radius: 150
        });

        expect(result.radius).toBe(150);
        expect(mockNotificationService.sendGeofenceUpdateNotification)
          .toHaveBeenCalledWith('user-123', expect.objectContaining({
            type: 'geofence_updated',
            geofenceId: 'geofence-123',
            changes: { radius: { from: 100, to: 150 } }
          }));
      });
    });
  });

  describe('Performance and Optimization', () => {
    describe('batchLocationProcessing', () => {
      it('should efficiently process multiple users locations simultaneously', async () => {
        const userLocations = [
          { userId: 'user-1', location: { ...testCoordinates.hsinchu_city_hall, accuracy: 5 } },
          { userId: 'user-2', location: { ...testCoordinates.hsinchu_park, accuracy: 7 } },
          { userId: 'user-3', location: { ...testCoordinates.hsinchu_station, accuracy: 6 } }
        ];

        const mockGeofences = [
          { id: 'geofence-1', center: testCoordinates.hsinchu_city_hall, radius: 100, userId: 'user-1' },
          { id: 'geofence-2', center: testCoordinates.hsinchu_park, radius: 80, userId: 'user-2' },
          { id: 'geofence-3', center: testCoordinates.hsinchu_station, radius: 120, userId: 'user-3' }
        ];

        mockGeofenceRepository.findActiveByUsers.mockResolvedValue(mockGeofences);
        mockLocationService.calculateDistance.mockReturnValue(10); // All users inside their geofences

        const startTime = Date.now();
        const results = await geofenceEngine.batchProcessLocations(userLocations);
        const processingTime = Date.now() - startTime;

        expect(results).toHaveLength(3);
        expect(processingTime).toBeLessThan(1000); // Should process quickly
        expect(results.every(r => r.entries.length > 0)).toBe(true);
      });

      it('should handle high-frequency location updates without performance degradation', async () => {
        const userId = 'user-123';
        const geofence = {
          id: 'geofence-123',
          center: testCoordinates.hsinchu_city_hall,
          radius: 100,
          userId
        };

        mockGeofenceRepository.findActiveByUser.mockResolvedValue([geofence]);
        mockLocationService.calculateDistance.mockReturnValue(50);

        // Simulate 100 location updates in rapid succession
        const locationUpdates = Array.from({ length: 100 }, (_, i) => ({
          lat: 24.8138 + (i * 0.0001), // Slight movement
          lng: 120.9675 + (i * 0.0001),
          accuracy: 5,
          timestamp: new Date(Date.now() + i * 1000) // 1 second apart
        }));

        const startTime = Date.now();

        for (const location of locationUpdates) {
          await geofenceEngine.checkGeofenceStatus(userId, location);
        }

        const totalTime = Date.now() - startTime;
        const avgTimePerUpdate = totalTime / locationUpdates.length;

        expect(avgTimePerUpdate).toBeLessThan(50); // Should process each update in <50ms
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    describe('errorRecovery', () => {
      it('should handle location service failures gracefully', async () => {
        const userId = 'user-123';
        const location = testCoordinates.hsinchu_city_hall;

        mockLocationService.calculateDistance.mockRejectedValue(new Error('GPS service unavailable'));
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([]);

        const result = await geofenceEngine.checkGeofenceStatus(userId, location);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].type).toBe('location_service_error');
        expect(result.entries).toHaveLength(0);
        expect(result.exits).toHaveLength(0);
      });

      it('should continue processing other geofences when one fails', async () => {
        const userId = 'user-123';
        const geofences = [
          { id: 'geofence-1', center: testCoordinates.hsinchu_city_hall, radius: 100, userId },
          { id: 'geofence-2', center: testCoordinates.hsinchu_park, radius: 80, userId },
          { id: 'geofence-3', center: testCoordinates.hsinchu_station, radius: 120, userId }
        ];

        const location = testCoordinates.hsinchu_city_hall;

        mockGeofenceRepository.findActiveByUser.mockResolvedValue(geofences);

        // First geofence calculation fails, others succeed
        mockLocationService.calculateDistance
          .mockRejectedValueOnce(new Error('Calculation failed for geofence-1'))
          .mockReturnValueOnce(10) // geofence-2 - inside
          .mockReturnValueOnce(200); // geofence-3 - outside

        const result = await geofenceEngine.checkGeofenceStatus(userId, location);

        expect(result.errors).toHaveLength(1);
        expect(result.entries).toHaveLength(1); // Only geofence-2 processed successfully
        expect(result.entries[0].geofenceId).toBe('geofence-2');
      });
    });
  });

  describe('Integration with External Services', () => {
    describe('emergencyResponse', () => {
      it('should trigger emergency alerts for critical geofence violations', async () => {
        const emergencyGeofence = {
          id: 'emergency-geofence-123',
          name: '危險區域警戒',
          center: testCoordinates.outside_hsinchu,
          radius: 500,
          userId: 'user-123',
          type: 'danger_zone',
          emergencyEnabled: true
        };

        const dangerLocation = {
          lat: 25.0330, // Inside danger zone
          lng: 121.5654,
          accuracy: 5,
          timestamp: new Date()
        };

        mockLocationService.calculateDistance.mockReturnValue(100); // Inside danger zone
        mockGeofenceRepository.findActiveByUser.mockResolvedValue([emergencyGeofence]);
        mockNotificationService.sendEmergencyAlert.mockResolvedValue(true);

        const result = await geofenceEngine.checkGeofenceStatus('user-123', dangerLocation);

        expect(result.emergencyAlerts).toHaveLength(1);
        expect(result.emergencyAlerts[0]).toEqual(expect.objectContaining({
          geofenceId: 'emergency-geofence-123',
          alertLevel: 'critical',
          eventType: 'danger_zone_entry'
        }));

        expect(mockNotificationService.sendEmergencyAlert).toHaveBeenCalledWith(
          'user-123',
          expect.objectContaining({
            type: 'emergency_geofence_violation',
            urgency: 'high',
            geofenceId: 'emergency-geofence-123'
          })
        );
      });
    });
  });
});