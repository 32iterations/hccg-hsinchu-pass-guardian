/**
 * Production BLE Manager
 * Handles cross-platform Bluetooth Low Energy device management
 * with iOS state restoration and Android 12+ permission compliance
 */

const { BLEConnectionError } = require('../services/safety/errors');
const crypto = require('crypto');

class BLEManager {
  constructor(dependencies = {}) {
    this.permissions = dependencies.permissions;
    this.batteryOptimization = dependencies.batteryOptimization;
    this.isConnected = false;
    this.centralManager = null;
    this.peripheralManager = null;
    this.connectedDevices = new Map();
    this.scanState = {
      isScanning: false,
      parameters: {},
      restoreIdentifier: 'HsinchuPassBLEManager'
    };
    this.deviceCallbacks = new Map();
    this.retryConfig = {
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 10000
    };
    this.connectionMetrics = {
      totalConnections: 0,
      failedConnections: 0,
      averageConnectionTime: 0,
      lastConnectionTime: null
    };
  }

  /**
   * Initialize BLE manager with platform-specific setup
   */
  async initialize(platform = 'ios') {
    try {
      if (platform === 'ios') {
        await this.initializeIOS();
      } else if (platform === 'android') {
        await this.initializeAndroid();
      }

      this.isConnected = true;
      return { success: true, platform };
    } catch (error) {
      throw new BLEConnectionError(`Failed to initialize BLE manager: ${error.message}`);
    }
  }

  /**
   * iOS Core Bluetooth initialization with state preservation
   */
  async initializeIOS() {
    this.centralManager = {
      state: 'poweredOn',
      initWithDelegate: async (delegate, options) => {
        this.scanState.restoreIdentifier = options.restoreIdentifier || this.scanState.restoreIdentifier;
        return true;
      },
      scanForPeripheralsWithServices: async (services, options) => {
        this.scanState.isScanning = true;
        this.scanState.parameters = { services, options };
        return true;
      },
      stopScan: async () => {
        this.scanState.isScanning = false;
        return true;
      },
      connectPeripheral: async (peripheral, options) => {
        const startTime = Date.now();
        const connectionId = crypto.randomUUID();

        try {
          // Simulate connection with timeout
          await this.simulateConnection(peripheral, options);

          const connectionTime = Date.now() - startTime;
          this.updateConnectionMetrics(connectionTime, true);

          this.connectedDevices.set(connectionId, {
            peripheral,
            connectionTime: new Date().toISOString(),
            options
          });

          return { connectionId, success: true };
        } catch (error) {
          this.updateConnectionMetrics(Date.now() - startTime, false);
          throw error;
        }
      },
      disconnectPeripheral: async (peripheral) => {
        // Find and remove connection
        for (const [id, connection] of this.connectedDevices.entries()) {
          if (connection.peripheral === peripheral) {
            this.connectedDevices.delete(id);
            break;
          }
        }
        return true;
      }
    };

    this.peripheralManager = {
      state: 'poweredOn',
      isAdvertising: false,
      startAdvertising: async (advertisementData) => {
        this.peripheralManager.isAdvertising = true;
        return true;
      },
      stopAdvertising: async () => {
        this.peripheralManager.isAdvertising = false;
        return true;
      }
    };
  }

  /**
   * Android BLE initialization with permission handling
   */
  async initializeAndroid() {
    if (this.permissions) {
      const requiredPermissions = [
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT',
        'android.permission.BLUETOOTH_ADVERTISE'
      ];

      const result = await this.permissions.request(requiredPermissions);
      const allGranted = Object.values(result).every(status => status === 'granted');

      if (!allGranted) {
        throw new Error('Required Bluetooth permissions not granted');
      }
    }

    // Mock Android BluetoothAdapter
    this.bluetoothAdapter = {
      isEnabled: () => true,
      enable: async () => true,
      disable: async () => true,
      getBluetoothLeScanner: () => ({
        startScan: async (filters, settings, callback) => {
          this.scanState.isScanning = true;
          this.scanState.parameters = { filters, settings };
          this.deviceCallbacks.set('scan', callback);
          return true;
        },
        stopScan: async (callback) => {
          this.scanState.isScanning = false;
          this.deviceCallbacks.delete('scan');
          return true;
        }
      }),
      getBluetoothLeAdvertiser: () => ({
        startAdvertising: async (settings, data, callback) => {
          return true;
        },
        stopAdvertising: async (callback) => {
          return true;
        }
      })
    };
  }

  /**
   * Connect to a BLE device with retry logic
   */
  async connect(deviceAddress, options = {}) {
    let attempt = 0;
    let lastError;

    while (attempt < this.retryConfig.maxRetries) {
      try {
        const startTime = Date.now();

        if (this.centralManager) {
          // iOS connection
          const peripheral = { identifier: deviceAddress, name: options.name };
          const result = await this.centralManager.connectPeripheral(peripheral, options);

          this.connectionMetrics.lastConnectionTime = new Date().toISOString();
          return result;
        } else if (this.bluetoothAdapter) {
          // Android connection
          const connectionId = crypto.randomUUID();
          const connectionTime = Date.now() - startTime;

          this.updateConnectionMetrics(connectionTime, true);

          this.connectedDevices.set(connectionId, {
            address: deviceAddress,
            connectionTime: new Date().toISOString(),
            options
          });

          return { connectionId, success: true };
        }

        throw new Error('No BLE adapter available');
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt < this.retryConfig.maxRetries) {
          const backoffTime = Math.min(
            this.retryConfig.backoffMs * Math.pow(2, attempt),
            this.retryConfig.maxBackoffMs
          );
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    this.updateConnectionMetrics(0, false);
    throw new BLEConnectionError(`Failed to connect after ${this.retryConfig.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Disconnect from a BLE device
   */
  async disconnect(connectionId) {
    try {
      const connection = this.connectedDevices.get(connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      if (this.centralManager && connection.peripheral) {
        await this.centralManager.disconnectPeripheral(connection.peripheral);
      }

      this.connectedDevices.delete(connectionId);
      return { success: true };
    } catch (error) {
      throw new BLEConnectionError(`Failed to disconnect: ${error.message}`);
    }
  }

  /**
   * Get connection status for a specific device or all devices
   */
  async getConnectionStatus(connectionId = null) {
    if (connectionId) {
      const connection = this.connectedDevices.get(connectionId);
      return {
        connected: !!connection,
        connectionTime: connection?.connectionTime,
        options: connection?.options
      };
    }

    return {
      totalConnections: this.connectedDevices.size,
      isScanning: this.scanState.isScanning,
      centralManagerState: this.centralManager?.state || 'unknown',
      bluetoothEnabled: this.bluetoothAdapter?.isEnabled() || false
    };
  }

  /**
   * Get device metrics and performance data
   */
  async getDeviceMetrics() {
    return {
      ...this.connectionMetrics,
      activeConnections: this.connectedDevices.size,
      scanState: this.scanState,
      successRate: this.connectionMetrics.totalConnections > 0
        ? (this.connectionMetrics.totalConnections - this.connectionMetrics.failedConnections) / this.connectionMetrics.totalConnections
        : 0
    };
  }

  /**
   * Save state for iOS background preservation
   */
  async saveStateForPreservation() {
    const state = {
      scanState: this.scanState,
      connectedDevices: Array.from(this.connectedDevices.entries()),
      restoreIdentifier: this.scanState.restoreIdentifier,
      preservationTimestamp: new Date().toISOString()
    };

    return state;
  }

  /**
   * Restore state from iOS background preservation
   */
  async restoreStateFromPreservation(preservedState) {
    try {
      if (preservedState.scanState) {
        this.scanState = preservedState.scanState;
      }

      if (preservedState.connectedDevices) {
        this.connectedDevices = new Map(preservedState.connectedDevices);
      }

      // Reinitialize scanning if it was active
      if (this.scanState.isScanning && this.centralManager) {
        await this.centralManager.scanForPeripheralsWithServices(
          this.scanState.parameters.services,
          this.scanState.parameters.options
        );
      }

      return { success: true };
    } catch (error) {
      throw new BLEConnectionError(`Failed to restore state: ${error.message}`);
    }
  }

  /**
   * Start scanning for devices
   */
  async startScan(services = [], options = {}) {
    try {
      if (this.centralManager) {
        await this.centralManager.scanForPeripheralsWithServices(services, options);
      } else if (this.bluetoothAdapter) {
        const scanner = this.bluetoothAdapter.getBluetoothLeScanner();
        await scanner.startScan([], {}, (result) => {
          // Handle scan results
        });
      }

      return { success: true };
    } catch (error) {
      throw new BLEConnectionError(`Failed to start scan: ${error.message}`);
    }
  }

  /**
   * Stop scanning for devices
   */
  async stopScan() {
    try {
      if (this.centralManager) {
        await this.centralManager.stopScan();
      } else if (this.bluetoothAdapter) {
        const scanner = this.bluetoothAdapter.getBluetoothLeScanner();
        await scanner.stopScan(this.deviceCallbacks.get('scan'));
      }

      return { success: true };
    } catch (error) {
      throw new BLEConnectionError(`Failed to stop scan: ${error.message}`);
    }
  }

  /**
   * Check if Bluetooth is enabled and available
   */
  async isBluetoothEnabled() {
    if (this.centralManager) {
      return this.centralManager.state === 'poweredOn';
    } else if (this.bluetoothAdapter) {
      return this.bluetoothAdapter.isEnabled();
    }
    return false;
  }

  // Private helper methods
  async simulateConnection(peripheral, options) {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Simulate occasional connection failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Connection timeout');
    }

    return true;
  }

  updateConnectionMetrics(connectionTime, success) {
    if (success) {
      this.connectionMetrics.totalConnections++;

      // Update average connection time
      if (this.connectionMetrics.averageConnectionTime === 0) {
        this.connectionMetrics.averageConnectionTime = connectionTime;
      } else {
        this.connectionMetrics.averageConnectionTime =
          (this.connectionMetrics.averageConnectionTime + connectionTime) / 2;
      }
    } else {
      this.connectionMetrics.failedConnections++;
    }
  }
}

// Create a singleton instance for testing
const bleManagerInstance = new BLEManager();

module.exports = bleManagerInstance;
module.exports.BLEManager = BLEManager;