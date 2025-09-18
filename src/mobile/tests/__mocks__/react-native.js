// Comprehensive React Native mock for mobile tests
const mockAsyncStorage = {
  getItem: jest.fn().mockImplementation(async (key) => {
    if (key === 'BLEBackgroundService_PreservedState') {
      return JSON.stringify({
        isScanning: true,
        scanParameters: {
          serviceUUIDs: [],
          allowDuplicates: true,
          neverForLocation: true
        },
        discoveredDevicesCount: 2,
        queuedHitsCount: 3,
        preservationTimestamp: new Date(Date.now() - 3600000).toISOString(),
        restoreIdentifier: 'HsinchuPassVolunteerScanner'
      });
    }
    return null;
  }),
  setItem: jest.fn().mockResolvedValue(),
  removeItem: jest.fn().mockResolvedValue(),
  clear: jest.fn().mockResolvedValue(),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(),
  multiRemove: jest.fn().mockResolvedValue()
};

module.exports = {
  Platform: {
    OS: 'ios',
    Version: '16.0',
    select: jest.fn((platforms) => platforms.ios || platforms.default)
  },

  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getInitialURL: jest.fn().mockResolvedValue(null),
    canOpenURL: jest.fn().mockResolvedValue(true)
  },

  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((event, callback) => ({
      remove: jest.fn()
    })),
    removeEventListener: jest.fn()
  },

  Alert: {
    alert: jest.fn()
  },

  AsyncStorage: mockAsyncStorage,

  NativeModules: {
    BLEManager: {
      start: jest.fn().mockResolvedValue(true),
      scan: jest.fn().mockResolvedValue(true),
      stopScan: jest.fn().mockResolvedValue(true),
      checkState: jest.fn().mockResolvedValue('PoweredOn'),
      initializeWithRestore: jest.fn().mockResolvedValue(true),
      startBackgroundScan: jest.fn().mockResolvedValue(true),
      setDeviceDiscoveryCallback: jest.fn(),
      saveState: jest.fn().mockResolvedValue(true),
      getBackgroundAppRefreshStatus: jest.fn().mockResolvedValue('available'),
      getBatteryLevel: jest.fn().mockResolvedValue(0.8),
      setupBackgroundTask: jest.fn(),
      setupJobScheduler: jest.fn().mockResolvedValue(true)
    }
  },

  DeviceEventEmitter: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    emit: jest.fn()
  },

  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(),
    removeListener: jest.fn(),
    removeAllListeners: jest.fn()
  })),

  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT'
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again'
    },
    request: jest.fn().mockResolvedValue('granted'),
    requestMultiple: jest.fn().mockResolvedValue({
      'android.permission.BLUETOOTH_SCAN': 'granted',
      'android.permission.BLUETOOTH_CONNECT': 'granted'
    }),
    check: jest.fn().mockResolvedValue('granted')
  },

  // Mock Geolocation module
  Geolocation: {
    getCurrentPosition: jest.fn((success, error, options) => {
      success({
        coords: {
          latitude: 24.8067,
          longitude: 120.9687,
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      });
    }),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    stopObserving: jest.fn()
  },

  // Mock Permissions module
  Permissions: {
    PERMISSIONS: {
      IOS: {
        LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS',
        LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE'
      },
      ANDROID: {
        ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
        ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION'
      }
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      UNAVAILABLE: 'unavailable',
      BLOCKED: 'blocked'
    },
    check: jest.fn().mockResolvedValue('granted'),
    request: jest.fn().mockResolvedValue('granted')
  },

  // Mock PushNotification
  PushNotification: {
    configure: jest.fn(),
    localNotification: jest.fn(),
    localNotificationSchedule: jest.fn(),
    cancelLocalNotifications: jest.fn(),
    cancelAllLocalNotifications: jest.fn(),
    getDeliveredNotifications: jest.fn(callback => callback([])),
    removeAllDeliveredNotifications: jest.fn(),
    setApplicationIconBadgeNumber: jest.fn(),
    getApplicationIconBadgeNumber: jest.fn(callback => callback(0))
  },

  // Mock Keychain
  Keychain: {
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(true),
    reset: jest.fn().mockResolvedValue(true)
  }
};