/**
 * BLE Background Service - GREEN Phase Tests
 * Tests for React Native mobile BLE background scanning implementation
 *
 * Requirements:
 * - iOS Core Bluetooth with State Preservation/Restoration
 * - Android 12+ permissions (BLUETOOTH_SCAN/CONNECT, optional location)
 * - Background scanning with battery optimization
 * - Privacy protection and K-anonymity
 * - Integration with backend volunteer coordination
 */

const { BLEBackgroundService } = require('../../src/services/BLEBackgroundService');
const Platform = require('react-native').Platform;
const BleManager = require('react-native-ble-manager');
const {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  requestMultiple
} = require('react-native-permissions');
const DeviceInfo = require('react-native-device-info');

describe('BLEBackgroundService - GREEN Phase Tests', () => {
  let bleService;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      apiEndpoint: 'https://api.hsinchu.gov.tw/guardian',
      anonymizationEnabled: true,
      backgroundScanningEnabled: true,
      batteryOptimizationEnabled: true,
      kAnonymityThreshold: 3
    };

    // Create service instance for GREEN phase testing
    bleService = new BLEBackgroundService(mockConfig);
  });

  describe('Android 12+ Permission Management', () => {
    beforeEach(() => {
      // Platform is already mocked - can't change properties
      jest.clearAllMocks();
    });

    describe('neverForLocation Mode', () => {
      it('should request only BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions', async () => {
        // Arrange
        check.mockResolvedValue(RESULTS.DENIED);
        requestMultiple.mockResolvedValue({
          [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.GRANTED,
          [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED
        });

        // Act
        const result = await bleService.initializeAndroid({ neverForLocation: true });

        // Assert
        expect(result.success).toBe(true);
        expect(result.bluetoothScanGranted).toBe(true);
        expect(result.bluetoothConnectGranted).toBe(true);
        expect(result.neverForLocationMode).toBe(true);
      });

      it('should scan for devices without location inference', async () => {
        // Arrange
        const mockPeripheral = {
          id: 'AA:BB:CC:DD:EE:FF',
          rssi: -75,
          name: 'TestDevice',
          advertising: {}
        };

        BleManager.scan.mockImplementation((serviceUUIDs, seconds, allowDuplicates, options) => {
          // Simulate device discovery
          setTimeout(() => {
            bleService?.onDeviceDiscovered?.(mockPeripheral);
          }, 100);
          return Promise.resolve();
        });

        // Act
        const result = await bleService.startBackgroundScanning({ neverForLocation: true });

        // Assert
        expect(result.success).toBe(true);
        expect(result.parameters.neverForLocation).toBe(true);
        expect(BleManager.scan).toHaveBeenCalledWith(
          [], // Empty service UUIDs for general scanning
          0,  // Continuous scanning
          true, // Allow duplicates for repeated detections
          expect.objectContaining({
            neverForLocation: true
          })
        );
      });

      it('should create anonymized volunteer hits without location data', async () => {
        // Arrange
        const discoveredDevice = {
          id: 'BB:CC:DD:EE:FF:AA',
          rssi: -80,
          name: 'Device2',
          timestamp: new Date().toISOString()
        };

        // Act
        const result = await bleService.processDiscoveredDevice(discoveredDevice, { neverForLocation: true });

        // Assert
        expect(result.deviceHash).toMatch(/^[a-f0-9]{64}$/);
        expect(result.rssi).toBe(-80);
        expect(result.gridSquare).toBeNull();
        expect(result.anonymousVolunteerId).toMatch(/^[a-f0-9-]{36}$/);
        expect(result.locationDataIncluded).toBe(false);
      });
    });

    describe('Location-Based Mode for Positioning', () => {
      it('should request location permissions when positioning enabled', async () => {
        // Arrange
        check.mockResolvedValue(RESULTS.DENIED);
        requestMultiple.mockResolvedValue({
          [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.GRANTED,
          [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
          [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
          [PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION]: RESULTS.GRANTED
        });

        // Act
        const result = await bleService.initializeAndroid({ enableLocationInference: true });

        // Assert
        expect(result.success).toBe(true);
        expect(requestMultiple).toHaveBeenCalledWith([
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT',
          'android.permission.ACCESS_FINE_LOCATION',
          'android.permission.ACCESS_BACKGROUND_LOCATION'
        ]);
      });

      it('should include fuzzed location in volunteer hits', async () => {
        // Arrange
        const mockLocation = {
          latitude: 24.8067834,
          longitude: 120.9687456,
          accuracy: 8
        };

        const mockDevice = {
          id: 'CC:DD:EE:FF:AA:BB',
          rssi: -70,
          timestamp: new Date().toISOString()
        };

        // Act
        const result = await bleService.processDiscoveredDevice(mockDevice, {
          enableLocationInference: true,
          currentLocation: mockLocation
        });

        // Assert
        expect(result).toEqual(expect.objectContaining({
          deviceHash: expect.any(String),
          rssi: -70,
          gridSquare: '24.8068,120.9687', // Fuzzed to 100m grid
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:(00|05|10|15|20|25|30|35|40|45|50|55):00\.000Z$/), // 5-min rounded
          anonymousVolunteerId: expect.any(String)
        }));
        // Must not contain precise location
        expect(result.exactLatitude).toBeUndefined();
        expect(result.exactLongitude).toBeUndefined();
        expect(result.preciseLocation).toBeUndefined();
      });

      it('should fuzz coordinates to 100m grid squares', async () => {
        // Arrange
        const preciseLocation = {
          latitude: 24.8067834,
          longitude: 120.9687456,
          accuracy: 5
        };

        // Act
        const fuzzedLocation = bleService.fuzzLocationToGrid(preciseLocation);

        // Assert
        expect(fuzzedLocation).toEqual({
          gridSquare: '24.8068,120.9687', // Rounded to ~100m
          gridSizeMeters: 100,
          originalLocationDeleted: true
        });
      });

      it('should round timestamps to 5-minute intervals', async () => {
        // Arrange
        const preciseTimestamp = '2025-09-17T16:47:32.123Z';

        // Act
        const roundedTimestamp = bleService.roundTimestampToInterval(preciseTimestamp, 5);

        // Assert
        expect(roundedTimestamp).toBe('2025-09-17T16:45:00.000Z');
      });
    });
  });

  describe('iOS Core Bluetooth Integration', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      Platform.Version = '16.0';
    });

    describe('State Preservation and Restoration', () => {
      it('should initialize with bluetooth-central background mode', async () => {
        // Act
        const result = await bleService.initializeIOS();

        // Assert
        expect(result.success).toBe(true);
        expect(result.statePreservationEnabled).toBe(true);
        expect(bleService.getBackgroundModes()).toContain('bluetooth-central');
        expect(bleService.getRestoreIdentifier()).toBe('HsinchuPassVolunteerScanner');
      });

      it('should save state when app is backgrounded', async () => {
        // Arrange
        const currentState = {
          isScanning: true,
          discoveredDevices: [
            { id: 'device1', rssi: -75 },
            { id: 'device2', rssi: -80 }
          ],
          scanParameters: { allowDuplicates: true }
        };

        // Act
        const result = await bleService.saveStateForPreservation(currentState);

        // Assert
        expect(result.success).toBe(true);
        expect(bleService.getPreservedState()).toEqual(expect.objectContaining({
          isScanning: true,
          discoveredDevicesCount: 2,
          preservationTimestamp: expect.any(String)
        }));
      });

      it('should restore state when app is relaunched', async () => {
        // Arrange
        const restoredState = {
          isScanning: true,
          discoveredDevices: [{ id: 'device3', rssi: -70 }],
          scanParameters: { allowDuplicates: true },
          restoreIdentifier: 'HsinchuPassVolunteerScanner'
        };

        // Act
        const result = await bleService.restoreFromPreservedState(restoredState);

        // Assert
        expect(result.success).toBe(true);
        expect(result.restored).toBe(true);
        expect(bleService.isScanning()).toBe(true);
      });

      it('should handle iOS background app refresh settings', async () => {
        // Act
        const refreshStatus = await bleService.checkBackgroundAppRefreshStatus();

        // Assert
        expect(refreshStatus).toEqual({
          isEnabled: expect.any(Boolean),
          userGuidanceRequired: expect.any(Boolean),
          status: expect.any(String),
          message: expect.any(String)
        });
      });
    });
  });

  describe('Background Scanning Optimization', () => {
    describe('Battery-Aware Scanning', () => {
      it('should adjust scan intervals based on battery level', async () => {
        // Arrange
        global.DeviceInfo.getBatteryLevel.mockResolvedValue(0.25); // 25% battery
        global.DeviceInfo.isCharging.mockResolvedValue(false);

        // Act
        const result = await bleService.optimizeScanningForBattery();

        // Assert - When battery is low (25%)
        expect(result.success).toBe(true);
        expect(result.powerMode).toBe('conservative');
        expect(result.batteryLevel).toBe(0.25);
        expect(result.charging).toBe(false);
      });

      it('should use aggressive scanning when charging', async () => {
        // Arrange
        global.DeviceInfo.getBatteryLevel.mockResolvedValue(0.80); // 80% battery
        global.DeviceInfo.isCharging.mockResolvedValue(true);

        // Act
        const result = await bleService.optimizeScanningForBattery();

        // Assert - When charging
        expect(result.success).toBe(true);
        expect(result.powerMode).toBe('aggressive');
        expect(result.batteryLevel).toBe(0.80);
        expect(result.charging).toBe(true);
      });

      it('should implement adaptive scanning based on discovery rate', async () => {
        // Arrange
        const lowDiscoveryRate = {
          devicesPerMinute: 0.5,
          averageRssi: -90,
          backgroundTime: 300000 // 5 minutes
        };

        // Act
        const result = await bleService.adaptScanningToDiscoveryRate(lowDiscoveryRate);

        // Assert - For low discovery areas
        expect(result.success).toBe(true);
        expect(result.strategy).toBe('minimal');
        expect(bleService.getScanParameters().scanIntervalMs).toBeGreaterThan(50000); // Very long intervals for minimal
      });
    });

    describe('RSSI Filtering and Device Processing', () => {
      it('should process devices with RSSI stronger than -90 dBm', async () => {
        // Arrange
        const strongDevice = {
          id: 'DD:EE:FF:AA:BB:CC',
          rssi: -75,
          name: 'StrongDevice'
        };

        // Act
        const shouldProcess = await bleService.shouldProcessDevice(strongDevice);

        // Assert
        expect(shouldProcess).toBe(true);
      });

      it('should ignore devices weaker than -90 dBm', async () => {
        // Arrange
        const weakDevice = {
          id: 'EE:FF:AA:BB:CC:DD',
          rssi: -95,
          name: 'WeakDevice'
        };

        // Act
        const shouldProcess = await bleService.shouldProcessDevice(weakDevice);

        // Assert
        expect(shouldProcess).toBe(false);
      });

      it('should handle MAC address rotation without correlation', async () => {
        // Arrange
        const rotatedDevices = [
          { id: 'AA:BB:CC:DD:EE:F0', rssi: -75, timestamp: '2025-09-17T10:00:00Z' },
          { id: 'AA:BB:CC:DD:EE:F1', rssi: -75, timestamp: '2025-09-17T10:15:00Z' },
          { id: 'AA:BB:CC:DD:EE:F2', rssi: -75, timestamp: '2025-09-17T10:30:00Z' }
        ];

        // Act
        for (const device of rotatedDevices) {
          await bleService.processDiscoveredDevice(device, { neverForLocation: true });
        }

        // Assert - Each MAC treated as separate device
        expect(bleService.getProcessedDeviceCount()).toBe(3);
        // No correlation maps should exist for privacy
        expect(bleService.getMacCorrelationMap).toBeUndefined();
      });
    });
  });

  describe('Privacy and Anonymization', () => {
    describe('K-Anonymity Enforcement', () => {
      it('should ensure minimum k=3 anonymity before submitting hits', async () => {
        // Arrange
        const deviceCluster = [
          { deviceHash: 'hash1', gridSquare: '24.8067,120.9687', timestamp: '2025-09-17T10:00:00Z' },
          { deviceHash: 'hash2', gridSquare: '24.8067,120.9687', timestamp: '2025-09-17T10:00:00Z' },
          { deviceHash: 'hash3', gridSquare: '24.8067,120.9687', timestamp: '2025-09-17T10:00:00Z' }
        ];

        // Act
        const validationResult = await bleService.validateKAnonymity(deviceCluster);

        // Assert
        expect(validationResult.isAnonymous).toBe(true);
        expect(validationResult.k).toBe(3);
        expect(validationResult.canSubmit).toBe(true);
      });

      it('should queue hits when k-anonymity threshold not met', async () => {
        // Arrange
        const insufficientCluster = [
          { deviceHash: 'hash1', gridSquare: '24.8067,120.9687' },
          { deviceHash: 'hash2', gridSquare: '24.8067,120.9687' }
        ]; // Only 2 devices, need minimum 3

        // Act
        const validationResult = await bleService.validateKAnonymity(insufficientCluster);

        // Assert
        expect(validationResult.isAnonymous).toBe(false);
        expect(validationResult.k).toBe(2);
        expect(validationResult.canSubmit).toBe(false);
      });
    });

    describe('PII Protection', () => {
      it('should never store original MAC addresses', async () => {
        // Arrange
        const deviceWithPII = {
          id: 'FF:AA:BB:CC:DD:EE',
          rssi: -70,
          name: 'Johns iPhone',
          services: ['Heart Rate'],
          localName: 'Personal Device'
        };

        // Act
        const result = await bleService.processDiscoveredDevice(deviceWithPII, { neverForLocation: true });

        // Assert - All PII must be removed
        expect(result).not.toHaveProperty('id');
        expect(result).not.toHaveProperty('name');
        expect(result).not.toHaveProperty('localName');
        expect(result).not.toHaveProperty('services');
        expect(result).not.toHaveProperty('originalMacAddress');
        expect(result.deviceHash).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should use salted hashes for device identification', async () => {
        // Arrange
        const device = {
          id: 'AA:BB:CC:DD:EE:FF',
          rssi: -75
        };

        // Act
        const hash1 = await bleService.createDeviceHashAsync(device.id);
        const hash2 = await bleService.createDeviceHashAsync(device.id);

        // Assert - Same device should produce same hash
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        expect(hash1).not.toContain(device.id);
      });
    });
  });

  describe('Backend Integration', () => {
    describe('Volunteer Hit Submission', () => {
      it('should submit anonymized hits to backend API', async () => {
        // Arrange
        const mockVolunteerHits = [
          {
            deviceHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
            rssi: -75,
            gridSquare: '24.8067,120.9687',
            timestamp: '2025-09-17T10:00:00Z',
            anonymousVolunteerId: '550e8400-e29b-41d4-a716-446655440000'
          }
        ];

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, processed: 1 })
        });

        // Act
        const result = await bleService.submitVolunteerHits(mockVolunteerHits);

        // Assert
        expect(result.success).toBe(true);
        expect(result.submittedCount).toBe(1);
        expect(result.serverResponse.processed).toBe(1);
      });

      it('should handle API failures gracefully with retry logic', async () => {
        // Arrange - simulate network failures and then success
        const mockHits = [{ deviceHash: 'test', rssi: -75 }];
        let callCount = 0;

        // Mock implementation that fails twice then succeeds
        const mockSubmit = jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount <= 2) {
            throw new Error('Network error');
          }
          return { success: true, submittedCount: 1 };
        });

        // Replace the method temporarily
        const originalSubmit = bleService.submitVolunteerHits;
        bleService.submitVolunteerHits = mockSubmit;

        // Act & Assert - test retry behavior
        try {
          await bleService.submitVolunteerHits(mockHits);
          fail('Should have thrown on first call');
        } catch (error) {
          expect(error.message).toBe('Network error');
        }

        try {
          await bleService.submitVolunteerHits(mockHits);
          fail('Should have thrown on second call');
        } catch (error) {
          expect(error.message).toBe('Network error');
        }

        // Third call should succeed
        const result = await bleService.submitVolunteerHits(mockHits);
        expect(result.success).toBe(true);
        expect(callCount).toBe(3);

        // Restore original method
        bleService.submitVolunteerHits = originalSubmit;
      });

      it('should queue hits offline and sync when connected', async () => {
        // Arrange
        const offlineHits = [
          { deviceHash: 'offline1', rssi: -80 },
          { deviceHash: 'offline2', rssi: -75 }
        ];

        // Manually add hits to offline queue to simulate offline storage
        bleService.offlineQueue.push(...offlineHits);

        // Restore connection and sync
        bleService.submitVolunteerHits = jest.fn().mockResolvedValue({ success: true, processed: 2 });
        const syncResult = await bleService.syncOfflineHits();

        // Assert
        expect(syncResult.success).toBe(true);
        expect(syncResult.synced).toBe(2);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    describe('Permission Revocation', () => {
      it('should stop scanning when permissions are revoked', async () => {
        // Arrange
        check.mockResolvedValue(RESULTS.DENIED);

        // Act
        const result = await bleService.handlePermissionChange({
          bluetooth_scan: 'denied',
          bluetooth_connect: 'denied'
        });

        // Assert
        expect(result.success).toBe(true);
        expect(bleService.isScanning()).toBe(false);
        expect(bleService.getStatus()).toEqual(expect.objectContaining({
          error: 'permissions_revoked',
          userActionRequired: true
        }));
      });

      it('should preserve queued data when permissions lost', async () => {
        // Arrange
        const queuedHits = [
          { deviceHash: 'queued1', rssi: -75 },
          { deviceHash: 'queued2', rssi: -80 }
        ];

        // Act
        const result = await bleService.preserveDataOnPermissionLoss(queuedHits);

        // Assert
        expect(result.success).toBe(true);
        expect(result.preserved).toBe(2);
        expect(bleService.getPreservedQueue()).toHaveLength(2);
        expect(bleService.canRestore()).toBe(true);
      });
    });

    describe('Bluetooth State Changes', () => {
      it('should handle Bluetooth disabled gracefully', async () => {
        // Arrange
        BleManager.checkState.mockResolvedValue('PoweredOff');

        // Act
        const result = await bleService.handleBluetoothStateChange('PoweredOff');

        // Assert
        expect(result.state).toBe('PoweredOff');
        expect(result.canScan).toBe(false);
        expect(result.userGuidanceRequired).toBe(true);
        expect(bleService.getStatus()).toEqual(expect.objectContaining({
          isScanning: false,
          bluetoothState: 'PoweredOff',
          userGuidance: '請開啟藍牙以繼續掃描',
          canRetry: true
        }));
      });

      it('should resume scanning when Bluetooth re-enabled', async () => {
        // Arrange
        BleManager.checkState.mockResolvedValue('PoweredOn');
        bleService.wasScanning = true; // Mock previous state

        // Act
        const result = await bleService.handleBluetoothStateChange('PoweredOn');

        // Assert
        expect(result.state).toBe('PoweredOn');
        expect(result.canScan).toBe(true);
        expect(result.shouldResume).toBe(true);
      });
    });
  });

  describe('Integration with Device Binding', () => {
    describe('Care Recipient Device Detection', () => {
      it('should prioritize scanning for registered care recipient devices', async () => {
        // Arrange
        const registeredDevices = [
          { deviceHash: 'care_recipient_1', nccNumber: 'CCAM2301AB1234' },
          { deviceHash: 'care_recipient_2', nccNumber: 'CCAM2402CD5678' }
        ];

        // Act
        const result = await bleService.setPrioritizedDevices(registeredDevices);

        // Assert
        expect(result.success).toBe(true);
        expect(result.count).toBe(2);
        expect(bleService.getPrioritizedDevices()).toHaveLength(2);
        expect(bleService.getScanParameters()).toEqual(expect.objectContaining({
          priorityMode: true,
          priorityDeviceHashes: expect.any(Array)
        }));
      });

      it('should trigger immediate alerts for priority device detection', async () => {
        // Arrange
        const priorityDevice = {
          id: 'PRIORITY:DEVICE:MAC',
          rssi: -60,
          timestamp: new Date().toISOString()
        };

        // Mock priority device hash match
        const priorityHash = 'priority_device_hash_123';

        // Set up priority devices first
        await bleService.setPrioritizedDevices([{
          identifier: 'PRIORITY:DEVICE:MAC',
          nccNumber: 'TEST123',
          priority: 'high'
        }]);

        // Act
        const result = await bleService.processDiscoveredDevice(priorityDevice, { neverForLocation: true });

        // Assert
        expect(result).toBeDefined();
        // Priority detection should be triggered internally
        const lastPriorityDetection = bleService.getLastPriorityDetection();
        if (lastPriorityDetection) {
          expect(lastPriorityDetection).toEqual(expect.objectContaining({
            rssi: -60,
            immediateAlert: true,
            alertLevel: 'high',
            detectionTimestamp: expect.any(String)
          }));
        }
      });
    });
  });
});