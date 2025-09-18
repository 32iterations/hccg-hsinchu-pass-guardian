// Mock react-native-permissions

const PERMISSIONS = {
  IOS: {
    LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS',
    LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
    BLUETOOTH: 'ios.permission.BLUETOOTH',
    NOTIFICATIONS: 'ios.permission.NOTIFICATIONS'
  },
  ANDROID: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
    POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS'
  }
};

const RESULTS = {
  UNAVAILABLE: 'unavailable',
  DENIED: 'denied',
  LIMITED: 'limited',
  GRANTED: 'granted',
  BLOCKED: 'blocked'
};

const check = jest.fn(() => Promise.resolve(RESULTS.GRANTED));
const request = jest.fn(() => Promise.resolve(RESULTS.GRANTED));
const checkMultiple = jest.fn(() => Promise.resolve({
  [PERMISSIONS.IOS.LOCATION_ALWAYS]: RESULTS.GRANTED,
  [PERMISSIONS.IOS.BLUETOOTH]: RESULTS.GRANTED
}));
const requestMultiple = jest.fn(() => Promise.resolve({
  [PERMISSIONS.IOS.LOCATION_ALWAYS]: RESULTS.GRANTED,
  [PERMISSIONS.IOS.BLUETOOTH]: RESULTS.GRANTED
}));

module.exports = {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  checkMultiple,
  requestMultiple
};