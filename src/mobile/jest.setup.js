// Enhanced Mobile-specific Jest setup for React Native tests
require('@testing-library/jest-dom');

// Set test environment
process.env.NODE_ENV = 'test';

// Global DeviceInfo for battery optimization tests
global.DeviceInfo = {
  getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
  isCharging: jest.fn(() => Promise.resolve(false)),
  getApiLevel: jest.fn(() => Promise.resolve(33))
};

// React Native Core Modules Mock
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '16.0',
    select: jest.fn((platforms) => platforms.ios || platforms.default)
  },
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    canOpenURL: jest.fn().mockResolvedValue(true)
  },
  AppState: {
    addEventListener: jest.fn((event, callback) => ({
      remove: jest.fn()
    })),
    currentState: 'active'
  },
  Alert: {
    alert: jest.fn()
  },
  AsyncStorage: {
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn((key) => {
      if (key === 'BLEBackgroundService_PreservedState') {
        // Return the state that would be saved by saveStateForPreservation
        return Promise.resolve(JSON.stringify({
          isScanning: true,
          scanParameters: { serviceUUIDs: [], allowDuplicates: true },
          discoveredDevicesCount: 1,
          queuedHitsCount: 0,
          preservationTimestamp: new Date().toISOString(),
          preservationVersion: '2.0.0'
        }));
      }
      return Promise.resolve(null);
    }),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve())
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
    },
    RNCryptor: {
      encrypt: jest.fn((data, password) => Promise.resolve(data + '_encrypted')),
      decrypt: jest.fn((data, password) => Promise.resolve(data.replace('_encrypted', '')))
    },
    RNFetchBlob: {
      fs: {
        dirs: {
          DocumentDir: '/mock/document/path',
          CacheDir: '/mock/cache/path'
        }
      }
    }
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT'
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again'
    },
    request: jest.fn(() => Promise.resolve('granted')),
    requestMultiple: jest.fn(() => Promise.resolve({
      'android.permission.BLUETOOTH_SCAN': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'granted'
    })),
    check: jest.fn(() => Promise.resolve('granted'))
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn()
  },
  StatusBar: {
    setBarStyle: jest.fn(),
    setBackgroundColor: jest.fn()
  }
}));

// React Native Keychain mock - Conditional mock only if package exists
try {
  require.resolve('react-native-keychain');
  jest.mock('react-native-keychain', () => ({
    setInternetCredentials: jest.fn().mockResolvedValue(true),
    getInternetCredentials: jest.fn().mockResolvedValue({
      username: 'hsinchu_guardian',
      password: 'access_token_123'
    }),
    resetInternetCredentials: jest.fn().mockResolvedValue(true),
    SECURITY_LEVEL: {
      SECURE_HARDWARE: 'SECURE_HARDWARE',
      SECURE_SOFTWARE: 'SECURE_SOFTWARE',
      ANY: 'ANY'
    },
    ACCESSIBLE: {
      WHEN_UNLOCKED: 'WHEN_UNLOCKED',
      AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
      ALWAYS: 'ALWAYS',
      WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: 'WHEN_PASSCODE_SET_THIS_DEVICE_ONLY'
    }
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native BLE Manager mock - Conditional mock only if package exists
try {
  require.resolve('react-native-ble-manager');
  jest.mock('react-native-ble-manager', () => ({
    scan: jest.fn(() => Promise.resolve()),
    stopScan: jest.fn(() => Promise.resolve()),
    checkState: jest.fn(() => Promise.resolve('PoweredOn')),
    enableBluetooth: jest.fn(() => Promise.resolve()),
    getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    getConnectedPeripherals: jest.fn(() => Promise.resolve([])),
    getDiscoveredPeripherals: jest.fn(() => Promise.resolve([])),
    startNotification: jest.fn(() => Promise.resolve()),
    stopNotification: jest.fn(() => Promise.resolve()),
    read: jest.fn(() => Promise.resolve([])),
    write: jest.fn(() => Promise.resolve()),
    retrieveServices: jest.fn(() => Promise.resolve({}))
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Permissions mock - Conditional mock only if package exists
try {
  require.resolve('react-native-permissions');
  jest.mock('react-native-permissions', () => ({
    PERMISSIONS: {
      ANDROID: {
        BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
        BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
        ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
        ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
        ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION'
      },
      IOS: {
        BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL',
        LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS',
        LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE'
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
    })),
    openSettings: jest.fn(() => Promise.resolve())
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Device Info mock - Conditional mock only if package exists
try {
  require.resolve('react-native-device-info');
  jest.mock('react-native-device-info', () => ({
    getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
    isCharging: jest.fn(() => Promise.resolve(false)),
    getApiLevel: jest.fn(() => Promise.resolve(33)),
    getSystemVersion: jest.fn(() => '16.0'),
    getBrand: jest.fn(() => 'Apple'),
    getModel: jest.fn(() => 'iPhone'),
    getDeviceId: jest.fn(() => 'test-device-id'),
    getUniqueId: jest.fn(() => Promise.resolve('unique-device-id')),
    hasNotch: jest.fn(() => false),
    hasDynamicIsland: jest.fn(() => false),
    isTablet: jest.fn(() => false),
    getManufacturer: jest.fn(() => Promise.resolve('Apple')),
    getFreeDiskStorage: jest.fn(() => Promise.resolve(1000000000)),
    getTotalMemory: jest.fn(() => Promise.resolve(4000000000)),
    getUsedMemory: jest.fn(() => Promise.resolve(2000000000))
  }));
} catch (e) {
  // Package not installed, skip mock
}

// AsyncStorage mock - Conditional mock only if package exists
try {
  require.resolve('@react-native-async-storage/async-storage');
  jest.mock('@react-native-async-storage/async-storage', () => ({
    default: {
      setItem: jest.fn(() => Promise.resolve()),
      getItem: jest.fn((key) => {
        if (key === 'BLEBackgroundService_PreservedState') {
          return Promise.resolve(JSON.stringify({
            isScanning: true,
            scanParameters: { serviceUUIDs: [], allowDuplicates: true },
            discoveredDevicesCount: 1,
            queuedHitsCount: 0,
            preservationTimestamp: new Date().toISOString(),
            preservationVersion: '2.0.0'
          }));
        }
        return Promise.resolve(null);
      }),
      removeItem: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
      getAllKeys: jest.fn(() => Promise.resolve([])),
      multiGet: jest.fn(() => Promise.resolve([])),
      multiSet: jest.fn(() => Promise.resolve()),
      multiRemove: jest.fn(() => Promise.resolve())
    },
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn((key) => {
      if (key === 'BLEBackgroundService_PreservedState') {
        return Promise.resolve(JSON.stringify({
          isScanning: true,
          scanParameters: { serviceUUIDs: [], allowDuplicates: true },
          discoveredDevicesCount: 1,
          queuedHitsCount: 0,
          preservationTimestamp: new Date().toISOString(),
          preservationVersion: '2.0.0'
        }));
      }
      return Promise.resolve(null);
    }),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve())
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Geolocation mock - Conditional mock only if package exists
try {
  require.resolve('@react-native-community/geolocation');
  jest.mock('@react-native-community/geolocation', () => ({
    getCurrentPosition: jest.fn().mockImplementation((success, error, options) => {
      const mockPosition = {
        coords: {
          latitude: 24.8067834,
          longitude: 120.9687456,
          accuracy: 8,
          altitude: 100,
          altitudeAccuracy: 10,
          heading: 0,
          speed: 0
        },
        timestamp: Date.now()
      };
      if (success) setTimeout(() => success(mockPosition), 100);
    }),
    watchPosition: jest.fn().mockReturnValue(1),
    clearWatch: jest.fn(),
    requestAuthorization: jest.fn(() => Promise.resolve('granted')),
    setRNConfiguration: jest.fn()
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Push Notification mock - Conditional mock only if package exists
try {
  require.resolve('react-native-push-notification');
  jest.mock('react-native-push-notification', () => ({
    localNotification: jest.fn(),
    createChannel: jest.fn(),
    configure: jest.fn(),
    requestPermissions: jest.fn().mockResolvedValue({
      alert: true,
      badge: true,
      sound: true
    }),
    checkPermissions: jest.fn().mockResolvedValue({
      alert: true,
      badge: true,
      sound: true
    }),
    cancelAllLocalNotifications: jest.fn(),
    cancelLocalNotifications: jest.fn(),
    getScheduledLocalNotifications: jest.fn().mockResolvedValue([]),
    getDeliveredNotifications: jest.fn().mockResolvedValue([]),
    removeAllDeliveredNotifications: jest.fn(),
    removeDeliveredNotifications: jest.fn(),
    setApplicationIconBadgeNumber: jest.fn(),
    getApplicationIconBadgeNumber: jest.fn().mockResolvedValue(0)
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Biometrics mock - Conditional mock only if package exists
try {
  require.resolve('react-native-biometrics');
  jest.mock('react-native-biometrics', () => ({
    createKeys: jest.fn(() => Promise.resolve({ publicKey: 'mock-public-key' })),
    biometricKeysExist: jest.fn(() => Promise.resolve({ keysExist: false })),
    deleteKeys: jest.fn(() => Promise.resolve({ keysDeleted: true })),
    createSignature: jest.fn(() => Promise.resolve({ success: true, signature: 'mock-signature' })),
    simplePrompt: jest.fn(() => Promise.resolve({ success: true })),
    isSensorAvailable: jest.fn(() => Promise.resolve({
      available: true,
      biometryType: 'TouchID'
    }))
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native MMKV mock - Conditional mock only if package exists
try {
  require.resolve('react-native-mmkv');
  jest.mock('react-native-mmkv', () => ({
    MMKV: jest.fn().mockImplementation(() => ({
      set: jest.fn(),
      getString: jest.fn(() => null),
      getNumber: jest.fn(() => null),
      getBoolean: jest.fn(() => null),
      contains: jest.fn(() => false),
      delete: jest.fn(),
      clearAll: jest.fn(),
      getAllKeys: jest.fn(() => [])
    }))
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Crypto mock - Conditional mock only if package exists
try {
  require.resolve('react-native-crypto');
  jest.mock('react-native-crypto', () => ({
    randomBytes: jest.fn((size) => Buffer.alloc(size, 'a')),
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'mocked-hash')
    })),
    createCipher: jest.fn(() => ({
      update: jest.fn(),
      final: jest.fn()
    })),
    createDecipher: jest.fn(() => ({
      update: jest.fn(),
      final: jest.fn()
    }))
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native NetInfo mock - Conditional mock only if package exists
try {
  require.resolve('@react-native-community/netinfo');
  jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn(() => Promise.resolve({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true
    })),
    addEventListener: jest.fn(() => jest.fn()),
    useNetInfo: jest.fn(() => ({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true
    }))
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Vector Icons mock - Conditional mock only if package exists
try {
  require.resolve('react-native-vector-icons');
  jest.mock('react-native-vector-icons/MaterialIcons', () => 'MockedIcon');
  jest.mock('react-native-vector-icons/Ionicons', () => 'MockedIcon');
  jest.mock('react-native-vector-icons/FontAwesome', () => 'MockedIcon');
} catch (e) {
  // Package not installed, skip mock
}

// React Native Linear Gradient mock - Conditional mock only if package exists
try {
  require.resolve('react-native-linear-gradient');
  jest.mock('react-native-linear-gradient', () => 'LinearGradient');
} catch (e) {
  // Package not installed, skip mock
}

// React Native Safe Area Context mock - Conditional mock only if package exists
try {
  require.resolve('react-native-safe-area-context');
  jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 })
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Navigation mock - Conditional mock only if package exists
try {
  require.resolve('@react-navigation/native');
  jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      reset: jest.fn(),
      setOptions: jest.fn()
    }),
    useRoute: () => ({
      params: {},
      key: 'test',
      name: 'Test'
    }),
    useFocusEffect: jest.fn(),
    useIsFocused: () => true,
    NavigationContainer: ({ children }) => children,
    createNavigationContainerRef: () => ({
      current: {
        navigate: jest.fn(),
        reset: jest.fn()
      }
    })
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Flipper mock - Conditional mock only if package exists
try {
  require.resolve('react-native-flipper');
  jest.mock('react-native-flipper', () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Background Job mock - Conditional mock only if package exists
try {
  require.resolve('react-native-background-job');
  jest.mock('react-native-background-job', () => ({
    register: jest.fn(),
    unregister: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn(() => false)
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Background Task mock - Conditional mock only if package exists
try {
  require.resolve('react-native-background-task');
  jest.mock('react-native-background-task', () => ({
    define: jest.fn(),
    start: jest.fn(),
    stop: jest.fn()
  }));
} catch (e) {
  // Package not installed, skip mock
}

// React Native Haptic Feedback mock - Conditional mock only if package exists
try {
  require.resolve('react-native-haptic-feedback');
  jest.mock('react-native-haptic-feedback', () => ({
    trigger: jest.fn(),
    HapticFeedbackTypes: {
      selection: 'selection',
      impactLight: 'impactLight',
      impactMedium: 'impactMedium',
      impactHeavy: 'impactHeavy',
      notificationSuccess: 'notificationSuccess',
      notificationWarning: 'notificationWarning',
      notificationError: 'notificationError'
    }
  }));
} catch (e) {
  // Package not installed, skip mock
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock crypto for Node.js compatibility
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }
};

// Mock URL for older Node.js versions
if (typeof URL === 'undefined') {
  global.URL = require('url').URL;
}

// Enhanced fetch mock for React Native with offline scenario support
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      // Default API responses for MyData OAuth
      access_token: 'access_token_12345',
      token_type: 'Bearer',
      expires_in: 3600,
      // Default user profile
      name: '王小明',
      emergency_contacts: [{
        name: '王太太',
        phone: '0912345678',
        relationship: 'spouse'
      }],
      success: true
    }),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Map(),
    clone: () => ({})
  })
);

// Ensure fetch mock has all required Jest methods
Object.defineProperty(global.fetch, 'mockResolvedValue', {
  value: jest.fn().mockImplementation((value) => {
    global.fetch.mockImplementation(() => Promise.resolve(value));
    return global.fetch;
  }),
  writable: true
});

Object.defineProperty(global.fetch, 'mockRejectedValue', {
  value: jest.fn().mockImplementation((error) => {
    global.fetch.mockImplementation(() => Promise.reject(error));
    return global.fetch;
  }),
  writable: true
});

Object.defineProperty(global.fetch, 'mockImplementation', {
  value: jest.fn().mockImplementation((fn) => {
    global.fetch = jest.fn(fn);
    // Re-add the mock methods after mockImplementation
    Object.defineProperty(global.fetch, 'mockResolvedValue', {
      value: jest.fn().mockImplementation((value) => {
        global.fetch.mockImplementation(() => Promise.resolve(value));
        return global.fetch;
      }),
      writable: true
    });
    Object.defineProperty(global.fetch, 'mockRejectedValue', {
      value: jest.fn().mockImplementation((error) => {
        global.fetch.mockImplementation(() => Promise.reject(error));
        return global.fetch;
      }),
      writable: true
    });
    return global.fetch;
  }),
  writable: true
});

// Mock Blob for React Native
global.Blob = class MockBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((size, part) => size + (part.length || 0), 0);
  }
};

// Mock FormData for React Native
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

// Enhanced Timer mocks for React Native
jest.useFakeTimers();

// Battery optimization testing helpers
global.setBatteryLevel = (level) => {
  global.DeviceInfo.getBatteryLevel.mockResolvedValue(level);
};

global.setChargingStatus = (charging) => {
  global.DeviceInfo.isCharging.mockResolvedValue(charging);
};

// Platform testing helpers
global.setPlatform = (platform) => {
  require('react-native').Platform.OS = platform;
};

// Permission testing helpers
global.setPermissionResult = (permission, result) => {
  const { check } = require('react-native-permissions');
  check.mockImplementation((p) =>
    p === permission ? Promise.resolve(result) : Promise.resolve('granted')
  );
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  // Reset global mocks to defaults
  global.DeviceInfo.getBatteryLevel.mockResolvedValue(0.8);
  global.DeviceInfo.isCharging.mockResolvedValue(false);
  require('react-native').Platform.OS = 'ios';
});