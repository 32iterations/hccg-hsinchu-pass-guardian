/**
 * Permissions utility module
 * Provides permission checking functions for BLE scanning and other operations
 */

const PERMISSIONS = {
  BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
  BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
  ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION'
};

const RESULTS = {
  GRANTED: 'granted',
  DENIED: 'denied',
  BLOCKED: 'blocked'
};

/**
 * Mock permission checker for testing and server environments
 */
class PermissionChecker {
  constructor() {
    this.RESULTS = RESULTS;
  }

  async check(permission) {
    // In server environment, always return granted for simulation
    if (process.env.NODE_ENV === 'test') {
      return RESULTS.GRANTED;
    }

    // In real app, this would call native permission APIs
    return RESULTS.GRANTED;
  }

  async request(permissions) {
    const result = {};

    if (Array.isArray(permissions)) {
      permissions.forEach(permission => {
        result[permission] = RESULTS.GRANTED;
      });
    } else {
      result[permissions] = RESULTS.GRANTED;
    }

    return result;
  }
}

module.exports = {
  PERMISSIONS,
  RESULTS,
  PermissionChecker,
  // Export default instance
  check: (permission) => new PermissionChecker().check(permission),
  request: (permissions) => new PermissionChecker().request(permissions)
};