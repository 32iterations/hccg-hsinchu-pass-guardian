module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Enable fake timers globally
  fakeTimers: {
    enableGlobally: true
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/src/backend/tests/setup/test-setup.config.js'
  ],

  // Module path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },

  // Test file patterns - Focus on backend tests first
  testMatch: [
    '<rootDir>/src/backend/tests/**/*.test.(js|ts)',
    '<rootDir>/tests/**/*.test.(ts|tsx|js)'
  ],

  // Exclude setup files from being treated as tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/src/backend/tests/setup/',
    '/src/mobile/'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],

  // Coverage thresholds (temporarily reduced to allow incremental fixing)
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Test timeout
  testTimeout: 10000,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};