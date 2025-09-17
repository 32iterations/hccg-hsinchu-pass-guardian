/**
 * BLE Scanner API Routes - P2 Implementation
 * Bluetooth Low Energy scanning with anonymization
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const BLEScannerService = require('../services/ble-scanner.service');
const AnonymizationService = require('../services/anonymization.service');

// Initialize services with dependencies
const bleAdapter = require('../hardware/ble-manager');
const permissions = require('../utils/permissions');
const batteryOptimization = require('../utils/battery-optimization');
const anonymizationService = new AnonymizationService();

const bleScannerService = new BLEScannerService({
  bleAdapter,
  permissions,
  batteryOptimization,
  anonymizationService
});

/**
 * @route POST /api/v1/ble/initialize-android
 * @desc Initialize Android BLE scanning with permissions
 * @access Private
 */
router.post('/initialize-android', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { enableLocationInference } = req.body;
    
    const result = await bleScannerService.initializeAndroidScanning({
      enableLocationInference: enableLocationInference || false
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'ANDROID_INIT_FAILED'
    });
  }
});

/**
 * @route POST /api/v1/ble/initialize-ios
 * @desc Initialize iOS BLE scanning with state preservation
 * @access Private
 */
router.post('/initialize-ios', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { centralManager } = req.body;
    
    const result = await bleScannerService.initializeIOSScanning(centralManager);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: 'IOS_INIT_FAILED'
    });
  }
});

/**
 * @route POST /api/v1/ble/start-scanning
 * @desc Start BLE scanning with specified configuration
 * @access Private
 */
router.post('/start-scanning', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { neverForLocation, enableLocationInference, currentLocation } = req.body;
    
    const options = {
      neverForLocation: neverForLocation || false,
      enableLocationInference: enableLocationInference || false,
      currentLocation
    };
    
    const result = await bleScannerService.startScanning(options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: error.message,
      code: 'SCANNING_START_FAILED'
    });
  }
});

/**
 * @route POST /api/v1/ble/stop-scanning
 * @desc Stop BLE scanning
 * @access Private
 */
router.post('/stop-scanning', authMiddleware.authenticate(), async (req, res) => {
  try {
    const result = await bleScannerService.stopScanning();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SCANNING_STOP_FAILED'
    });
  }
});

/**
 * @route GET /api/v1/ble/status
 * @desc Get current BLE scanner status
 * @access Private
 */
router.get('/status', authMiddleware.authenticate(), async (req, res) => {
  try {
    const status = bleScannerService.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/configure-battery
 * @desc Configure scanning based on battery status
 * @access Private
 */
router.post('/configure-battery', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { batteryStatus } = req.body;
    
    if (!batteryStatus) {
      return res.status(400).json({
        success: false,
        error: 'Battery status is required'
      });
    }
    
    const parameters = await bleScannerService.configureScanningForBattery(batteryStatus);
    
    res.json({
      success: true,
      data: parameters
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/adapt-detection-rate
 * @desc Adapt scanning intervals based on detection rate
 * @access Private
 */
router.post('/adapt-detection-rate', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { detectionRate } = req.body;
    
    if (typeof detectionRate !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Detection rate must be a number'
      });
    }
    
    const parameters = await bleScannerService.adaptScanningToDetectionRate(detectionRate);
    
    res.json({
      success: true,
      data: parameters
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/create-volunteer-hit
 * @desc Create anonymized volunteer hit from discovered device
 * @access Private
 */
router.post('/create-volunteer-hit', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { device, location } = req.body;
    
    if (!device || !device.address) {
      return res.status(400).json({
        success: false,
        error: 'Device with address is required'
      });
    }
    
    const hit = await bleScannerService.createVolunteerHit(device, location);
    
    res.json({
      success: true,
      data: hit
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/batch-process-locations
 * @desc Batch process multiple locations for efficiency
 * @access Private
 */
router.post('/batch-process-locations', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { locations } = req.body;
    
    if (!Array.isArray(locations)) {
      return res.status(400).json({
        success: false,
        error: 'Locations must be an array'
      });
    }
    
    const processed = await bleScannerService.batchProcessLocations(locations);
    
    res.json({
      success: true,
      data: processed
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/handle-bluetooth-state-change
 * @desc Handle Bluetooth state changes
 * @access Private
 */
router.post('/handle-bluetooth-state-change', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { state } = req.body;
    
    if (!state) {
      return res.status(400).json({
        success: false,
        error: 'Bluetooth state is required'
      });
    }
    
    await bleScannerService.handleBluetoothStateChange(state);
    
    res.json({
      success: true,
      data: {
        state,
        handled: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/handle-permission-revocation
 * @desc Handle permission revocation
 * @access Private
 */
router.post('/handle-permission-revocation', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { revokedPermissions } = req.body;
    
    if (!Array.isArray(revokedPermissions)) {
      return res.status(400).json({
        success: false,
        error: 'Revoked permissions must be an array'
      });
    }
    
    const status = await bleScannerService.handlePermissionRevocation(revokedPermissions);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/handle-permission-restored
 * @desc Handle permission restoration
 * @access Private
 */
router.post('/handle-permission-restored', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { preservedState } = req.body;
    
    const result = await bleScannerService.handlePermissionRestored(preservedState);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/save-state
 * @desc Save scanning state for iOS preservation
 * @access Private
 */
router.post('/save-state', authMiddleware.authenticate(), async (req, res) => {
  try {
    const state = await bleScannerService.saveStateForPreservation();
    
    res.json({
      success: true,
      data: state
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/restore-state
 * @desc Restore state from iOS preservation
 * @access Private
 */
router.post('/restore-state', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { restoredState } = req.body;
    
    const result = await bleScannerService.restoreStateFromPreservation(restoredState);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/ble/handle-ios-background-restore
 * @desc Handle iOS background restore
 * @access Private
 */
router.post('/handle-ios-background-restore', authMiddleware.authenticate(), async (req, res) => {
  try {
    const result = await bleScannerService.handleIOSBackgroundRestore();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;