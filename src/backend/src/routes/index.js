const express = require('express');

// Import route modules
const rbacRoutes = require('./rbac');
const casesRoutes = require('./cases');
const mydataRoutes = require('./mydata');
const kpiRoutes = require('./kpi');

const router = express.Router();

// API version prefix
const API_VERSION = '/api/v1';

// Mount route modules
router.use(`${API_VERSION}/rbac`, rbacRoutes);
router.use(`${API_VERSION}/cases`, casesRoutes);
router.use(`${API_VERSION}/mydata`, mydataRoutes);
router.use(`${API_VERSION}/kpi`, kpiRoutes);

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
        kpi: `${API_VERSION}/kpi`
      }
    }
  });
});

// Test endpoints for middleware testing
router.get(`${API_VERSION}/test/error`, (req, res, next) => {
  throw new Error('Test error for middleware testing');
});

router.get(`${API_VERSION}/test/database-error`, (req, res, next) => {
  const error = new Error('Database connection failed');
  error.name = 'DatabaseError';
  throw error;
});

module.exports = router;