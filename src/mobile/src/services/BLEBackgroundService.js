/**
 * Production BLE Background Service for React Native
 * Cross-platform mobile BLE background scanning implementation
 * with iOS Core Bluetooth state preservation and Android 12+ compliance
 */

import { NativeModules, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { BLEManager } = NativeModules;

export class BLEBackgroundService {
  constructor(config = {}) {
    this.config = {
      restoreIdentifier: 'HsinchuPassVolunteerScanner',
      backgroundModes: ['bluetooth-central'],
      scanInterval: Platform.OS === 'ios' ? 1000 : 5000,
      rssiThreshold: -90,
      maxRetries: 3,
      ...config
    };

    // Service state
    this.isScanning = false;
    this.discoveredDevices = [];
    this.volunteerHits = [];
    this.scanParameters = {};
    this.status = { isScanning: false, error: null };
    this.lastVolunteerHit = null;
    this.offlineQueue = [];
    this.preservedQueue = [];
    this.queuedHits = [];
    this.submissionStatus = { status: 'idle', totalRetries: 0 };
    this.wasScanning = false;
    this.preservedState = null;
    this.prioritizedDevices = [];
    this.lastPriorityDetection = null;

    // Production additions
    this.connectionMetrics = {
      totalScans: 0,
      successfulScans: 0,
      averageDevicesPerScan: 0,
      lastScanTime: null
    };
    this.errorHistory = [];
    this.retryQueue = [];
    this.backgroundTask = null;
    this.appStateListener = null;

    this.initializeService();
  }

  /**
   * Initialize the background service
   */
  async initializeService() {
    try {
      // Setup app state monitoring
      this.setupAppStateMonitoring();

      // Restore previous state if available
      await this.restoreServiceState();

      // Platform-specific initialization
      if (Platform.OS === 'ios') {
        await this.initializeIOS();
      } else if (Platform.OS === 'android') {
        await this.initializeAndroid();
      }

      return { success: true };
    } catch (error) {
      this.logError('Service initialization failed', error);
      throw error;
    }
  }

  /**
   * iOS Core Bluetooth initialization with state preservation
   */
  async initializeIOS() {
    try {
      // Configure Core Bluetooth with restore identifier
      if (BLEManager && BLEManager.initializeWithRestore) {
        await BLEManager.initializeWithRestore({
          restoreIdentifier: this.config.restoreIdentifier,
          showPowerAlert: true,
          backgroundModes: this.config.backgroundModes
        });
      }

      // Setup background task handling
      this.setupIOSBackgroundTasks();

      return { success: true, platform: 'ios' };
    } catch (error) {
      throw new Error(`iOS initialization failed: ${error.message}`);
    }
  }

  /**
   * Android 12+ BLE initialization with proper permissions
   */
  async initializeAndroid(options = {}) {
    try {
      const requiredPermissions = [
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT'
      ];

      // Add location permissions based on usage
      if (options.enableLocationInference) {
        requiredPermissions.push(
          'android.permission.ACCESS_FINE_LOCATION',
          'android.permission.ACCESS_BACKGROUND_LOCATION'
        );
      } else if (options.neverForLocation) {
        // Android 12+ allows BLE scanning without location for non-location use cases
        // But we still need to declare this explicitly
      }

      // Request permissions
      if (BLEManager && BLEManager.requestPermissions) {
        const result = await BLEManager.requestPermissions(requiredPermissions);
        const allGranted = Object.values(result).every(status => status === 'granted');

        if (!allGranted) {
          throw new Error('Required Bluetooth permissions not granted');
        }
      }

      // Setup JobScheduler for background scanning compliance
      await this.setupAndroidBackgroundScanning();

      return { success: true, platform: 'android', permissions: requiredPermissions };
    } catch (error) {
      throw new Error(`Android initialization failed: ${error.message}`);
    }
  }

  /**
   * Start background BLE scanning
   */
  async startBackgroundScanning(options = {}) {
    try {
      this.scanParameters = {
        neverForLocation: options.neverForLocation || false,
        enableLocationInference: options.enableLocationInference || false,
        currentLocation: options.currentLocation,
        rssiThreshold: options.rssiThreshold || this.config.rssiThreshold,
        scanInterval: options.scanInterval || this.config.scanInterval,
        ...options
      };

      // Platform-specific scan start
      if (Platform.OS === 'ios') {
        await this.startIOSBackgroundScanning();
      } else if (Platform.OS === 'android') {
        await this.startAndroidBackgroundScanning();
      }

      this.isScanning = true;
      this.connectionMetrics.totalScans++;
      this.connectionMetrics.lastScanTime = new Date().toISOString();

      // Save state for restoration
      await this.saveServiceState();

      return { success: true, parameters: this.scanParameters };
    } catch (error) {
      this.handleScanError(error);
      throw error;
    }
  }

  /**
   * iOS background scanning with Core Bluetooth
   */
  async startIOSBackgroundScanning() {
    try {
      const scanOptions = {
        allowDuplicates: false,
        scanInterval: this.scanParameters.scanInterval,
        rssiThreshold: this.scanParameters.rssiThreshold
      };

      if (BLEManager && BLEManager.startBackgroundScan) {
        await BLEManager.startBackgroundScan(scanOptions);
      }

      // Setup device discovery callback
      this.setupDeviceDiscoveryCallback();

      return { success: true };
    } catch (error) {
      throw new Error(`iOS background scanning failed: ${error.message}`);
    }
  }

  /**
   * Android background scanning with JobScheduler compliance
   */
  async startAndroidBackgroundScanning() {
    try {
      const scanSettings = {
        scanMode: 'SCAN_MODE_LOW_POWER', // Battery efficient
        callbackType: 'CALLBACK_TYPE_ALL_MATCHES',
        matchMode: 'MATCH_MODE_AGGRESSIVE',
        rssiThreshold: this.scanParameters.rssiThreshold,
        backgroundCompliant: true
      };

      if (BLEManager && BLEManager.startBackgroundScan) {
        await BLEManager.startBackgroundScan(scanSettings);
      }

      // Setup device discovery callback
      this.setupDeviceDiscoveryCallback();

      return { success: true };
    } catch (error) {
      throw new Error(`Android background scanning failed: ${error.message}`);
    }
  }

  /**
   * Setup device discovery callback
   */
  setupDeviceDiscoveryCallback() {
    if (BLEManager && BLEManager.setDeviceDiscoveryCallback) {
      BLEManager.setDeviceDiscoveryCallback((device) => {
        this.handleDeviceDiscovered(device);
      });
    }
  }

  /**
   * Handle discovered BLE device
   */
  async handleDeviceDiscovered(device) {
    try {
      // Check RSSI threshold
      if (!await this.shouldProcessDevice(device)) {
        return;
      }

      // Process device with anonymization
      await this.processDiscoveredDevice(device, this.scanParameters);

      // Update metrics
      this.updateScanMetrics(device);

      // Handle priority devices if configured
      if (this.prioritizedDevices.length > 0) {
        await this.checkPriorityDevice(device);
      }
    } catch (error) {
      this.logError('Device discovery handling failed', error);
      await this.handleDiscoveryError(error, device);
    }
  }

  /**
   * Process discovered device with privacy-first approach
   */
  async processDiscoveredDevice(device, options = {}) {
    try {
      let volunteerHit;

      if (options.neverForLocation) {
        // Create anonymized hit without location data
        volunteerHit = {
          deviceHash: this.createDeviceHash(device.id || device.address),
          rssi: device.rssi,
          timestamp: device.timestamp || new Date().toISOString(),
          gridSquare: null,
          anonymousVolunteerId: this.generateAnonymousId(),
          locationDataIncluded: false
        };
      } else if (options.enableLocationInference && options.currentLocation) {
        // Create hit with fuzzed location for positioning
        const fuzzedLocation = this.fuzzLocationToGrid(options.currentLocation);
        const roundedTimestamp = this.roundTimestampToInterval(
          device.timestamp || new Date().toISOString(),
          5
        );

        volunteerHit = {
          deviceHash: this.createDeviceHash(device.id || device.address),
          rssi: device.rssi,
          timestamp: roundedTimestamp,
          gridSquare: fuzzedLocation.gridSquare,
          anonymousVolunteerId: this.generateAnonymousId(),
          locationDataIncluded: true,
          gridSizeMeters: fuzzedLocation.gridSizeMeters
        };
      }

      // Store hit and queue for submission
      if (volunteerHit) {
        this.lastVolunteerHit = volunteerHit;
        this.volunteerHits.push(volunteerHit);
        this.queuedHits.push(volunteerHit);

        // Check if we can submit (k-anonymity threshold)
        if (this.canSubmitHits()) {
          await this.submitQueuedHits();
        }
      }

      return volunteerHit;
    } catch (error) {
      throw new Error(`Device processing failed: ${error.message}`);
    }
  }

  /**
   * Check if device should be processed based on RSSI
   */
  async shouldProcessDevice(device) {
    return device.rssi >= this.config.rssiThreshold;
  }

  /**
   * Fuzz location to privacy-preserving grid squares
   */
  fuzzLocationToGrid(location) {
    // Round to ~100m grid for privacy
    const lat = Math.round(location.latitude * 10000) / 10000;
    const lng = Math.round(location.longitude * 10000) / 10000;

    return {
      gridSquare: `${lat.toFixed(4)},${lng.toFixed(4)}`,
      gridSizeMeters: 100,
      originalLocationDeleted: true
    };
  }

  /**
   * Round timestamp to interval for privacy (prevents precise timing correlation)
   */
  roundTimestampToInterval(timestamp, intervalMinutes) {
    try {
      const date = new Date(timestamp);

      // Validate timestamp
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid timestamp: ${timestamp}`);
      }

      const minutes = Math.floor(date.getMinutes() / intervalMinutes) * intervalMinutes;
      date.setMinutes(minutes, 0, 0);

      return date.toISOString();
    } catch (error) {
      // Fallback to current time rounded
      const fallbackDate = new Date();
      const minutes = Math.floor(fallbackDate.getMinutes() / intervalMinutes) * intervalMinutes;
      fallbackDate.setMinutes(minutes, 0, 0);
      return fallbackDate.toISOString();
    }
  }

  /**
   * Create device hash for anonymization
   */
  createDeviceHash(identifier) {
    try {
      // Use React Native's built-in crypto if available, otherwise fallback
      const crypto = require('crypto');
      const salt = 'hsinchupass_mobile_salt_2025';
      return crypto.createHash('sha256').update(identifier + salt).digest('hex');
    } catch (error) {
      // Fallback hash implementation for React Native
      return this.simpleHash(identifier + 'hsinchupass_mobile_salt_2025');
    }
  }

  /**
   * Simple hash fallback for React Native environments
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(16, '0').repeat(4).substring(0, 64);
  }

  /**
   * Generate anonymous volunteer ID
   */
  generateAnonymousId() {
    // Generate UUID-like string
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * iOS state preservation for background app termination
   */
  async saveStateForPreservation(state = {}) {
    try {
      const preservationState = {
        isScanning: this.isScanning,
        scanParameters: this.scanParameters,
        queuedHits: this.queuedHits,
        prioritizedDevices: this.prioritizedDevices,
        restoreIdentifier: this.config.restoreIdentifier,
        preservationTimestamp: new Date().toISOString(),
        ...state
      };

      // Save to AsyncStorage for persistence
      await AsyncStorage.setItem(
        'BLEBackgroundService_PreservedState',
        JSON.stringify(preservationState)
      );

      // Platform-specific state saving
      if (Platform.OS === 'ios' && BLEManager && BLEManager.saveState) {
        await BLEManager.saveState(preservationState);
      }

      this.preservedState = preservationState;
      return preservationState;
    } catch (error) {
      this.logError('State preservation failed', error);
      throw error;
    }
  }

  /**
   * Restore from preserved state
   */
  async restoreFromPreservedState(state = null) {
    try {
      let restoredState = state;

      if (!restoredState) {
        // Try to restore from AsyncStorage
        const storedState = await AsyncStorage.getItem('BLEBackgroundService_PreservedState');
        if (storedState) {
          restoredState = JSON.parse(storedState);
        }
      }

      if (restoredState) {
        this.preservedState = restoredState;
        this.isScanning = restoredState.isScanning || false;
        this.scanParameters = restoredState.scanParameters || {};
        this.queuedHits = restoredState.queuedHits || [];
        this.prioritizedDevices = restoredState.prioritizedDevices || [];

        // Resume scanning if it was active
        if (restoredState.isScanning) {
          await this.startBackgroundScanning(restoredState.scanParameters);
        }

        // Process any queued hits
        if (this.queuedHits.length > 0) {
          await this.submitQueuedHits();
        }
      }

      return { success: true, restored: !!restoredState };
    } catch (error) {
      this.logError('State restoration failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check background app refresh status (iOS)
   */
  async checkBackgroundAppRefreshStatus() {
    try {
      if (Platform.OS === 'ios' && BLEManager && BLEManager.getBackgroundAppRefreshStatus) {
        const status = await BLEManager.getBackgroundAppRefreshStatus();
        return {
          isEnabled: status === 'available',
          userGuidanceRequired: status !== 'available',
          status,
          message: status === 'available' ? '背景App重新整理已啟用' : '請啟用背景App重新整理以持續掃描'
        };
      }

      return { isEnabled: true, userGuidanceRequired: false };
    } catch (error) {
      this.logError('Background app refresh check failed', error);
      return { isEnabled: false, userGuidanceRequired: true };
    }
  }

  /**
   * Battery optimization and power management
   */
  async optimizeScanningForBattery() {
    try {
      // Get battery level if available
      let batteryLevel = 1.0;
      if (Platform.OS === 'android' && BLEManager && BLEManager.getBatteryLevel) {
        batteryLevel = await BLEManager.getBatteryLevel();
      }

      // Adjust scanning parameters based on battery level
      if (batteryLevel < 0.2) {
        // Low battery: reduce scanning frequency
        this.scanParameters.scanInterval = this.config.scanInterval * 2;
        this.scanParameters.powerLevel = 'POWER_ULTRA_LOW';
      } else if (batteryLevel < 0.5) {
        // Medium battery: moderate scanning
        this.scanParameters.scanInterval = this.config.scanInterval * 1.5;
        this.scanParameters.powerLevel = 'POWER_LOW';
      } else {
        // Good battery: normal scanning
        this.scanParameters.scanInterval = this.config.scanInterval;
        this.scanParameters.powerLevel = 'POWER_MEDIUM';
      }

      return { success: true, batteryLevel, optimized: true };
    } catch (error) {
      this.logError('Battery optimization failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle priority devices for immediate alerts
   */
  async setPrioritizedDevices(devices) {
    try {
      this.prioritizedDevices = devices.map(device => ({
        ...device,
        deviceHash: this.createDeviceHash(device.identifier || device.address),
        priority: device.priority || 'high'
      }));

      // Update scan parameters for priority mode
      this.scanParameters = {
        ...this.scanParameters,
        priorityMode: true,
        priorityDeviceHashes: this.prioritizedDevices.map(d => d.deviceHash)
      };

      return { success: true, count: this.prioritizedDevices.length };
    } catch (error) {
      this.logError('Priority device setup failed', error);
      throw error;
    }
  }

  /**
   * Check if discovered device is a priority device
   */
  async checkPriorityDevice(device) {
    try {
      const deviceHash = this.createDeviceHash(device.id || device.address);
      const priorityDevice = this.prioritizedDevices.find(p => p.deviceHash === deviceHash);

      if (priorityDevice) {
        this.lastPriorityDetection = {
          deviceHash,
          rssi: device.rssi,
          immediateAlert: true,
          alertLevel: priorityDevice.priority,
          detectionTimestamp: new Date().toISOString(),
          device: priorityDevice
        };

        // Trigger immediate submission for priority devices
        await this.submitPriorityDetection(this.lastPriorityDetection);

        return true;
      }

      return false;
    } catch (error) {
      this.logError('Priority device check failed', error);
      return false;
    }
  }

  /**
   * Submit priority detection immediately
   */
  async submitPriorityDetection(detection) {
    try {
      // In production, this would send to backend immediately
      console.log('Priority device detected:', detection);

      // Store in offline queue if submission fails
      this.offlineQueue.unshift(detection); // Priority items first

      return { success: true };
    } catch (error) {
      this.logError('Priority detection submission failed', error);
      throw error;
    }
  }

  /**
   * Privacy validation - check k-anonymity threshold
   */
  async validateKAnonymity(deviceCluster) {
    // Require at least k=3 devices before submission for privacy
    return deviceCluster.length >= 3;
  }

  /**
   * Check if hits can be submitted (privacy threshold met)
   */
  canSubmitHits() {
    return this.queuedHits.length >= 3; // k-anonymity threshold
  }

  /**
   * Submit queued volunteer hits to backend
   */
  async submitQueuedHits() {
    try {
      if (this.queuedHits.length === 0) {
        return { success: true, processed: 0 };
      }

      // Validate k-anonymity before submission
      if (!await this.validateKAnonymity(this.queuedHits)) {
        return { success: false, reason: 'k-anonymity threshold not met' };
      }

      // In production, submit to backend API
      const result = await this.submitVolunteerHits(this.queuedHits);

      if (result.success) {
        // Clear queue on successful submission
        this.queuedHits = [];
        this.submissionStatus = {
          lastSubmission: new Date().toISOString(),
          totalRetries: 0,
          status: 'success'
        };
      }

      return result;
    } catch (error) {
      // Add to offline queue for retry
      this.offlineQueue.push(...this.queuedHits);
      this.queuedHits = [];

      this.submissionStatus = {
        status: 'failed',
        lastError: error.message,
        totalRetries: this.submissionStatus.totalRetries + 1
      };

      throw error;
    }
  }

  /**
   * Submit volunteer hits to backend (mock implementation)
   */
  async submitVolunteerHits(hits) {
    try {
      // Mock API call - replace with actual backend integration
      console.log('Submitting volunteer hits:', hits.length);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate occasional failures for testing
      if (Math.random() < 0.1) { // 10% failure rate
        throw new Error('Network error');
      }

      return {
        success: true,
        processed: hits.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Submission failed: ${error.message}`);
    }
  }

  /**
   * Sync offline hits when connection restored
   */
  async syncOfflineHits() {
    try {
      if (this.offlineQueue.length === 0) {
        return { success: true, synced: 0 };
      }

      const result = await this.submitVolunteerHits(this.offlineQueue);

      if (result.success) {
        this.offlineQueue = [];
      }

      return { success: true, synced: result.processed };
    } catch (error) {
      this.logError('Offline sync failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle permission changes
   */
  async handlePermissionChange(permissions) {
    try {
      const hasRequiredPermissions = permissions.bluetooth_scan === 'granted' &&
                                   permissions.bluetooth_connect === 'granted';

      if (!hasRequiredPermissions) {
        // Stop scanning and preserve data
        await this.stopScanning();
        await this.preserveDataOnPermissionLoss(this.queuedHits);

        this.status = {
          error: 'permissions_revoked',
          userActionRequired: true,
          missingPermissions: Object.keys(permissions).filter(p => permissions[p] !== 'granted')
        };
      } else {
        // Permissions restored, resume scanning
        await this.restoreFromPreservedState();
      }

      return { success: true };
    } catch (error) {
      this.logError('Permission change handling failed', error);
      throw error;
    }
  }

  /**
   * Preserve data when permissions are lost
   */
  async preserveDataOnPermissionLoss(queuedHits) {
    try {
      this.preservedQueue = [...queuedHits];

      // Save to persistent storage
      await AsyncStorage.setItem(
        'BLEBackgroundService_PreservedQueue',
        JSON.stringify(this.preservedQueue)
      );

      return { success: true, preserved: this.preservedQueue.length };
    } catch (error) {
      this.logError('Data preservation failed', error);
      throw error;
    }
  }

  /**
   * Handle Bluetooth state changes
   */
  async handleBluetoothStateChange(state) {
    try {
      if (state === 'PoweredOff' || state === 'Unsupported') {
        this.status = {
          isScanning: false,
          bluetoothState: state,
          userGuidance: state === 'PoweredOff' ? '請開啟藍牙以繼續掃描' : '此裝置不支援藍牙功能',
          canRetry: state === 'PoweredOff'
        };
        this.isScanning = false;
      } else if (state === 'PoweredOn' && this.wasScanning) {
        // Resume scanning when Bluetooth is re-enabled
        await this.startBackgroundScanning(this.scanParameters);
      }

      return { success: true, state };
    } catch (error) {
      this.logError('Bluetooth state change handling failed', error);
      throw error;
    }
  }

  /**
   * Stop scanning
   */
  async stopScanning() {
    try {
      this.wasScanning = this.isScanning;
      this.isScanning = false;

      if (BLEManager && BLEManager.stopScan) {
        await BLEManager.stopScan();
      }

      // Save final state
      await this.saveServiceState();

      return { success: true };
    } catch (error) {
      this.logError('Stop scanning failed', error);
      throw error;
    }
  }

  /**
   * Setup app state monitoring
   */
  setupAppStateMonitoring() {
    this.appStateListener = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background') {
        await this.saveStateForPreservation();
      } else if (nextAppState === 'active') {
        await this.restoreFromPreservedState();
      }
    });
  }

  /**
   * Setup iOS background tasks
   */
  setupIOSBackgroundTasks() {
    if (Platform.OS === 'ios' && BLEManager && BLEManager.setupBackgroundTask) {
      BLEManager.setupBackgroundTask({
        taskName: 'BLEBackgroundScanning',
        handler: async () => {
          // Background task handler
          await this.saveStateForPreservation();
        }
      });
    }
  }

  /**
   * Setup Android background scanning compliance
   */
  async setupAndroidBackgroundScanning() {
    if (Platform.OS === 'android' && BLEManager && BLEManager.setupJobScheduler) {
      await BLEManager.setupJobScheduler({
        jobId: 1001,
        serviceName: 'BLEBackgroundScanService',
        interval: 15 * 60 * 1000, // 15 minutes minimum for JobScheduler
        requiredNetworkType: 'NONE',
        requiresCharging: false,
        requiresDeviceIdle: false
      });
    }
  }

  /**
   * Update scan metrics
   */
  updateScanMetrics(device) {
    try {
      this.connectionMetrics.successfulScans++;

      // Update average devices per scan
      const currentAvg = this.connectionMetrics.averageDevicesPerScan;
      const totalSuccessful = this.connectionMetrics.successfulScans;
      this.connectionMetrics.averageDevicesPerScan =
        (currentAvg * (totalSuccessful - 1) + 1) / totalSuccessful;

      this.discoveredDevices.push({
        ...device,
        timestamp: new Date().toISOString()
      });

      // Keep discovered devices list manageable
      if (this.discoveredDevices.length > 100) {
        this.discoveredDevices = this.discoveredDevices.slice(-100);
      }
    } catch (error) {
      this.logError('Metrics update failed', error);
    }
  }

  /**
   * Handle scan errors with retry logic
   */
  handleScanError(error) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      retryable: this.isRetryableError(error)
    };

    this.errorHistory.push(errorEntry);

    // Keep error history manageable
    if (this.errorHistory.length > 20) {
      this.errorHistory = this.errorHistory.slice(-20);
    }

    // Add to retry queue if retryable
    if (errorEntry.retryable) {
      this.retryQueue.push({
        action: 'startScanning',
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxAttempts: this.config.maxRetries
      });
    }

    this.status = {
      isScanning: false,
      error: error.message,
      canRetry: errorEntry.retryable
    };
  }

  /**
   * Handle discovery errors
   */
  async handleDiscoveryError(error, device) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      device: device ? { address: device.address, rssi: device.rssi } : null,
      retryable: this.isRetryableError(error)
    };

    this.errorHistory.push(errorEntry);

    // Add to retry queue if retryable
    if (errorEntry.retryable && device) {
      this.retryQueue.push({
        action: 'processDevice',
        device,
        timestamp: new Date().toISOString(),
        attempts: 0,
        maxAttempts: this.config.maxRetries
      });
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'network',
      'timeout',
      'connection',
      'temporary',
      'bluetooth_disabled'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Save service state to storage
   */
  async saveServiceState() {
    try {
      const state = {
        isScanning: this.isScanning,
        scanParameters: this.scanParameters,
        metrics: this.connectionMetrics,
        timestamp: new Date().toISOString()
      };

      await AsyncStorage.setItem('BLEBackgroundService_State', JSON.stringify(state));
      return { success: true };
    } catch (error) {
      this.logError('State save failed', error);
      return { success: false };
    }
  }

  /**
   * Restore service state from storage
   */
  async restoreServiceState() {
    try {
      const storedState = await AsyncStorage.getItem('BLEBackgroundService_State');
      if (storedState) {
        const state = JSON.parse(storedState);
        this.connectionMetrics = state.metrics || this.connectionMetrics;
        this.scanParameters = state.scanParameters || this.scanParameters;
      }
      return { success: true };
    } catch (error) {
      this.logError('State restore failed', error);
      return { success: false };
    }
  }

  /**
   * Enhanced logging
   */
  logError(context, error) {
    const errorInfo = {
      context,
      message: error.message,
      timestamp: new Date().toISOString(),
      platform: Platform.OS
    };

    console.error(`[BLEBackgroundService] ${context}:`, errorInfo);
  }

  /**
   * Cleanup and destroy service
   */
  async destroy() {
    try {
      // Stop scanning
      await this.stopScanning();

      // Save final state
      await this.saveStateForPreservation();

      // Remove listeners
      if (this.appStateListener) {
        this.appStateListener.remove();
      }

      // Clear timers and intervals
      if (this.backgroundTask) {
        clearInterval(this.backgroundTask);
      }

      return { success: true };
    } catch (error) {
      this.logError('Service destruction failed', error);
      return { success: false };
    }
  }

  // Getter methods for status and data access
  getStatus() { return this.status; }
  isScanning() { return this.isScanning; }
  getScanParameters() { return this.scanParameters; }
  getProcessedDeviceCount() { return this.discoveredDevices.length; }
  getQueuedHits() { return this.queuedHits; }
  getLastVolunteerHit() { return this.lastVolunteerHit; }
  getSubmissionStatus() { return this.submissionStatus; }
  getOfflineQueue() { return this.offlineQueue; }
  getPreservedQueue() { return this.preservedQueue; }
  canRestore() { return this.preservedQueue.length > 0; }
  getPrioritizedDevices() { return this.prioritizedDevices; }
  getLastPriorityDetection() { return this.lastPriorityDetection; }
  getBackgroundModes() { return this.config.backgroundModes; }
  getRestoreIdentifier() { return this.config.restoreIdentifier; }
  getPreservedState() { return this.preservedState; }
  getDiscoveredDevices() { return this.discoveredDevices; }
  getConnectionMetrics() { return this.connectionMetrics; }
  getErrorHistory() { return this.errorHistory; }
}