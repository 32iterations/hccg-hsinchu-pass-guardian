// React Native AsyncStorage mock
const mockAsyncStorage = {
  getItem: jest.fn().mockImplementation(async (key) => {
    if (key === 'BLE_SERVICE_STATE') {
      return JSON.stringify({
        isScanning: false,
        connectedDevices: [],
        lastScanTime: new Date().toISOString(),
        scanCount: 0
      });
    }
    if (key === 'BLEBackgroundService_PreservedState') {
      return JSON.stringify({
        isScanning: true,
        scanParameters: {
          serviceUUIDs: [],
          allowDuplicates: true,
          scanOptions: { neverForLocation: true }
        },
        discoveredDevicesCount: 2,
        queuedHitsCount: 3,
        preservationTimestamp: new Date(Date.now() - 3600000).toISOString(),
        restoreIdentifier: 'HsinchuPassVolunteerScanner'
      });
    }
    return null;
  }),
  setItem: jest.fn().mockImplementation(async (key, value) => {
    // Mock successful storage
    return Promise.resolve();
  }),
  removeItem: jest.fn().mockImplementation(async (key) => {
    return Promise.resolve();
  }),
  clear: jest.fn().mockImplementation(async () => {
    return Promise.resolve();
  }),
  getAllKeys: jest.fn().mockImplementation(async () => {
    return Promise.resolve(['BLE_SERVICE_STATE', 'BLEBackgroundService_PreservedState']);
  }),
  multiGet: jest.fn().mockImplementation(async (keys) => {
    return Promise.resolve(keys.map(key => [key, null]));
  }),
  multiSet: jest.fn().mockImplementation(async (keyValuePairs) => {
    return Promise.resolve();
  }),
  multiRemove: jest.fn().mockImplementation(async (keys) => {
    return Promise.resolve();
  })
};

module.exports = mockAsyncStorage;
module.exports.default = mockAsyncStorage;