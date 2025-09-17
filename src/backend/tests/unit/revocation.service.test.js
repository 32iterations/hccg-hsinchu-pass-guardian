const RevocationService = require('../../src/services/revocation.service');
const EventEmitter = require('events');

describe('RevocationService', () => {
  let revocationService;
  let mockLogger;
  let mockDatabase;
  let mockCache;
  let mockMyDataAdapter;
  let mockRetentionService;
  let mockAuditService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockDatabase = {
      transaction: jest.fn(),
      query: jest.fn(),
      delete: jest.fn(),
      insert: jest.fn()
    };

    mockCache = {
      delete: jest.fn(),
      deletePattern: jest.fn(),
      exists: jest.fn()
    };

    mockMyDataAdapter = {
      revokeConsent: jest.fn(),
      notifyRevocation: jest.fn()
    };

    mockRetentionService = {
      processRevocation: jest.fn(),
      generateCertificate: jest.fn()
    };

    mockAuditService = {
      logRevocation: jest.fn(),
      generateAuditTrail: jest.fn()
    };

    revocationService = new RevocationService({
      logger: mockLogger,
      database: mockDatabase,
      cache: mockCache,
      myDataAdapter: mockMyDataAdapter,
      retentionService: mockRetentionService,
      auditService: mockAuditService
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Immediate Revocation Processing', () => {
    test('should process complete revocation within 100ms', async () => {
      const startTime = Date.now();
      
      mockDatabase.transaction.mockImplementation(async (callback) => {
        return callback({
          delete: jest.fn().mockResolvedValue({ rowCount: 5 }),
          insert: jest.fn().mockResolvedValue({ rowCount: 1 })
        });
      });
      mockCache.deletePattern.mockResolvedValue(10);
      mockMyDataAdapter.revokeConsent.mockResolvedValue({ success: true });

      const result = await revocationService.revokeAllData({
        patientId: 'PAT001',
        familyId: 'FAM001',
        reason: 'user_requested'
      });

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(100);
      expect(result.success).toBe(true);
      expect(result.deletedFromDB).toBe(5);
      expect(result.deletedFromCache).toBe(10);
    });

    test('should delete data from all storage layers', async () => {
      const patientId = 'PAT001';
      
      mockDatabase.transaction.mockImplementation(async (callback) => {
        const tx = {
          delete: jest.fn().mockResolvedValue({ rowCount: 1 }),
          insert: jest.fn().mockResolvedValue({ rowCount: 1 })
        };
        await callback(tx);
        return { success: true };
      });

      await revocationService.revokeAllData({ patientId });

      // Database deletion
      expect(mockDatabase.transaction).toHaveBeenCalled();
      
      // Cache deletion
      expect(mockCache.deletePattern).toHaveBeenCalledWith(`*${patientId}*`);
      
      // MyData platform notification
      expect(mockMyDataAdapter.revokeConsent).toHaveBeenCalledWith(
        expect.objectContaining({ patientId })
      );
    });

    test('should handle partial failures with rollback', async () => {
      mockDatabase.transaction.mockRejectedValue(new Error('DB Error'));
      mockCache.deletePattern.mockResolvedValue(5);

      await expect(
        revocationService.revokeAllData({ patientId: 'PAT001' })
      ).rejects.toThrow('Revocation failed');

      // Should attempt rollback
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Revocation failed'),
        expect.any(Error)
      );
    });
  });

  describe('Audit Trail Generation', () => {
    test('should create comprehensive audit trail for revocation', async () => {
      const revocationRequest = {
        patientId: 'PAT001',
        familyId: 'FAM001',
        reason: 'user_requested',
        requestedBy: 'family_member',
        timestamp: new Date()
      };

      mockDatabase.transaction.mockResolvedValue({ success: true });
      mockAuditService.generateAuditTrail.mockResolvedValue({
        trailId: 'TRAIL001',
        entries: 15
      });

      const result = await revocationService.revokeWithAudit(revocationRequest);

      expect(mockAuditService.generateAuditTrail).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'data_revocation',
          patientId: 'PAT001',
          details: expect.objectContaining({
            reason: 'user_requested',
            requestedBy: 'family_member'
          })
        })
      );
      expect(result.auditTrailId).toBe('TRAIL001');
    });

    test('should include all affected data types in audit', async () => {
      const affectedData = [
        { type: 'personal_info', count: 1 },
        { type: 'location_history', count: 150 },
        { type: 'medical_records', count: 5 },
        { type: 'device_bindings', count: 2 },
        { type: 'consent_records', count: 3 }
      ];

      mockDatabase.query.mockResolvedValue({ rows: affectedData });
      
      const auditDetails = await revocationService.getRevocationAuditDetails({
        patientId: 'PAT001'
      });

      expect(auditDetails.affectedDataTypes).toEqual(affectedData);
      expect(auditDetails.totalRecords).toBe(161);
      expect(auditDetails.timestamp).toBeDefined();
    });

    test('should generate immutable revocation receipt', async () => {
      mockDatabase.transaction.mockResolvedValue({ deletedCount: 50 });
      
      const receipt = await revocationService.generateRevocationReceipt({
        patientId: 'PAT001',
        familyId: 'FAM001',
        deletedCount: 50
      });

      expect(receipt).toMatchObject({
        receiptId: expect.stringMatching(/^REV-\d{8}-/),
        patientId: 'PAT001',
        familyId: 'FAM001',
        timestamp: expect.any(Date),
        deletedRecords: 50,
        hash: expect.stringMatching(/^[a-f0-9]{64}$/), // SHA-256
        signature: expect.any(String)
      });

      // Verify receipt is stored
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'revocation_receipts',
        expect.objectContaining({
          receiptId: receipt.receiptId
        })
      );
    });
  });

  describe('Cascade Deletion', () => {
    test('should delete all related data in correct order', async () => {
      const deletionOrder = [];
      
      mockDatabase.transaction.mockImplementation(async (callback) => {
        const tx = {
          delete: jest.fn((table) => {
            deletionOrder.push(table);
            return Promise.resolve({ rowCount: 1 });
          }),
          insert: jest.fn().mockResolvedValue({ rowCount: 1 })
        };
        await callback(tx);
        return { success: true };
      });

      await revocationService.cascadeDelete({
        patientId: 'PAT001',
        includeRelated: true
      });

      // Verify deletion order (dependent data first)
      const expectedOrder = [
        'location_history',
        'alerts',
        'device_data',
        'medical_records',
        'consent_records',
        'personal_info'
      ];

      expect(deletionOrder).toEqual(expectedOrder);
    });

    test('should handle foreign key constraints', async () => {
      mockDatabase.transaction.mockImplementation(async (callback) => {
        const tx = {
          delete: jest.fn()
            .mockRejectedValueOnce(new Error('Foreign key constraint'))
            .mockResolvedValue({ rowCount: 1 }),
          insert: jest.fn().mockResolvedValue({ rowCount: 1 })
        };
        await callback(tx);
        return { success: true, retries: 1 };
      });

      const result = await revocationService.cascadeDelete({
        patientId: 'PAT001',
        handleConstraints: true
      });

      expect(result.success).toBe(true);
      expect(result.retries).toBe(1);
    });

    test('should notify dependent services before deletion', async () => {
      const notificationHandlers = new EventEmitter();
      const locationHandler = jest.fn();
      const deviceHandler = jest.fn();
      const alertHandler = jest.fn();

      notificationHandlers.on('location', locationHandler);
      notificationHandlers.on('device', deviceHandler);
      notificationHandlers.on('alert', alertHandler);

      revocationService.setNotificationHandlers(notificationHandlers);

      await revocationService.cascadeDelete({
        patientId: 'PAT001',
        notifyServices: true
      });

      expect(locationHandler).toHaveBeenCalledBefore(mockDatabase.transaction);
      expect(deviceHandler).toHaveBeenCalledBefore(mockDatabase.transaction);
      expect(alertHandler).toHaveBeenCalledBefore(mockDatabase.transaction);
    });
  });

  describe('Recovery and Rollback', () => {
    test('should support revocation cancellation within grace period', async () => {
      const revocationId = 'REV-20240101-001';
      
      // Start revocation
      mockDatabase.insert.mockResolvedValue({ revocationId });
      const pendingRevocation = await revocationService.initiateRevocation({
        patientId: 'PAT001',
        gracePeriodMinutes: 5
      });

      expect(pendingRevocation.status).toBe('pending');
      expect(pendingRevocation.canCancel).toBe(true);

      // Cancel revocation
      const cancelled = await revocationService.cancelRevocation(revocationId);
      expect(cancelled.success).toBe(true);
      expect(mockDatabase.delete).not.toHaveBeenCalled();
    });

    test('should create backup before permanent deletion', async () => {
      const backupLocation = '/backup/revocation/PAT001_20240101.json';
      
      mockDatabase.query.mockResolvedValue({
        rows: [
          { type: 'personal_info', data: { name: '王大明' } },
          { type: 'medical_records', data: { diagnosis: 'MCI' } }
        ]
      });

      await revocationService.revokeWithBackup({
        patientId: 'PAT001',
        createBackup: true
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Backup created'),
        expect.objectContaining({ location: expect.any(String) })
      );
    });

    test('should validate revocation request integrity', async () => {
      await expect(
        revocationService.validateAndRevoke({
          patientId: 'PAT001',
          familyId: 'FAM002', // Mismatch
          signature: 'invalid-signature'
        })
      ).rejects.toThrow('Invalid revocation request');

      expect(mockDatabase.transaction).not.toHaveBeenCalled();
      expect(mockAuditService.logRevocation).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'revocation_rejected',
          reason: 'invalid_signature'
        })
      );
    });
  });

  describe('Compliance and Verification', () => {
    test('should verify complete data deletion', async () => {
      const patientId = 'PAT001';
      
      // Perform deletion
      mockDatabase.transaction.mockResolvedValue({ success: true });
      mockCache.exists.mockResolvedValue(false);
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await revocationService.revokeAllData({ patientId });

      // Verify deletion
      const verification = await revocationService.verifyDeletion(patientId);

      expect(verification).toMatchObject({
        verified: true,
        databaseRecords: 0,
        cacheEntries: 0,
        timestamp: expect.any(Date),
        certificate: expect.any(String)
      });
    });

    test('should detect incomplete deletion', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [{ id: 'remaining' }] });

      const verification = await revocationService.verifyDeletion('PAT001');

      expect(verification.verified).toBe(false);
      expect(verification.remainingData).toEqual(['database']);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Incomplete deletion detected')
      );
    });

    test('should generate GDPR Article 17 compliance report', async () => {
      const report = await revocationService.generateGDPRComplianceReport({
        patientId: 'PAT001',
        revocationId: 'REV-001'
      });

      expect(report).toMatchObject({
        article17Compliance: true,
        rightToErasure: 'fulfilled',
        processingTime: expect.any(Number),
        dataCategories: expect.any(Array),
        thirdPartyNotifications: expect.any(Array),
        retentionExceptions: expect.any(Array)
      });
    });
  });
});
