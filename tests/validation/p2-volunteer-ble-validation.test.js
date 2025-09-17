/**
 * P2 志工BLE Production Validation Tests
 *
 * Validates:
 * - Android 12+ BLUETOOTH_SCAN/CONNECT permissions with neverForLocation
 * - iOS State Preservation/Restoration functionality
 * - VolunteerHit anonymization with NO PII exposure
 * - BLE background scanning capabilities under real conditions
 */

const { BLEBackgroundService } = require('../../src/mobile/src/services/BLEBackgroundService');
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

describe('P2 志工BLE Production Validation', () => {
  let bleService;
  let realDevices;
  let mockBackendAPI;

  beforeAll(async () => {
    // Real BLE device signatures for testing (anonymized)
    realDevices = [
      {
        id: 'AA:BB:CC:DD:EE:F1',
        rssi: -75,
        name: 'TestDevice1',
        advertising: { localName: 'Device1' }
      },
      {
        id: 'BB:CC:DD:EE:FF:A2',
        rssi: -82,
        name: null, // Anonymous device
        advertising: {}
      },
      {
        id: 'CC:DD:EE:FF:AA:B3',
        rssi: -65,
        name: 'PersonalDevice',
        advertising: { localName: 'Johns iPhone' }
      }
    ];

    mockBackendAPI = {
      endpoint: process.env.REAL_BLE_API_ENDPOINT || 'https://api.hsinchu.gov.tw/guardian/ble',
      apiKey: process.env.BLE_API_KEY
    };

    bleService = new BLEBackgroundService({
      apiEndpoint: mockBackendAPI.endpoint,
      anonymizationEnabled: true,
      backgroundScanningEnabled: true,
      batteryOptimizationEnabled: true,
      kAnonymityThreshold: 3,
      neverForLocation: true
    });
  });

  describe('Android 12+ Permission Management with neverForLocation', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.Version = 33; // Android 13
      jest.clearAllMocks();
    });

    it('should request ONLY BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions', async () => {
      // Arrange
      check.mockImplementation((permission) => {
        return Promise.resolve(RESULTS.DENIED);
      });

      requestMultiple.mockResolvedValue({
        [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.GRANTED,
        [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED
      });

      // Act
      const permissionResult = await bleService.initializeAndroid({
        neverForLocation: true,
        targetSDK: 33
      });

      // Assert
      expect(requestMultiple).toHaveBeenCalledWith([
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT
      ]);

      // Verify location permissions are NOT requested
      expect(requestMultiple).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
          PERMISSIONS.ANDROID.ACCESS_COARSE_LOCATION,
          PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION
        ])
      );

      expect(permissionResult.bluetoothScanGranted).toBe(true);
      expect(permissionResult.bluetoothConnectGranted).toBe(true);
      expect(permissionResult.locationPermissionsRequested).toBe(false);
      expect(permissionResult.neverForLocationMode).toBe(true);
    });

    it('should configure BLE scanning without location inference', async () => {
      // Act
      await bleService.startBackgroundScanning({
        neverForLocation: true,
        enableLocationInference: false
      });

      // Assert
      expect(BleManager.scan).toHaveBeenCalledWith(
        [], // Empty service UUIDs - general scanning
        0,  // Continuous scanning
        true, // Allow duplicates for tracking
        expect.objectContaining({
          neverForLocation: true,
          reportDelay: 0,
          scanMode: expect.stringMatching(/balanced|low_power/),
          matchMode: expect.stringMatching(/aggressive|sticky/)
        })
      );

      const scanConfig = bleService.getScanConfiguration();
      expect(scanConfig.locationInferenceEnabled).toBe(false);
      expect(scanConfig.neverForLocationCompliant).toBe(true);
    });

    it('should handle manifest declaration validation for neverForLocation', async () => {
      // Verify the BLE service validates proper manifest declarations
      const manifestValidation = await bleService.validateManifestConfiguration();

      expect(manifestValidation).toEqual(expect.objectContaining({
        bluetoothScanPermission: expect.objectContaining({
          declared: true,
          neverForLocation: true,
          usesPermissionFlags: expect.stringContaining('neverForLocation')
        }),
        bluetoothConnectPermission: expect.objectContaining({
          declared: true
        }),
        locationPermissions: expect.objectContaining({
          fineLocationDeclared: false,
          coarseLocationDeclared: false,
          backgroundLocationDeclared: false
        })
      }));
    });

    it('should create anonymized volunteer hits without any location data', async () => {
      // Arrange
      const discoveredDevice = realDevices[0];
      const currentTime = new Date().toISOString();

      // Act
      const volunteerHit = await bleService.processDiscoveredDevice(discoveredDevice, {
        neverForLocation: true,
        timestamp: currentTime
      });

      // Assert - NO location data should be present
      expect(volunteerHit).toEqual(expect.objectContaining({
        deviceHash: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256 hash
        rssi: -75,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:(00|05|10|15|20|25|30|35|40|45|50|55):00\.000Z$/), // 5-min rounded
        anonymousVolunteerId: expect.stringMatching(/^[a-f0-9-]{36}$/),

        // MUST NOT contain any location data
        gridSquare: null,
        latitude: undefined,
        longitude: undefined,
        location: undefined,
        gpsCoordinates: undefined,
        approximateLocation: undefined,

        // MUST NOT contain any PII
        originalMacAddress: undefined,
        deviceName: undefined,
        localName: undefined,
        advertising: undefined,
        services: undefined
      }));

      // Verify strict anonymization
      expect(Object.keys(volunteerHit)).not.toContain('id');
      expect(Object.keys(volunteerHit)).not.toContain('name');
      expect(Object.keys(volunteerHit)).not.toContain('originalDevice');
    });

    it('should validate Android 12+ runtime permission flow', async () => {
      // Simulate Android 12+ permission flow
      const androidVersion = await DeviceInfo.getApiLevel();

      if (androidVersion >= 31) { // Android 12+
        // Check permissions are properly requested
        check.mockImplementation((permission) => {
          if (permission === PERMISSIONS.ANDROID.BLUETOOTH_SCAN) {
            return Promise.resolve(RESULTS.DENIED);
          }
          if (permission === PERMISSIONS.ANDROID.BLUETOOTH_CONNECT) {
            return Promise.resolve(RESULTS.DENIED);
          }
          return Promise.resolve(RESULTS.DENIED);
        });

        requestMultiple.mockResolvedValue({
          [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.GRANTED,
          [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED
        });

        const permissionFlow = await bleService.requestAndroid12Permissions();

        expect(permissionFlow.targetSDK).toBeGreaterThanOrEqual(31);
        expect(permissionFlow.bluetoothPermissionsRequired).toBe(true);
        expect(permissionFlow.locationPermissionsRequired).toBe(false);
        expect(permissionFlow.neverForLocationCompliant).toBe(true);
      }
    });
  });

  describe('iOS State Preservation/Restoration Validation', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      Platform.Version = '16.0';
      jest.clearAllMocks();
    });

    it('should initialize with proper Core Bluetooth configuration', async () => {
      // Act
      const iosInitResult = await bleService.initializeIOS({
        restoreIdentifier: 'HsinchuPassVolunteerScanner',
        backgroundModes: ['bluetooth-central']
      });

      // Assert
      expect(iosInitResult).toEqual(expect.objectContaining({
        restoreIdentifier: 'HsinchuPassVolunteerScanner',
        backgroundModes: expect.arrayContaining(['bluetooth-central']),
        statePreservationEnabled: true,
        stateRestorationEnabled: true
      }));

      const config = bleService.getIOSConfiguration();
      expect(config.centralManager).toEqual(expect.objectContaining({
        restoreIdentifier: 'HsinchuPassVolunteerScanner',
        showPowerAlert: false, // Don't interrupt user
        options: expect.objectContaining({
          CBCentralManagerScanOptionAllowDuplicatesKey: true
        })
      }));
    });

    it('should save complete state when app backgrounded', async () => {
      // Arrange - simulate active scanning with discovered devices
      const activeState = {
        isScanning: true,
        scanParameters: {
          serviceUUIDs: [],
          allowDuplicates: true,
          scanOptions: { neverForLocation: true }
        },
        discoveredDevices: realDevices.map(device => ({
          id: device.id,
          rssi: device.rssi,
          lastSeen: Date.now()
        })),
        volunteerHitQueue: [
          { deviceHash: 'hash1', rssi: -75, timestamp: new Date().toISOString() },
          { deviceHash: 'hash2', rssi: -82, timestamp: new Date().toISOString() }
        ],
        scanStartTime: Date.now() - 300000, // 5 minutes ago
        batteryOptimizedMode: false
      };

      // Act
      const preservationResult = await bleService.saveStateForPreservation(activeState);

      // Assert
      expect(preservationResult.preservedState).toEqual(expect.objectContaining({
        isScanning: true,
        scanParameters: expect.objectContaining({
          serviceUUIDs: [],
          allowDuplicates: true
        }),
        discoveredDevicesCount: 3,
        queuedHitsCount: 2,
        preservationTimestamp: expect.any(String),
        preservationVersion: expect.any(String),

        // Should NOT preserve PII
        deviceDetails: undefined,
        rawDeviceData: undefined,
        personalInformation: undefined
      }));

      expect(preservationResult.success).toBe(true);
      expect(preservationResult.dataSize).toBeLessThan(1024); // Compact state
    });

    it('should restore state correctly when app relaunched', async () => {
      // Arrange - simulate app relaunch with preserved state
      const preservedState = {
        isScanning: true,
        scanParameters: {
          serviceUUIDs: [],
          allowDuplicates: true,
          scanOptions: { neverForLocation: true }
        },
        discoveredDevicesCount: 2,
        queuedHitsCount: 3,
        preservationTimestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        restoreIdentifier: 'HsinchuPassVolunteerScanner'
      };

      // Act
      const restorationResult = await bleService.restoreFromPreservedState(preservedState);

      // Assert
      expect(restorationResult.restored).toBe(true);
      expect(restorationResult.scanningResumed).toBe(true);

      // Verify scanning resumed with correct parameters
      expect(BleManager.scan).toHaveBeenCalledWith(
        [],
        0,
        true,
        expect.objectContaining({
          neverForLocation: true
        })
      );

      const currentState = bleService.getCurrentState();
      expect(currentState.isScanning).toBe(true);
      expect(currentState.restoredFromBackground).toBe(true);
      expect(currentState.timeSinceLastPreservation).toBeLessThan(3600000); // Within hour
    });

    it('should handle iOS background app refresh settings', async () => {
      // Act
      const backgroundRefreshStatus = await bleService.checkIOSBackgroundAppRefresh();

      // Assert
      expect(backgroundRefreshStatus).toEqual(expect.objectContaining({
        isEnabled: expect.any(Boolean),
        status: expect.stringMatching(/available|denied|restricted/),
        backgroundModes: expect.arrayContaining(['bluetooth-central']),
        userGuidanceRequired: expect.any(Boolean)
      }));

      if (!backgroundRefreshStatus.isEnabled) {
        expect(backgroundRefreshStatus.userGuidance).toEqual(expect.objectContaining({
          title: expect.any(String),
          message: expect.stringContaining('背景App重新整理'),
          actionText: '前往設定',
          settingsPath: 'App-Prefs:root=General&path=BACKGROUND_APP_REFRESH'
        }));
      }
    });

    it('should validate iOS State Preservation across app lifecycle', async () => {
      // Simulate full app lifecycle
      const lifecycle = [
        { state: 'active', action: 'startScanning' },
        { state: 'background', action: 'preserveState' },
        { state: 'suspended', action: 'maintainBluetooth' },
        { state: 'terminated', action: 'prepareRestoration' },
        { state: 'relaunch', action: 'restoreState' },
        { state: 'active', action: 'resumeScanning' }
      ];

      const lifecycleResults = [];

      for (const step of lifecycle) {
        let result;

        switch (step.action) {
          case 'startScanning':
            result = await bleService.startBackgroundScanning();
            break;
          case 'preserveState':
            result = await bleService.handleAppStateChange('background');
            break;
          case 'maintainBluetooth':
            result = await bleService.maintainBluetoothInBackground();
            break;
          case 'prepareRestoration':
            result = await bleService.prepareForTermination();
            break;
          case 'restoreState':
            result = await bleService.handleAppLaunchWithRestoration();
            break;
          case 'resumeScanning':
            result = await bleService.resumeScanningAfterRestore();
            break;
        }

        lifecycleResults.push({ ...step, result, timestamp: Date.now() });
      }

      // Verify complete lifecycle maintained functionality
      const finalState = bleService.getCurrentState();
      expect(finalState.isScanning).toBe(true);
      expect(finalState.lifecycleCompleted).toBe(true);
      expect(finalState.stateIntegrityMaintained).toBe(true);
    });
  });

  describe('VolunteerHit Anonymization with NO PII Exposure', () => {
    it('should ensure absolute PII protection in volunteer hits', async () => {
      // Arrange - device with extensive PII
      const deviceWithPII = {
        id: 'AA:BB:CC:DD:EE:FF', // Real MAC
        rssi: -70,
        name: 'Johns iPhone 14 Pro',
        localName: 'Personal Device',
        advertising: {
          localName: 'Johns iPhone 14 Pro',
          manufacturerData: 'Apple Inc.',
          serviceUUIDs: ['180F', '180A'], // Battery, Device Info
          txPowerLevel: 12,
          serviceData: {
            '180F': 'battery_data'
          }
        },
        services: [
          { uuid: '180F', name: 'Battery Service' },
          { uuid: '180A', name: 'Device Information' }
        ],
        characteristics: [
          { uuid: '2A19', name: 'Battery Level' }
        ]
      };

      // Act
      const anonymizedHit = await bleService.processDiscoveredDevice(deviceWithPII, {
        neverForLocation: true,
        strictAnonymization: true
      });

      // Assert - Verify NO PII fields exist
      const piiFields = [
        'id', 'name', 'localName', 'advertising', 'services', 'characteristics',
        'originalMacAddress', 'deviceName', 'manufacturerData', 'serviceData',
        'personalInformation', 'identifiableData', 'rawDevice'
      ];

      for (const field of piiFields) {
        expect(anonymizedHit).not.toHaveProperty(field);
        expect(anonymizedHit[field]).toBeUndefined();
      }

      // Verify only allowed anonymized fields
      const allowedFields = ['deviceHash', 'rssi', 'timestamp', 'anonymousVolunteerId'];
      const actualFields = Object.keys(anonymizedHit);

      expect(actualFields.sort()).toEqual(allowedFields.sort());

      // Verify hash cannot be reverse-engineered
      expect(anonymizedHit.deviceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(anonymizedHit.deviceHash).not.toContain('AA:BB:CC:DD:EE:FF');
      expect(anonymizedHit.deviceHash).not.toContain('Johns');
      expect(anonymizedHit.deviceHash).not.toContain('iPhone');
    });

    it('should implement salted hashing for device identification', async () => {
      // Arrange
      const testDevice = { id: 'TEST:MAC:ADDRESS:123', rssi: -75 };
      const dailySalt = await bleService.getDailySalt(); // Should rotate daily

      // Act
      const hash1 = await bleService.createDeviceHash(testDevice.id, dailySalt);
      const hash2 = await bleService.createDeviceHash(testDevice.id, dailySalt);
      const hash3 = await bleService.createDeviceHash(testDevice.id, 'different-salt');

      // Assert
      expect(hash1).toBe(hash2); // Same device, same salt = same hash
      expect(hash1).not.toBe(hash3); // Different salt = different hash
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 format
      expect(hash1).not.toContain(testDevice.id); // Original MAC not in hash

      // Verify salt rotation
      const saltAge = await bleService.getSaltAge();
      expect(saltAge).toBeLessThan(86400000); // Less than 24 hours
    });

    it('should enforce K-anonymity before submitting volunteer hits', async () => {
      // Arrange - create multiple devices to test k-anonymity
      const deviceCluster = [
        { id: 'DEVICE:001', rssi: -75 },
        { id: 'DEVICE:002', rssi: -78 },
        { id: 'DEVICE:003', rssi: -72 }
      ];

      const gridSquare = '24.8067,120.9687'; // Same location for anonymity
      const timeWindow = '2025-09-17T10:00:00.000Z'; // Same time window

      // Process each device
      const volunteerHits = [];
      for (const device of deviceCluster) {
        const hit = await bleService.processDiscoveredDevice(device, {
          neverForLocation: true,
          gridSquare: gridSquare,
          timestamp: timeWindow
        });
        volunteerHits.push(hit);
      }

      // Act
      const kAnonymityResult = await bleService.validateKAnonymity(volunteerHits, 3);

      // Assert
      expect(kAnonymityResult.isAnonymous).toBe(true);
      expect(kAnonymityResult.k).toBeGreaterThanOrEqual(3);
      expect(kAnonymityResult.canSubmit).toBe(true);

      // Test insufficient k-anonymity
      const insufficientHits = volunteerHits.slice(0, 2); // Only 2 devices
      const insufficientResult = await bleService.validateKAnonymity(insufficientHits, 3);

      expect(insufficientResult.isAnonymous).toBe(false);
      expect(insufficientResult.k).toBeLessThan(3);
      expect(insufficientResult.canSubmit).toBe(false);
      expect(insufficientResult.queueForLater).toBe(true);
    });

    it('should validate complete anonymization pipeline', async () => {
      // Arrange - device with all possible PII fields
      const richDevice = {
        id: 'RICH:DEVICE:DATA:456',
        rssi: -68,
        name: 'Complex Device Name',
        localName: 'User Personal Item',
        advertising: {
          localName: 'Personal BLE Device',
          manufacturerData: 'Detailed Manufacturer Info',
          serviceUUIDs: ['180F', '180A', '1801'],
          serviceData: {
            '180F': 'service_specific_data',
            'custom': 'proprietary_data'
          },
          txPowerLevel: 15,
          flags: ['LE_GENERAL_DISCOVERABLE']
        },
        services: [
          { uuid: '180F', name: 'Battery Service', primary: true },
          { uuid: '180A', name: 'Device Information', primary: true }
        ],
        characteristics: [
          { uuid: '2A19', name: 'Battery Level', value: '85%' },
          { uuid: '2A29', name: 'Manufacturer Name', value: 'Company Inc.' }
        ],
        metadata: {
          connectionState: 'disconnected',
          bondState: 'none',
          firstSeen: Date.now() - 3600000,
          lastSeen: Date.now()
        }
      };

      // Act - complete anonymization process
      const anonymizationResult = await bleService.completeAnonymizationPipeline(richDevice);

      // Assert - verify complete PII removal
      expect(anonymizationResult.originalDataCleared).toBe(true);
      expect(anonymizationResult.piiFieldsRemoved).toBeGreaterThan(10);
      expect(anonymizationResult.anonymizedOutput).toEqual(expect.objectContaining({
        deviceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        rssi: -68,
        timestamp: expect.any(String),
        anonymousVolunteerId: expect.any(String)
      }));

      // Verify no traces of original data
      const outputString = JSON.stringify(anonymizationResult.anonymizedOutput);
      expect(outputString).not.toContain('RICH:DEVICE:DATA:456');
      expect(outputString).not.toContain('Complex Device Name');
      expect(outputString).not.toContain('Personal');
      expect(outputString).not.toContain('Company Inc');
      expect(outputString).not.toContain('85%');
    });
  });

  describe('BLE Background Scanning Capabilities', () => {
    it('should maintain background scanning under battery optimization', async () => {
      // Arrange - various battery levels
      const batteryScenarios = [
        { level: 0.80, charging: true, expectedMode: 'aggressive' },
        { level: 0.50, charging: false, expectedMode: 'balanced' },
        { level: 0.20, charging: false, expectedMode: 'conservative' },
        { level: 0.10, charging: false, expectedMode: 'minimal' }
      ];

      for (const scenario of batteryScenarios) {
        // Mock battery state
        DeviceInfo.getBatteryLevel.mockResolvedValue(scenario.level);
        DeviceInfo.isCharging.mockResolvedValue(scenario.charging);

        // Act
        await bleService.optimizeScanningForBattery();

        // Assert
        const scanParams = bleService.getCurrentScanParameters();
        expect(scanParams.powerMode).toBe(scenario.expectedMode);

        if (scenario.level < 0.25 && !scenario.charging) {
          // Low battery, not charging - should be very conservative
          expect(scanParams.scanIntervalMs).toBeGreaterThan(30000); // 30+ seconds
          expect(scanParams.scanDurationMs).toBeLessThan(10000); // <10 seconds
        } else if (scenario.charging) {
          // Charging - can be more aggressive
          expect(scanParams.scanIntervalMs).toBeLessThan(15000); // <15 seconds
          expect(scanParams.scanDurationMs).toBeGreaterThan(5000); // >5 seconds
        }
      }
    });

    it('should handle BLE state changes gracefully', async () => {
      const bluetoothStates = [
        'PoweredOn',
        'PoweredOff',
        'Resetting',
        'Unauthorized',
        'Unknown',
        'Unsupported'
      ];

      for (const state of bluetoothStates) {
        // Arrange
        BleManager.checkState.mockResolvedValue(state);

        // Act
        const stateResult = await bleService.handleBluetoothStateChange(state);

        // Assert
        expect(stateResult.state).toBe(state);

        if (state === 'PoweredOn') {
          expect(stateResult.canScan).toBe(true);
          expect(stateResult.shouldResume).toBe(true);
        } else {
          expect(stateResult.canScan).toBe(false);
          expect(stateResult.userGuidanceRequired).toBe(true);
        }

        if (state === 'PoweredOff') {
          expect(stateResult.userGuidance).toContain('請開啟藍牙');
        } else if (state === 'Unauthorized') {
          expect(stateResult.userGuidance).toContain('藍牙權限');
        }
      }
    });

    it('should implement adaptive scanning based on discovery rate', async () => {
      // Arrange - simulate different environments
      const environments = [
        {
          name: 'busy_urban',
          devicesPerMinute: 15,
          averageRssi: -75,
          expectedStrategy: 'high_frequency'
        },
        {
          name: 'suburban',
          devicesPerMinute: 5,
          averageRssi: -80,
          expectedStrategy: 'balanced'
        },
        {
          name: 'rural',
          devicesPerMinute: 1,
          averageRssi: -85,
          expectedStrategy: 'low_frequency'
        },
        {
          name: 'indoor',
          devicesPerMinute: 0.2,
          averageRssi: -90,
          expectedStrategy: 'minimal'
        }
      ];

      for (const env of environments) {
        // Act
        await bleService.adaptScanningToEnvironment({
          discoveryRate: env.devicesPerMinute,
          averageSignalStrength: env.averageRssi,
          environment: env.name
        });

        // Assert
        const adaptedParams = bleService.getAdaptedScanParameters();
        expect(adaptedParams.strategy).toBe(env.expectedStrategy);

        if (env.devicesPerMinute > 10) {
          // High discovery rate - more frequent scanning
          expect(adaptedParams.scanIntervalMs).toBeLessThan(15000);
        } else if (env.devicesPerMinute < 1) {
          // Low discovery rate - less frequent scanning
          expect(adaptedParams.scanIntervalMs).toBeGreaterThan(30000);
        }
      }
    });

    it('should validate production BLE integration with backend', async () => {
      if (!mockBackendAPI.endpoint) {
        console.warn('Skipping backend integration - endpoint not configured');
        return;
      }

      // Arrange - real volunteer hits for submission
      const realVolunteerHits = [
        {
          deviceHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
          rssi: -75,
          timestamp: '2025-09-17T10:00:00.000Z',
          anonymousVolunteerId: '550e8400-e29b-41d4-a716-446655440000'
        },
        {
          deviceHash: 'b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef012a',
          rssi: -82,
          timestamp: '2025-09-17T10:00:00.000Z',
          anonymousVolunteerId: '550e8400-e29b-41d4-a716-446655440001'
        },
        {
          deviceHash: 'c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef012ab2',
          rssi: -68,
          timestamp: '2025-09-17T10:00:00.000Z',
          anonymousVolunteerId: '550e8400-e29b-41d4-a716-446655440002'
        }
      ];

      // Act
      const submissionResult = await bleService.submitVolunteerHits(realVolunteerHits);

      // Assert
      expect(submissionResult.success).toBe(true);
      expect(submissionResult.submittedCount).toBe(3);
      expect(submissionResult.serverResponse).toEqual(expect.objectContaining({
        processed: 3,
        anonymityValidated: true,
        noRejectedHits: true
      }));

      // Verify submission was properly anonymized
      expect(submissionResult.submissionPayload).not.toContain('MAC');
      expect(submissionResult.submissionPayload).not.toContain('real');
      expect(submissionResult.submissionPayload).not.toContain('location');
    });
  });

  describe('Production Error Handling and Recovery', () => {
    it('should handle permission revocation gracefully', async () => {
      // Simulate permissions being revoked at runtime
      check.mockImplementation((permission) => {
        if (permission === PERMISSIONS.ANDROID.BLUETOOTH_SCAN) {
          return Promise.resolve(RESULTS.DENIED);
        }
        return Promise.resolve(RESULTS.GRANTED);
      });

      // Act
      const revocationResult = await bleService.handlePermissionRevocation();

      // Assert
      expect(revocationResult.scanningPaused).toBe(true);
      expect(revocationResult.dataPreserved).toBe(true);
      expect(revocationResult.userNotified).toBe(true);
      expect(revocationResult.retryStrategy).toBeDefined();

      // Verify graceful degradation
      const serviceStatus = bleService.getServiceStatus();
      expect(serviceStatus.isOperational).toBe(false);
      expect(serviceStatus.canRecover).toBe(true);
      expect(serviceStatus.queuedDataCount).toBeGreaterThanOrEqual(0);
    });

    it('should recover from temporary BLE failures', async () => {
      // Simulate BLE failure and recovery
      const failureScenarios = [
        { error: 'BLE_ADAPTER_ERROR', recoverable: true },
        { error: 'SCAN_FAILED_ALREADY_STARTED', recoverable: true },
        { error: 'SCAN_FAILED_APPLICATION_REGISTRATION_FAILED', recoverable: false },
        { error: 'SCAN_FAILED_INTERNAL_ERROR', recoverable: true }
      ];

      for (const scenario of failureScenarios) {
        // Arrange
        BleManager.scan.mockRejectedValueOnce(new Error(scenario.error));

        // Act
        const recoveryResult = await bleService.handleScanFailure(scenario.error);

        // Assert
        expect(recoveryResult.error).toBe(scenario.error);
        expect(recoveryResult.recoverable).toBe(scenario.recoverable);

        if (scenario.recoverable) {
          expect(recoveryResult.retryAttempted).toBe(true);
          expect(recoveryResult.retryDelayMs).toBeGreaterThan(1000);
        } else {
          expect(recoveryResult.requiresUserIntervention).toBe(true);
        }
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await bleService?.cleanup?.();
  });
});