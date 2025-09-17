// Jest setup file for global test configuration
require('@testing-library/jest-dom');

// Polyfill for TextEncoder/TextDecoder (Node.js 18+ compatibility)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock DOM APIs only if window exists (JSDOM environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Override global location with a simple mock that just tracks changes
  global.mockLocation = {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    toString: () => 'http://localhost:3000'
  };

  // Don't try to override window.location, just intercept its usage

  // Mock history API
  Object.defineProperty(window, 'history', {
    value: {
      pushState: jest.fn(),
      replaceState: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      go: jest.fn(),
      length: 1,
      scrollRestoration: 'auto',
      state: null
    },
    writable: true
  });

  // Mock URL constructor to work with our custom location
  const OriginalURL = global.URL;
  global.URL = class extends OriginalURL {
    constructor(url, base) {
      // If no base is provided and url is relative, use our mock location
      if (!base && typeof url === 'string' && !url.includes('://')) {
        base = mockLocation.href;
      }
      super(url, base || mockLocation.href);
    }
  };
}

// Global console warning suppression for known issues
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress specific known warnings that don't affect functionality
  if (args[0] && typeof args[0] === 'string' &&
      args[0].includes('A function to advance timers was called')) {
    return;
  }
  originalWarn.apply(console, args);
};

// Setup global test utilities
global.jest = jest;