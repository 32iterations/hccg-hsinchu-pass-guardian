// React Native BLE Manager mock
const BleManager = {
  start: jest.fn().mockResolvedValue(true),
  scan: jest.fn().mockResolvedValue(true),
  stopScan: jest.fn().mockResolvedValue(true),
  connect: jest.fn().mockResolvedValue(true),
  disconnect: jest.fn().mockResolvedValue(true),
  checkState: jest.fn().mockResolvedValue('PoweredOn'),
  getConnectedPeripherals: jest.fn().mockResolvedValue([]),
  getDiscoveredPeripherals: jest.fn().mockResolvedValue([]),
  isPeripheralConnected: jest.fn().mockResolvedValue(false),
  retrieveServices: jest.fn().mockResolvedValue([]),
  readRSSI: jest.fn().mockResolvedValue(-70),
  requestMTU: jest.fn().mockResolvedValue(23),
  requestConnectionPriority: jest.fn().mockResolvedValue(true),
  enableBluetooth: jest.fn().mockResolvedValue(true),

  // Event listeners
  addListener: jest.fn(),
  removeListener: jest.fn(),
  removeAllListeners: jest.fn()
};

module.exports = BleManager;
module.exports.default = BleManager;