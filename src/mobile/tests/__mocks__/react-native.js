// React Native mock for Jest testing
module.exports = {
  Platform: {
    OS: 'ios',
    Version: '16.0',
    select: jest.fn((platforms) => platforms.ios || platforms.default)
  },

  Linking: {
    openURL: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getInitialURL: jest.fn(),
    canOpenURL: jest.fn().mockResolvedValue(true)
  },

  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },

  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },

  NativeModules: {},

  Alert: {
    alert: jest.fn()
  }
};