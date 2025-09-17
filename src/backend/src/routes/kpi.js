const express = require('express');
const { AuthMiddleware, ValidationMiddleware, schemas } = require('../middleware');
const KPIService = require('../../services/KPIService');

const router = express.Router();
const authMiddleware = new AuthMiddleware();
const validationMiddleware = new ValidationMiddleware();
const kpiService = new KPIService({
  storage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {}
  },
  database: null,
  auditService: null,
  rbacService: null
});

// Apply authentication to all KPI routes
router.use(authMiddleware.authenticate());

// GET /api/v1/kpi/dashboard - Get dashboard metrics
router.get('/dashboard',
  authMiddleware.requirePermissions(['view_dashboard']),
  async (req, res, next) => {
    try {
      const { startDate, endDate, useCache } = req.query;

      const dashboardData = await kpiService.getDashboardMetrics({
        startDate,
        endDate,
        useCache: useCache === 'true'
      });

      // Set cache headers if data is cached
      if (dashboardData.cached) {
        res.set('X-Cache-Status', 'HIT');
      } else {
        res.set('X-Cache-Status', 'MISS');
      }

      res.json({
        success: true,
        data: {
          summary: dashboardData.summary,
          performance: dashboardData.performance,
          trends: dashboardData.trends,
          alerts: dashboardData.alerts,
          lastUpdated: dashboardData.lastUpdated
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/kpi/metrics/:type - Get specific metric type
router.get('/metrics/:type',
  authMiddleware.requirePermissions(['view_metrics']),
  async (req, res, next) => {
    try {
      const metricType = req.params.type;
      const { startDate, endDate, granularity, aggregation, region } = req.query;

      // Validate metric type
      const validMetricTypes = ['cases', 'volunteers', 'system', 'compliance'];
      if (!validMetricTypes.includes(metricType)) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: `Invalid metric type. Must be one of: ${validMetricTypes.join(', ')}`
        });
      }

      const metricsData = await kpiService.getMetricsByType(metricType, {
        startDate,
        endDate,
        granularity,
        aggregation,
        region
      });

      res.json({
        success: true,
        data: {
          metricType,
          timeframe: metricsData.timeframe,
          metrics: metricsData.metrics,
          trends: metricsData.trends,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/kpi/reports/compliance - Generate compliance report
router.get('/reports/compliance',
  authMiddleware.requirePermissions(['view_compliance_reports']),
  async (req, res, next) => {
    try {
      const { format, period, year, month, includeRegulatory } = req.query;

      const reportData = await kpiService.generateComplianceReport({
        format,
        period,
        year: year ? parseInt(year) : undefined,
        month: month ? parseInt(month) : undefined,
        includeRegulatory: includeRegulatory === 'true'
      });

      res.json({
        success: true,
        data: {
          reportId: reportData.reportId,
          generatedAt: reportData.generatedAt,
          period: reportData.period,
          compliance: {
            overall: reportData.compliance.overall,
            dataProtection: reportData.compliance.dataProtection,
            consentManagement: reportData.compliance.consentManagement,
            auditTrail: reportData.compliance.auditTrail,
            retention: reportData.compliance.retention,
            ...(includeRegulatory === 'true' && {
              gdpr: reportData.compliance.gdpr,
              personalDataProtection: reportData.compliance.personalDataProtection
            })
          },
          recommendations: reportData.recommendations,
          actionItems: reportData.actionItems
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/kpi/alerts - Get active system alerts
router.get('/alerts',
  authMiddleware.requirePermissions(['view_alerts']),
  async (req, res, next) => {
    try {
      const { severity, type } = req.query;

      const alertsData = await kpiService.getActiveAlerts({
        severity,
        type
      });

      res.json({
        success: true,
        data: {
          alerts: alertsData.alerts,
          summary: alertsData.summary
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/kpi/reports/generate - Generate custom reports
router.post('/reports/generate',
  authMiddleware.requirePermissions(['generate_reports']),
  async (req, res, next) => {
    try {
      const reportRequest = req.body;

      // Validate required fields
      if (!reportRequest.type || !reportRequest.period) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Report type and period are required'
        });
      }

      const job = await kpiService.generateCustomReport(reportRequest);

      res.status(202).json({
        success: true,
        message: 'Report generation initiated',
        data: {
          jobId: job.jobId,
          estimatedCompletion: job.estimatedCompletion,
          status: 'processing'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Test endpoint for user info (for middleware testing)
router.get('/test/user-info',
  async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: {
          userId: req.user.userId,
          roles: req.user.roles,
          permissions: req.user.permissions
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;