/**
 * BLE Scanner Service - Cross-platform Bluetooth Low Energy scanning
 * Handles Android 12+ permissions, iOS state preservation, and privacy-first device discovery
 */

const { ValidationError, SecurityError } = require('../utils/errors');

class BLEScannerService {
  constructor(dependencies = {}) {
    this.bleAdapter = dependencies.bleAdapter;
    this.permissions = dependencies.permissions;
    this.batteryOptimization = dependencies.batteryOptimization;
    this.anonymizationService = dependencies.anonymizationService;

    this.isScanning = false;
    this.scanParameters = {};
    this.status = { isScanning: false, error: null };
    this.rssiThreshold = -90; // dBm
    this.queuedVolunteerHits = [];
    this.detectionRate = 0;
    this.lastDetectionTime = null;
    this.centralManager = null;
  }

  /**
   * Initialize Android scanning with proper permissions
   */
  async initializeAndroidScanning(options = {}) {
    try {
      const permissions = [
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT'
      ];

      // Add location permissions if inference is enabled
      if (options.enableLocationInference) {
        permissions.push(
          'android.permission.ACCESS_FINE_LOCATION',
          'android.permission.ACCESS_BACKGROUND_LOCATION'
        );
      }

      const result = await this.permissions.request(permissions);

      // Verify all permissions granted
      const allGranted = Object.values(result).every(status => status === 'granted');

      if (!allGranted) {
        throw new Error('Required permissions not granted');
      }

      return { success: true, permissions: result };
    } catch (error) {
      throw new Error(`Failed to initialize Android scanning: ${error.message}`);
    }
  }

  /**
   * Start BLE scanning with specified configuration
   */
  async startScanning(options = {}) {
    try {
      // Configure scanning parameters
      this.scanParameters = {
        neverForLocation: options.neverForLocation || false,
        enableLocationInference: options.enableLocationInference || false,
        currentLocation: options.currentLocation
      };

      // Set up device discovery callback
      this.bleAdapter.onDeviceDiscovered((device) => {
        this.handleDeviceDiscovered(device);
      });

      // Start the actual scan
      await this.bleAdapter.startScan(this.scanParameters);

      this.isScanning = true;
      this.status = { isScanning: true };

      return { success: true };
    } catch (error) {
      this.status = {
        isScanning: false,
        error: 'bluetooth_disabled',
        canRetry: true,
        message: '藍牙已關閉，掃描暫停'
      };
      throw new Error(`Failed to start scanning: ${error.message}`);
    }
  }

  /**
   * Stop BLE scanning
   */
  async stopScanning() {
    try {
      await this.bleAdapter.stopScan();
      this.isScanning = false;
      this.status = { isScanning: false };
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to stop scanning: ${error.message}`);
    }
  }

  /**
   * Handle discovered device
   */
  async handleDeviceDiscovered(device) {
    try {
      // Check RSSI threshold
      if (!await this.shouldProcessDevice(device)) {
        return;
      }

      await this.processDiscoveredDevice(device, this.scanParameters);
    } catch (error) {
      console.error('Error handling discovered device:', error);
    }
  }

  /**
   * Process discovered device with anonymization
   */
  async processDiscoveredDevice(device, options = {}) {
    try {
      if (options.neverForLocation) {
        // No location inference - just device hashing
        await this.anonymizationService.anonymizeDevice({
          address: device.address,
          rssi: device.rssi,
          timestamp: device.timestamp || new Date().toISOString(),
          includeLocation: false
        });
      } else if (options.enableLocationInference && options.currentLocation) {
        // Include location data for positioning
        await this.anonymizationService.createVolunteerHit({
          deviceHash: await this._hashDeviceAddress(device.address),
          rssi: device.rssi,
          gridSquare: await this.fuzzLocationToGrid(options.currentLocation),
          timestamp: await this.roundTimestampToInterval(device.timestamp || new Date().toISOString()),
          anonymousId: this._generateAnonymousId()
        });
      }
    } catch (error) {
      throw new Error(`Failed to process discovered device: ${error.message}`);
    }
  }

  /**
   * Check if device should be processed based on RSSI
   */
  async shouldProcessDevice(device) {
    return device.rssi >= this.rssiThreshold; // -90 dBm or stronger
  }

  /**
   * Fuzz location to 100m grid squares
   */
  async fuzzLocationToGrid(location) {
    const gridSize = 100; // meters
    const latGrid = Math.round(location.latitude * 10000) / 10000; // ~100m precision
    const lngGrid = Math.round(location.longitude * 10000) / 10000;
    return `${latGrid.toFixed(4)},${lngGrid.toFixed(4)}`;
  }

  /**
   * Round timestamp to 5-minute intervals
   */
  async roundTimestampToInterval(timestamp) {
    const date = new Date(timestamp);
    const minutes = Math.floor(date.getMinutes() / 5) * 5;
    date.setMinutes(minutes, 0, 0); // Set to nearest 5-minute interval
    date.setMilliseconds(0); // Ensure milliseconds are 0

    // Format with milliseconds as .000
    const isoString = date.toISOString();
    return isoString.replace(/\.\d{3}Z$/, '.000Z');
  }

  /**
   * Initialize iOS scanning with state preservation
   */
  async initializeIOSScanning(centralManager) {
    try {
      this.centralManager = centralManager;

      if (centralManager && centralManager.initWithDelegate) {
        await centralManager.initWithDelegate(this, {
          restoreIdentifier: 'HsinchuPassVolunteerScanner'
        });
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to initialize iOS scanning: ${error.message}`);
    }
  }

  /**
   * Save scanning state for iOS preservation
   */
  async saveStateForPreservation() {
    try {
      const state = {
        isScanning: this.isScanning,
        scanParameters: this.scanParameters,
        discoveredDevices: [], // Don't persist device data for privacy
        restoreIdentifier: 'HsinchuPassVolunteerScanner'
      };

      if (this.bleAdapter && this.bleAdapter.saveState) {
        await this.bleAdapter.saveState(state);
      }

      return state;
    } catch (error) {
      throw new Error(`Failed to save state for preservation: ${error.message}`);
    }
  }

  /**
   * Restore state from iOS preservation
   */
  async restoreStateFromPreservation(restoredState) {
    try {
      if (this.bleAdapter && this.bleAdapter.restoreState) {
        await this.bleAdapter.restoreState(restoredState);
      }

      if (restoredState && restoredState.isScanning) {
        const scanParams = restoredState.scanParameters || {};
        await this.bleAdapter.startScan(scanParams);
        this.isScanning = true;
        this.scanParameters = scanParams;
        this.status = { isScanning: true, error: null };
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to restore state from preservation: ${error.message}`);
    }
  }

  /**
   * Handle iOS background restore
   */
  async handleIOSBackgroundRestore() {
    try {
      // Resume scanning automatically
      await this.bleAdapter.startScan();
      this.isScanning = true;
      this.status = { isScanning: true, error: null };
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to handle iOS background restore: ${error.message}`);
    }
  }

  /**
   * Configure scanning based on battery status
   */
  async configureScanningForBattery(batteryStatus) {
    try {
      let parameters;

      if (batteryStatus.isCharging) {
        // Aggressive scanning when charging
        parameters = {
          scanIntervalMs: 5000,   // 5s ON
          scanWindowMs: 3000,     // 3s window
          pauseIntervalMs: 5000,  // 5s OFF
          powerLevel: 'POWER_HIGH',
          dutyCycle: 0.6          // 60% maximum
        };
      } else {
        // Conservative scanning when not charging
        parameters = {
          scanIntervalMs: 10000,  // 10s ON
          scanWindowMs: 5000,     // 5s window
          pauseIntervalMs: 50000, // 50s OFF
          powerLevel: 'POWER_ULTRA_LOW',
          dutyCycle: 0.2          // 20% maximum
        };
      }

      await this.bleAdapter.setScanParameters(parameters);
      return parameters;
    } catch (error) {
      throw new Error(`Failed to configure scanning for battery: ${error.message}`);
    }
  }

  /**
   * Adapt scanning intervals based on detection rate
   */
  async adaptScanningToDetectionRate(detectionRate) {
    try {
      const parameters = {
        scanIntervalMs: detectionRate < 0.2 ? 15000 : 10000, // Longer intervals for low detection
        adaptiveMode: true
      };

      await this.bleAdapter.setScanParameters(parameters);
      return parameters;
    } catch (error) {
      throw new Error(`Failed to adapt scanning to detection rate: ${error.message}`);
    }
  }

  /**
   * Create anonymized volunteer hit
   */
  async createVolunteerHit(device, location) {
    try {
      const deviceHash = await this._hashDeviceAddress(device.address);
      const gridSquare = location ? await this.fuzzLocationToGrid(location) : null;
      const timestamp = await this.roundTimestampToInterval(device.timestamp || new Date().toISOString());

      return await this.anonymizationService.createVolunteerHit({
        deviceHash,
        rssi: device.rssi,
        timestamp,
        gridSquare,
        anonymousId: this._generateAnonymousId()
      });
    } catch (error) {
      throw new Error(`Failed to create volunteer hit: ${error.message}`);
    }
  }

  /**
   * Analyze temporal clustering patterns
   */
  async analyzeTemporalClustering() {
    try {
      // No correlation logic - each MAC is treated separately for privacy
      return {
        correlationEnabled: false,
        message: 'Temporal correlation disabled for privacy protection'
      };
    } catch (error) {
      throw new SecurityError(`Failed to analyze temporal clustering: ${error.message}`);
    }
  }

  /**
   * Batch process multiple locations for efficiency
   */
  async batchProcessLocations(locations) {
    try {
      if (!Array.isArray(locations)) {
        throw new ValidationError('Locations must be an array');
      }

      const processedLocations = [];
      for (const location of locations) {
        const gridSquare = await this.fuzzLocationToGrid(location);
        processedLocations.push({
          original: location,
          gridSquare,
          processed: true
        });
      }

      return processedLocations;
    } catch (error) {
      throw new Error(`Failed to batch process locations: ${error.message}`);
    }
  }

  /**
   * Handle Bluetooth state changes
   */
  async handleBluetoothStateChange(state) {
    try {
      if (state === 'enabled' && this.status.error === 'bluetooth_disabled') {
        await this.bleAdapter.startScan();
        this.status = { isScanning: true, error: null };
        this.isScanning = true;
      } else if (state === 'disabled') {
        this.status = {
          isScanning: false,
          error: 'bluetooth_disabled',
          canRetry: true,
          message: '藍牙已關閉，掃描暫停'
        };
        this.isScanning = false;
      }
    } catch (error) {
      throw new Error(`Failed to handle Bluetooth state change: ${error.message}`);
    }
  }

  /**
   * Handle permission revocation
   */
  async handlePermissionRevocation(revokedPermissions) {
    try {
      // Stop scanning immediately
      await this.bleAdapter.stopScan();
      this.isScanning = false;

      // Preserve queued data
      if (this.anonymizationService && this.anonymizationService.preserveQueuedData) {
        await this.anonymizationService.preserveQueuedData();
      }

      this.status = {
        isScanning: false,
        error: 'permissions_revoked',
        missingPermissions: revokedPermissions,
        message: '權限被撤銷，請重新授權'
      };

      return this.status;
    } catch (error) {
      throw new SecurityError(`Failed to handle permission revocation: ${error.message}`);
    }
  }

  /**
   * Handle permission restored
   */
  async handlePermissionRestored(preservedState) {
    try {
      if (preservedState && preservedState.scanParameters) {
        await this.bleAdapter.startScan(preservedState.scanParameters);
      } else {
        await this.bleAdapter.startScan();
      }

      if (this.anonymizationService && this.anonymizationService.processQueuedHits && preservedState.queuedHits) {
        await this.anonymizationService.processQueuedHits(preservedState.queuedHits);
      }

      this.isScanning = true;
      this.status = { isScanning: true, error: null };

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to handle permission restored: ${error.message}`);
    }
  }

  /**
   * Get current scanner status
   */
  getStatus() {
    return this.status;
  }

  // Private helper methods
  async _hashDeviceAddress(address) {
    const crypto = require('crypto');
    const salt = 'hsinchupass_volunteer_salt_2025';
    return crypto.createHash('sha256').update(address + salt).digest('hex');
  }

  _generateAnonymousId() {
    const crypto = require('crypto');
    return crypto.randomUUID();
  }
}

module.exports = BLEScannerService;