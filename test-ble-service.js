// Simple test verification for BLE Background Service
const path = require('path');

// Mock React Native module
const mockReactNative = {
  NativeModules: {
    BLEManager: {}
  },
  Platform: { OS: 'ios' },
  AppState: {
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  AsyncStorage: {
    setItem: () => Promise.resolve(),
    getItem: () => Promise.resolve(null)
  }
};

// Mock require for react-native
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'react-native') {
    return mockReactNative;
  }
  if (id === '@react-native-async-storage/async-storage') {
    return {
      default: mockReactNative.AsyncStorage,
      ...mockReactNative.AsyncStorage
    };
  }
  return originalRequire.apply(this, arguments);
};

// Mock global objects
global.Platform = mockReactNative.Platform;
global.AsyncStorage = mockReactNative.AsyncStorage;

// Mock DeviceInfo for battery tests
global.DeviceInfo = {
  getBatteryLevel: () => Promise.resolve(0.8),
  isCharging: () => Promise.resolve(false)
};

// Load the BLE service
const { BLEBackgroundService } = require('./src/mobile/src/services/BLEBackgroundService.js');

async function runTests() {
  console.log('🧪 Testing BLE Background Service Implementation...\n');

  const bleService = new BLEBackgroundService();
  let passed = 0;
  let failed = 0;

  // Test 1: State preservation without PII
  try {
    const testState = {
      discoveredDevices: [
        { id: 'AA:BB:CC:DD:EE:F1', rssi: -75 },
        { id: 'BB:CC:DD:EE:FF:A2', rssi: -82 },
        { id: 'CC:DD:EE:FF:AA:B3', rssi: -65 }
      ],
      volunteerHitQueue: [
        { deviceHash: 'hash1', rssi: -75 },
        { deviceHash: 'hash2', rssi: -82 }
      ]
    };

    const result = await bleService.saveStateForPreservation(testState);

    const hasExpectedFields = result.preservedState.hasOwnProperty('isScanning') &&
                             result.preservedState.hasOwnProperty('scanParameters') &&
                             result.preservedState.hasOwnProperty('discoveredDevicesCount') &&
                             result.preservedState.hasOwnProperty('queuedHitsCount') &&
                             result.preservedState.hasOwnProperty('preservationTimestamp') &&
                             result.preservedState.hasOwnProperty('preservationVersion');

    const hasNoPII = result.preservedState.deviceDetails === undefined &&
                     result.preservedState.rawDeviceData === undefined &&
                     result.preservedState.personalInformation === undefined;

    if (hasExpectedFields && hasNoPII && result.success) {
      console.log('✅ State preservation test: PASSED');
      passed++;
    } else {
      console.log('❌ State preservation test: FAILED');
      console.log('   Expected fields:', hasExpectedFields);
      console.log('   PII protected:', hasNoPII);
      failed++;
    }
  } catch (error) {
    console.log('❌ State preservation test: ERROR -', error.message);
    failed++;
  }

  // Test 2: Device anonymization
  try {
    const deviceWithPII = {
      id: 'AA:BB:CC:DD:EE:FF',
      rssi: -70,
      name: 'Johns iPhone',
      localName: 'Personal Device'
    };

    const anonymizedHit = await bleService.processDiscoveredDevice(deviceWithPII, {
      strictAnonymization: true
    });

    const allowedFields = ['deviceHash', 'rssi', 'timestamp', 'anonymousVolunteerId'];
    const actualFields = Object.keys(anonymizedHit);
    const hasOnlyAllowedFields = actualFields.length === allowedFields.length &&
                                actualFields.every(field => allowedFields.includes(field));

    const hasValidHash = /^[a-f0-9]{64}$/.test(anonymizedHit.deviceHash);
    const hasNoOriginalData = !JSON.stringify(anonymizedHit).includes('AA:BB:CC:DD:EE:FF') &&
                             !JSON.stringify(anonymizedHit).includes('Johns');

    if (hasOnlyAllowedFields && hasValidHash && hasNoOriginalData) {
      console.log('✅ Device anonymization test: PASSED');
      passed++;
    } else {
      console.log('❌ Device anonymization test: FAILED');
      console.log('   Only allowed fields:', hasOnlyAllowedFields);
      console.log('   Valid hash:', hasValidHash);
      console.log('   No original data:', hasNoOriginalData);
      console.log('   Actual fields:', actualFields);
      failed++;
    }
  } catch (error) {
    console.log('❌ Device anonymization test: ERROR -', error.message);
    failed++;
  }

  // Test 3: Battery optimization
  try {
    // Set battery scenario for low battery
    global.DeviceInfo.getBatteryLevel = () => Promise.resolve(0.2);
    global.DeviceInfo.isCharging = () => Promise.resolve(false);

    const result = await bleService.optimizeScanningForBattery();
    const params = bleService.getCurrentScanParameters();

    const hasValidParameters = params.scanIntervalMs > 30000 && // Conservative mode
                              params.scanDurationMs < 10000 &&
                              params.powerMode === 'conservative';

    if (hasValidParameters && result.success) {
      console.log('✅ Battery optimization test: PASSED');
      passed++;
    } else {
      console.log('❌ Battery optimization test: FAILED');
      console.log('   Result:', result);
      console.log('   Params:', params);
      failed++;
    }
  } catch (error) {
    console.log('❌ Battery optimization test: ERROR -', error.message);
    failed++;
  }

  // Test 4: K-anonymity validation
  try {
    const volunteerHits = [
      { deviceHash: 'hash1', rssi: -75, timestamp: '2025-09-18T10:00:00.000Z' },
      { deviceHash: 'hash2', rssi: -82, timestamp: '2025-09-18T10:00:00.000Z' },
      { deviceHash: 'hash3', rssi: -68, timestamp: '2025-09-18T10:00:00.000Z' }
    ];

    const kResult = await bleService.validateKAnonymity(volunteerHits, 3);

    if (kResult.isAnonymous && kResult.k >= 3 && kResult.canSubmit) {
      console.log('✅ K-anonymity validation test: PASSED');
      passed++;
    } else {
      console.log('❌ K-anonymity validation test: FAILED');
      console.log('   Result:', kResult);
      failed++;
    }
  } catch (error) {
    console.log('❌ K-anonymity validation test: ERROR -', error.message);
    failed++;
  }

  // Test 5: Bluetooth state handling
  try {
    const stateResults = {};
    const states = ['PoweredOn', 'PoweredOff', 'Unauthorized'];

    for (const state of states) {
      stateResults[state] = await bleService.handleBluetoothStateChange(state);
    }

    const validResults = stateResults.PoweredOn.canScan === true &&
                        stateResults.PoweredOn.userGuidanceRequired === false &&
                        stateResults.PoweredOff.canScan === false &&
                        stateResults.PoweredOff.userGuidanceRequired === true &&
                        stateResults.Unauthorized.canScan === false &&
                        stateResults.Unauthorized.userGuidanceRequired === true;

    if (validResults) {
      console.log('✅ Bluetooth state handling test: PASSED');
      passed++;
    } else {
      console.log('❌ Bluetooth state handling test: FAILED');
      console.log('   Results:', stateResults);
      failed++;
    }
  } catch (error) {
    console.log('❌ Bluetooth state handling test: ERROR -', error.message);
    failed++;
  }

  console.log('\n📊 Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%\n`);

  if (failed === 0) {
    console.log('🎉 All core BLE functionality tests passed! The P2 validation should work.');
  } else {
    console.log('⚠️  Some tests failed. Issues need to be addressed.');
  }

  return { passed, failed };
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});