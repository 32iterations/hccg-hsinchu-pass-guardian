const express = require("express");
const router = express.Router();
const { AuthMiddleware } = require("../middleware/auth");
const { ValidationMiddleware } = require("../middleware/validation");

const authMiddleware = new AuthMiddleware();
const validationMiddleware = new ValidationMiddleware();

// Mock Device Binding Service
const mockDeviceBindingService = {
  async bindDevice(deviceData) {
    return {
      bindingId: "binding_" + Date.now(),
      deviceId: deviceData.deviceId,
      serialNumber: deviceData.serialNumber,
      userId: deviceData.userId,
      bindingTime: new Date().toISOString(),
      status: "active"
    };
  },

  async unbindDevice(deviceId) {
    return {
      success: true,
      deviceId,
      unbindingTime: new Date().toISOString()
    };
  },

  async getDeviceBinding(deviceId) {
    return {
      deviceId,
      serialNumber: "SN123456789",
      userId: "user123",
      bindingTime: new Date().toISOString(),
      status: "active",
      manufacturer: "Test Manufacturer",
      model: "Test Model"
    };
  },

  async getUserDevices(userId) {
    return {
      devices: [
        {
          deviceId: "device123",
          serialNumber: "SN123456789",
          bindingTime: new Date().toISOString(),
          status: "active"
        }
      ],
      total: 1
    };
  }
};

// Bind device to user
router.post("/bind",
  authMiddleware.authenticate(),
  validationMiddleware.validate({
    deviceId: { required: true, type: "string", min: 1, max: 100 },
    serialNumber: { required: true, type: "string", min: 1, max: 50 },
    manufacturer: { required: false, type: "string", max: 100 },
    model: { required: false, type: "string", max: 100 }
  }),
  async (req, res) => {
    try {
      const deviceData = {
        ...req.body,
        userId: req.user.userId
      };
      
      const result = await mockDeviceBindingService.bindDevice(deviceData);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: error.message
      });
    }
  }
);

// Unbind device
router.post("/unbind/:deviceId",
  authMiddleware.authenticate(),
  async (req, res) => {
    try {
      const result = await mockDeviceBindingService.unbindDevice(req.params.deviceId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: error.message
      });
    }
  }
);

// Get device binding info
router.get("/:deviceId",
  authMiddleware.authenticate(),
  async (req, res) => {
    try {
      const result = await mockDeviceBindingService.getDeviceBinding(req.params.deviceId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Device binding not found"
      });
    }
  }
);

// Get user devices
router.get("/user/:userId",
  authMiddleware.authenticate(),
  async (req, res) => {
    try {
      const result = await mockDeviceBindingService.getUserDevices(req.params.userId);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: error.message
      });
    }
  }
);

module.exports = router;
