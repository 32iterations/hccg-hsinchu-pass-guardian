/**
 * Permissions Management Utilities
 *
 * Handles permission requests and status checking for mobile platforms.
 */

class PermissionsManager {
  constructor() {
    this.PERMISSIONS = {
      BLUETOOTH_SCAN: "android.permission.BLUETOOTH_SCAN",
      BLUETOOTH_CONNECT: "android.permission.BLUETOOTH_CONNECT",
      BLUETOOTH_ADVERTISE: "android.permission.BLUETOOTH_ADVERTISE",
      ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
      ACCESS_COARSE_LOCATION: "android.permission.ACCESS_COARSE_LOCATION"
    };

    this.RESULTS = {
      GRANTED: "granted",
      DENIED: "denied",
      BLOCKED: "blocked",
      NEVER_ASK_AGAIN: "never_ask_again"
    };
  }

  /**
   * Check permission status
   */
  async check(permission) {
    if (process.env.NODE_ENV === "test") {
      return this.RESULTS.GRANTED;
    }

    // Mock implementation
    return this.RESULTS.DENIED;
  }

  /**
   * Request permissions
   */
  async request(permissions) {
    if (process.env.NODE_ENV === "test") {
      const results = {};
      for (const permission of permissions) {
        results[permission] = this.RESULTS.GRANTED;
      }
      return results;
    }

    // Mock implementation
    const results = {};
    for (const permission of permissions) {
      results[permission] = this.RESULTS.DENIED;
    }
    return results;
  }

  /**
   * Request multiple permissions
   */
  async requestMultiple(permissions) {
    return await this.request(permissions);
  }

  /**
   * Check if permission is granted
   */
  async isGranted(permission) {
    const status = await this.check(permission);
    return status === this.RESULTS.GRANTED;
  }

  /**
   * Get required Bluetooth permissions for Android 12+
   */
  getBluetoothPermissions() {
    return [
      this.PERMISSIONS.BLUETOOTH_SCAN,
      this.PERMISSIONS.BLUETOOTH_CONNECT
    ];
  }

  /**
   * Get location permissions
   */
  getLocationPermissions() {
    return [
      this.PERMISSIONS.ACCESS_FINE_LOCATION,
      this.PERMISSIONS.ACCESS_COARSE_LOCATION
    ];
  }
}

module.exports = { PermissionsManager };
