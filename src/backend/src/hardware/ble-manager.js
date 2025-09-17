/**
 * BLE Manager - Minimal implementation for TDD GREEN phase
 */

const { BLEConnectionError } = require('../services/safety/errors');

class BLEManager {
  // These methods are empty and will be mocked by jest
  async connect() {}
  async getConnectionStatus() {}
  async getDeviceMetrics() {}
}

module.exports = { BLEManager };