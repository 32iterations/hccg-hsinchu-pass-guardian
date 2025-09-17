/**
 * Geofence Repository - Mock implementation for TDD GREEN phase
 */

class GeofenceRepository {
  constructor() {
    // Mock implementation
  }

  async findActiveByUser(userId) {
    // Mock implementation - returns empty array
    return [];
  }

  async getUserGeofenceStatus(userId, geofenceId) {
    // Mock implementation
    return {
      userId,
      geofenceId,
      status: 'outside',
      lastEntry: null,
      lastExit: null,
      dwellStartTime: null
    };
  }

  async updateGeofenceStatus(userId, geofenceId, statusData) {
    // Mock implementation
    return {
      userId,
      geofenceId,
      ...statusData,
      updatedAt: new Date()
    };
  }

  async getLastNotification(userId, geofenceId, eventType) {
    // Mock implementation - returns null for no previous notifications
    return null;
  }

  async saveEvent(event) {
    // Mock implementation
    return { ...event, id: `event-${Date.now()}` };
  }

  async getCooldownStatus(userId, geofenceId) {
    // Mock implementation
    return { active: false, remainingMs: 0 };
  }

  async findByCoordinates(lat, lng) {
    // Mock implementation
    return [];
  }

  async saveNotification(userId, geofenceId, eventType, timestamp = new Date()) {
    // Mock implementation
    return {
      userId,
      geofenceId,
      eventType,
      timestamp
    };
  }

  async countUserGeofences(userId) {
    // Mock implementation
    return 0;
  }

  async findByUserAndName(userId, name) {
    // Mock implementation
    return null;
  }

  async create(geofenceData) {
    // Mock implementation
    return {
      id: 'new-geofence-id',
      ...geofenceData,
      createdAt: new Date()
    };
  }

  async findById(geofenceId) {
    // Mock implementation
    return {
      id: geofenceId,
      name: 'Test Geofence',
      radius: 100,
      userId: 'test-user'
    };
  }

  async update(geofenceId, updates) {
    // Mock implementation
    return {
      id: geofenceId,
      ...updates,
      updatedAt: new Date()
    };
  }

  async findActiveByUsers(userIds) {
    // Mock implementation for batch processing
    return [];
  }
}

module.exports = { GeofenceRepository };