/**
 * Device Binding API Routes - P1 Implementation
 * NCC validation and device management endpoints
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/shared');
const { DeviceBindingService } = require('../services/safety/device-binding.service');
const { ValidationError, NCCValidationError, DuplicateDeviceError, BLEConnectionError } = require('../services/safety/errors');

// Initialize service with dependencies
const deviceRepository = require('../repositories/device.repository');
const bleManager = require('../hardware/ble-manager');
const notificationService = require('../services/notification.service');

const deviceBindingService = new DeviceBindingService(
  deviceRepository,
  bleManager,
  notificationService
);

/**
 * @route POST /api/v1/devices/validate-ncc
 * @desc Validate NCC certification number
 * @access Private
 */
router.post('/validate-ncc', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { nccNumber } = req.body;
    
    if (!nccNumber) {
      return res.status(400).json({
        success: false,
        error: 'NCC number is required'
      });
    }

    const isValid = await deviceBindingService.validateNCCNumber(nccNumber);
    
    res.json({
      success: true,
      data: {
        valid: isValid,
        nccNumber,
        validatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof NCCValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: 'NCC_VALIDATION_FAILED'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'NCC validation service error'
    });
  }
});

/**
 * @route POST /api/v1/devices/register
 * @desc Register new device with NCC validation
 * @access Private
 */
router.post('/register', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { serialNumber, nccNumber, metadata } = req.body;
    const userId = req.user.id;
    
    const deviceData = {
      serialNumber,
      nccNumber,
      userId,
      metadata
    };
    
    const device = await deviceBindingService.registerDevice(deviceData);
    
    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    if (error instanceof DuplicateDeviceError) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: 'DEVICE_ALREADY_EXISTS'
      });
    }
    
    if (error instanceof NCCValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: 'NCC_VALIDATION_FAILED'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Device registration failed'
    });
  }
});

/**
 * @route POST /api/v1/devices/transfer
 * @desc Transfer device ownership
 * @access Private
 */
router.post('/transfer', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { serialNumber, toUserId, reason } = req.body;
    const fromUserId = req.user.id;
    
    const transferData = {
      serialNumber,
      fromUserId,
      toUserId,
      reason
    };
    
    const result = await deviceBindingService.transferDevice(transferData);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route POST /api/v1/devices/:deviceId/connect
 * @desc Connect to device via BLE
 * @access Private
 */
router.post('/:deviceId/connect', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { maxRetries, baseDelay } = req.body;
    
    const options = {
      maxRetries: maxRetries || 3,
      baseDelay: baseDelay || 1000
    };
    
    const connection = await deviceBindingService.connectToDevice(deviceId, options);
    
    res.json({
      success: true,
      data: connection
    });
  } catch (error) {
    if (error instanceof BLEConnectionError) {
      return res.status(503).json({
        success: false,
        error: error.message,
        code: 'BLE_CONNECTION_FAILED'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Connection failed'
    });
  }
});

/**
 * @route GET /api/v1/devices/:deviceId/metrics
 * @desc Get device performance metrics
 * @access Private
 */
router.get('/:deviceId/metrics', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const metrics = await deviceBindingService.getDeviceMetrics(deviceId);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/devices/:deviceId/health
 * @desc Monitor device connection health
 * @access Private
 */
router.get('/:deviceId/health', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const health = await deviceBindingService.monitorConnectionHealth(deviceId);
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route PUT /api/v1/devices/:deviceId/status
 * @desc Update device status
 * @access Private
 */
router.put('/:deviceId/status', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status } = req.body;
    
    const result = await deviceBindingService.updateDeviceStatus(deviceId, status);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route GET /api/v1/devices/regulatory-info
 * @desc Get regulatory compliance information
 * @access Public
 */
router.get('/regulatory-info', async (req, res) => {
  try {
    const info = await deviceBindingService.getRegulatoryInfo();
    
    res.json({
      success: true,
      data: info
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve regulatory information'
    });
  }
});

/**
 * @route POST /api/v1/devices/consent
 * @desc Record user consent for device registration
 * @access Private
 */
router.post('/consent', authMiddleware.authenticate(), async (req, res) => {
  try {
    const { consentGiven, consentType } = req.body;
    const userId = req.user.id;
    
    const consentData = {
      userId,
      consentGiven,
      consentType: consentType || 'device_registration'
    };
    
    const result = await deviceBindingService.recordUserConsent(consentData);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;