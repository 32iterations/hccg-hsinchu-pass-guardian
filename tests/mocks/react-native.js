// Mock React Native modules for testing

const Platform = {
  OS: 'ios',
  select: (options) => options.ios || options.default,
  Version: 14
};

const NativeModules = {
  BLEManager: {
    startScan: jest.fn(),
    stopScan: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  }
};

const BackgroundFetch = {
  configure: jest.fn(),
  scheduleTask: jest.fn(),
  finish: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  status: jest.fn()
};

const Geolocation = {
  getCurrentPosition: jest.fn((success, error) => {
    success({
      coords: {
        latitude: 24.8138,
        longitude: 120.9675,
        accuracy: 10
      }
    });
  }),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn()
};

const PushNotification = {
  configure: jest.fn(),
  localNotification: jest.fn(),
  createChannel: jest.fn(),
  checkPermissions: jest.fn((callback) => {
    callback({ alert: true, badge: true, sound: true });
  }),
  requestPermissions: jest.fn(() => Promise.resolve({ alert: true, badge: true, sound: true }))
};

const PushNotificationIOS = {
  addNotificationRequest: jest.fn(),
  requestPermissions: jest.fn(() => Promise.resolve({ alert: true, badge: true, sound: true })),
  checkPermissions: jest.fn((callback) => {
    callback({ alert: true, badge: true, sound: true });
  })
};

const AsyncStorage = {
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([]))
};

module.exports = {
  Platform,
  NativeModules,
  BackgroundFetch,
  Geolocation,
  PushNotification,
  PushNotificationIOS,
  AsyncStorage
};