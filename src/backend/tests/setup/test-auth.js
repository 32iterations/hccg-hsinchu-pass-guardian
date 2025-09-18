/**
 * Test Authentication Setup
 * Provides mock authentication for integration tests
 */

const jwt = require('jsonwebtoken');

class TestAuthSetup {
  constructor() {
    this.testTokens = {
      'Bearer admin-token': {
        userId: 'admin-123',
        email: 'admin@test.com',
        roles: ['admin', 'case_manager'],
        permissions: ['create_cases', 'read_cases', 'update_cases', 'delete_cases', 'search_cases', 'manage_users', 'admin:all']
      },
      'Bearer family-member-token': {
        userId: 'family-123',
        email: 'family@test.com',
        roles: ['family'],
        permissions: ['create_cases', 'read_cases', 'update_cases']
      },
      'Bearer volunteer-token': {
        userId: 'volunteer-123',
        email: 'volunteer@test.com',
        roles: ['volunteer'],
        permissions: ['read_cases', 'update_cases']
      },
      'Bearer user-token': {
        userId: 'user-456',
        email: 'user@test.com',
        roles: ['user'],
        permissions: ['read_cases']
      }
    };
  }

  setupMockAuth() {
    // Mock the auth middleware for tests
    jest.mock('../../src/middleware/auth', () => {
      return {
        AuthMiddleware: class MockAuthMiddleware {
          constructor() {
            this.testTokens = this.testTokens;
          }

          authenticate() {
            return (req, res, next) => {
              const token = req.headers.authorization;

              if (!token) {
                return res.status(401).json({
                  success: false,
                  error: 'Unauthorized',
                  message: 'No token provided'
                });
              }

              // Check test tokens
              const testUser = this.testTokens[token];
              if (testUser) {
                req.user = testUser;
                return next();
              }

              // Default unauthorized
              return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Invalid token'
              });
            };
          }

          requirePermissions(permissions) {
            return (req, res, next) => {
              if (!req.user) {
                return res.status(401).json({
                  success: false,
                  error: 'Unauthorized'
                });
              }

              // Admin bypass
              if (req.user.roles.includes('admin')) {
                return next();
              }

              // Check permissions
              const hasPermission = permissions.every(perm =>
                req.user.permissions.includes(perm)
              );

              if (!hasPermission) {
                return res.status(403).json({
                  success: false,
                  error: 'Forbidden',
                  message: 'Insufficient permissions'
                });
              }

              next();
            };
          }

          requireRoles(roles) {
            return (req, res, next) => {
              if (!req.user) {
                return res.status(401).json({
                  success: false,
                  error: 'Unauthorized'
                });
              }

              const hasRole = roles.some(role => req.user.roles.includes(role));

              if (!hasRole) {
                return res.status(403).json({
                  success: false,
                  error: 'Forbidden',
                  message: 'Insufficient role'
                });
              }

              next();
            };
          }
        }
      };
    });
  }

  getTestToken(role) {
    return `Bearer ${role}-token`;
  }

  getTestUser(role) {
    return this.testTokens[`Bearer ${role}-token`];
  }
}

module.exports = TestAuthSetup;