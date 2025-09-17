const request = require('supertest');
const app = require('../../src/app');

describe('KPI API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/kpi/dashboard', () => {
    it('should return comprehensive dashboard metrics', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/dashboard')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          summary: expect.objectContaining({
            totalCases: expect.any(Number),
            activeCases: expect.any(Number),
            resolvedCases: expect.any(Number),
            averageResolutionTime: expect.any(Number),
            successRate: expect.any(Number)
          }),
          performance: expect.objectContaining({
            responseTime: expect.objectContaining({
              average: expect.any(Number),
              p95: expect.any(Number),
              p99: expect.any(Number)
            }),
            volunteerUtilization: expect.any(Number),
            systemUptime: expect.any(Number)
          }),
          trends: expect.objectContaining({
            caseVolume: expect.any(Array),
            resolutionTrends: expect.any(Array),
            geographicDistribution: expect.any(Array)
          }),
          alerts: expect.any(Array),
          lastUpdated: expect.any(String)
        }
      });
    });

    it('should support time range filtering', async () => {
      await request(app)
        .get('/api/v1/kpi/dashboard')
        .set('Authorization', 'Bearer admin-token')
        .query({
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        })
        .expect(200);
    });

    it('should require admin permissions', async () => {
      await request(app)
        .get('/api/v1/kpi/dashboard')
        .set('Authorization', 'Bearer user-token')
        .expect(403);
    });

    it('should return cached data when available', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/dashboard')
        .set('Authorization', 'Bearer admin-token')
        .query({ useCache: true })
        .expect(200);

      expect(response.headers).toHaveProperty('x-cache-status');
    });
  });

  describe('GET /api/v1/kpi/metrics/:type', () => {
    it('should return case management metrics', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/metrics/cases')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          metricType: 'cases',
          timeframe: expect.any(String),
          metrics: expect.objectContaining({
            totalCases: expect.any(Number),
            newCases: expect.any(Number),
            closedCases: expect.any(Number),
            averageResolutionTime: expect.any(Number),
            casesByPriority: expect.any(Object),
            casesByStatus: expect.any(Object),
            casesByRegion: expect.any(Object)
          }),
          trends: expect.any(Array),
          generatedAt: expect.any(String)
        }
      });
    });

    it('should return volunteer performance metrics', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/metrics/volunteers')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.data.metrics).toEqual(
        expect.objectContaining({
          totalVolunteers: expect.any(Number),
          activeVolunteers: expect.any(Number),
          averageResponseTime: expect.any(Number),
          completionRate: expect.any(Number),
          volunteerRatings: expect.any(Object),
          geographicCoverage: expect.any(Array)
        })
      );
    });

    it('should return system performance metrics', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/metrics/system')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.data.metrics).toEqual(
        expect.objectContaining({
          uptime: expect.any(Number),
          apiResponseTimes: expect.any(Object),
          errorRates: expect.any(Object),
          throughput: expect.any(Number),
          concurrentUsers: expect.any(Number),
          resourceUtilization: expect.any(Object)
        })
      );
    });

    it('should return compliance metrics', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/metrics/compliance')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.data.metrics).toEqual(
        expect.objectContaining({
          dataRetentionCompliance: expect.any(Number),
          consentCompliance: expect.any(Number),
          auditTrailIntegrity: expect.any(Number),
          privacyPolicyCompliance: expect.any(Number),
          securityIncidents: expect.any(Number)
        })
      );
    });

    it('should validate metric type parameter', async () => {
      await request(app)
        .get('/api/v1/kpi/metrics/invalid-type')
        .set('Authorization', 'Bearer admin-token')
        .expect(400);
    });

    it('should support custom date ranges', async () => {
      await request(app)
        .get('/api/v1/kpi/metrics/cases')
        .set('Authorization', 'Bearer admin-token')
        .query({
          startDate: '2023-01-01',
          endDate: '2023-01-31',
          granularity: 'daily'
        })
        .expect(200);
    });

    it('should support different aggregation levels', async () => {
      await request(app)
        .get('/api/v1/kpi/metrics/cases')
        .set('Authorization', 'Bearer admin-token')
        .query({
          aggregation: 'weekly',
          region: '新竹市東區'
        })
        .expect(200);
    });
  });

  describe('GET /api/v1/kpi/reports/compliance', () => {
    it('should generate comprehensive compliance report', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/reports/compliance')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          reportId: expect.any(String),
          generatedAt: expect.any(String),
          period: expect.any(Object),
          compliance: expect.objectContaining({
            overall: expect.any(Number),
            dataProtection: expect.objectContaining({
              score: expect.any(Number),
              details: expect.any(Array)
            }),
            consentManagement: expect.objectContaining({
              score: expect.any(Number),
              activeConsents: expect.any(Number),
              revokedConsents: expect.any(Number),
              expiredConsents: expect.any(Number)
            }),
            auditTrail: expect.objectContaining({
              score: expect.any(Number),
              completeness: expect.any(Number),
              integrity: expect.any(Number)
            }),
            retention: expect.objectContaining({
              score: expect.any(Number),
              scheduledDeletions: expect.any(Number),
              completedDeletions: expect.any(Number)
            })
          }),
          recommendations: expect.any(Array),
          actionItems: expect.any(Array)
        }
      });
    });

    it('should support different report formats', async () => {
      await request(app)
        .get('/api/v1/kpi/reports/compliance')
        .set('Authorization', 'Bearer admin-token')
        .query({ format: 'pdf' })
        .expect(200);
    });

    it('should generate monthly compliance reports', async () => {
      await request(app)
        .get('/api/v1/kpi/reports/compliance')
        .set('Authorization', 'Bearer admin-token')
        .query({
          period: 'monthly',
          year: 2023,
          month: 10
        })
        .expect(200);
    });

    it('should include regulatory compliance details', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/reports/compliance')
        .set('Authorization', 'Bearer admin-token')
        .query({ includeRegulatory: true })
        .expect(200);

      expect(response.body.data.compliance).toHaveProperty('gdpr');
      expect(response.body.data.compliance).toHaveProperty('personalDataProtection');
    });

    it('should require appropriate permissions for compliance reports', async () => {
      await request(app)
        .get('/api/v1/kpi/reports/compliance')
        .set('Authorization', 'Bearer user-token')
        .expect(403);
    });
  });

  describe('GET /api/v1/kpi/alerts', () => {
    it('should return active system alerts', async () => {
      const response = await request(app)
        .get('/api/v1/kpi/alerts')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          alerts: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              type: expect.any(String),
              severity: expect.oneOf(['low', 'medium', 'high', 'critical']),
              message: expect.any(String),
              timestamp: expect.any(String),
              acknowledged: expect.any(Boolean),
              metadata: expect.any(Object)
            })
          ]),
          summary: expect.objectContaining({
            total: expect.any(Number),
            critical: expect.any(Number),
            high: expect.any(Number),
            medium: expect.any(Number),
            low: expect.any(Number)
          })
        }
      });
    });

    it('should filter alerts by severity', async () => {
      await request(app)
        .get('/api/v1/kpi/alerts')
        .set('Authorization', 'Bearer admin-token')
        .query({ severity: 'critical' })
        .expect(200);
    });

    it('should filter alerts by type', async () => {
      await request(app)
        .get('/api/v1/kpi/alerts')
        .set('Authorization', 'Bearer admin-token')
        .query({ type: 'performance' })
        .expect(200);
    });
  });

  describe('POST /api/v1/kpi/reports/generate', () => {
    const reportRequest = {
      type: 'monthly_summary',
      period: {
        start: '2023-10-01',
        end: '2023-10-31'
      },
      sections: ['cases', 'volunteers', 'compliance'],
      format: 'pdf',
      recipients: ['admin@hsinchu.gov.tw']
    };

    it('should generate custom reports', async () => {
      const response = await request(app)
        .post('/api/v1/kpi/reports/generate')
        .set('Authorization', 'Bearer admin-token')
        .send(reportRequest)
        .expect(202);

      expect(response.body).toEqual({
        success: true,
        message: 'Report generation initiated',
        data: {
          jobId: expect.any(String),
          estimatedCompletion: expect.any(String),
          status: 'processing'
        }
      });
    });

    it('should validate report parameters', async () => {
      await request(app)
        .post('/api/v1/kpi/reports/generate')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(400);
    });

    it('should require admin permissions for report generation', async () => {
      await request(app)
        .post('/api/v1/kpi/reports/generate')
        .set('Authorization', 'Bearer user-token')
        .send(reportRequest)
        .expect(403);
    });
  });
});