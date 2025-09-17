const express = require('express');
const { authMiddleware } = require('../middleware/shared');

// Import route modules
const rbacRoutes = require('./rbac');
const casesRoutes = require('./cases');
const mydataRoutes = require('./mydata');
const kpiRoutes = require('./kpi');
const deviceBindingRoutes = require('./device-binding');
const bleScannerRoutes = require('./ble-scanner');
// const mydataEnhancedRoutes = require('./mydata-enhanced'); // Commented out until file exists

const router = express.Router();

// API version prefix
const API_VERSION = '/api/v1';

// Mount route modules
router.use(`${API_VERSION}/rbac`, rbacRoutes);
router.use(`${API_VERSION}/cases`, casesRoutes);
router.use(`${API_VERSION}/mydata`, mydataRoutes);
router.use(`${API_VERSION}/kpi`, kpiRoutes);
router.use(`${API_VERSION}/devices`, deviceBindingRoutes);
router.use(`${API_VERSION}/ble`, bleScannerRoutes);
// router.use(`${API_VERSION}/mydata-enhanced`, mydataEnhancedRoutes); // Commented out until file exists

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API info endpoint
router.get(`${API_VERSION}/info`, (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Hsinchu Pass Safety Guardian API',
      version: process.env.npm_package_version || '1.0.0',
      description: 'REST API for safety guardian system',
      endpoints: {
        rbac: `${API_VERSION}/rbac`,
        cases: `${API_VERSION}/cases`,
        mydata: `${API_VERSION}/mydata`,
        kpi: `${API_VERSION}/kpi`,
        devices: `${API_VERSION}/devices`,
        ble: `${API_VERSION}/ble`,
        mydataEnhanced: `${API_VERSION}/mydata-enhanced`
      }
    }
  });
});

// Test endpoints for middleware testing
router.get(`${API_VERSION}/test/user-info`,
  authMiddleware.authenticate(),
  (req, res, next) => {
  // This endpoint should be protected and return user info
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  res.json({
    success: true,
    data: {
      userId: req.user.userId,
      roles: req.user.roles,
      permissions: req.user.permissions
    }
  });
});

router.get(`${API_VERSION}/test/error`, (req, res, next) => {
  const error = new Error('Test error for middleware testing');
  error.requestId = req.requestId;
  throw error;
});

router.get(`${API_VERSION}/test/database-error`, (req, res, next) => {
  const error = new Error('Database connection failed');
  error.name = 'DatabaseError';
  error.requestId = req.requestId;
  throw error;
});

module.exports = router;