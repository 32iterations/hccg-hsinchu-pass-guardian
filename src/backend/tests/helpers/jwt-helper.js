const jwt = require('jsonwebtoken');

class JWTTestHelper {
  constructor() {
    this.secret = process.env.JWT_SECRET || 'development-secret-key';
  }

  generateToken(payload, options = {}) {
    const defaultPayload = {
      userId: 'test-user-123',
      roles: ['user'],
      permissions: ['read:basic'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
    };

    const tokenPayload = { ...defaultPayload, ...payload };
    return jwt.sign(tokenPayload, this.secret, options);
  }

  generateExpiredToken(payload = {}) {
    const expiredPayload = {
      userId: 'test-user-123',
      roles: ['user'],
      permissions: ['read:basic'],
      iat: Math.floor(Date.now() / 1000) - (60 * 60 * 2), // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - (60 * 60) // 1 hour ago (expired)
    };

    return jwt.sign({ ...expiredPayload, ...payload }, this.secret);
  }

  generateAdminToken() {
    return this.generateToken({
      userId: 'admin-user-456',
      roles: ['admin', 'case_manager'],
      permissions: [
        'read_sensitive_data',
        'view_roles',
        'read_cases',
        'update_cases',
        'create_cases',
        'assign_cases',
        'view_detailed_kpis',
        'export_data',
        'admin_all'
      ],
      clearanceLevel: 'confidential'
    });
  }

  generateUserToken() {
    return this.generateToken({
      userId: 'regular-user-789',
      roles: ['user'],
      permissions: ['read:basic', 'read:own_data']
    });
  }

  generateCaseManagerToken() {
    return this.generateToken({
      userId: 'case-manager-321',
      roles: ['case_manager'],
      permissions: [
        'read:cases',
        'write:cases',
        'read:basic',
        'manage:cases'
      ]
    });
  }

  getTestTokens() {
    return {
      'valid-admin-token': this.generateAdminToken(),
      'admin-token': this.generateAdminToken(),
      'valid-user-token': this.generateUserToken(),
      'user-token': this.generateUserToken(),
      'case-manager-token': this.generateCaseManagerToken(),
      'valid-token': this.generateUserToken(),
      'expired-token': this.generateExpiredToken(),
      'invalid-token': 'clearly-invalid-token',
      'family-member-token': this.generateToken({
        userId: 'family123',
        roles: ['family_member'],
        permissions: ['read_own_cases', 'view_basic_info'],
        clearanceLevel: 'family'
      }),
      'unauthorized-user-token': this.generateToken({
        userId: 'unauthorized-999',
        roles: ['external_auditor'],
        permissions: ['read_audit_data'],
        clearanceLevel: 'audit_only'
      }),
      'volunteer-token': this.generateToken({
        userId: 'volunteer-001',
        roles: ['volunteer'],
        permissions: ['update_case_status', 'read_basic_data'],
        clearanceLevel: 'restricted'
      }),
      '承辦-user-token': this.generateToken({
        userId: 'case-worker-001',
        roles: ['case_worker'],
        permissions: ['read_sensitive_data', 'create_cases', 'assign_cases'],
        clearanceLevel: 'confidential'
      }),
      'restricted-user-token': this.generateToken({
        userId: 'social-worker-002',
        roles: ['social_worker'],
        permissions: ['read_basic_data'],
        clearanceLevel: 'restricted'
      })
    };
  }
}

module.exports = { JWTTestHelper };