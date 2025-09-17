/**
 * Safety Service Error Definitions
 * 新竹通安心守護 - 錯誤定義
 */

class NCCValidationError extends Error {
  constructor(message, code = 'NCC_VALIDATION_FAILED') {
    super(message);
    this.name = 'NCCValidationError';
    this.code = code;
  }
}

class DuplicateDeviceError extends Error {
  constructor(message, code = 'DUPLICATE_DEVICE') {
    super(message);
    this.name = 'DuplicateDeviceError';
    this.code = code;
  }
}

class BLEConnectionError extends Error {
  constructor(message, code = 'BLE_CONNECTION_FAILED') {
    super(message);
    this.name = 'BLEConnectionError';
    this.code = code;
  }
}

class GeofenceViolationError extends Error {
  constructor(message, code = 'GEOFENCE_VIOLATION') {
    super(message);
    this.name = 'GeofenceViolationError';
    this.code = code;
  }
}

class LocationAccuracyError extends Error {
  constructor(message, code = 'LOCATION_ACCURACY_INSUFFICIENT') {
    super(message);
    this.name = 'LocationAccuracyError';
    this.code = code;
  }
}

class CooldownActiveError extends Error {
  constructor(message, code = 'COOLDOWN_ACTIVE') {
    super(message);
    this.name = 'CooldownActiveError';
    this.code = code;
  }
}

module.exports = {
  NCCValidationError,
  DuplicateDeviceError,
  BLEConnectionError,
  GeofenceViolationError,
  LocationAccuracyError,
  CooldownActiveError
};