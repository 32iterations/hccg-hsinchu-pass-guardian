const RetentionService = require('../../src/services/retention.service');
const cron = require('node-cron');

jest.mock('node-cron');

describe('RetentionService', () => {
  let retentionService;
  let mockLogger;
  let mockDatabase;
  let mockAuditService;
  let mockMyDataAdapter;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockDatabase = {
      query: jest.fn(),
      transaction: jest.fn(),
      delete: jest.fn(),
      update: jest.fn()
    };

    mockAuditService = {
      logRetention: jest.fn(),
      logDeletion: jest.fn(),
      generateReport: jest.fn()
    };

    mockMyDataAdapter = {
      cleanupExpiredData: jest.fn(),
      revokeConsentCascade: jest.fn()
    };

    retentionService = new RetentionService({
      logger: mockLogger,
      database: mockDatabase,
      auditService: mockAuditService,
      myDataAdapter: mockMyDataAdapter,
      defaultRetentionDays: 7,
      emergencyRetentionMinutes: 30
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('TTL-based Data Retention', () => {
    test('should set appropriate TTL based on data purpose', async () => {
      const testCases = [
        { purpose: 'emergency_location', expectedTTL: 30 * 60 }, // 30 minutes
        { purpose: 'medical_info', expectedTTL: 24 * 60 * 60 }, // 24 hours
        { purpose: 'general_info', expectedTTL: 7 * 24 * 60 * 60 }, // 7 days
        { purpose: 'consent_record', expectedTTL: 30 * 24 * 60 * 60 } // 30 days
      ];

      for (const { purpose, expectedTTL } of testCases) {
        const ttl = await retentionService.calculateTTL({
          dataType: 'personal_info',
          purpose,
          hasConsent: true
        });

        expect(ttl).toBe(expectedTTL);
      }
    });

    test('should apply minimum retention for regulatory compliance', async () => {
      const ttl = await retentionService.calculateTTL({
        dataType: 'audit_log',
        purpose: 'compliance',
        regulatoryRequirement: true
      });

      expect(ttl).toBeGreaterThanOrEqual(90 * 24 * 60 * 60); // 90 days minimum
    });

    test('should reduce TTL for sensitive data without explicit consent', async () => {
      const ttlWithConsent = await retentionService.calculateTTL({
        dataType: 'medical_records',
        purpose: 'treatment',
        hasConsent: true
      });

      const ttlWithoutConsent = await retentionService.calculateTTL({
        dataType: 'medical_records',
        purpose: 'treatment',
        hasConsent: false
      });

      expect(ttlWithoutConsent).toBeLessThan(ttlWithConsent);
      expect(ttlWithoutConsent).toBeLessThanOrEqual(60 * 60); // 1 hour max
    });
  });

  describe('Automated Cleanup Jobs', () => {
    test('should schedule daily cleanup cron job', () => {
      retentionService.initializeCleanupJobs();

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 2 * * *', // 2 AM daily
        expect.any(Function),
        expect.objectContaining({
          timezone: 'Asia/Taipei'
        })
      );
    });

    test('should cleanup expired personal data', async () => {
      const expiredRecords = [
        { id: 'REC001', type: 'personal_info', expiresAt: new Date('2024-01-01') },
        { id: 'REC002', type: 'location_data', expiresAt: new Date('2024-01-02') },
        { id: 'REC003', type: 'medical_info', expiresAt: new Date('2024-01-03') }
      ];

      mockDatabase.query.mockResolvedValue({ rows: expiredRecords });
      mockDatabase.transaction.mockImplementation(async (callback) => {
        return callback({
          delete: mockDatabase.delete,
          update: mockDatabase.update
        });
      });

      await retentionService.performCleanup();

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM data_records WHERE expiresAt <'),
        expect.any(Array)
      );
      expect(mockDatabase.delete).toHaveBeenCalledTimes(expiredRecords.length);
      expect(mockAuditService.logDeletion).toHaveBeenCalledTimes(expiredRecords.length);
    });

    test('should handle cleanup failures gracefully', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database error'));

      await retentionService.performCleanup();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed'),
        expect.any(Error)
      );
      expect(mockAuditService.logDeletion).not.toHaveBeenCalled();
    });

    test('should cleanup orphaned consent records', async () => {
      const orphanedConsents = [
        { consentId: 'CON001', patientId: null },
        { consentId: 'CON002', familyId: null }
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] }) // No expired records
        .mockResolvedValueOnce({ rows: orphanedConsents }); // Orphaned consents

      await retentionService.performCleanup();

      expect(mockDatabase.delete).toHaveBeenCalledWith(
        'consents',
        expect.objectContaining({ consentId: 'CON001' })
      );
      expect(mockDatabase.delete).toHaveBeenCalledWith(
        'consents',
        expect.objectContaining({ consentId: 'CON002' })
      );
    });
  });

  describe('Immediate Revocation', () => {
    test('should immediately delete all data on revocation request', async () => {
      const patientId = 'PAT001';
      const affectedTables = [
        'personal_info',
        'location_history',
        'medical_records',
        'consent_records',
        'device_bindings'
      ];

      mockDatabase.transaction.mockImplementation(async (callback) => {
        const tx = { delete: jest.fn(), update: jest.fn() };
        await callback(tx);
        return { deletedCount: 15 };
      });

      const result = await retentionService.processRevocation({
        patientId,
        requesterId: 'FAM001',
        reason: 'user_requested',
        cascadeDelete: true
      });

      expect(result.success).toBe(true);
      expect(result.deletedRecords).toBe(15);
      expect(mockAuditService.logDeletion).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId,
          reason: 'user_requested',
          type: 'immediate_revocation'
        })
      );
    });

    test('should generate deletion certificate', async () => {
      mockDatabase.transaction.mockResolvedValue({ deletedCount: 10 });

      const result = await retentionService.processRevocation({
        patientId: 'PAT001',
        generateCertificate: true
      });

      expect(result.certificate).toBeDefined();
      expect(result.certificate).toMatchObject({
        certificateId: expect.any(String),
        timestamp: expect.any(Date),
        patientId: 'PAT001',
        deletedCount: 10,
        hash: expect.any(String),
        signature: expect.any(String)
      });
    });

    test('should notify related services of revocation', async () => {
      const notificationHandlers = [
        jest.fn(),
        jest.fn(),
        jest.fn()
      ];

      retentionService.registerRevocationHandler(notificationHandlers[0]);
      retentionService.registerRevocationHandler(notificationHandlers[1]);
      retentionService.registerRevocationHandler(notificationHandlers[2]);

      await retentionService.processRevocation({
        patientId: 'PAT001',
        notifyServices: true
      });

      notificationHandlers.forEach(handler => {
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            patientId: 'PAT001',
            timestamp: expect.any(Date)
          })
        );
      });
    });

    test('should validate revocation request authorization', async () => {
      await expect(
        retentionService.processRevocation({
          patientId: 'PAT001',
          requesterId: 'UNAUTHORIZED',
          requireAuthorization: true
        })
      ).rejects.toThrow('Unauthorized revocation request');

      expect(mockDatabase.transaction).not.toHaveBeenCalled();
    });
  });

  describe('Retention Policies', () => {
    test('should apply data minimization principle', async () => {
      const dataRecord = {
        personalInfo: {
          name: '王大明',
          idNumber: 'A123456789',
          address: '新竹市',
          phone: '0912345678',
          email: 'test@example.com',
          bloodType: 'O+',
          emergencyContact: '王小美'
        }
      };

      const minimized = await retentionService.applyDataMinimization({
        data: dataRecord,
        purpose: 'emergency_location',
        requiredFields: ['name', 'emergencyContact']
      });

      expect(minimized.personalInfo).toEqual({
        name: '王大明',
        emergencyContact: '王小美'
      });
      expect(minimized.personalInfo.idNumber).toBeUndefined();
      expect(minimized.personalInfo.address).toBeUndefined();
    });

    test('should pseudonymize data after initial retention period', async () => {
      const originalData = {
        patientId: 'PAT001',
        name: '王大明',
        location: { lat: 24.8066, lng: 120.9686 }
      };

      mockDatabase.query.mockResolvedValue({
        rows: [{
          ...originalData,
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days old
        }]
      });

      await retentionService.applyPseudonymization();

      expect(mockDatabase.update).toHaveBeenCalledWith(
        'data_records',
        expect.objectContaining({
          patientId: expect.stringMatching(/^PSEUDO_/),
          name: expect.stringMatching(/^\*{3}/)
        }),
        expect.any(Object)
      );
    });

    test('should enforce different retention periods by data category', async () => {
      const policies = retentionService.getRetentionPolicies();

      expect(policies).toMatchObject({
        emergency_data: { days: 1, extendable: false },
        medical_records: { days: 30, requiresConsent: true },
        audit_logs: { days: 90, regulatory: true },
        consent_records: { days: 365, immutable: true },
        anonymized_data: { days: null, indefinite: true }
      });
    });
  });

  describe('Compliance Reporting', () => {
    test('should generate GDPR compliance report', async () => {
      mockDatabase.query.mockResolvedValue({
        rows: [
          { category: 'personal_info', count: 150, avgRetentionDays: 5.2 },
          { category: 'medical_records', count: 75, avgRetentionDays: 15.8 },
          { category: 'location_data', count: 1200, avgRetentionDays: 0.5 }
        ]
      });

      const report = await retentionService.generateComplianceReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        includeGDPR: true
      });

      expect(report).toMatchObject({
        period: expect.any(Object),
        totalRecords: 1425,
        categorySummary: expect.any(Array),
        gdprCompliance: {
          dataMinimization: expect.any(Boolean),
          retentionCompliance: expect.any(Boolean),
          rightToErasure: expect.any(Boolean),
          averageRetentionDays: expect.any(Number)
        }
      });
    });

    test('should track data subject requests', async () => {
      const requests = [
        { type: 'access', count: 25 },
        { type: 'deletion', count: 10 },
        { type: 'portability', count: 5 },
        { type: 'rectification', count: 3 }
      ];

      mockDatabase.query.mockResolvedValue({ rows: requests });

      const stats = await retentionService.getDataSubjectRequestStats({
        month: '2024-01'
      });

      expect(stats.totalRequests).toBe(43);
      expect(stats.breakdown).toEqual(expect.arrayContaining(requests));
      expect(stats.averageResponseTime).toBeDefined();
    });
  });
});
