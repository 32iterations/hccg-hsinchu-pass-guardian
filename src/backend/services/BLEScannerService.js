/**
 * BLEScannerService - P2 Volunteer BLE & Geo Alerts
 *
 * Manages BLE scanning for volunteer mode with Android 12+ permission handling,
 * iOS State Preservation/Restoration, RSSI filtering, and battery efficiency.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class BLEScannerService {
  constructor(dependencies) {
    this.bleAdapter = dependencies.bleAdapter;
    this.permissions = dependencies.permissions;
    this.batteryOptimization = dependencies.batteryOptimization;
    this.anonymizationService = dependencies.anonymizationService;

    this.status = {
      isScanning: false,
      error: null,
      canRetry: true
    };

    this.scanParameters = {
      scanIntervalMs: 10000,
      scanWindowMs: 5000,
      pauseIntervalMs: 50000,
      powerLevel: 'POWER_ULTRA_LOW',
      dutyCycle: 0.2
    };
  }

  async initializeAndroidScanning(options = {}) {
    const requiredPermissions = [
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT'
    ];

    if (options.enableLocationInference) {
      requiredPermissions.push(
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION'
      );
    }

    const result = await this.permissions.request(requiredPermissions);
    return result;
  }

  async initializeIOSScanning(cbCentralManager) {
    await cbCentralManager.initWithDelegate(
      this,
      {
        restoreIdentifier: 'HsinchuPassVolunteerScanner'
      }
    );
    return true;
  }

  async startScanning(options = {}) {
    try {
      if (options.neverForLocation) {
        await this.bleAdapter.startScan({
          neverForLocation: true,
          ...this.scanParameters
        });
      } else {
        await this.bleAdapter.startScan(this.scanParameters);
      }

      this.status.isScanning = true;
      this.status.error = null;

      // Set up device discovery callback
      this.bleAdapter.onDeviceDiscovered((device) => {
        this.processDiscoveredDevice(device, options);
      });

      return true;
    } catch (error) {
      this.status.isScanning = false;
      this.status.error = 'bluetooth_disabled';
      this.status.message = '藍牙已關閉，掃描暫停';
      throw error;
    }
  }

  async stopScanning() {
    await this.bleAdapter.stopScan();
    this.status.isScanning = false;
  }

  async processDiscoveredDevice(device, options = {}) {
    // Check RSSI threshold
    if (!this.shouldProcessDevice(device)) {
      return;
    }

    // Anonymize device immediately
    const anonymizedDevice = {
      deviceHash: await this.createDeviceHash(device.address),
      rssi: device.rssi,
      timestamp: this.roundTimestampToInterval(device.timestamp || new Date().toISOString()),
      includeLocation: !options.neverForLocation
    };

    await this.anonymizationService.anonymizeDevice(anonymizedDevice);

    if (options.enableLocationInference && options.currentLocation) {
      await this.createVolunteerHit(device, options.currentLocation);
    }
  }

  shouldProcessDevice(device) {
    // RSSI threshold: -90 dBm or stronger
    return device.rssi >= -90;
  }

  async createDeviceHash(macAddress) {
    // SHA-256 hash with salt
    const crypto = require('crypto');
    const salt = await this.getSessionSalt();
    return crypto.createHash('sha256')
      .update(macAddress + salt)
      .digest('hex');
  }

  async getSessionSalt() {
    // Return a consistent salt for the session
    return 'hsinchupass_volunteer_salt_2025';
  }

  roundTimestampToInterval(timestamp) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 5) * 5;

    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);

    return date.toISOString();
  }

  async fuzzLocationToGrid(location) {
    // Fuzz to 100m grid
    const gridLat = Math.round(location.latitude * 1000) / 1000; // ~100m precision
    const gridLng = Math.round(location.longitude * 1000) / 1000;

    return `${gridLat},${gridLng}`;
  }

  async createVolunteerHit(device, location) {
    const volunteerHit = {
      deviceHash: await this.createDeviceHash(device.address),
      rssi: device.rssi,
      gridSquare: await this.fuzzLocationToGrid(location),
      timestamp: this.roundTimestampToInterval(device.timestamp || new Date().toISOString()),
      anonymousId: require('crypto').randomUUID()
    };

    await this.anonymizationService.createVolunteerHit(volunteerHit);
    return volunteerHit;
  }

  async configureScanningForBattery(batteryStatus) {
    if (batteryStatus.isCharging) {
      // Aggressive scanning when charging
      await this.bleAdapter.setScanParameters({
        scanIntervalMs: 5000,
        scanWindowMs: 3000,
        pauseIntervalMs: 5000,
        powerLevel: 'POWER_HIGH',
        dutyCycle: 0.6
      });
    } else {
      // Conservative scanning when not charging
      await this.bleAdapter.setScanParameters({
        scanIntervalMs: 10000,
        scanWindowMs: 5000,
        pauseIntervalMs: 50000,
        powerLevel: 'POWER_ULTRA_LOW',
        dutyCycle: 0.2
      });
    }
  }

  async adaptScanningToDetectionRate(detectionRate) {
    if (detectionRate < 0.2) {
      // Low detection rate - increase intervals
      await this.bleAdapter.setScanParameters({
        scanIntervalMs: 15000,
        adaptiveMode: true
      });
    }
  }

  // iOS State Preservation/Restoration
  async saveStateForPreservation() {
    const state = {
      isScanning: this.status.isScanning,
      scanParameters: this.scanParameters,
      discoveredDevices: [],
      restoreIdentifier: 'HsinchuPassVolunteerScanner'
    };

    await this.bleAdapter.saveState?.(state);
    return state;
  }

  async restoreStateFromPreservation(restoredState) {
    if (restoredState.isScanning) {
      await this.bleAdapter.restoreState?.(restoredState);
      await this.bleAdapter.startScan(restoredState.scanParameters);
      this.status.isScanning = true;
    }
  }

  async handleIOSBackgroundRestore() {
    // Resume scanning automatically
    if (!this.status.isScanning) {
      await this.bleAdapter.startScan();
      this.status.isScanning = true;
    }
  }

  // Error handling
  async handleBluetoothStateChange(state) {
    if (state === 'enabled' && this.status.error === 'bluetooth_disabled') {
      await this.bleAdapter.startScan();
      this.status.isScanning = true;
      this.status.error = null;
    }
  }

  async handlePermissionRevocation(revokedPermissions) {
    await this.bleAdapter.stopScan();
    this.status.isScanning = false;
    this.status.error = 'permissions_revoked';
    this.status.missingPermissions = revokedPermissions;
    this.status.message = '權限被撤銷，請重新授權';

    // Preserve queued data
    await this.anonymizationService.preserveQueuedData?.();
  }

  async handlePermissionRestored(preservedState) {
    await this.bleAdapter.startScan(preservedState.scanParameters);
    await this.anonymizationService.processQueuedHits?.(preservedState.queuedHits);
    this.status.isScanning = true;
    this.status.error = null;
  }

  isScanning() {
    return this.status.isScanning;
  }

  getStatus() {
    return this.status;
  }
}

module.exports = BLEScannerService;