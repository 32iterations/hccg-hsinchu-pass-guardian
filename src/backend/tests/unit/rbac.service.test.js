/**
 * RBAC Service Test Suite - Comprehensive Security Testing
 * 新竹縣安心守護系統 - 角色權限控制測試
 *
 * This test suite covers comprehensive RBAC requirements:
 * - Role-based access control (Viewer/Operator/Admin)
 * - Permission validation for sensitive operations
 * - Field-level visibility control (PII protection)
 * - Multi-tenant support
 * - Session management with role context
 * - Audit trail for permission changes
 * - Bulk role assignments
 * - Time-based access controls
 * - Resource-specific permissions
 * - Security event logging
 *
 * All tests will FAIL initially as RBACService doesn't exist yet (RED phase)
 */

const RBACService = require('../../src/services/rbac.service');

describe('RBACService - 角色權限控制服務', () => {
  let rbacService;
  let mockDatabase;
  let mockAuditLogger;
  let mockSessionManager;

  beforeEach(() => {
    // Mock dependencies
    mockDatabase = {
      findUserById: jest.fn(),
      findRoleById: jest.fn(),
      updateUserRoles: jest.fn(),
      createAuditLog: jest.fn(),
      findPermissions: jest.fn(),
      findTenantById: jest.fn(),
      findResourcePermissions: jest.fn()
    };

    mockAuditLogger = {
      logPermissionChange: jest.fn(),
      logAccessAttempt: jest.fn(),
      logSecurityEvent: jest.fn()
    };

    mockSessionManager = {
      createSession: jest.fn(),
      validateSession: jest.fn(),
      updateSessionContext: jest.fn(),
      expireSession: jest.fn()
    };

    rbacService = new RBACService({
      database: mockDatabase,
      auditLogger: mockAuditLogger,
      sessionManager: mockSessionManager
    });
  });

  describe('1. Role-Based Access Control (基本角色控制)', () => {
    describe('Role Definitions', () => {
      test('should define Viewer role with read-only permissions', async () => {
        const viewerRole = await rbacService.getRoleDefinition('Viewer');

        expect(viewerRole).toBeDefined();
        expect(viewerRole.permissions).toContain('READ_CASES');
        expect(viewerRole.permissions).toContain('READ_ALERTS');
        expect(viewerRole.permissions).not.toContain('CREATE_CASES');
        expect(viewerRole.permissions).not.toContain('DELETE_CASES');
      });

      test('should define Operator role with case management permissions', async () => {
        const operatorRole = await rbacService.getRoleDefinition('Operator');

        expect(operatorRole).toBeDefined();
        expect(operatorRole.permissions).toContain('READ_CASES');
        expect(operatorRole.permissions).toContain('CREATE_CASES');
        expect(operatorRole.permissions).toContain('UPDATE_CASES');
        expect(operatorRole.permissions).toContain('ASSIGN_CASES');
        expect(operatorRole.permissions).not.toContain('DELETE_USERS');
        expect(operatorRole.permissions).not.toContain('MANAGE_SYSTEM');
      });

      test('should define Admin role with full system permissions', async () => {
        const adminRole = await rbacService.getRoleDefinition('Admin');

        expect(adminRole).toBeDefined();
        expect(adminRole.permissions).toContain('MANAGE_USERS');
        expect(adminRole.permissions).toContain('MANAGE_ROLES');
        expect(adminRole.permissions).toContain('DELETE_CASES');
        expect(adminRole.permissions).toContain('EXPORT_DATA');
        expect(adminRole.permissions).toContain('MANAGE_SYSTEM');
      });

      test('should reject invalid role types', async () => {
        await expect(rbacService.getRoleDefinition('InvalidRole'))
          .rejects.toThrow('Invalid role type: InvalidRole');
      });
    });

    describe('User Role Assignment', () => {
      test('should assign single role to user', async () => {
        const userId = 'user_taiwan_health_001';
        const roleId = 'role_operator';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          name: '陳承辦員',
          department: '新竹縣衛生局'
        });

        await rbacService.assignRole(userId, roleId);

        expect(mockDatabase.updateUserRoles).toHaveBeenCalledWith(
          userId,
          expect.arrayContaining([roleId])
        );
        expect(mockAuditLogger.logPermissionChange).toHaveBeenCalledWith({
          userId,
          action: 'ROLE_ASSIGNED',
          roleId,
          timestamp: expect.any(Date),
          operator: expect.any(String)
        });
      });

      test('should assign multiple roles to user', async () => {
        const userId = 'user_supervisor_001';
        const roleIds = ['role_operator', 'role_supervisor'];

        await rbacService.assignMultipleRoles(userId, roleIds);

        expect(mockDatabase.updateUserRoles).toHaveBeenCalledWith(
          userId,
          roleIds
        );
      });

      test('should prevent role escalation without proper authorization', async () => {
        const operatorUserId = 'user_operator_001';
        const targetUserId = 'user_viewer_001';
        const adminRoleId = 'role_admin';

        mockDatabase.findUserById.mockResolvedValue({
          id: operatorUserId,
          roles: ['role_operator']
        });

        await expect(rbacService.assignRole(targetUserId, adminRoleId, {
          operatorId: operatorUserId
        })).rejects.toThrow('Insufficient privileges to assign Admin role');
      });
    });
  });

  describe('2. Permission Validation (權限驗證)', () => {
    describe('Sensitive Operations', () => {
      test('should validate permission for case deletion', async () => {
        const userId = 'user_admin_001';
        const caseId = 'case_emergency_001';
        const permission = 'DELETE_CASES';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          roles: ['role_admin']
        });

        const hasPermission = await rbacService.validatePermission(
          userId,
          permission,
          { resourceId: caseId }
        );

        expect(hasPermission).toBe(true);
        expect(mockAuditLogger.logAccessAttempt).toHaveBeenCalledWith({
          userId,
          permission,
          resourceId: caseId,
          result: 'GRANTED',
          timestamp: expect.any(Date)
        });
      });

      test('should deny permission for unauthorized export operations', async () => {
        const userId = 'user_viewer_001';
        const permission = 'EXPORT_PERSONAL_DATA';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          roles: ['role_viewer']
        });

        const hasPermission = await rbacService.validatePermission(
          userId,
          permission
        );

        expect(hasPermission).toBe(false);
        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          userId,
          permission,
          severity: 'HIGH',
          timestamp: expect.any(Date)
        });
      });

      test('should validate emergency override permissions', async () => {
        const userId = 'user_emergency_001';
        const permission = 'EMERGENCY_OVERRIDE';

        const result = await rbacService.validateEmergencyPermission(
          userId,
          permission,
          {
            justification: '緊急失蹤案件需要立即存取個資',
            supervisorApproval: 'supervisor_001'
          }
        );

        expect(result.granted).toBe(true);
        expect(result.timeLimit).toBe(3600000); // 1 hour
        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'EMERGENCY_ACCESS_GRANTED',
          userId,
          justification: '緊急失蹤案件需要立即存取個資',
          timeLimit: 3600000
        });
      });
    });

    describe('Resource-Specific Permissions', () => {
      test('should validate department-specific case access', async () => {
        const userId = 'user_health_dept_001';
        const caseId = 'case_health_violation_001';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          department: '衛生局',
          roles: ['role_operator']
        });

        mockDatabase.findResourcePermissions.mockResolvedValue({
          caseId,
          department: '衛生局',
          category: 'health_violation'
        });

        const hasAccess = await rbacService.validateResourceAccess(
          userId,
          'CASE',
          caseId
        );

        expect(hasAccess).toBe(true);
      });

      test('should deny cross-department case access', async () => {
        const userId = 'user_social_dept_001';
        const caseId = 'case_health_violation_001';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          department: '社會處',
          roles: ['role_operator']
        });

        mockDatabase.findResourcePermissions.mockResolvedValue({
          caseId,
          department: '衛生局',
          category: 'health_violation'
        });

        const hasAccess = await rbacService.validateResourceAccess(
          userId,
          'CASE',
          caseId
        );

        expect(hasAccess).toBe(false);
      });
    });
  });

  describe('3. Field-Level Visibility Control (欄位級可見性控制)', () => {
    describe('PII Protection', () => {
      test('should hide PII fields from Viewer role', async () => {
        const userId = 'user_viewer_001';
        const caseData = {
          id: 'case_001',
          title: '走失老人案件',
          location: '新竹縣竹北市',
          elderName: '王老先生',
          elderIdNumber: 'A123456789',
          phoneNumber: '0987654321',
          medicalCondition: '失智症',
          familyContact: '王小明',
          familyPhone: '0912345678',
          status: 'ACTIVE'
        };

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          roles: ['role_viewer']
        });

        const filteredData = await rbacService.filterFieldsByRole(
          userId,
          caseData,
          'CASE'
        );

        expect(filteredData.id).toBe('case_001');
        expect(filteredData.title).toBe('走失老人案件');
        expect(filteredData.location).toBe('新竹縣竹北市');
        expect(filteredData.status).toBe('ACTIVE');

        // PII should be masked or removed
        expect(filteredData.elderIdNumber).toBe('A123***789');
        expect(filteredData.phoneNumber).toBe('0987***321');
        expect(filteredData.familyPhone).toBe('0912***678');
        expect(filteredData.medicalCondition).toBeUndefined();
      });

      test('should show limited PII to Operator role', async () => {
        const userId = 'user_operator_001';
        const caseData = {
          elderName: '王老先生',
          elderIdNumber: 'A123456789',
          phoneNumber: '0987654321',
          medicalCondition: '失智症',
          familyContact: '王小明'
        };

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          roles: ['role_operator']
        });

        const filteredData = await rbacService.filterFieldsByRole(
          userId,
          caseData,
          'CASE'
        );

        expect(filteredData.elderName).toBe('王老先生');
        expect(filteredData.familyContact).toBe('王小明');
        expect(filteredData.medicalCondition).toBe('失智症');
        // ID should still be partially masked
        expect(filteredData.elderIdNumber).toBe('A123***789');
        expect(filteredData.phoneNumber).toBeDefined();
      });

      test('should show full PII to Admin role', async () => {
        const userId = 'user_admin_001';
        const caseData = {
          elderIdNumber: 'A123456789',
          phoneNumber: '0987654321',
          bankAccount: '1234567890123456'
        };

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          roles: ['role_admin']
        });

        const filteredData = await rbacService.filterFieldsByRole(
          userId,
          caseData,
          'CASE'
        );

        expect(filteredData.elderIdNumber).toBe('A123456789');
        expect(filteredData.phoneNumber).toBe('0987654321');
        expect(filteredData.bankAccount).toBe('1234567890123456');
      });

      test('should apply custom masking rules for healthcare data', async () => {
        const healthData = {
          patientId: 'P20240917001',
          diagnosis: '阿茲海默症第二期',
          medication: '憶思能 10mg',
          allergies: '青黴素過敏',
          emergencyContact: '家屬王小明 0912345678'
        };

        const maskedData = await rbacService.applyHealthcareMasking(
          healthData,
          'role_viewer'
        );

        expect(maskedData.diagnosis).toBe('認知功能相關疾病');
        expect(maskedData.medication).toBe('[處方藥物已遮罩]');
        expect(maskedData.allergies).toBe('[過敏史已遮罩]');
        expect(maskedData.emergencyContact).toBe('家屬王** 0912***678');
      });
    });
  });

  describe('4. Multi-Tenant Support (多租戶支援)', () => {
    describe('Tenant Isolation', () => {
      test('should isolate data between different county governments', async () => {
        const hsinchuUserId = 'user_hsinchu_001';
        const taipeiUserId = 'user_taipei_001';

        mockDatabase.findUserById
          .mockResolvedValueOnce({
            id: hsinchuUserId,
            tenantId: 'hsinchu_county',
            roles: ['role_operator']
          })
          .mockResolvedValueOnce({
            id: taipeiUserId,
            tenantId: 'taipei_city',
            roles: ['role_operator']
          });

        const hsinchuCases = await rbacService.getTenantData(
          hsinchuUserId,
          'CASES'
        );
        const taipeiCases = await rbacService.getTenantData(
          taipeiUserId,
          'CASES'
        );

        expect(mockDatabase.findPermissions).toHaveBeenCalledWith({
          userId: hsinchuUserId,
          tenantId: 'hsinchu_county',
          resourceType: 'CASES'
        });
        expect(mockDatabase.findPermissions).toHaveBeenCalledWith({
          userId: taipeiUserId,
          tenantId: 'taipei_city',
          resourceType: 'CASES'
        });
      });

      test('should prevent cross-tenant data access', async () => {
        const userId = 'user_hsinchu_001';
        const taipeiCaseId = 'case_taipei_001';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          tenantId: 'hsinchu_county'
        });

        await expect(rbacService.validateTenantAccess(
          userId,
          taipeiCaseId
        )).rejects.toThrow('Access denied: Cross-tenant data access not allowed');
      });

      test('should support super-admin cross-tenant access', async () => {
        const superAdminId = 'user_super_admin_001';
        const anyTenantCaseId = 'case_any_tenant_001';

        mockDatabase.findUserById.mockResolvedValue({
          id: superAdminId,
          roles: ['role_super_admin'],
          tenantId: 'system'
        });

        const hasAccess = await rbacService.validateTenantAccess(
          superAdminId,
          anyTenantCaseId
        );

        expect(hasAccess).toBe(true);
      });
    });
  });

  describe('5. Session Management with Role Context (角色上下文會話管理)', () => {
    describe('Session Creation', () => {
      test('should create session with role context', async () => {
        const userId = 'user_operator_001';
        const sessionData = {
          userId,
          roles: ['role_operator'],
          tenantId: 'hsinchu_county',
          department: '社會處',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0...'
        };

        const session = await rbacService.createSessionWithRoleContext(sessionData);

        expect(mockSessionManager.createSession).toHaveBeenCalledWith({
          ...sessionData,
          permissions: expect.arrayContaining(['READ_CASES', 'CREATE_CASES']),
          sessionTimeout: 28800000, // 8 hours
          lastActivity: expect.any(Date)
        });
        expect(session.sessionId).toBeDefined();
        expect(session.permissions).toContain('READ_CASES');
      });

      test('should set appropriate session timeout based on role', async () => {
        const adminSession = await rbacService.createSessionWithRoleContext({
          userId: 'admin_001',
          roles: ['role_admin']
        });

        const viewerSession = await rbacService.createSessionWithRoleContext({
          userId: 'viewer_001',
          roles: ['role_viewer']
        });

        expect(adminSession.timeout).toBe(14400000); // 4 hours for admin
        expect(viewerSession.timeout).toBe(28800000); // 8 hours for viewer
      });
    });

    describe('Session Validation', () => {
      test('should validate active session with current permissions', async () => {
        const sessionId = 'session_12345';

        mockSessionManager.validateSession.mockResolvedValue({
          userId: 'user_001',
          roles: ['role_operator'],
          permissions: ['READ_CASES', 'CREATE_CASES'],
          lastActivity: new Date(),
          isValid: true
        });

        const isValid = await rbacService.validateSessionPermissions(
          sessionId,
          'CREATE_CASES'
        );

        expect(isValid).toBe(true);
      });

      test('should invalidate expired sessions', async () => {
        const expiredSessionId = 'session_expired';

        mockSessionManager.validateSession.mockResolvedValue({
          isValid: false,
          reason: 'SESSION_EXPIRED'
        });

        const isValid = await rbacService.validateSessionPermissions(
          expiredSessionId,
          'READ_CASES'
        );

        expect(isValid).toBe(false);
        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'SESSION_EXPIRED',
          sessionId: expiredSessionId,
          timestamp: expect.any(Date)
        });
      });
    });

    describe('Role Context Updates', () => {
      test('should update session when user roles change', async () => {
        const userId = 'user_001';
        const sessionId = 'session_12345';
        const newRoles = ['role_operator', 'role_supervisor'];

        await rbacService.updateSessionRoleContext(sessionId, newRoles);

        expect(mockSessionManager.updateSessionContext).toHaveBeenCalledWith(
          sessionId,
          {
            roles: newRoles,
            permissions: expect.any(Array),
            lastRoleUpdate: expect.any(Date)
          }
        );
      });
    });
  });

  describe('6. Audit Trail for Permission Changes (權限變更稽核軌跡)', () => {
    describe('Permission Change Logging', () => {
      test('should log role assignment with full context', async () => {
        const userId = 'user_001';
        const roleId = 'role_operator';
        const operatorId = 'admin_001';

        await rbacService.assignRole(userId, roleId, { operatorId });

        expect(mockAuditLogger.logPermissionChange).toHaveBeenCalledWith({
          action: 'ROLE_ASSIGNED',
          targetUserId: userId,
          roleId,
          operatorId,
          timestamp: expect.any(Date),
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
          justification: expect.any(String)
        });
      });

      test('should log role removal with approval chain', async () => {
        const userId = 'user_001';
        const roleId = 'role_admin';
        const approvalChain = [
          { approverId: 'supervisor_001', approvedAt: new Date() },
          { approverId: 'director_001', approvedAt: new Date() }
        ];

        await rbacService.removeRole(userId, roleId, { approvalChain });

        expect(mockAuditLogger.logPermissionChange).toHaveBeenCalledWith({
          action: 'ROLE_REMOVED',
          targetUserId: userId,
          roleId,
          approvalChain,
          severity: 'HIGH',
          requiresReview: true
        });
      });

      test('should create immutable audit records', async () => {
        const auditRecord = await rbacService.createAuditRecord({
          action: 'PERMISSION_GRANTED',
          userId: 'user_001',
          permission: 'EXPORT_DATA'
        });

        expect(auditRecord.hash).toBeDefined();
        expect(auditRecord.previousHash).toBeDefined();
        expect(auditRecord.signature).toBeDefined();
        expect(mockDatabase.createAuditLog).toHaveBeenCalledWith({
          ...auditRecord,
          immutable: true,
          chainVerified: true
        });
      });
    });

    describe('Audit Query and Review', () => {
      test('should query audit trail with proper filtering', async () => {
        const filters = {
          userId: 'user_001',
          dateRange: {
            start: new Date('2024-09-01'),
            end: new Date('2024-09-17')
          },
          actions: ['ROLE_ASSIGNED', 'ROLE_REMOVED']
        };

        const auditTrail = await rbacService.queryAuditTrail(filters);

        expect(mockDatabase.findPermissions).toHaveBeenCalledWith({
          userId: 'user_001',
          timestamp: {
            $gte: filters.dateRange.start,
            $lte: filters.dateRange.end
          },
          action: { $in: filters.actions }
        });
      });

      test('should detect audit trail tampering', async () => {
        const suspiciousRecord = {
          id: 'audit_001',
          hash: 'tampered_hash',
          previousHash: 'valid_hash'
        };

        const verification = await rbacService.verifyAuditIntegrity(suspiciousRecord);

        expect(verification.isValid).toBe(false);
        expect(verification.tamperedFields).toContain('hash');
        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'AUDIT_TAMPERING_DETECTED',
          recordId: 'audit_001',
          severity: 'CRITICAL'
        });
      });
    });
  });

  describe('7. Bulk Role Assignments (批量角色指派)', () => {
    describe('Department-wide Assignments', () => {
      test('should assign roles to entire department', async () => {
        const departmentId = 'health_department';
        const roleId = 'role_health_operator';
        const userIds = ['user_001', 'user_002', 'user_003'];

        mockDatabase.findUserById.mockImplementation((id) =>
          Promise.resolve({ id, department: departmentId })
        );

        const result = await rbacService.bulkAssignRoleByDepartment(
          departmentId,
          roleId
        );

        expect(result.successCount).toBe(3);
        expect(result.failureCount).toBe(0);
        expect(mockAuditLogger.logPermissionChange).toHaveBeenCalledTimes(3);
      });

      test('should handle partial failures in bulk assignment', async () => {
        const userIds = ['user_001', 'user_002', 'invalid_user'];
        const roleId = 'role_operator';

        mockDatabase.updateUserRoles
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error('User not found'));

        const result = await rbacService.bulkAssignRole(userIds, roleId);

        expect(result.successCount).toBe(2);
        expect(result.failureCount).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].userId).toBe('invalid_user');
      });

      test('should validate bulk assignment permissions', async () => {
        const operatorId = 'user_operator_001';
        const targetUsers = ['user_001', 'user_002'];
        const adminRoleId = 'role_admin';

        mockDatabase.findUserById.mockResolvedValue({
          id: operatorId,
          roles: ['role_operator']
        });

        await expect(rbacService.bulkAssignRole(
          targetUsers,
          adminRoleId,
          { operatorId }
        )).rejects.toThrow('Insufficient privileges for bulk admin assignment');
      });
    });

    describe('CSV Import Role Assignment', () => {
      test('should process CSV role assignment file', async () => {
        const csvData = `userId,role,department,justification
user_001,role_operator,衛生局,新進承辦人員
user_002,role_viewer,社會處,實習生觀察權限
user_003,role_admin,資訊室,系統管理需求`;

        const result = await rbacService.processBulkAssignmentCSV(csvData);

        expect(result.processedCount).toBe(3);
        expect(result.successCount).toBe(3);
        expect(mockAuditLogger.logPermissionChange).toHaveBeenCalledTimes(3);
      });

      test('should validate CSV format and reject invalid entries', async () => {
        const invalidCsvData = `userId,role
user_001,invalid_role
,role_operator
user_003,`;

        const result = await rbacService.processBulkAssignmentCSV(invalidCsvData);

        expect(result.processedCount).toBe(3);
        expect(result.successCount).toBe(0);
        expect(result.errors).toHaveLength(3);
      });
    });
  });

  describe('8. Time-Based Access Controls (時間基礎存取控制)', () => {
    describe('Scheduled Access', () => {
      test('should grant access during business hours', async () => {
        const userId = 'user_operator_001';
        const currentTime = new Date('2024-09-17T10:00:00+08:00'); // 10 AM Taiwan time

        jest.spyOn(Date, 'now').mockReturnValue(currentTime.getTime());

        const hasAccess = await rbacService.validateTimeBasedAccess(
          userId,
          'READ_CASES',
          {
            schedule: {
              allowedHours: { start: 8, end: 18 },
              timezone: 'Asia/Taipei',
              workdays: [1, 2, 3, 4, 5] // Monday to Friday
            }
          }
        );

        expect(hasAccess).toBe(true);
      });

      test('should deny access outside business hours', async () => {
        const userId = 'user_operator_001';
        const currentTime = new Date('2024-09-17T22:00:00+08:00'); // 10 PM Taiwan time

        jest.spyOn(Date, 'now').mockReturnValue(currentTime.getTime());

        const hasAccess = await rbacService.validateTimeBasedAccess(
          userId,
          'READ_CASES',
          {
            schedule: {
              allowedHours: { start: 8, end: 18 },
              timezone: 'Asia/Taipei'
            }
          }
        );

        expect(hasAccess).toBe(false);
        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'AFTER_HOURS_ACCESS_DENIED',
          userId,
          requestedTime: currentTime,
          allowedHours: { start: 8, end: 18 }
        });
      });

      test('should handle emergency override for time restrictions', async () => {
        const userId = 'user_emergency_001';
        const currentTime = new Date('2024-09-17T23:00:00+08:00'); // 11 PM

        const hasAccess = await rbacService.validateTimeBasedAccess(
          userId,
          'EMERGENCY_ACCESS',
          {
            allowEmergencyOverride: true,
            justification: '緊急失蹤案件處理',
            supervisorApproval: 'supervisor_001'
          }
        );

        expect(hasAccess).toBe(true);
        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'EMERGENCY_TIME_OVERRIDE',
          userId,
          justification: '緊急失蹤案件處理',
          supervisorApproval: 'supervisor_001'
        });
      });
    });

    describe('Temporary Access Grants', () => {
      test('should grant temporary elevated access', async () => {
        const userId = 'user_temp_001';
        const permission = 'EXPORT_DATA';
        const duration = 3600000; // 1 hour

        const tempAccess = await rbacService.grantTemporaryAccess(
          userId,
          permission,
          duration,
          {
            justification: '月報表匯出需求',
            approver: 'supervisor_001'
          }
        );

        expect(tempAccess.granted).toBe(true);
        expect(tempAccess.expiresAt).toBeDefined();
        expect(tempAccess.tempPermissionId).toBeDefined();
      });

      test('should automatically revoke expired temporary access', async () => {
        const tempPermissionId = 'temp_perm_001';

        // Mock expired permission
        mockDatabase.findPermissions.mockResolvedValue({
          id: tempPermissionId,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          userId: 'user_001',
          permission: 'EXPORT_DATA'
        });

        const isValid = await rbacService.validateTemporaryAccess(tempPermissionId);

        expect(isValid).toBe(false);
        expect(mockAuditLogger.logPermissionChange).toHaveBeenCalledWith({
          action: 'TEMPORARY_ACCESS_EXPIRED',
          tempPermissionId,
          userId: 'user_001'
        });
      });
    });
  });

  describe('9. Resource-Specific Permissions (資源特定權限)', () => {
    describe('Healthcare Data Access', () => {
      test('should validate medical record access permissions', async () => {
        const userId = 'user_medical_001';
        const patientId = 'patient_taiwan_001';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          medicalLicense: 'TW_MED_12345',
          specializations: ['geriatrics'],
          department: 'medical'
        });

        const hasAccess = await rbacService.validateMedicalRecordAccess(
          userId,
          patientId,
          'READ_MEDICAL_HISTORY'
        );

        expect(hasAccess).toBe(true);
        expect(mockAuditLogger.logAccessAttempt).toHaveBeenCalledWith({
          userId,
          resourceType: 'MEDICAL_RECORD',
          resourceId: patientId,
          result: 'GRANTED',
          medicalLicense: 'TW_MED_12345'
        });
      });

      test('should deny medical access without proper license', async () => {
        const userId = 'user_social_001';
        const patientId = 'patient_taiwan_001';

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          department: 'social_services',
          medicalLicense: null
        });

        const hasAccess = await rbacService.validateMedicalRecordAccess(
          userId,
          patientId,
          'READ_MEDICAL_HISTORY'
        );

        expect(hasAccess).toBe(false);
      });
    });

    describe('Location-Based Access', () => {
      test('should validate geographic boundary access', async () => {
        const userId = 'user_hsinchu_001';
        const resourceLocation = {
          county: '新竹縣',
          district: '竹北市',
          coordinates: { lat: 24.8387, lng: 121.0051 }
        };

        mockDatabase.findUserById.mockResolvedValue({
          id: userId,
          authorizedRegions: ['新竹縣'],
          department: 'hsinchu_county'
        });

        const hasAccess = await rbacService.validateGeographicAccess(
          userId,
          resourceLocation
        );

        expect(hasAccess).toBe(true);
      });

      test('should deny access to out-of-jurisdiction resources', async () => {
        const userId = 'user_hsinchu_001';
        const resourceLocation = {
          county: '台北市',
          district: '信義區'
        };

        const hasAccess = await rbacService.validateGeographicAccess(
          userId,
          resourceLocation
        );

        expect(hasAccess).toBe(false);
      });
    });
  });

  describe('10. Security Event Logging (安全事件記錄)', () => {
    describe('Suspicious Activity Detection', () => {
      test('should detect and log multiple failed access attempts', async () => {
        const userId = 'user_001';
        const failedAttempts = [
          { permission: 'DELETE_CASES', timestamp: new Date() },
          { permission: 'EXPORT_DATA', timestamp: new Date() },
          { permission: 'MANAGE_USERS', timestamp: new Date() }
        ];

        await rbacService.detectSuspiciousActivity(userId, failedAttempts);

        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'SUSPICIOUS_ACCESS_PATTERN',
          userId,
          failedAttempts: 3,
          severity: 'HIGH',
          requiresInvestigation: true
        });
      });

      test('should log privilege escalation attempts', async () => {
        const userId = 'user_operator_001';
        const attemptedRole = 'role_admin';

        await rbacService.logPrivilegeEscalationAttempt(userId, attemptedRole);

        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'PRIVILEGE_ESCALATION_ATTEMPT',
          userId,
          attemptedRole,
          currentRoles: expect.any(Array),
          severity: 'CRITICAL',
          autoBlock: true
        });
      });
    });

    describe('Compliance Reporting', () => {
      test('should generate GDPR compliance report', async () => {
        const dateRange = {
          start: new Date('2024-09-01'),
          end: new Date('2024-09-17')
        };

        const complianceReport = await rbacService.generateComplianceReport(
          'GDPR',
          dateRange
        );

        expect(complianceReport).toMatchObject({
          reportType: 'GDPR',
          period: dateRange,
          dataAccessEvents: expect.any(Number),
          dataExportEvents: expect.any(Number),
          consentWithdrawals: expect.any(Number),
          dataRetentionViolations: expect.any(Number)
        });
      });

      test('should generate Taiwan Personal Data Protection Act report', async () => {
        const complianceReport = await rbacService.generateComplianceReport(
          'TAIWAN_PDPA',
          { start: new Date('2024-09-01'), end: new Date('2024-09-17') }
        );

        expect(complianceReport.taiwanSpecificRequirements).toBeDefined();
        expect(complianceReport.crossBorderTransfers).toBeDefined();
        expect(complianceReport.sensitiveDataAccess).toBeDefined();
      });
    });

    describe('Real-time Security Monitoring', () => {
      test('should trigger real-time alerts for critical events', async () => {
        const criticalEvent = {
          type: 'MASS_DATA_EXPORT',
          userId: 'user_001',
          recordCount: 10000,
          includesPII: true
        };

        await rbacService.processCriticalSecurityEvent(criticalEvent);

        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          ...criticalEvent,
          severity: 'CRITICAL',
          alertSent: true,
          autoFreeze: true
        });
      });

      test('should implement circuit breaker for repeated violations', async () => {
        const userId = 'user_violations_001';

        // Simulate multiple violations
        for (let i = 0; i < 5; i++) {
          await rbacService.recordSecurityViolation(userId, 'UNAUTHORIZED_ACCESS');
        }

        const userStatus = await rbacService.getUserSecurityStatus(userId);

        expect(userStatus.blocked).toBe(true);
        expect(userStatus.reason).toBe('CIRCUIT_BREAKER_TRIGGERED');
        expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith({
          type: 'USER_AUTO_BLOCKED',
          userId,
          violationCount: 5,
          blockDuration: 3600000 // 1 hour
        });
      });
    });
  });

  describe('Integration with Taiwan Healthcare Regulations', () => {
    test('should implement NHI data access controls', async () => {
      const userId = 'user_nhi_001';
      const nhiDataRequest = {
        patientId: 'P20240917001',
        dataType: 'MEDICAL_HISTORY',
        purpose: 'EMERGENCY_CARE'
      };

      const access = await rbacService.validateNHIDataAccess(userId, nhiDataRequest);

      expect(access.granted).toBe(true);
      expect(access.limitedFields).toBeDefined();
      expect(access.auditRequired).toBe(true);
    });

    test('should comply with MOHW data retention policies', async () => {
      const retentionPolicy = await rbacService.getMOHWRetentionPolicy('ELDER_CARE_DATA');

      expect(retentionPolicy.maxRetentionDays).toBe(2555); // 7 years
      expect(retentionPolicy.autoDeleteEnabled).toBe(true);
      expect(retentionPolicy.notificationBeforeDeletion).toBe(30); // 30 days notice
    });
  });
});