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

  // Mock window.location only if it doesn't exist or isn't already mocked
  if (!window.location || !window.location.mockClear) {
    delete window.location;
    window.location = {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn()
    };
  }
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