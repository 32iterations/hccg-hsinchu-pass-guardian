/**
 * 稽核服務測試套件 (Audit Service Test Suite)
 *
 * 測試範圍:
 * 1. 綜合稽核記錄 - 所有操作的稽核記錄
 * 2. 稽核軌跡完整性 - 防篡改檢測
 * 3. 合規報告 (GDPR, 台灣個資法, 醫療法規)
 * 4. 資料存取追蹤與模式分析
 * 5. 安全事件記錄與警報
 * 6. 稽核日誌保留與歸檔
 * 7. 查詢與搜尋功能
 * 8. 監管機關匯出功能
 *
 * @file audit.service.test.js
 * @requires AuditService - 尚未實作，測試將失敗 (RED Phase)
 */

const AuditService = require('../../src/services/audit.service');
const { ValidationError, SecurityError, ComplianceError } = require('../../src/utils/errors');

describe('稽核服務 (Audit Service)', () => {
  let auditService;
  let mockDatabase;
  let mockHasher;
  let mockEncryption;
  let mockNotificationService;

  beforeEach(() => {
    // Mock dependencies
    mockDatabase = {
      insert: jest.fn(),
      find: jest.fn(),
      findByQuery: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      transaction: jest.fn()
    };

    mockHasher = {
      createHash: jest.fn(),
      verifyHash: jest.fn(),
      createChainHash: jest.fn()
    };

    mockEncryption = {
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      generateKey: jest.fn()
    };

    mockNotificationService = {
      sendSecurityAlert: jest.fn(),
      sendComplianceNotification: jest.fn()
    };

    auditService = new AuditService({
      database: mockDatabase,
      hasher: mockHasher,
      encryption: mockEncryption,
      notificationService: mockNotificationService
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('綜合稽核記錄 (Comprehensive Audit Logging)', () => {
    test('應記錄使用者登入事件', async () => {
      const loginEvent = {
        action: 'USER_LOGIN',
        userId: 'user-12345',
        userRole: '承辦人員',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0...',
        timestamp: new Date(),
        metadata: {
          loginMethod: 'password',
          sessionId: 'session-abc123'
        }
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-001' });

      await auditService.logUserAction(loginEvent);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'USER_LOGIN',
          userId: 'user-12345',
          userRole: '承辦人員',
          ipAddress: '192.168.1.100'
        })
      );
    });

    test('應記錄資料存取事件', async () => {
      const dataAccessEvent = {
        action: 'DATA_ACCESS',
        userId: 'user-12345',
        resourceType: 'CASE_RECORD',
        resourceId: 'case-67890',
        accessType: 'READ',
        purpose: '案件查詢處理',
        sensitive: true,
        dataFields: ['姓名', '身分證字號', '電話', '住址'],
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-002' });

      await auditService.logDataAccess(dataAccessEvent);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'DATA_ACCESS',
          resourceType: 'CASE_RECORD',
          sensitive: true,
          purpose: '案件查詢處理'
        })
      );
    });

    test('應記錄系統管理操作', async () => {
      const adminEvent = {
        action: 'SYSTEM_CONFIG_CHANGE',
        userId: 'admin-001',
        userRole: '系統管理員',
        configType: 'NOTIFICATION_SETTINGS',
        beforeValue: { maxRetries: 3 },
        afterValue: { maxRetries: 5 },
        reason: '提升通知可靠性',
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-003' });

      await auditService.logSystemOperation(adminEvent);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'SYSTEM_CONFIG_CHANGE',
          configType: 'NOTIFICATION_SETTINGS',
          beforeValue: { maxRetries: 3 },
          afterValue: { maxRetries: 5 }
        })
      );
    });

    test('應記錄資料匯出事件', async () => {
      const exportEvent = {
        action: 'DATA_EXPORT',
        userId: 'user-12345',
        userRole: '承辦人員',
        exportType: 'CASE_SUMMARY',
        recordCount: 150,
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        purpose: '月報製作',
        approvalId: 'approval-456',
        watermarkId: 'watermark-789',
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-004' });

      await auditService.logDataExport(exportEvent);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'DATA_EXPORT',
          exportType: 'CASE_SUMMARY',
          recordCount: 150,
          watermarkId: 'watermark-789'
        })
      );
    });

    test('應記錄失敗的操作嘗試', async () => {
      const failedEvent = {
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        userId: 'user-12345',
        targetResource: 'ADMIN_PANEL',
        failureReason: '權限不足',
        severity: 'HIGH',
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-005' });
      mockNotificationService.sendSecurityAlert.mockResolvedValue(true);

      await auditService.logSecurityEvent(failedEvent);

      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'HIGH',
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT'
        })
      );
    });
  });

  describe('稽核軌跡完整性 (Audit Trail Integrity)', () => {
    test('應為每筆稽核記錄建立雜湊值', async () => {
      const auditEvent = {
        action: 'DATA_ACCESS',
        userId: 'user-12345',
        timestamp: new Date()
      };

      mockHasher.createHash.mockReturnValue('hash-abc123');
      mockDatabase.insert.mockResolvedValue({ id: 'audit-006' });

      await auditService.logUserAction(auditEvent);

      expect(mockHasher.createHash).toHaveBeenCalledWith(
        expect.stringContaining('DATA_ACCESS')
      );
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          hash: 'hash-abc123'
        })
      );
    });

    test('應建立稽核記錄鏈式雜湊', async () => {
      const previousHash = 'prev-hash-123';
      const currentRecord = { action: 'USER_LOGIN', userId: 'user-001' };

      mockDatabase.find.mockResolvedValue([{ hash: previousHash }]);
      mockHasher.createChainHash.mockReturnValue('chain-hash-456');
      mockDatabase.insert.mockResolvedValue({ id: 'audit-007' });

      await auditService.logUserAction(currentRecord);

      expect(mockHasher.createChainHash).toHaveBeenCalledWith(
        currentRecord,
        previousHash
      );
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          chainHash: 'chain-hash-456',
          previousHash: previousHash
        })
      );
    });

    test('應檢測稽核記錄的篡改', async () => {
      const suspiciousRecords = [
        {
          id: 'audit-001',
          action: 'DATA_ACCESS',
          hash: 'modified-hash',
          originalData: '{"action":"DATA_ACCESS","userId":"user-001"}'
        }
      ];

      mockDatabase.findByQuery.mockResolvedValue(suspiciousRecords);
      mockHasher.verifyHash.mockReturnValue(false);

      const result = await auditService.verifyAuditIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.tamperedRecords).toHaveLength(1);
      expect(result.tamperedRecords[0].id).toBe('audit-001');
    });

    test('應在檢測到篡改時發送安全警報', async () => {
      const tamperedRecord = {
        id: 'audit-001',
        action: 'DATA_DELETE',
        hash: 'invalid-hash'
      };

      mockDatabase.findByQuery.mockResolvedValue([tamperedRecord]);
      mockHasher.verifyHash.mockReturnValue(false);
      mockNotificationService.sendSecurityAlert.mockResolvedValue(true);

      await auditService.verifyAuditIntegrity();

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'AUDIT_TAMPERING_DETECTED',
          severity: 'CRITICAL',
          recordId: 'audit-001'
        })
      );
    });

    test('應支援稽核記錄的數位簽章', async () => {
      const auditEvent = {
        action: 'SENSITIVE_DATA_ACCESS',
        userId: 'user-12345',
        timestamp: new Date()
      };

      mockEncryption.generateKey.mockReturnValue('signature-key');
      mockHasher.createHash.mockReturnValue('digital-signature');
      mockDatabase.insert.mockResolvedValue({ id: 'audit-008' });

      await auditService.logSensitiveAction(auditEvent);

      expect(mockEncryption.generateKey).toHaveBeenCalled();
      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          digitalSignature: 'digital-signature',
          signatureKey: 'signature-key'
        })
      );
    });
  });

  describe('合規報告 (Compliance Reporting)', () => {
    test('應產生 GDPR 合規報告', async () => {
      const gdprQuery = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        dataSubjectId: 'user-12345'
      };

      const mockGdprData = [
        {
          action: 'DATA_ACCESS',
          purpose: '案件處理',
          legalBasis: 'legitimate_interest',
          dataCategory: 'personal_data',
          timestamp: new Date('2024-01-15')
        }
      ];

      mockDatabase.findByQuery.mockResolvedValue(mockGdprData);

      const report = await auditService.generateGDPRReport(gdprQuery);

      expect(report).toHaveProperty('dataSubjectId', 'user-12345');
      expect(report).toHaveProperty('reportPeriod');
      expect(report).toHaveProperty('dataProcessingActivities');
      expect(report.dataProcessingActivities).toHaveLength(1);
      expect(report.dataProcessingActivities[0]).toHaveProperty('legalBasis', 'legitimate_interest');
    });

    test('應產生台灣個資法合規報告', async () => {
      const pdpaQuery = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        organizationUnit: '新竹市政府社會處'
      };

      const mockPdpaData = [
        {
          action: 'PERSONAL_DATA_COLLECTION',
          purpose: '社會福利服務',
          category: '識別類個人資料',
          consentStatus: 'explicit_consent',
          retentionPeriod: '5年',
          timestamp: new Date('2024-01-15')
        }
      ];

      mockDatabase.findByQuery.mockResolvedValue(mockPdpaData);

      const report = await auditService.generatePDPAReport(pdpaQuery);

      expect(report).toHaveProperty('organizationUnit', '新竹市政府社會處');
      expect(report).toHaveProperty('personalDataActivities');
      expect(report.personalDataActivities[0]).toHaveProperty('purpose', '社會福利服務');
      expect(report.personalDataActivities[0]).toHaveProperty('category', '識別類個人資料');
    });

    test('應產生醫療法規合規報告', async () => {
      const healthcareQuery = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        facilityId: 'HSC-FACILITY-001'
      };

      const mockHealthcareData = [
        {
          action: 'MEDICAL_RECORD_ACCESS',
          patientId: 'patient-12345',
          accessPurpose: '急診醫療處置',
          healthcareProvider: '新竹馬偕醫院',
          accessDuration: '30分鐘',
          timestamp: new Date('2024-01-15')
        }
      ];

      mockDatabase.findByQuery.mockResolvedValue(mockHealthcareData);

      const report = await auditService.generateHealthcareComplianceReport(healthcareQuery);

      expect(report).toHaveProperty('facilityId', 'HSC-FACILITY-001');
      expect(report).toHaveProperty('medicalRecordAccess');
      expect(report.medicalRecordAccess[0]).toHaveProperty('accessPurpose', '急診醫療處置');
    });

    test('應驗證合規報告的完整性', async () => {
      const reportData = {
        type: 'GDPR',
        period: '2024-01',
        recordCount: 150
      };

      mockHasher.createHash.mockReturnValue('report-hash-123');

      const report = await auditService.createComplianceReport(reportData);

      expect(report).toHaveProperty('reportHash', 'report-hash-123');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('reportId');
    });

    test('應自動檢查合規性違規', async () => {
      const violations = [
        {
          type: 'DATA_RETENTION_EXCEEDED',
          recordId: 'case-12345',
          retentionPeriod: '3年',
          currentAge: '4年',
          severity: 'HIGH'
        }
      ];

      mockDatabase.findByQuery.mockResolvedValue(violations);
      mockNotificationService.sendComplianceNotification.mockResolvedValue(true);

      const complianceCheck = await auditService.runComplianceCheck();

      expect(complianceCheck.violations).toHaveLength(1);
      expect(mockNotificationService.sendComplianceNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'COMPLIANCE_VIOLATION',
          severity: 'HIGH'
        })
      );
    });
  });

  describe('資料存取追蹤 (Data Access Tracking)', () => {
    test('應追蹤個人資料的存取模式', async () => {
      const accessPattern = {
        userId: 'user-12345',
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        }
      };

      const mockAccessData = [
        { timestamp: new Date('2024-01-01T09:00:00Z'), resourceType: 'CASE_RECORD' },
        { timestamp: new Date('2024-01-01T14:30:00Z'), resourceType: 'VOLUNTEER_INFO' },
        { timestamp: new Date('2024-01-02T10:15:00Z'), resourceType: 'CASE_RECORD' }
      ];

      mockDatabase.findByQuery.mockResolvedValue(mockAccessData);

      const pattern = await auditService.analyzeAccessPattern(accessPattern);

      expect(pattern).toHaveProperty('userId', 'user-12345');
      expect(pattern).toHaveProperty('totalAccesses', 3);
      expect(pattern).toHaveProperty('resourceTypes');
      expect(pattern.resourceTypes).toHaveProperty('CASE_RECORD', 2);
      expect(pattern.resourceTypes).toHaveProperty('VOLUNTEER_INFO', 1);
    });

    test('應檢測異常的資料存取行為', async () => {
      const suspiciousActivity = {
        userId: 'user-12345',
        timeWindow: '1小時',
        accessCount: 50, // 異常高頻存取
        resourceTypes: ['CASE_RECORD'],
        timestamp: new Date()
      };

      mockDatabase.aggregate.mockResolvedValue([{ count: 50, avgCount: 5 }]);

      const anomaly = await auditService.detectAccessAnomaly(suspiciousActivity);

      expect(anomaly.isAnomalous).toBe(true);
      expect(anomaly.anomalyScore).toBeGreaterThan(0.8);
      expect(anomaly.riskLevel).toBe('HIGH');
    });

    test('應記錄資料下載和列印事件', async () => {
      const downloadEvent = {
        action: 'DATA_DOWNLOAD',
        userId: 'user-12345',
        fileName: '案件統計報表_202401.xlsx',
        fileSize: 2048576, // 2MB
        downloadMethod: 'browser',
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-009' });

      await auditService.logFileDownload(downloadEvent);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'DATA_DOWNLOAD',
          fileName: '案件統計報表_202401.xlsx',
          fileSize: 2048576
        })
      );
    });

    test('應提供資料血緣追蹤', async () => {
      const lineageQuery = {
        dataId: 'case-12345',
        trackingDepth: 3
      };

      const mockLineageData = {
        dataId: 'case-12345',
        originalSource: 'EMERGENCY_CALL_SYSTEM',
        transformations: [
          { operation: 'ANONYMIZATION', timestamp: new Date('2024-01-01T10:00:00Z') },
          { operation: 'AGGREGATION', timestamp: new Date('2024-01-01T10:05:00Z') }
        ],
        accessHistory: [
          { userId: 'user-001', purpose: '案件處理', timestamp: new Date('2024-01-01T10:10:00Z') }
        ]
      };

      mockDatabase.findByQuery.mockResolvedValue([mockLineageData]);

      const lineage = await auditService.traceDataLineage(lineageQuery);

      expect(lineage).toHaveProperty('dataId', 'case-12345');
      expect(lineage).toHaveProperty('transformations');
      expect(lineage.transformations).toHaveLength(2);
    });
  });

  describe('安全事件記錄 (Security Event Logging)', () => {
    test('應記錄登入失敗事件', async () => {
      const loginFailure = {
        action: 'LOGIN_FAILURE',
        userId: 'user-12345',
        failureReason: '密碼錯誤',
        ipAddress: '192.168.1.100',
        attemptCount: 3,
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-010' });

      await auditService.logSecurityEvent(loginFailure);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'LOGIN_FAILURE',
          failureReason: '密碼錯誤',
          attemptCount: 3
        })
      );
    });

    test('應記錄權限提升事件', async () => {
      const privilegeEscalation = {
        action: 'PRIVILEGE_ESCALATION',
        userId: 'user-12345',
        fromRole: '一般使用者',
        toRole: '承辦人員',
        grantedBy: 'admin-001',
        reason: '臨時案件處理需求',
        duration: '2小時',
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-011' });

      await auditService.logPrivilegeChange(privilegeEscalation);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'PRIVILEGE_ESCALATION',
          fromRole: '一般使用者',
          toRole: '承辦人員',
          grantedBy: 'admin-001'
        })
      );
    });

    test('應記錄可疑的檔案存取', async () => {
      const suspiciousAccess = {
        action: 'SUSPICIOUS_FILE_ACCESS',
        userId: 'user-12345',
        filePath: '/sensitive/config/database.conf',
        accessTime: '凌晨2:30',
        userLocation: '非辦公室IP',
        riskScore: 0.85,
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-012' });
      mockNotificationService.sendSecurityAlert.mockResolvedValue(true);

      await auditService.logSecurityEvent(suspiciousAccess);

      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SUSPICIOUS_FILE_ACCESS',
          riskScore: 0.85
        })
      );
    });

    test('應記錄資料庫直接存取事件', async () => {
      const dbAccess = {
        action: 'DIRECT_DATABASE_ACCESS',
        userId: 'dba-001',
        databaseName: 'hsinchu_pass_guardian',
        queryType: 'SELECT',
        affectedTables: ['users', 'cases', 'audit_logs'],
        recordCount: 1000,
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-013' });

      await auditService.logDatabaseAccess(dbAccess);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'DIRECT_DATABASE_ACCESS',
          affectedTables: ['users', 'cases', 'audit_logs'],
          recordCount: 1000
        })
      );
    });
  });

  describe('稽核日誌保留與歸檔 (Audit Log Retention)', () => {
    test('應根據保留政策歸檔舊記錄', async () => {
      const retentionPolicy = {
        activeRetention: '2年',
        archiveRetention: '7年',
        totalRetention: '10年'
      };

      const oldRecords = [
        { id: 'audit-old-001', timestamp: new Date('2022-01-01') },
        { id: 'audit-old-002', timestamp: new Date('2022-06-01') }
      ];

      mockDatabase.findByQuery.mockResolvedValue(oldRecords);
      mockDatabase.transaction.mockImplementation(async (callback) => {
        return await callback(mockDatabase);
      });

      const archiveResult = await auditService.archiveOldRecords(retentionPolicy);

      expect(archiveResult.archivedCount).toBe(2);
      expect(archiveResult.archiveLocation).toBeDefined();
    });

    test('應壓縮歸檔的稽核記錄', async () => {
      const archiveData = {
        records: [
          { id: 'audit-001', action: 'DATA_ACCESS' },
          { id: 'audit-002', action: 'USER_LOGIN' }
        ],
        compressionType: 'gzip'
      };

      mockEncryption.encrypt.mockReturnValue('compressed-encrypted-data');

      const compressedArchive = await auditService.compressArchive(archiveData);

      expect(compressedArchive).toHaveProperty('compressedSize');
      expect(compressedArchive).toHaveProperty('encryptedData', 'compressed-encrypted-data');
      expect(compressedArchive).toHaveProperty('compressionRatio');
    });

    test('應驗證歸檔資料的完整性', async () => {
      const archiveFile = {
        id: 'archive-2022-001',
        location: '/archives/audit_2022_q1.gz.enc',
        recordCount: 10000,
        checksum: 'sha256-checksum'
      };

      mockHasher.verifyHash.mockReturnValue(true);

      const verification = await auditService.verifyArchiveIntegrity(archiveFile);

      expect(verification.isValid).toBe(true);
      expect(verification.recordCount).toBe(10000);
      expect(verification.checksumValid).toBe(true);
    });

    test('應支援歸檔資料的搜尋', async () => {
      const searchQuery = {
        dateRange: {
          start: '2022-01-01',
          end: '2022-12-31'
        },
        action: 'DATA_EXPORT',
        userId: 'user-12345'
      };

      const mockArchiveResults = [
        {
          archiveId: 'archive-2022-001',
          recordId: 'audit-archived-001',
          action: 'DATA_EXPORT',
          timestamp: new Date('2022-06-15')
        }
      ];

      mockDatabase.findByQuery.mockResolvedValue(mockArchiveResults);

      const searchResults = await auditService.searchArchivedRecords(searchQuery);

      expect(searchResults.records).toHaveLength(1);
      expect(searchResults.records[0]).toHaveProperty('action', 'DATA_EXPORT');
    });
  });

  describe('查詢與搜尋功能 (Query and Search)', () => {
    test('應支援複雜的稽核記錄查詢', async () => {
      const complexQuery = {
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        actions: ['DATA_ACCESS', 'DATA_EXPORT'],
        userRoles: ['承辦人員', '督導人員'],
        severity: ['HIGH', 'CRITICAL'],
        resourceTypes: ['CASE_RECORD', 'VOLUNTEER_INFO'],
        pagination: {
          page: 1,
          pageSize: 50
        }
      };

      const mockQueryResults = {
        records: [
          { id: 'audit-001', action: 'DATA_ACCESS', severity: 'HIGH' },
          { id: 'audit-002', action: 'DATA_EXPORT', severity: 'CRITICAL' }
        ],
        totalCount: 150,
        pageCount: 3
      };

      mockDatabase.findByQuery.mockResolvedValue(mockQueryResults.records);
      mockDatabase.count.mockResolvedValue(150);

      const queryResults = await auditService.queryAuditRecords(complexQuery);

      expect(queryResults.records).toHaveLength(2);
      expect(queryResults.totalCount).toBe(150);
      expect(queryResults.pageCount).toBe(3);
    });

    test('應支援全文搜尋稽核記錄', async () => {
      const searchQuery = {
        keywords: '案件 個資 存取',
        fuzzyMatch: true,
        language: 'zh-TW'
      };

      const mockSearchResults = [
        {
          id: 'audit-001',
          action: 'DATA_ACCESS',
          description: '存取案件個資進行處理',
          relevanceScore: 0.95
        }
      ];

      mockDatabase.findByQuery.mockResolvedValue(mockSearchResults);

      const searchResults = await auditService.fullTextSearch(searchQuery);

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0]).toHaveProperty('relevanceScore', 0.95);
    });

    test('應提供稽核統計摘要', async () => {
      const summaryQuery = {
        timeframe: 'monthly',
        year: 2024,
        month: 1
      };

      const mockSummaryData = {
        totalRecords: 15000,
        actionBreakdown: {
          'DATA_ACCESS': 8000,
          'USER_LOGIN': 5000,
          'DATA_EXPORT': 2000
        },
        userRoleBreakdown: {
          '承辦人員': 10000,
          '督導人員': 3000,
          '系統管理員': 2000
        },
        severityBreakdown: {
          'LOW': 12000,
          'MEDIUM': 2500,
          'HIGH': 400,
          'CRITICAL': 100
        }
      };

      mockDatabase.aggregate.mockResolvedValue([mockSummaryData]);

      const summary = await auditService.getAuditSummary(summaryQuery);

      expect(summary.totalRecords).toBe(15000);
      expect(summary.actionBreakdown).toHaveProperty('DATA_ACCESS', 8000);
      expect(summary.severityBreakdown).toHaveProperty('CRITICAL', 100);
    });
  });

  describe('監管機關匯出功能 (Regulatory Export)', () => {
    test('應產生監管機關格式的稽核報告', async () => {
      const regulatoryExport = {
        agency: '國家發展委員會',
        reportType: '個人資料保護稽核報告',
        period: {
          start: '2024-01-01',
          end: '2024-03-31'
        },
        requestedBy: 'inspector-001',
        approvalReference: 'NDC-AUDIT-2024-001'
      };

      const mockRegulatorData = {
        organizationInfo: {
          name: '新竹市政府',
          registrationNumber: 'GOV-HSC-001',
          dpoContact: 'dpo@hccg.gov.tw'
        },
        auditSummary: {
          totalRecords: 50000,
          personalDataAccess: 15000,
          dataExports: 200,
          violations: 5
        }
      };

      mockDatabase.aggregate.mockResolvedValue([mockRegulatorData]);

      const regulatoryReport = await auditService.generateRegulatoryReport(regulatoryExport);

      expect(regulatoryReport).toHaveProperty('agency', '國家發展委員會');
      expect(regulatoryReport).toHaveProperty('reportFormat', 'OFFICIAL');
      expect(regulatoryReport).toHaveProperty('digitalSignature');
      expect(regulatoryReport).toHaveProperty('watermark');
    });

    test('應為監管匯出加上浮水印', async () => {
      const exportData = {
        requestedBy: 'inspector-001',
        agency: '法務部調查局',
        purpose: '個資法稽核',
        timestamp: new Date()
      };

      const watermark = await auditService.generateWatermark(exportData);

      expect(watermark).toContain('inspector-001');
      expect(watermark).toContain('法務部調查局');
      expect(watermark).toContain('個資法稽核');
      expect(watermark).toMatch(/\d{4}-\d{2}-\d{2}/); // 日期格式
    });

    test('應記錄監管機關的資料請求', async () => {
      const regulatoryRequest = {
        action: 'REGULATORY_DATA_REQUEST',
        requestingAgency: '監察院',
        requestType: '行政調查',
        legalBasis: '監察法第26條',
        requestScope: '2024年第一季個資處理活動',
        requestedBy: 'investigator-001',
        urgencyLevel: 'NORMAL',
        timestamp: new Date()
      };

      mockDatabase.insert.mockResolvedValue({ id: 'audit-014' });

      await auditService.logRegulatoryRequest(regulatoryRequest);

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        'audit_logs',
        expect.objectContaining({
          action: 'REGULATORY_DATA_REQUEST',
          requestingAgency: '監察院',
          legalBasis: '監察法第26條'
        })
      );
    });

    test('應驗證監管匯出的授權', async () => {
      const exportRequest = {
        requestId: 'REG-REQ-001',
        approvalLevel: 'DIRECTOR_GENERAL',
        approvedBy: 'director-001',
        legalBasis: '政府資訊公開法',
        validUntil: new Date('2024-12-31')
      };

      const authorizationCheck = await auditService.verifyExportAuthorization(exportRequest);

      expect(authorizationCheck.isAuthorized).toBe(true);
      expect(authorizationCheck.approvalLevel).toBe('DIRECTOR_GENERAL');
      expect(authorizationCheck.remainingValidDays).toBeGreaterThan(0);
    });
  });

  describe('錯誤處理 (Error Handling)', () => {
    test('應在稽核記錄失敗時拋出錯誤', async () => {
      const auditEvent = {
        action: 'DATA_ACCESS',
        userId: 'user-12345'
      };

      mockDatabase.insert.mockRejectedValue(new Error('Database connection failed'));

      await expect(auditService.logUserAction(auditEvent))
        .rejects.toThrow('Database connection failed');
    });

    test('應在無效查詢參數時拋出驗證錯誤', async () => {
      const invalidQuery = {
        dateRange: {
          start: '2024-12-31',
          end: '2024-01-01' // 結束日期早於開始日期
        }
      };

      await expect(auditService.queryAuditRecords(invalidQuery))
        .rejects.toThrow(ValidationError);
    });

    test('應在未授權存取時拋出安全錯誤', async () => {
      const unauthorizedQuery = {
        requestedBy: 'user-12345',
        userRole: '一般使用者', // 無權限存取稽核記錄
        action: 'AUDIT_ACCESS'
      };

      await expect(auditService.queryAuditRecords(unauthorizedQuery))
        .rejects.toThrow(SecurityError);
    });

    test('應在合規檢查失敗時拋出合規錯誤', async () => {
      const nonCompliantRequest = {
        dataType: 'SENSITIVE_PERSONAL_DATA',
        purpose: '行銷推廣', // 不符合原始蒐集目的
        retentionPeriod: '無限期' // 違反保存期限規定
      };

      await expect(auditService.validateComplianceRequest(nonCompliantRequest))
        .rejects.toThrow(ComplianceError);
    });
  });
});