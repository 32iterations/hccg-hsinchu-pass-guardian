// Test setup and mocks
const jwt = require('jsonwebtoken');

// Polyfill for TextEncoder/TextDecoder if not available (Node < 18)
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Setup Jest environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.API_BASE_URL = 'http://localhost:3000';

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Mock JWT tokens for testing
const mockTokens = {
  'valid-jwt-token': {
    userId: 'user123',
    roles: ['viewer'],
    permissions: ['read_cases', 'view_kpis', 'view_roles']
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
    permissions: ['read_cases', 'create_cases', 'view_kpis']
  },
  'family-member-token': {
    userId: 'family123',
    roles: ['family_member'],
    permissions: ['read_cases', 'create_cases', 'view_kpis']
  },
  'volunteer-token': {
    userId: 'volunteer123',
    roles: ['volunteer'],
    permissions: ['read_cases', 'update_case_status', 'search_cases']
  },
  'case-manager-token': {
    userId: 'manager123',
    roles: ['case_manager'],
    permissions: ['read_cases', 'update_cases', 'assign_cases', 'view_dashboard']
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
  // Handle test tokens - strip Bearer prefix if present
  let cleanToken = token;
  if (typeof token === 'string' && token.startsWith('Bearer ')) {
    cleanToken = token.substring(7);
  }

  // Check for mock tokens first
  if (mockTokens[cleanToken]) {
    return mockTokens[cleanToken];
  }

  // Handle explicit test error tokens
  if (cleanToken === 'invalid-token' || cleanToken === 'expired-token') {
    const error = new Error('Invalid token');
    error.name = cleanToken === 'expired-token' ? 'TokenExpiredError' : 'JsonWebTokenError';
    throw error;
  }

  // For actual JWT tokens or if no mock found, use original verification
  try {
    return originalVerify(token, secret, options);
  } catch (error) {
    // If original verification fails, treat as invalid
    const jwtError = new Error('Invalid or expired token');
    jwtError.name = 'JsonWebTokenError';
    throw jwtError;
  }
};

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = jest.fn();

afterAll(() => {
  // Restore original implementations
  jwt.verify = originalVerify;
  console.error = originalConsoleError;
});

// Cleanup function for tests
global.afterEach(() => {
  jest.clearAllMocks();
});

module.exports = { mockTokens };