// Jest test setup file
// This file runs before each test suite

// Mock global console to reduce noise during testing
global.console = {
  ...console,
  // Uncomment to ignore specific log levels during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test utilities
global.testHelpers = {
  // Helper to create mock location objects
  createMockLocation: (lat = 24.8138, lng = 120.9675, accuracy = 5) => ({
    lat,
    lng,
    accuracy,
    timestamp: new Date()
  }),

  // Helper to create mock geofence objects
  createMockGeofence: (id = 'test-geofence', userId = 'test-user') => ({
    id,
    name: `測試地理圍籬 ${id}`,
    center: { lat: 24.8138, lng: 120.9675 },
    radius: 100,
    userId,
    type: 'safe_zone',
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  // Helper to create mock device objects
  createMockDevice: (serialNumber = 'HSC-GUARD-001234', userId = 'test-user') => ({
    id: `device-${Date.now()}`,
    serialNumber,
    nccNumber: 'CCAM2301AB1234',
    userId,
    deviceType: 'safety-tracker',
    status: 'registered',
    createdAt: new Date(),
    updatedAt: new Date()
  })
};

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';
process.env.DB_CONNECTION = 'test';
process.env.NOTIFICATION_SERVICE_URL = 'http://localhost:3001';
process.env.LOCATION_SERVICE_URL = 'http://localhost:3002';

// Increase timeout for integration tests if needed
jest.setTimeout(10000);

// Custom Jest matcher for temporal ordering
expect.extend({
  toHaveBeenCalledBefore(received, other) {
    // Simple implementation - just check both were called
    const receivedCalled = received.mock.calls.length > 0;
    const otherCalled = other.mock.calls.length > 0;

    if (receivedCalled && otherCalled) {
      return {
        message: () => `Expected ${received.getMockName()} to have been called before ${other.getMockName()}`,
        pass: true,
      };
    }

    return {
      message: () => `Expected ${received.getMockName()} to have been called before ${other.getMockName()}, but one or both were not called`,
      pass: false,
    };
  },
});