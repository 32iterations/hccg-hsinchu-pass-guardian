/**
 * Device Binding Service - 新竹通安心守護裝置綁定服務
 *
 * Handles NCC certification validation and device management for HsinchuPass safety guardian devices.
 * This service ensures compliance with Taiwan's National Communications Commission (NCC) regulations
 * and manages the complete device lifecycle from registration to active monitoring.
 *
 * Key Features:
 * - NCC certification validation per Taiwan regulatory requirements
 * - Duplicate serial number prevention
 * - BLE connection retry logic with exponential backoff
 * - Concurrent binding request handling with proper locking
 * - Batch device binding (up to 50 devices)
 * - Device state tracking and history management
 *
 * @class DeviceBindingService
 * @version 1.0.0
 * @author HsinchuPass Safety Team
 */

class DeviceBindingService {
  constructor() {
    // In-memory storage for bound devices (in production, use proper database)
    this.boundDevices = new Map();
    this.deviceHistory = new Map();
    this.bindingLocks = new Map();

    // Connection tracking
    this.connectionAttempts = new Map();
    this.backgroundReconnections = new Map();

    // Regulatory constants
    this.NCC_PATTERN = /^CCAM\d{2}\d{2}[A-Z]{2}\d{4}$/;
    this.REGULATORY_WARNING = `本產品符合國家通訊傳播委員會（NCC）低功率電波輻射性電機管理辦法規定，審驗合格之低功率射頻電機，非經許可，公司、商號或使用者均不得擅自變更頻率、加大功率或變更原設計之特性及功能。使用時不得影響飛航安全及干擾合法通信；經型式認證合格之低功率射頻電機，必須接受其他合法無線電機之干擾。低功率射頻電機之使用不得影響飛航安全及干擾合法通信；如有干擾現象發生時，應立即停止使用，並改善至無干擾時方得繼續使用。前述合法通信，指依電信法規定作業之無線電通信。低功率射頻電機須忍受合法通信或工業、科學及醫療用電波輻射性電機設備之干擾。

依據NCC低功率電波輻射性電機管理辦法：
• 經型式認證合格之低功率射頻電機，不得擅自變更頻率、加大功率或變更原設計之特性及功能
• 使用時不得影響飛航安全及干擾合法通信
• 必須接受其他合法無線電機之干擾
• NCC認證標章、審驗號碼、製造商資訊必須清楚標示於產品上

本產品已通過NCC型式認證，認證號碼請參閱產品標籤。`;
  }

  /**
   * Bind a single device with comprehensive validation
   * @param {Object} device - Device information to bind
   * @returns {Promise<Object>} Binding result
   */
  async bindDevice(device) {
    try {
      // Validate NCC certification
      if (!device.nccCertification) {
        throw new Error('Device must have valid NCC type approval number');
      }

      if (!this.NCC_PATTERN.test(device.nccCertification)) {
        throw new Error('Invalid NCC certification format. Expected: CCAM[YY][XX][####]');
      }

      // Validate serial number format
      if (!this._isValidSerialNumber(device.serialNumber)) {
        throw new Error('Invalid serial number format');
      }

      // Check for duplicate serial number
      if (this.boundDevices.has(device.serialNumber)) {
        throw new Error(`Serial number ${device.serialNumber} is already registered`);
      }

      // Acquire binding lock for this serial number
      await this._acquireBindingLock(device.serialNumber);

      try {
        const bindingResult = {
          serialNumber: device.serialNumber,
          manufacturer: device.manufacturer,
          model: device.model,
          nccCertification: device.nccCertification,
          nccValidated: true,
          regulatoryWarning: this.REGULATORY_WARNING,
          bindingTime: new Date().toISOString(),
          userId: device.userId,
          batteryLevel: device.batteryLevel || null,
          lowBatteryAlert: device.batteryLevel ? device.batteryLevel < 20 : false,
          connected: false,
          connectionAttempts: 0,
          connectionError: null,
          bindingStatus: 'bound'
        };

        // Attempt BLE connection if BLE address provided
        if (device.bleAddress) {
          const connectionResult = await this._attemptBLEConnection(device);
          Object.assign(bindingResult, connectionResult);
        }

        // Store device
        this.boundDevices.set(device.serialNumber, bindingResult);

        // Add to device history
        this._addToHistory(device.serialNumber, 'device_bound', {
          timestamp: bindingResult.bindingTime,
          userId: device.userId
        });

        return bindingResult;
      } finally {
        // Release binding lock
        this._releaseBindingLock(device.serialNumber);
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bind multiple devices in batch (up to 50)
   * @param {Array} devices - Array of device objects to bind
   * @returns {Promise<Object>} Batch binding results
   */
  async bindDevicesBatch(devices) {
    if (!Array.isArray(devices)) {
      throw new Error('Devices must be an array');
    }

    if (devices.length > 50) {
      throw new Error('Batch binding limited to 50 devices maximum');
    }

    const results = {
      successful: [],
      failed: [],
      total: devices.length
    };

    // Process devices concurrently with proper locking
    const bindingPromises = devices.map(async (device, index) => {
      try {
        const result = await this.bindDevice(device);
        results.successful.push({ index, device: device.serialNumber, result });
      } catch (error) {
        results.failed.push({
          index,
          device: device.serialNumber,
          error: error.message
        });
      }
    });

    await Promise.all(bindingPromises);

    return results;
  }

  /**
   * Get device binding history
   * @param {string} serialNumber - Device serial number
   * @returns {Promise<Array>} Device history events
   */
  async getDeviceHistory(serialNumber) {
    return this.deviceHistory.get(serialNumber) || [];
  }

  /**
   * Mock BLE connection method for testing
   * @param {Object} device - Device with BLE address
   * @returns {Promise<Object>} Connection result
   */
  async bleConnect(device) {
    // This is a mock implementation for testing
    // In real implementation, this would connect to actual BLE device
    return new Promise((resolve, reject) => {
      // Simulate connection attempt
      setTimeout(() => {
        resolve({ connected: true });
      }, 100);
    });
  }

  /**
   * Attempt BLE connection with retry logic
   * @param {Object} device - Device information
   * @returns {Promise<Object>} Connection result
   * @private
   */
  async _attemptBLEConnection(device) {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    let connectionAttempts = 0;
    let connected = false;
    let connectionError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      connectionAttempts = attempt;

      try {
        await this.bleConnect(device);
        connected = true;
        break;
      } catch (error) {
        connectionError = error.message;

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await this._sleep(delay);
        }
      }
    }

    const result = {
      connected,
      connectionAttempts,
      connectionError: connected ? null : 'Failed after 3 attempts',
      bindingStatus: connected ? 'active' : 'pending_connection'
    };

    // Set up background reconnection if connection failed
    if (!connected) {
      result.backgroundReconnection = true;
      result.reconnectionInterval = 30000; // 30 seconds
      result.maxReconnectionAttempts = 10;

      this.backgroundReconnections.set(device.serialNumber, {
        enabled: true,
        interval: 30000,
        maxAttempts: 10,
        currentAttempts: 0
      });
    }

    return result;
  }

  /**
   * Validate serial number format
   * @param {string} serialNumber - Serial number to validate
   * @returns {boolean} True if valid
   * @private
   */
  _isValidSerialNumber(serialNumber) {
    if (!serialNumber || typeof serialNumber !== 'string') {
      return false;
    }

    // Serial numbers should not contain spaces or invalid characters
    if (/\s/.test(serialNumber)) {
      return false;
    }

    // Additional format validation can be added here
    return true;
  }

  /**
   * Acquire binding lock for concurrent request handling
   * @param {string} serialNumber - Device serial number
   * @returns {Promise<void>}
   * @private
   */
  async _acquireBindingLock(serialNumber) {
    while (this.bindingLocks.has(serialNumber)) {
      await this._sleep(10); // Wait 10ms and try again
    }
    this.bindingLocks.set(serialNumber, true);
  }

  /**
   * Release binding lock
   * @param {string} serialNumber - Device serial number
   * @private
   */
  _releaseBindingLock(serialNumber) {
    this.bindingLocks.delete(serialNumber);
  }

  /**
   * Add event to device history
   * @param {string} serialNumber - Device serial number
   * @param {string} event - Event type
   * @param {Object} details - Event details
   * @private
   */
  _addToHistory(serialNumber, event, details) {
    if (!this.deviceHistory.has(serialNumber)) {
      this.deviceHistory.set(serialNumber, []);
    }

    this.deviceHistory.get(serialNumber).push({
      event,
      timestamp: details.timestamp || new Date().toISOString(),
      ...details
    });
  }

  /**
   * Sleep utility for delays
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = DeviceBindingService;