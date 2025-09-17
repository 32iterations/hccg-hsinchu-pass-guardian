// Jest setup for React Native testing
import 'react-native-gesture-handler/jestSetup';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  // The mock for `call` immediately calls the callback which is incorrect
  // So we override it with a no-op
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock BLE Manager
jest.mock('react-native-ble-manager', () => ({
  start: jest.fn(() => Promise.resolve()),
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  getDiscoveredPeripherals: jest.fn(() => Promise.resolve([])),
  connect: jest.fn(() => Promise.resolve()),
  disconnect: jest.fn(() => Promise.resolve()),
  checkState: jest.fn(() => Promise.resolve('PoweredOn')),
}));

// Mock Geolocation
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn(),
}));

// Mock Permissions
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
    },
    IOS: {
      LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS',
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
      BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
  },
  check: jest.fn(),
  request: jest.fn(),
  requestMultiple: jest.fn(),
}));

// Mock Push Notifications
jest.mock('react-native-push-notification', () => ({
  configure: jest.fn(),
  localNotification: jest.fn(),
  createChannel: jest.fn(),
  channelExists: jest.fn(),
  getChannels: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
}));

// Mock Keychain
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
}));

// Mock Device Info
jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(() => Promise.resolve('mock-device-id')),
  getSystemName: jest.fn(() => Promise.resolve('iOS')),
  getSystemVersion: jest.fn(() => Promise.resolve('15.0')),
  getBatteryLevel: jest.fn(() => Promise.resolve(0.75)),
  isCharging: jest.fn(() => Promise.resolve(false)),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(),
}));

// Silence the warning: Animated: `useNativeDriver` is not supported
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');