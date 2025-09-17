/**
 * Event Emitter Service - Mock implementation for TDD GREEN phase
 */

class EventEmitter {
  constructor() {
    this.events = new Map();
  }

  emit(eventName, data) {
    // Mock implementation - just store the event
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    this.events.get(eventName).push({
      data,
      timestamp: new Date()
    });
    return true;
  }

  on(eventName, callback) {
    // Mock implementation
    return this;
  }

  off(eventName, callback) {
    // Mock implementation
    return this;
  }

  getEvents(eventName) {
    // Helper for testing
    return this.events.get(eventName) || [];
  }
}

module.exports = { EventEmitter };