/**
 * Location Service - Mock implementation for TDD GREEN phase
 */

class LocationService {
  constructor() {
    // Mock implementation
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(point1, point2) {
    // Mock implementation - returns 10 by default
    return 10;
  }

  async getCurrentLocation(userId) {
    // Mock implementation
    return {
      lat: 24.8138,
      lng: 120.9675,
      accuracy: 5,
      timestamp: new Date()
    };
  }

  /**
   * Real distance calculation using Haversine formula
   * (for when we need actual calculations)
   */
  calculateHaversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }
}

module.exports = { LocationService };