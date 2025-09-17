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
        'read:rbac',
        'write:rbac',
        'read:cases',
        'write:cases',
        'read:audit',
        'admin:all'
      ]
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
      'invalid-token': 'clearly-invalid-token'
    };
  }
}

module.exports = { JWTTestHelper };