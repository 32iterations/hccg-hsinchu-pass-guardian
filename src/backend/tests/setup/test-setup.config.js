/**
 * @fileoverview Backend Test Setup - London School TDD Mock Infrastructure
 * @description Comprehensive test setup for backend services with proper mock isolation
 *
 * London School TDD Patterns:
 * - Mock all external dependencies
 * - Focus on interaction testing
 * - Verify object collaborations
 * - Isolate units completely
 *
 * @author Taiwan Emergency Response System - TDD Swarm
 * @created 2025-09-17
 */

const { TextEncoder, TextDecoder } = require('util');

// Ensure polyfills are available globally
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Enhanced performance mock for backend testing
global.performance = global.performance || {
  now: () => Date.now(),
  mark: (name) => ({ name, startTime: Date.now() }),
  measure: (name, startMark, endMark) => ({ name, duration: Date.now() - (startMark?.startTime || 0) }),
  getEntriesByName: () => [],
  getEntriesByType: () => []
};

/**
 * London School Mock Factory
 * Creates properly isolated mocks for external dependencies
 */
class MockFactory {
  /**
   * Create repository mock with standard CRUD operations
   */
  static createRepositoryMock(customMethods = {}) {
    return {
      findById: jest.fn().mockResolvedValue(null),
      findBySerialNumber: jest.fn().mockResolvedValue(null),
      findByUserAndName: jest.fn().mockResolvedValue(null),
      findActiveByUser: jest.fn().mockResolvedValue([]),
      findActiveByUsers: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      update: jest.fn().mockResolvedValue({ id: 'mock-id' }),
      updateStatus: jest.fn().mockResolvedValue({ id: 'mock-id', status: 'updated' }),
      delete: jest.fn().mockResolvedValue(true),
      count: jest.fn().mockResolvedValue(0),
      countUserGeofences: jest.fn().mockResolvedValue(0),
      checkNCCRegistry: jest.fn().mockResolvedValue(true),
      getUserGeofenceStatus: jest.fn().mockResolvedValue(null),
      updateGeofenceStatus: jest.fn().mockResolvedValue({}),
      getLastNotification: jest.fn().mockResolvedValue(null),
      saveUserConsent: jest.fn().mockResolvedValue({ consentRecorded: true }),
      getUserConsent: jest.fn().mockResolvedValue({ consentRecorded: true }),
      ...customMethods
    };
  }

  /**
   * Create service mock with standard service operations
   */
  static createServiceMock(customMethods = {}) {
    return {
      process: jest.fn().mockResolvedValue({}),
      validate: jest.fn().mockResolvedValue(true),
      execute: jest.fn().mockResolvedValue({}),
      hasPermission: jest.fn().mockResolvedValue(true),
      getUserRole: jest.fn().mockResolvedValue('USER'),
      getRolePermissions: jest.fn().mockResolvedValue([]),
      checkResourceAvailability: jest.fn().mockResolvedValue(true),
      getAvailableResources: jest.fn().mockResolvedValue({}),
      log: jest.fn().mockResolvedValue(true),
      ...customMethods
    };
  }

  /**
   * Create notification service mock
   */
  static createNotificationMock() {
    return {
      send: jest.fn().mockResolvedValue(true),
      sendGeofenceAlert: jest.fn().mockResolvedValue(true),
      sendDwellAlert: jest.fn().mockResolvedValue(true),
      sendEmergencyAlert: jest.fn().mockResolvedValue(true),
      sendDeviceBindingNotification: jest.fn().mockResolvedValue(true),
      sendConnectionAlert: jest.fn().mockResolvedValue(true),
      sendGeofenceUpdateNotification: jest.fn().mockResolvedValue(true),
      notifyAssignment: jest.fn().mockResolvedValue(true),
      createCommunicationChannel: jest.fn().mockResolvedValue(true),
      emergencyBroadcast: jest.fn().mockResolvedValue(true),
      broadcast: jest.fn().mockResolvedValue(true),
      createWebSocketSubscription: jest.fn().mockResolvedValue(true),
      notifyQualifiedVolunteers: jest.fn().mockResolvedValue(true),
      sendVolunteerAlert: jest.fn().mockResolvedValue(true)
    };
  }

  /**
   * Create location service mock
   */
  static createLocationMock() {
    return {
      calculateDistance: jest.fn().mockReturnValue(0),
      getCurrentLocation: jest.fn().mockResolvedValue({
        latitude: 24.8138,
        longitude: 120.9675,
        accuracy: 5,
        timestamp: new Date()
      }),
      validateCoordinates: jest.fn().mockReturnValue(true),
      getAddress: jest.fn().mockResolvedValue('新竹市東區中正路1號')
    };
  }

  /**
   * Create BLE manager mock
   */
  static createBLEMock() {
    return {
      connect: jest.fn().mockResolvedValue({ connected: true }),
      disconnect: jest.fn().mockResolvedValue(true),
      scan: jest.fn().mockResolvedValue([]),
      getConnectionStatus: jest.fn().mockResolvedValue({ connected: true }),
      getDeviceMetrics: jest.fn().mockResolvedValue({
        signalStrength: -45,
        batteryLevel: 75,
        lastSeen: new Date()
      }),
      startScan: jest.fn().mockResolvedValue(true),
      stopScan: jest.fn().mockResolvedValue(true),
      isScanning: jest.fn().mockReturnValue(false),
      setPowerLevel: jest.fn().mockResolvedValue(true),
      setScanParameters: jest.fn().mockResolvedValue(true),
      onDeviceDiscovered: jest.fn()
    };
  }

  /**
   * Create event emitter mock
   */
  static createEventEmitterMock() {
    return {
      emit: jest.fn().mockReturnValue(true),
      on: jest.fn().mockReturnValue(undefined),
      off: jest.fn().mockReturnValue(undefined),
      once: jest.fn().mockReturnValue(undefined),
      removeListener: jest.fn().mockReturnValue(undefined),
      removeAllListeners: jest.fn().mockReturnValue(undefined)
    };
  }
}

/**
 * Test Data Factory
 * Creates consistent test data objects
 */
class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      id: 'user-123',
      name: '測試用戶',
      email: 'test@example.com',
      role: 'USER',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...overrides
    };
  }

  static createGeofence(overrides = {}) {
    return {
      id: 'geofence-123',
      name: '測試安全區域',
      center: { lat: 24.8138, lng: 120.9675 },
      radius: 100,
      type: 'safe_zone',
      userId: 'user-123',
      active: true,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...overrides
    };
  }

  static createDevice(overrides = {}) {
    return {
      id: 'device-123',
      serialNumber: 'HSC-GUARD-001234',
      nccNumber: 'CCAM2301AB1234',
      userId: 'user-123',
      deviceType: 'safety-tracker',
      status: 'registered',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...overrides
    };
  }

  static createLocation(overrides = {}) {
    return {
      latitude: 24.8138,
      longitude: 120.9675,
      accuracy: 5,
      timestamp: new Date(),
      ...overrides
    };
  }

  static createCase(overrides = {}) {
    return {
      caseId: 'case-123',
      caseNumber: 'HC20250917-0001',
      type: 'MISSING_PERSON',
      title: '測試案件',
      status: 'CREATED',
      severity: 'MEDIUM',
      priority: 1,
      createdBy: 'user-123',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      ...overrides
    };
  }

  static createVolunteerHit(overrides = {}) {
    return {
      anonymousId: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2025-09-17T16:45:00Z',
      gridSquare: '24.8067,120.9687',
      rssi: -75,
      deviceHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01',
      ...overrides
    };
  }
}

/**
 * London School Test Assertions
 * Enhanced assertions for interaction testing
 */
class LondonSchoolAssertions {
  /**
   * Assert that a mock was called with specific collaboration pattern
   */
  static assertCollaboration(mockFunction, expectedCalls) {
    expect(mockFunction).toHaveBeenCalledTimes(expectedCalls.length);
    expectedCalls.forEach((call, index) => {
      expect(mockFunction).toHaveBeenNthCalledWith(index + 1, ...call);
    });
  }

  /**
   * Assert that mocks were called in specific order
   */
  static assertCallOrder(mocks) {
    const allCalls = [];
    mocks.forEach(mock => {
      mock.mock.invocationCallOrder.forEach(order => {
        allCalls.push({ mock: mock.getMockName() || 'unknown', order });
      });
    });

    allCalls.sort((a, b) => a.order - b.order);
    const actualOrder = allCalls.map(call => call.mock);
    const expectedOrder = mocks.map(mock => mock.getMockName() || 'unknown');

    expect(actualOrder).toEqual(expectedOrder);
  }

  /**
   * Assert that no direct state access occurred (London School principle)
   */
  static assertNoStateAccess(objectUnderTest, prohibitedProperties) {
    prohibitedProperties.forEach(prop => {
      expect(objectUnderTest).not.toHaveProperty(prop);
    });
  }
}

// Export utilities for test files
global.MockFactory = MockFactory;
global.TestDataFactory = TestDataFactory;
global.LondonSchoolAssertions = LondonSchoolAssertions;

// Enhanced test utilities
global.testUtils = {
  ...global.testUtils,

  // Mock factory shortcuts
  mockRepo: MockFactory.createRepositoryMock,
  mockService: MockFactory.createServiceMock,
  mockNotification: MockFactory.createNotificationMock,
  mockLocation: MockFactory.createLocationMock,
  mockBLE: MockFactory.createBLEMock,
  mockEventEmitter: MockFactory.createEventEmitterMock,

  // Test data shortcuts
  createUser: TestDataFactory.createUser,
  createGeofence: TestDataFactory.createGeofence,
  createDevice: TestDataFactory.createDevice,
  createLocation: TestDataFactory.createLocation,
  createCase: TestDataFactory.createCase,
  createVolunteerHit: TestDataFactory.createVolunteerHit,

  // Assertion shortcuts
  assertCollaboration: LondonSchoolAssertions.assertCollaboration,
  assertCallOrder: LondonSchoolAssertions.assertCallOrder,
  assertNoStateAccess: LondonSchoolAssertions.assertNoStateAccess,

  // Timing utilities
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  advanceTimers: (ms) => jest.advanceTimersByTime(ms),

  // Mock reset utilities
  resetAllMocks: () => jest.clearAllMocks(),
  restoreAllMocks: () => jest.restoreAllMocks()
};

module.exports = {
  MockFactory,
  TestDataFactory,
  LondonSchoolAssertions
};