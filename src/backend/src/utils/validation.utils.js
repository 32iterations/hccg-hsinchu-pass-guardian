/**
 * Validation Utilities - Common validation patterns for safety services
 *
 * Centralized validation functions to maintain DRY principles and ensure
 * consistent validation logic across all safety services.
 *
 * @module ValidationUtils
 * @version 2.0.0
 */

const {
  NCC_VALIDATION,
  DEVICE_SERIAL,
  LOCATION,
  GEOFENCE,
  ERROR_MESSAGES
} = require('../constants/safety-service.constants');

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {string} [error] - Error message if validation failed
 * @property {Object} [details] - Additional validation details
 */

/**
 * NCC Number Validation Utilities
 */
class NCCValidator {
  /**
   * Validate NCC number format
   * @param {string} nccNumber - NCC number to validate
   * @returns {ValidationResult} Validation result
   */
  static validateFormat(nccNumber) {
    if (!nccNumber || typeof nccNumber !== 'string') {
      return {
        isValid: false,
        error: 'NCC number is required and must be a string'
      };
    }

    if (nccNumber.length !== NCC_VALIDATION.LENGTH) {
      return {
        isValid: false,
        error: `NCC number must be ${NCC_VALIDATION.LENGTH} characters long`
      };
    }

    if (!NCC_VALIDATION.PATTERN.test(nccNumber)) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.NCC_INVALID_FORMAT
      };
    }

    return { isValid: true };
  }

  /**
   * Validate NCC year component
   * @param {string} nccNumber - NCC number containing year
   * @returns {ValidationResult} Validation result
   */
  static validateYear(nccNumber) {
    const formatValidation = this.validateFormat(nccNumber);
    if (!formatValidation.isValid) {
      return formatValidation;
    }

    const yearStr = nccNumber.substring(
      NCC_VALIDATION.YEAR_START_INDEX,
      NCC_VALIDATION.YEAR_END_INDEX
    );
    const year = parseInt(yearStr, 10);

    if (year < NCC_VALIDATION.MIN_YEAR || year > NCC_VALIDATION.MAX_YEAR) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.NCC_INVALID_YEAR,
        details: { extractedYear: year, validRange: [NCC_VALIDATION.MIN_YEAR, NCC_VALIDATION.MAX_YEAR] }
      };
    }

    return {
      isValid: true,
      details: { extractedYear: year }
    };
  }

  /**
   * Complete NCC number validation
   * @param {string} nccNumber - NCC number to validate
   * @returns {ValidationResult} Validation result
   */
  static validate(nccNumber) {
    const formatValidation = this.validateFormat(nccNumber);
    if (!formatValidation.isValid) {
      return formatValidation;
    }

    const yearValidation = this.validateYear(nccNumber);
    if (!yearValidation.isValid) {
      return yearValidation;
    }

    return {
      isValid: true,
      details: {
        format: 'valid',
        year: yearValidation.details.extractedYear,
        fullNumber: nccNumber
      }
    };
  }
}

/**
 * Device Serial Number Validation Utilities
 */
class DeviceSerialValidator {
  /**
   * Validate device serial number format
   * @param {string} serialNumber - Serial number to validate
   * @returns {ValidationResult} Validation result
   */
  static validate(serialNumber) {
    if (!serialNumber || typeof serialNumber !== 'string') {
      return {
        isValid: false,
        error: 'Serial number is required and must be a string'
      };
    }

    if (!DEVICE_SERIAL.PATTERN.test(serialNumber)) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.DEVICE_INVALID_SERIAL
      };
    }

    const serialPart = serialNumber.replace(DEVICE_SERIAL.PREFIX, '');

    return {
      isValid: true,
      details: {
        prefix: DEVICE_SERIAL.PREFIX,
        serialPart: serialPart,
        fullSerial: serialNumber
      }
    };
  }
}

/**
 * Location and Coordinates Validation Utilities
 */
class LocationValidator {
  /**
   * Validate latitude coordinate
   * @param {number} lat - Latitude to validate
   * @returns {ValidationResult} Validation result
   */
  static validateLatitude(lat) {
    if (typeof lat !== 'number' || isNaN(lat)) {
      return {
        isValid: false,
        error: 'Latitude must be a valid number'
      };
    }

    if (lat < LOCATION.LATITUDE_RANGE.MIN || lat > LOCATION.LATITUDE_RANGE.MAX) {
      return {
        isValid: false,
        error: `Latitude must be between ${LOCATION.LATITUDE_RANGE.MIN} and ${LOCATION.LATITUDE_RANGE.MAX}`,
        details: { value: lat, validRange: LOCATION.LATITUDE_RANGE }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate longitude coordinate
   * @param {number} lng - Longitude to validate
   * @returns {ValidationResult} Validation result
   */
  static validateLongitude(lng) {
    if (typeof lng !== 'number' || isNaN(lng)) {
      return {
        isValid: false,
        error: 'Longitude must be a valid number'
      };
    }

    if (lng < LOCATION.LONGITUDE_RANGE.MIN || lng > LOCATION.LONGITUDE_RANGE.MAX) {
      return {
        isValid: false,
        error: `Longitude must be between ${LOCATION.LONGITUDE_RANGE.MIN} and ${LOCATION.LONGITUDE_RANGE.MAX}`,
        details: { value: lng, validRange: LOCATION.LONGITUDE_RANGE }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate GPS accuracy
   * @param {number} accuracy - GPS accuracy in meters
   * @returns {ValidationResult} Validation result
   */
  static validateAccuracy(accuracy) {
    if (typeof accuracy !== 'number' || isNaN(accuracy)) {
      return {
        isValid: false,
        error: 'GPS accuracy must be a valid number'
      };
    }

    if (accuracy < 0) {
      return {
        isValid: false,
        error: 'GPS accuracy cannot be negative',
        details: { value: accuracy }
      };
    }

    if (accuracy > LOCATION.ACCURACY_THRESHOLD_METERS) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.LOCATION_ACCURACY_EXCEEDED
          .replace('{{accuracy}}', accuracy)
          .replace('{{threshold}}', LOCATION.ACCURACY_THRESHOLD_METERS),
        details: {
          value: accuracy,
          threshold: LOCATION.ACCURACY_THRESHOLD_METERS,
          exceededBy: accuracy - LOCATION.ACCURACY_THRESHOLD_METERS
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate complete coordinate set
   * @param {Object} coordinates - Coordinates object
   * @param {number} coordinates.lat - Latitude
   * @param {number} coordinates.lng - Longitude
   * @returns {ValidationResult} Validation result
   */
  static validateCoordinates(coordinates) {
    if (!coordinates || typeof coordinates !== 'object') {
      return {
        isValid: false,
        error: 'Coordinates object is required'
      };
    }

    const latValidation = this.validateLatitude(coordinates.lat);
    if (!latValidation.isValid) {
      return latValidation;
    }

    const lngValidation = this.validateLongitude(coordinates.lng);
    if (!lngValidation.isValid) {
      return lngValidation;
    }

    return {
      isValid: true,
      details: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        valid: true
      }
    };
  }

  /**
   * Validate complete location object
   * @param {Object} location - Location object
   * @param {number} location.lat - Latitude
   * @param {number} location.lng - Longitude
   * @param {number} location.accuracy - GPS accuracy
   * @returns {ValidationResult} Validation result
   */
  static validateLocation(location) {
    if (!location || typeof location !== 'object') {
      return {
        isValid: false,
        error: 'Location object is required'
      };
    }

    const coordinatesValidation = this.validateCoordinates(location);
    if (!coordinatesValidation.isValid) {
      return coordinatesValidation;
    }

    const accuracyValidation = this.validateAccuracy(location.accuracy);
    if (!accuracyValidation.isValid) {
      return accuracyValidation;
    }

    return {
      isValid: true,
      details: {
        coordinates: coordinatesValidation.details,
        accuracy: location.accuracy,
        timestamp: location.timestamp || new Date()
      }
    };
  }
}

/**
 * Geofence Validation Utilities
 */
class GeofenceValidator {
  /**
   * Validate geofence radius
   * @param {number} radius - Radius in meters
   * @returns {ValidationResult} Validation result
   */
  static validateRadius(radius) {
    if (typeof radius !== 'number' || isNaN(radius)) {
      return {
        isValid: false,
        error: 'Radius must be a valid number'
      };
    }

    if (radius < GEOFENCE.MIN_RADIUS_METERS || radius > GEOFENCE.MAX_RADIUS_METERS) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.GEOFENCE_INVALID_RADIUS,
        details: {
          value: radius,
          validRange: [GEOFENCE.MIN_RADIUS_METERS, GEOFENCE.MAX_RADIUS_METERS]
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate geofence name
   * @param {string} name - Geofence name
   * @returns {ValidationResult} Validation result
   */
  static validateName(name) {
    if (!name || typeof name !== 'string') {
      return {
        isValid: false,
        error: 'Geofence name is required and must be a string'
      };
    }

    if (name.trim().length === 0) {
      return {
        isValid: false,
        error: 'Geofence name cannot be empty'
      };
    }

    if (name.length > 100) {
      return {
        isValid: false,
        error: 'Geofence name must be 100 characters or less',
        details: { length: name.length, maxLength: 100 }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate complete geofence data
   * @param {Object} geofenceData - Geofence data to validate
   * @returns {ValidationResult} Validation result
   */
  static validate(geofenceData) {
    if (!geofenceData || typeof geofenceData !== 'object') {
      return {
        isValid: false,
        error: 'Geofence data object is required'
      };
    }

    // Validate required fields
    if (!geofenceData.name || !geofenceData.userId) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.GEOFENCE_MISSING_REQUIRED_FIELDS
      };
    }

    // Validate name
    const nameValidation = this.validateName(geofenceData.name);
    if (!nameValidation.isValid) {
      return nameValidation;
    }

    // Validate coordinates
    const coordinatesValidation = LocationValidator.validateCoordinates(geofenceData.center);
    if (!coordinatesValidation.isValid) {
      return coordinatesValidation;
    }

    // Validate radius
    const radiusValidation = this.validateRadius(geofenceData.radius);
    if (!radiusValidation.isValid) {
      return radiusValidation;
    }

    return {
      isValid: true,
      details: {
        name: geofenceData.name,
        userId: geofenceData.userId,
        center: coordinatesValidation.details,
        radius: geofenceData.radius,
        type: geofenceData.type || 'safe_zone'
      }
    };
  }
}

/**
 * General Validation Utilities
 */
class GeneralValidator {
  /**
   * Validate required string field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @returns {ValidationResult} Validation result
   */
  static validateRequiredString(value, fieldName) {
    if (!value || typeof value !== 'string') {
      return {
        isValid: false,
        error: `${fieldName} is required and must be a string`
      };
    }

    if (value.trim().length === 0) {
      return {
        isValid: false,
        error: `${fieldName} cannot be empty`
      };
    }

    return { isValid: true };
  }

  /**
   * Validate positive number
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @returns {ValidationResult} Validation result
   */
  static validatePositiveNumber(value, fieldName) {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        isValid: false,
        error: `${fieldName} must be a valid number`
      };
    }

    if (value <= 0) {
      return {
        isValid: false,
        error: `${fieldName} must be a positive number`,
        details: { value }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate object has required properties
   * @param {Object} obj - Object to validate
   * @param {Array<string>} requiredProps - Required property names
   * @returns {ValidationResult} Validation result
   */
  static validateRequiredProperties(obj, requiredProps) {
    if (!obj || typeof obj !== 'object') {
      return {
        isValid: false,
        error: 'Object is required'
      };
    }

    const missingProps = requiredProps.filter(prop => !(prop in obj));

    if (missingProps.length > 0) {
      return {
        isValid: false,
        error: `Missing required properties: ${missingProps.join(', ')}`,
        details: { missingProperties: missingProps }
      };
    }

    return { isValid: true };
  }
}

module.exports = {
  NCCValidator,
  DeviceSerialValidator,
  LocationValidator,
  GeofenceValidator,
  GeneralValidator
};