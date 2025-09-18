/**
 * React Native Permissions mock for testing
 */

const PERMISSIONS = {
  ANDROID: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
    POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT'
  },
  IOS: {
    LOCATION_ALWAYS: 'ios.permission.LOCATION_ALWAYS',
    LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
    BLUETOOTH_PERIPHERAL: 'ios.permission.BLUETOOTH_PERIPHERAL'
  }
};

const RESULTS = {
  UNAVAILABLE: 'unavailable',
  DENIED: 'denied',
  LIMITED: 'limited',
  GRANTED: 'granted',
  BLOCKED: 'blocked'
};

const check = jest.fn().mockResolvedValue(RESULTS.GRANTED);
const request = jest.fn().mockResolvedValue(RESULTS.GRANTED);
const requestMultiple = jest.fn().mockResolvedValue({
  [PERMISSIONS.ANDROID.BLUETOOTH_SCAN]: RESULTS.GRANTED,
  [PERMISSIONS.ANDROID.BLUETOOTH_CONNECT]: RESULTS.GRANTED,
  [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION]: RESULTS.GRANTED,
  [PERMISSIONS.ANDROID.POST_NOTIFICATIONS]: RESULTS.GRANTED
});

module.exports = {
  PERMISSIONS,
  RESULTS,
  check,
  request,
  requestMultiple,
  openSettings: jest.fn().mockResolvedValue(true),
  checkLocationAccuracy: jest.fn().mockResolvedValue('full'),
  requestLocationAccuracy: jest.fn().mockResolvedValue('full')
};
