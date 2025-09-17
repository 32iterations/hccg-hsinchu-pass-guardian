/**
 * Custom error classes for Safety Guardian services
 * These will be implemented during the GREEN phase
 */

class SafetyGuardianError extends Error {
  constructor(message, code = 'SAFETY_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }
}

class NCCValidationError extends SafetyGuardianError {
  constructor(message = 'NCC certification validation failed', details = {}) {
    super(message, 'NCC_VALIDATION_FAILED', details);
  }
}

class DuplicateDeviceError extends SafetyGuardianError {
  constructor(message = 'Device serial number already registered', details = {}) {
    super(message, 'DUPLICATE_DEVICE', details);
  }
}

class BLEConnectionError extends SafetyGuardianError {
  constructor(message = 'BLE connection failed', details = {}) {
    super(message, 'BLE_CONNECTION_FAILED', details);
  }
}

class GeofenceViolationError extends SafetyGuardianError {
  constructor(message = 'Geofence violation detected', details = {}) {
    super(message, 'GEOFENCE_VIOLATION', details);
  }
}

class LocationAccuracyError extends SafetyGuardianError {
  constructor(message = 'Location accuracy insufficient for reliable geofence detection', details = {}) {
    super(message, 'LOCATION_ACCURACY_ERROR', details);
  }
}

class CooldownActiveError extends SafetyGuardianError {
  constructor(message = 'Notification cooldown is still active', details = {}) {
    super(message, 'COOLDOWN_ACTIVE', details);
  }
}

module.exports = {
  SafetyGuardianError,
  NCCValidationError,
  DuplicateDeviceError,
  BLEConnectionError,
  GeofenceViolationError,
  LocationAccuracyError,
  CooldownActiveError
};