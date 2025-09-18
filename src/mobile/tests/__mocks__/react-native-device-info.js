/**
 * React Native Device Info mock for testing
 */

module.exports = {
  getApiLevel: jest.fn(() => Promise.resolve(33)),
  getBatteryLevel: jest.fn(() => Promise.resolve(0.8)),
  isCharging: jest.fn(() => Promise.resolve(false)),
  getDeviceId: jest.fn(() => 'test-device-id'),
  getSystemVersion: jest.fn(() => '16.0'),
  getApplicationName: jest.fn(() => 'Hsinchu Guardian'),
  getBundleId: jest.fn(() => 'tw.gov.hsinchu.guardian'),
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getManufacturer: jest.fn(() => Promise.resolve('Apple')),
  getModel: jest.fn(() => 'iPhone 14'),
  isTablet: jest.fn(() => false),
  hasSystemFeature: jest.fn(() => Promise.resolve(true)),
  getSystemAvailableFeatures: jest.fn(() => Promise.resolve([])),
  hasGms: jest.fn(() => Promise.resolve(true)),
  hasHms: jest.fn(() => Promise.resolve(false))
};