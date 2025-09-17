// Test setup and mocks
const jwt = require('jsonwebtoken');

// Mock JWT tokens for testing
const mockTokens = {
  'valid-jwt-token': {
    userId: 'user123',
    roles: ['viewer'],
    permissions: ['read_cases', 'view_kpis']
  },
  'valid-admin-token': {
    userId: 'admin123',
    roles: ['admin'],
    permissions: ['*']
  },
  'admin-token': {
    userId: 'admin123',
    roles: ['admin'],
    permissions: ['*']
  },
  'user-token': {
    userId: 'user456',
    roles: ['family_member'],
    permissions: ['read_cases', 'create_cases']
  },
  'family-member-token': {
    userId: 'family123',
    roles: ['family_member'],
    permissions: ['read_cases', 'create_cases']
  },
  'volunteer-token': {
    userId: 'volunteer123',
    roles: ['volunteer'],
    permissions: ['read_cases', 'update_case_status', 'search_cases']
  },
  'case-manager-token': {
    userId: 'manager123',
    roles: ['case_manager'],
    permissions: ['read_cases', 'update_cases', 'assign_cases']
  },
  'limited-permission-token': {
    userId: 'limited123',
    roles: ['limited'],
    permissions: ['read_basic']
  },
  'unauthorized-user-token': {
    userId: 'unauthorized123',
    roles: ['guest'],
    permissions: []
  },
  'unauthorized-token': {
    userId: 'unauthorized456',
    roles: [],
    permissions: []
  },
  'other-user-token': {
    userId: 'other789',
    roles: ['user'],
    permissions: ['read_own_data']
  },
  'valid-user-token': {
    userId: 'user789',
    roles: ['user'],
    permissions: ['read_cases', 'create_cases']
  },
  'valid-token': {
    userId: 'user999',
    roles: ['user'],
    permissions: ['read_cases']
  }
};

// Override JWT verify for testing
const originalVerify = jwt.verify;
jwt.verify = (token, secret, options) => {
  // Handle test tokens
  if (token.startsWith('Bearer ')) {
    token = token.substring(7);
  }

  if (mockTokens[token]) {
    return mockTokens[token];
  }

  if (token === 'invalid-token' || token === 'expired-token') {
    const error = new Error('Invalid token');
    error.name = token === 'expired-token' ? 'TokenExpiredError' : 'JsonWebTokenError';
    throw error;
  }

  // Fall back to original implementation
  return originalVerify(token, secret, options);
};

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = jest.fn();

afterAll(() => {
  // Restore original implementations
  jwt.verify = originalVerify;
  console.error = originalConsoleError;
});

module.exports = { mockTokens };