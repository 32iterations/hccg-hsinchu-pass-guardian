const express = require('express');
const { authMiddleware } = require('../middleware/shared');
const { getServices } = require('../services');

const router = express.Router();
const services = getServices();
const { rbacService, auditService } = services;

// Import enhanced KPI service
const { EnhancedKPIService } = require('../../services/KPIService-enhanced');
const kpiService = new EnhancedKPIService({
  auditService,
  rbacService,
  aggregationOnly: true,
  drillDownDisabled: true
});

// Apply authentication to all KPI routes
router.use(authMiddleware.authenticate());

// GET /api/v1/kpi/dashboard - Get dashboard KPIs (aggregated only)
router.get('/dashboard',
  async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      const { period, department, includeBreakdowns } = req.query;

      // Check KPI access permissions
      const canViewKPIs = await rbacService.hasPermission(userId, 'view_kpis');
      if (!canViewKPIs) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Insufficient permissions to view KPIs'
        });
      }

      const kpiData = await kpiService.getDashboardKPIs(userId, {
        period: period || '30_days',
        department: department || 'all',
        includeBreakdowns: includeBreakdowns === 'true'
      });

      res.json({
        success: true,
        data: kpiData.data,
        meta: kpiData.meta
      });
    } catch (error) {
      console.error('KPI dashboard error:', error);
      next(error);
    }
  }
);

// GET /api/v1/kpi/detailed - Get detailed KPIs (restricted access)
router.get('/detailed',
  async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      const userRoles = req.user?.roles || [];
      const options = req.query;

      // Only 承辦人員 can access detailed KPIs
      const authorizedRoles = ['case_worker', 'case_manager', 'admin'];
      const isAuthorized = userRoles.some(role => authorizedRoles.includes(role));

      if (!isAuthorized) {
        // Log unauthorized access attempt
        await auditService?.logSecurityEvent({
          type: 'kpi_drill_down_denied',
          userId,
          operation: 'kpi_drill_down_attempt',
          result: 'access_denied',
          securityFlag: 'unauthorized_detail_access_attempt',
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          success: false,
          error: 'kpi_drill_down_denied',
          message: '無權限存取個案層級KPI資料',
          allowedLevel: 'aggregated_only',
          userRole: userRoles[0]
        });
      }

      // Prevent drill-down to individual cases
      if (options.includeIndividualCases === 'true' ||
          options.showPersonalData === 'true' ||
          options.drillDown === 'case_level') {

        await auditService?.logSecurityEvent({
          type: 'kpi_drill_down_denied',
          userId,
          operation: 'kpi_drill_down_attempt',
          result: 'access_denied',
          securityFlag: 'drill_down_attempted',
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          success: false,
          error: 'kpi_drill_down_denied',
          message: '無權限存取個案層級KPI資料',
          allowedLevel: 'aggregated_only',
          userRole: userRoles[0]
        });
      }

      const detailedKPIs = await kpiService.getDetailedKPIs(userId, options);

      res.json({
        success: true,
        data: detailedKPIs.aggregatedMetrics,
        meta: detailedKPIs.meta
      });
    } catch (error) {
      if (error.message.includes('Insufficient permissions') ||
          error.message.includes('not permitted')) {
        return res.status(403).json({
          success: false,
          error: 'kpi_drill_down_denied',
          message: '無權限存取個案層級KPI資料',
          allowedLevel: 'aggregated_only',
          userRole: req.user?.roles?.[0]
        });
      }
      console.error('Detailed KPI error:', error);
      next(error);
    }
  }
);

// GET /api/v1/kpi/role-specific - Get role-specific KPIs
router.get('/role-specific',
  async (req, res, next) => {
    try {
      const userId = req.user?.userId;

      const roleKPIs = await kpiService.getRoleSpecificKPIs(userId);

      res.json({
        success: true,
        data: roleKPIs.data,
        meta: roleKPIs.meta
      });
    } catch (error) {
      console.error('Role-specific KPI error:', error);
      next(error);
    }
  }
);

// GET /api/v1/kpi/temporal - Get temporal KPI data (anonymized)
router.get('/temporal',
  async (req, res, next) => {
    try {
      const userId = req.user?.userId;
      const { period, granularity, anonymized } = req.query;

      const temporalKPIs = await kpiService.getTemporalKPIs(userId, {
        period: period || '90_days',
        granularity: granularity || 'weekly',
        anonymized: anonymized !== 'false'
      });

      res.json({
        success: true,
        data: temporalKPIs.data,
        meta: temporalKPIs.meta
      });
    } catch (error) {
      console.error('Temporal KPI error:', error);
      next(error);
    }
  }
);

module.exports = router;