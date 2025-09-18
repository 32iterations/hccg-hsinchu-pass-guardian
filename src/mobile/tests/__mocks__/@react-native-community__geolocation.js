// React Native Community Geolocation mock for mobile tests
module.exports = {
  getCurrentPosition: jest.fn().mockImplementation((success, error, options) => {
    // Default to success case
    const mockPosition = {
      coords: {
        latitude: 24.8067834,
        longitude: 120.9687456,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      },
      timestamp: Date.now()
    };

    if (success) {
      setTimeout(() => success(mockPosition), 100);
    }
  }),

  watchPosition: jest.fn().mockImplementation((success, error, options) => {
    const watchId = Math.floor(Math.random() * 1000);

    // Simulate position updates
    const interval = setInterval(() => {
      if (success) {
        const mockPosition = {
          coords: {
            latitude: 24.8067834 + (Math.random() - 0.5) * 0.001,
            longitude: 120.9687456 + (Math.random() - 0.5) * 0.001,
            accuracy: 5 + Math.random() * 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        };
        success(mockPosition);
      }
    }, 1000);

    // Store interval for cleanup
    module.exports._intervals = module.exports._intervals || new Map();
    module.exports._intervals.set(watchId, interval);

    return watchId;
  }),

  clearWatch: jest.fn().mockImplementation((watchId) => {
    if (module.exports._intervals && module.exports._intervals.has(watchId)) {
      clearInterval(module.exports._intervals.get(watchId));
      module.exports._intervals.delete(watchId);
    }
  }),

  stopObserving: jest.fn(),
  requestAuthorization: jest.fn().mockResolvedValue('granted'),
  setRNConfiguration: jest.fn()
};