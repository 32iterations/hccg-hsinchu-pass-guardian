/**
 * Constants for Safety Services - 新竹通安心守護服務常數
 * Central location for all magic numbers, patterns, and configuration values
 */

// === Device Binding Constants ===

/**
 * NCC (National Communications Commission) validation constants
 */
const NCC_VALIDATION = {
  /** NCC number format pattern: CCAMYYMMXX#### */
  PATTERN: /^CCAM\d{2}\d{2}[A-Z]{2}\d{4}$/,
  /** Minimum valid year (2020 and later) */
  MIN_YEAR: 20,
  /** Maximum valid year (2099) */
  MAX_YEAR: 99,
  /** NCC number expected length */
  LENGTH: 14,
  /** Position indices for extracting year from NCC number */
  YEAR_START_INDEX: 4,
  YEAR_END_INDEX: 6
};

/**
 * Device serial number validation constants
 */
const DEVICE_SERIAL = {
  /** Serial number format pattern: HSC-GUARD-######*/
  PATTERN: /^HSC-GUARD-\d{6}$/,
  /** Serial number prefix */
  PREFIX: 'HSC-GUARD-',
  /** Expected total length */
  LENGTH: 12
};

/**
 * Device status transition rules
 */
const DEVICE_STATUS = {
  REGISTERED: 'registered',
  PAIRED: 'paired',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  /** Valid status transitions mapping */
  VALID_TRANSITIONS: {
    'registered': ['paired'],
    'paired': ['active'],
    'active': ['inactive'],
    'inactive': ['active']
  }
};

/**
 * BLE Connection constants
 */
const BLE_CONNECTION = {
  /** Default maximum retry attempts for connection */
  DEFAULT_MAX_RETRIES: 3,
  /** Base delay for exponential backoff (milliseconds) */
  BASE_RETRY_DELAY: 1000,
  /** Signal strength thresholds for connection quality */
  SIGNAL_THRESHOLDS: {
    EXCELLENT: -50,
    GOOD: -65,
    FAIR: -80
  },
  /** Connection quality levels */
  QUALITY_LEVELS: {
    EXCELLENT: 'excellent',
    GOOD: 'good',
    FAIR: 'fair',
    POOR: 'poor'
  }
};

/**
 * Retryable BLE error message patterns
 */
const BLE_RETRYABLE_ERRORS = [
  'Connection timeout',
  'Signal weak',
  'attempt failed'
];

// === Geofence Engine Constants ===

/**
 * Location and positioning constants
 */
const LOCATION = {
  /** GPS accuracy threshold in meters */
  ACCURACY_THRESHOLD_METERS: 10,
  /** Valid latitude range */
  LATITUDE_RANGE: { MIN: -90, MAX: 90 },
  /** Valid longitude range */
  LONGITUDE_RANGE: { MIN: -180, MAX: 180 }
};

/**
 * Geofence boundary and timing constants
 */
const GEOFENCE = {
  /** Exit confirmation delay in milliseconds (30 seconds) */
  EXIT_CONFIRMATION_DELAY_MS: 30000,
  /** Notification cooldown period in milliseconds (5 minutes) */
  NOTIFICATION_COOLDOWN_MS: 5 * 60 * 1000,
  /** Maximum radius allowed for geofence in meters */
  MAX_RADIUS_METERS: 2000,
  /** Minimum radius allowed for geofence in meters */
  MIN_RADIUS_METERS: 1,
  /** Maximum number of geofences per user */
  MAX_GEOFENCES_PER_USER: 10,
  /** Minimum dwell time for extended dwell tracking (minutes) */
  MIN_DWELL_TIME_MINUTES: 5,
  /** Default dwell alert intervals (minutes) */
  DEFAULT_DWELL_ALERT_INTERVALS: [5, 15, 30, 60]
};

/**
 * Geofence event types
 */
const GEOFENCE_EVENTS = {
  ENTRY: 'entry',
  EXIT: 'exit',
  DWELL_ALERT: 'dwell_alert',
  EMERGENCY: 'emergency',
  DANGER_ZONE_ENTRY: 'danger_zone_entry'
};

/**
 * Geofence status values
 */
const GEOFENCE_STATUS = {
  INSIDE: 'inside',
  OUTSIDE: 'outside'
};

/**
 * Geofence types
 */
const GEOFENCE_TYPES = {
  SAFE_ZONE: 'safe_zone',
  DANGER_ZONE: 'danger_zone',
  NOTIFICATION_ZONE: 'notification_zone'
};

/**
 * Notification cooldown periods by event type (milliseconds)
 */
const COOLDOWN_PERIODS = {
  [GEOFENCE_EVENTS.ENTRY]: 5 * 60 * 1000,      // 5 minutes
  [GEOFENCE_EVENTS.EXIT]: 5 * 60 * 1000,       // 5 minutes
  [GEOFENCE_EVENTS.DWELL_ALERT]: 15 * 60 * 1000, // 15 minutes
  [GEOFENCE_EVENTS.EMERGENCY]: 0                // No cooldown
};

/**
 * Alert levels
 */
const ALERT_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// === Time and Date Constants ===

/**
 * Time conversion constants
 */
const TIME = {
  /** Milliseconds in one second */
  MS_PER_SECOND: 1000,
  /** Milliseconds in one minute */
  MS_PER_MINUTE: 60 * 1000,
  /** Milliseconds in one hour */
  MS_PER_HOUR: 60 * 60 * 1000,
  /** Seconds in one minute */
  SECONDS_PER_MINUTE: 60
};

// === Error Message Templates ===

/**
 * Standardized error message templates
 */
const ERROR_MESSAGES = {
  // NCC Validation Errors
  NCC_INVALID_FORMAT: 'Invalid NCC number format. Expected format: CCAMYYMMXX#### (14 characters)',
  NCC_INVALID_YEAR: 'Invalid NCC year format. Year must be 20 or greater (2020+)',
  NCC_NOT_REGISTERED: 'NCC number not found in official registry',
  NCC_REGISTRY_CHECK_FAILED: 'Failed to validate NCC number with official registry',

  // Device Validation Errors
  DEVICE_INVALID_SERIAL: 'Invalid serial number format. Expected: HSC-GUARD-######',
  DEVICE_DUPLICATE_SERIAL: 'Device with this serial number already exists',
  DEVICE_NOT_FOUND: 'Device not found',
  DEVICE_UNAUTHORIZED_TRANSFER: 'Unauthorized device transfer attempt',
  DEVICE_INVALID_STATUS_TRANSITION: 'Invalid device status transition',

  // User Consent Errors
  USER_CONSENT_REQUIRED: 'User consent required before device registration',
  USER_CONSENT_NOT_FOUND: 'User consent record not found',

  // Geofence Validation Errors
  GEOFENCE_INVALID_COORDINATES: 'Invalid coordinates. Latitude must be -90 to 90, longitude must be -180 to 180',
  GEOFENCE_INVALID_RADIUS: 'Invalid radius. Must be between 1 and 2000 meters',
  GEOFENCE_MISSING_REQUIRED_FIELDS: 'Missing required fields: name and userId are required',
  GEOFENCE_MAX_EXCEEDED: 'Maximum number of geofences exceeded (10 per user)',
  GEOFENCE_NAME_EXISTS: 'Geofence name already exists for this user',

  // Location and Accuracy Errors
  LOCATION_ACCURACY_EXCEEDED: 'GPS accuracy {{accuracy}}m exceeds {{threshold}}m threshold',
  LOCATION_SERVICE_ERROR: 'Location service error occurred',

  // Cooldown and Notification Errors
  COOLDOWN_ACTIVE: 'Notification cooldown active for this geofence',
  NOTIFICATION_SEND_FAILED: 'Failed to send notification'
};

// === Regulatory and Legal Constants ===

/**
 * Chinese regulatory warning text (NCC compliance)
 */
const REGULATORY_TEXT = {
  NCC_WARNING: `本產品符合國家通訊傳播委員會（NCC）低功率電波輻射性電機管理辦法規定。

審驗合格之低功率射頻電機，非經許可，公司、商號或使用者均不得擅自變更頻率、加大功率或變更原設計之特性及功能。

使用時不得影響飛航安全及干擾合法通信；經型式認證合格之低功率射頻電機，必須接受經型式認證合格之低功率射頻電機之干擾。

本裝置必須標示NCC認證標章、審驗號碼及製造商資訊。`,

  PRIVACY_NOTICE: '個人資料保護法告知事項...',
  DATA_RETENTION_POLICY: '資料保存政策...',
  USER_RIGHTS: '使用者權利說明...'
};

module.exports = {
  // Device Binding Constants
  NCC_VALIDATION,
  DEVICE_SERIAL,
  DEVICE_STATUS,
  BLE_CONNECTION,
  BLE_RETRYABLE_ERRORS,

  // Geofence Constants
  LOCATION,
  GEOFENCE,
  GEOFENCE_EVENTS,
  GEOFENCE_STATUS,
  GEOFENCE_TYPES,
  COOLDOWN_PERIODS,
  ALERT_LEVELS,

  // Common Constants
  TIME,
  ERROR_MESSAGES,
  REGULATORY_TEXT
};