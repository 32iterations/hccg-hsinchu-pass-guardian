// Jest setup file for both frontend and backend tests
require('@testing-library/jest-dom');

// Polyfill for TextEncoder/TextDecoder (Node.js 18+ compatibility)
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

// React Native mocks for BLE validation tests
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 33,
    select: jest.fn(platforms => platforms.android || platforms.default)
  },
  AppState: {
    addEventListener: jest.fn((event, callback) => ({
      remove: jest.fn()
    })),
    currentState: 'active'
  },
  NativeModules: {
    BLEManager: {
      initializeWithRestore: jest.fn(() => Promise.resolve()),
      startBackgroundScan: jest.fn(() => Promise.resolve()),
      stopScan: jest.fn(() => Promise.resolve()),
      setDeviceDiscoveryCallback: jest.fn(),
      checkState: jest.fn(() => Promise.resolve('PoweredOn')),
      scan: jest.fn(() => Promise.resolve()),
      getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
      getBackgroundAppRefreshStatus: jest.fn(() => Promise.resolve('available')),
      saveState: jest.fn(() => Promise.resolve()),
      setupBackgroundTask: jest.fn(),
      setupJobScheduler: jest.fn(() => Promise.resolve())
    }
  },
  AsyncStorage: {
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve())
  }
}));

// React Native BLE Manager mock
jest.mock('react-native-ble-manager', () => ({
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  checkState: jest.fn(() => Promise.resolve('PoweredOn')),
  enableBluetooth: jest.fn(() => Promise.resolve()),
  getBatteryLevel: jest.fn(() => Promise.resolve(0.8))
}));

// React Native Permissions mock
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION'
    },
    IOS: {
      BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL'
    }
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    LIMITED: 'limited',
    UNAVAILABLE: 'unavailable'
  },
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  requestMultiple: jest.fn(() => Promise.resolve({
    'android.permission.BLUETOOTH_SCAN': 'granted',
    'android.permission.BLUETOOTH_CONNECT': 'granted'
  }))
}));

// React Native Device Info mock
jest.mock('react-native-device-info', () => ({
  getApiLevel: jest.fn(() => Promise.resolve(33)),
  getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
  isCharging: jest.fn(() => Promise.resolve(false)),
  getDeviceId: jest.fn(() => 'test-device-id'),
  getSystemVersion: jest.fn(() => '16.0')
}));

// AsyncStorage mock (only if module exists)
try {
  require.resolve('@react-native-async-storage/async-storage');
  jest.mock('@react-native-async-storage/async-storage', () => ({
    default: {
      setItem: jest.fn(() => Promise.resolve()),
      getItem: jest.fn(() => Promise.resolve(null)),
      removeItem: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    },
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve())
  }));
} catch (e) {
  // AsyncStorage not available, skip mock
}

// Global DeviceInfo for battery optimization tests
global.DeviceInfo = {
  getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
  isCharging: jest.fn(() => Promise.resolve(false)),
  getApiLevel: jest.fn(() => Promise.resolve(33))
};

// Make DeviceInfo available to require() calls as well
const DeviceInfo = global.DeviceInfo;

// Setup jsdom environment for React tests
if (typeof window !== 'undefined') {
  // Mock window.history for navigation tests
  Object.defineProperty(window, 'history', {
    value: {
      pushState: jest.fn(),
      replaceState: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      go: jest.fn()
    },
    writable: true
  });

  // Mock matchMedia for responsive tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock CustomEvent
  global.CustomEvent = jest.fn().mockImplementation((event, options) => {
    return {
      type: event,
      detail: options?.detail || {}
    };
  });
}

// Global mock for React testing
global.React = require('react');

// Global BleManager for direct access in tests
global.BleManager = {
  scan: jest.fn(() => Promise.resolve()),
  stopScan: jest.fn(() => Promise.resolve()),
  checkState: jest.fn(() => Promise.resolve('PoweredOn')),
  enableBluetooth: jest.fn(() => Promise.resolve())
};

// Mock global crypto for device hashing
global.crypto = {
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn((format) => 'a'.repeat(64))
  }))
};

// Enhanced fetch mock with proper Jest mock function support
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Map(),
    clone: () => ({})
  })
);

// Ensure fetch has proper Jest mock methods
global.fetch.mockResolvedValue = global.fetch.mockResolvedValue || jest.fn();
global.fetch.mockRejectedValue = global.fetch.mockRejectedValue || jest.fn();
global.fetch.mockImplementation = global.fetch.mockImplementation || jest.fn();
global.fetch.mockReturnValue = global.fetch.mockReturnValue || jest.fn();

// Mock Blob for React Native compatibility
global.Blob = class MockBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((size, part) => size + (part.length || 0), 0);
  }
};

// Mock FormData for React Native compatibility
global.FormData = class MockFormData {
  constructor() {
    this.data = new Map();
  }

  append(key, value) {
    this.data.set(key, value);
  }

  get(key) {
    return this.data.get(key);
  }

  has(key) {
    return this.data.has(key);
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn()
};

// Setup global mock location for tests
global.mockLocation = {
  pathname: '/',
  search: '',
  href: 'http://localhost:3000'
};

