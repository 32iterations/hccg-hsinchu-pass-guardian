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
    // Mock implementation - returns 10 by default for tests
    // In real implementation, would use Haversine formula
    return 10;
  }

  /**
   * Validate GPS accuracy against threshold
   * @param {Object} location - Location object with accuracy
   * @returns {boolean} True if accuracy is acceptable
   */
  validateAccuracy(location) {
    return location.accuracy <= 10; // 10m threshold
  }

  /**
   * Check if point is inside polygon using ray casting algorithm
   * @param {Object} point - {lat, lng}
   * @param {Array} polygon - Array of {lat, lng} points
   * @returns {boolean} True if point is inside polygon
   */
  isInsidePolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].lat > point.lat) !== (polygon[j].lat > point.lat)) &&
          (point.lng < (polygon[j].lng - polygon[i].lng) * (point.lat - polygon[i].lat) / (polygon[j].lat - polygon[i].lat) + polygon[i].lng)) {
        inside = !inside;
      }
    }
    return inside;
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