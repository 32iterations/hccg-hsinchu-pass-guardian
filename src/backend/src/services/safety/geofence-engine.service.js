/**
 * Geofence Engine Service - 新竹通安心守護地理圍籬引擎
 *
 * Advanced geofencing engine providing real-time boundary detection with high accuracy.
 * Features include 10m GPS accuracy requirement, 30-second exit confirmation delays,
 * 5-minute notification cooldowns, and emergency zone monitoring.
 *
 * Key Features:
 * - Real-time location boundary detection
 * - Smart exit confirmation with 30s delay
 * - Configurable notification cooldowns
 * - Emergency zone immediate alerts
 * - Dwell time tracking and alerting
 * - Batch processing for multiple users
 *
 * @class GeofenceEngine
 * @version 2.0.0
 * @author HsinchuPass Safety Team
 */

const { GeofenceViolationError, LocationAccuracyError, CooldownActiveError } = require('./errors');
const {
  LOCATION,
  GEOFENCE,
  GEOFENCE_EVENTS,
  GEOFENCE_STATUS,
  GEOFENCE_TYPES,
  COOLDOWN_PERIODS,
  ALERT_LEVELS,
  ERROR_MESSAGES,
  TIME
} = require('../../constants/safety-service.constants');

class GeofenceEngine {
  /**
   * Initialize Geofence Engine with required dependencies
   *
   * @param {Object} geofenceRepository - Repository for geofence data operations
   * @param {Object} locationService - Service for location calculations and validation
   * @param {Object} notificationService - Service for sending alerts and notifications
   * @param {Object} eventEmitter - Event emitter for real-time event broadcasting
   * @throws {Error} When required dependencies are missing
   */
  constructor(geofenceRepository, locationService, notificationService, eventEmitter) {
    if (!geofenceRepository || !locationService || !notificationService || !eventEmitter) {
      throw new Error('Missing required dependencies for GeofenceEngine');
    }

    this.geofenceRepository = geofenceRepository;
    this.locationService = locationService;
    this.notificationService = notificationService;
    this.eventEmitter = eventEmitter;

    // Pending exit confirmations - Maps user-geofence keys to timeout data
    this.pendingExits = new Map();

    // Configuration constants from centralized location
    this.ACCURACY_THRESHOLD = LOCATION.ACCURACY_THRESHOLD_METERS;
    this.EXIT_CONFIRMATION_DELAY = GEOFENCE.EXIT_CONFIRMATION_DELAY_MS;
    this.NOTIFICATION_COOLDOWN = GEOFENCE.NOTIFICATION_COOLDOWN_MS;
  }

  /**
   * Check geofence status for user location with comprehensive processing
   *
   * Analyzes current user location against all active geofences, handling entries,
   * exits, dwell time tracking, and emergency alerts. Includes GPS accuracy validation
   * and smart exit confirmation logic.
   *
   * @param {string} userId - User identifier
   * @param {Object} currentLocation - Current location data
   * @param {number} currentLocation.lat - Latitude (-90 to 90)
   * @param {number} currentLocation.lng - Longitude (-180 to 180)
   * @param {number} currentLocation.accuracy - GPS accuracy in meters
   * @param {Date} [currentLocation.timestamp] - Location timestamp
   * @returns {Promise<Object>} Comprehensive geofence status result
   * @returns {Array} returns.entries - New geofence entries
   * @returns {Array} returns.exits - Pending geofence exits
   * @returns {Array} returns.confirmedExits - Confirmed geofence exits
   * @returns {Array} returns.cancelledExits - Cancelled exit confirmations
   * @returns {Array} returns.dwellUpdates - Dwell time updates
   * @returns {Array} returns.emergencyAlerts - Emergency zone alerts
   * @returns {Array} returns.errors - Processing errors
   * @throws {LocationAccuracyError} When GPS accuracy is insufficient
   * @throws {CooldownActiveError} When notification cooldown is active
   */
  async checkGeofenceStatus(userId, currentLocation) {
    if (!userId || !currentLocation) {
      throw new Error('User ID and current location are required');
    }

    // Validate GPS accuracy using constants
    if (currentLocation.accuracy > this.ACCURACY_THRESHOLD) {
      const errorMessage = ERROR_MESSAGES.LOCATION_ACCURACY_EXCEEDED
        .replace('{{accuracy}}', currentLocation.accuracy)
        .replace('{{threshold}}', this.ACCURACY_THRESHOLD);
      throw new LocationAccuracyError(errorMessage);
    }

    const result = {
      entries: [],
      exits: [],
      confirmedExits: [],
      pendingExits: [],
      cancelledExits: [],
      dwellUpdates: [],
      emergencyAlerts: [],
      errors: []
    };

    try {
      // Get active geofences for user
      const geofences = await this.geofenceRepository.findActiveByUser(userId);

      for (const geofence of geofences) {
        try {
          await this.processGeofence(userId, currentLocation, geofence, result);
        } catch (error) {
          // Let cooldown and accuracy errors bubble up
          if (error instanceof CooldownActiveError || error instanceof LocationAccuracyError) {
            throw error;
          }

          result.errors.push({
            type: 'geofence_processing_error',
            geofenceId: geofence.id,
            error: error.message
          });
        }
      }

      // Process pending exit confirmations
      await this.processPendingExits(userId, currentLocation, result);

    } catch (error) {
      // Let specific errors bubble up
      if (error instanceof CooldownActiveError || error instanceof LocationAccuracyError) {
        throw error;
      }

      result.errors.push({
        type: 'location_service_error',
        error: error.message
      });
    }

    return result;
  }

  /**
   * Process individual geofence for location updates
   *
   * Analyzes a single geofence against the current location and determines
   * appropriate actions (entry, exit, dwell tracking, emergency alerts).
   *
   * @param {string} userId - User identifier
   * @param {Object} currentLocation - Current location data
   * @param {Object} geofence - Geofence configuration
   * @param {Object} result - Results object to populate
   * @throws {Error} When location calculation fails
   * @private
   */
  async processGeofence(userId, currentLocation, geofence, result) {
    try {
      const distance = this.locationService.calculateDistance(
        currentLocation,
        geofence.center
      );

      const isInside = distance <= geofence.radius;
      const currentStatus = await this.geofenceRepository.getUserGeofenceStatus(userId, geofence.id);
      const isCurrentlyInside = currentStatus && currentStatus.status === GEOFENCE_STATUS.INSIDE;

      if (isInside && !isCurrentlyInside) {
        // Entry detected
        await this.handleGeofenceEntry(userId, geofence, currentLocation, distance, result);

        // Check for emergency zones
        if (geofence.type === GEOFENCE_TYPES.DANGER_ZONE && geofence.emergencyEnabled) {
          await this.handleEmergencyAlert(userId, geofence, currentLocation, result);
        }
      } else if (!isInside && isCurrentlyInside) {
        // Exit detected - start confirmation process
        await this.handleGeofenceExit(userId, geofence, currentLocation, distance, result);
      } else if (isInside && isCurrentlyInside) {
        // User still inside - monitor dwell time
        await this.handleDwellTime(userId, geofence, currentLocation, currentStatus, result);
      }
    } catch (error) {
      // Re-throw to allow calling function to handle appropriately
      throw error;
    }
  }

  /**
   * Handle geofence entry event with cooldown and cancellation logic
   *
   * Processes a new geofence entry, including cooldown checking,
   * pending exit cancellation, status updates, and notifications.
   *
   * @param {string} userId - User identifier
   * @param {Object} geofence - Geofence configuration
   * @param {Object} location - Current location data
   * @param {number} distance - Distance from geofence center
   * @param {Object} result - Results object to update
   * @throws {CooldownActiveError} When notification cooldown is active
   * @private
   */
  async handleGeofenceEntry(userId, geofence, location, distance, result) {
    // Check notification cooldown using constants
    const cooldownActive = await this.isCooldownActive(userId, geofence.id, GEOFENCE_EVENTS.ENTRY);
    if (cooldownActive) {
      throw new CooldownActiveError(ERROR_MESSAGES.COOLDOWN_ACTIVE);
    }

    // Cancel any pending exit for this geofence
    const pendingExitKey = `${userId}-${geofence.id}`;
    if (this.pendingExits.has(pendingExitKey)) {
      clearTimeout(this.pendingExits.get(pendingExitKey).timeout);
      this.pendingExits.delete(pendingExitKey);

      result.cancelledExits.push({
        geofenceId: geofence.id,
        reason: 'user_returned',
        timestamp: new Date()
      });

      this.eventEmitter.emit('geofence.exit_cancelled', {
        userId,
        geofenceId: geofence.id,
        reason: 'user_returned'
      });
    }

    const entryEvent = {
      geofenceId: geofence.id,
      eventType: GEOFENCE_EVENTS.ENTRY,
      distance,
      accuracy: location.accuracy,
      timestamp: new Date(),
      dwellTimeMinutes: 0
    };

    result.entries.push(entryEvent);

    // Update geofence status using constants
    await this.geofenceRepository.updateGeofenceStatus(userId, geofence.id, {
      status: GEOFENCE_STATUS.INSIDE,
      lastEntry: new Date(),
      dwellStartTime: new Date()
    });

    // Send notification
    await this.notificationService.sendGeofenceAlert(userId, {
      type: 'geofence_entry',
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      timestamp: entryEvent.timestamp
    });

    // Emit event for real-time processing
    this.eventEmitter.emit('geofence.entry', entryEvent);
  }

  /**
   * Handle geofence exit with intelligent confirmation delay
   *
   * Implements smart exit confirmation with 30-second delay to prevent
   * false exit notifications due to GPS fluctuations.
   *
   * @param {string} userId - User identifier
   * @param {Object} geofence - Geofence configuration
   * @param {Object} location - Current location data
   * @param {number} distance - Distance from geofence center
   * @param {Object} result - Results object to update
   * @private
   */
  async handleGeofenceExit(userId, geofence, location, distance, result) {
    const pendingExitKey = `${userId}-${geofence.id}`;

    if (this.pendingExits.has(pendingExitKey)) {
      // Exit confirmation already in progress
      const pendingExit = this.pendingExits.get(pendingExitKey);
      const elapsed = Date.now() - pendingExit.startTime;
      const timeRemaining = Math.max(0, this.EXIT_CONFIRMATION_DELAY - elapsed);

      result.pendingExits.push({
        geofenceId: geofence.id,
        confirmationStarted: new Date(pendingExit.startTime),
        timeRemaining,
        progress: Math.min(100, (elapsed / this.EXIT_CONFIRMATION_DELAY) * 100)
      });
    } else {
      // Start new exit confirmation process
      const startTime = Date.now();
      const timeout = setTimeout(async () => {
        try {
          await this.confirmGeofenceExit(userId, geofence, location, distance);
        } catch (error) {
          console.error(`Exit confirmation failed for geofence ${geofence.id}:`, error);
        } finally {
          this.pendingExits.delete(pendingExitKey);
        }
      }, this.EXIT_CONFIRMATION_DELAY);

      this.pendingExits.set(pendingExitKey, {
        startTime,
        timeout,
        geofence,
        location,
        distance,
        userId
      });

      result.pendingExits.push({
        geofenceId: geofence.id,
        confirmationStarted: new Date(startTime),
        timeRemaining: this.EXIT_CONFIRMATION_DELAY,
        progress: 0
      });
    }
  }

  /**
   * Confirm geofence exit after delay period
   *
   * Finalizes the geofence exit after the confirmation delay,
   * updating status and sending notifications if not in cooldown.
   *
   * @param {string} userId - User identifier
   * @param {Object} geofence - Geofence configuration
   * @param {Object} location - Location data at exit detection
   * @param {number} distance - Distance from geofence center
   * @private
   */
  async confirmGeofenceExit(userId, geofence, location, distance) {
    const exitEvent = {
      geofenceId: geofence.id,
      eventType: GEOFENCE_EVENTS.EXIT,
      distance,
      accuracy: location.accuracy,
      timestamp: new Date(),
      confirmationDelay: this.EXIT_CONFIRMATION_DELAY
    };

    // Update geofence status using constants
    await this.geofenceRepository.updateGeofenceStatus(userId, geofence.id, {
      status: GEOFENCE_STATUS.OUTSIDE,
      lastExit: new Date(),
      dwellStartTime: null,
      exitConfirmed: true
    });

    // Check cooldown before sending notification
    const cooldownActive = await this.isCooldownActive(userId, geofence.id, GEOFENCE_EVENTS.EXIT);
    if (!cooldownActive) {
      await this.notificationService.sendGeofenceAlert(userId, {
        type: 'geofence_exit',
        geofenceId: geofence.id,
        geofenceName: geofence.name,
        timestamp: exitEvent.timestamp,
        confirmationDelay: this.EXIT_CONFIRMATION_DELAY
      });
    }

    // Emit event for real-time processing
    this.eventEmitter.emit('geofence.exit', exitEvent);
  }

  /**
   * Handle emergency alerts for danger zones
   *
   * Processes immediate emergency alerts when users enter designated danger zones.
   * Emergency alerts bypass normal cooldown periods for critical safety notifications.
   *
   * @param {string} userId - User identifier
   * @param {Object} geofence - Danger zone geofence configuration
   * @param {Object} location - Current location data
   * @param {Object} result - Results object to update
   * @private
   */
  async handleEmergencyAlert(userId, geofence, location, result) {
    const emergencyAlert = {
      geofenceId: geofence.id,
      alertLevel: ALERT_LEVELS.CRITICAL,
      eventType: GEOFENCE_EVENTS.DANGER_ZONE_ENTRY,
      timestamp: new Date(),
      location: {
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy
      },
      geofenceName: geofence.name
    };

    result.emergencyAlerts.push(emergencyAlert);

    // Send emergency notification (bypasses cooldown)
    await this.notificationService.sendEmergencyAlert(userId, {
      type: 'emergency_geofence_violation',
      urgency: 'high',
      alertLevel: ALERT_LEVELS.CRITICAL,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      location: emergencyAlert.location,
      timestamp: emergencyAlert.timestamp
    });

    // Emit emergency event for real-time response
    this.eventEmitter.emit('geofence.emergency', emergencyAlert);
  }

  /**
   * Handle dwell time tracking and alerting
   *
   * Monitors how long a user has been within a geofence and sends
   * appropriate dwell time alerts at configured intervals.
   *
   * @param {string} userId - User identifier
   * @param {Object} geofence - Geofence configuration
   * @param {Object} location - Current location data
   * @param {Object} currentStatus - Current geofence status
   * @param {Object} result - Results object to update
   * @private
   */
  async handleDwellTime(userId, geofence, location, currentStatus, result) {
    if (!geofence.dwellTrackingEnabled || !currentStatus.dwellStartTime) {
      return;
    }

    const dwellTimeMs = Date.now() - new Date(currentStatus.dwellStartTime).getTime();
    const dwellTimeMinutes = Math.floor(dwellTimeMs / TIME.MS_PER_MINUTE);

    if (dwellTimeMinutes >= GEOFENCE.MIN_DWELL_TIME_MINUTES) {
      result.dwellUpdates.push({
        geofenceId: geofence.id,
        dwellTimeMinutes,
        dwellStatus: 'extended',
        startTime: currentStatus.dwellStartTime,
        location: {
          lat: location.lat,
          lng: location.lng
        }
      });

      // Check for dwell alerts at specific intervals
      const alertIntervals = geofence.dwellAlertIntervals || GEOFENCE.DEFAULT_DWELL_ALERT_INTERVALS;

      if (alertIntervals.includes(dwellTimeMinutes)) {
        const lastAlert = currentStatus.lastDwellAlert ?
          new Date(currentStatus.lastDwellAlert) : null;

        // Only send alert if this is the first alert or enough time has passed
        const shouldSendAlert = !lastAlert || dwellTimeMinutes > GEOFENCE.MIN_DWELL_TIME_MINUTES;

        if (shouldSendAlert) {
          await this.notificationService.sendDwellAlert(userId, {
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            dwellTimeMinutes,
            alertType: `dwell_${dwellTimeMinutes}min`,
            location: result.dwellUpdates[result.dwellUpdates.length - 1].location,
            timestamp: new Date()
          });

          // Update last dwell alert timestamp
          await this.geofenceRepository.updateGeofenceStatus(userId, geofence.id, {
            lastDwellAlert: new Date()
          });
        }
      }
    }
  }

  /**
   * Process pending exit confirmations
   */
  async processPendingExits(userId, currentLocation, result) {
    for (const [key, pendingExit] of this.pendingExits.entries()) {
      if (key.startsWith(`${userId}-`)) {
        const elapsed = Date.now() - pendingExit.startTime;

        if (elapsed >= this.EXIT_CONFIRMATION_DELAY) {
          // Confirm exit
          const exitEvent = {
            geofenceId: pendingExit.geofence.id,
            eventType: 'exit',
            distance: pendingExit.distance,
            accuracy: pendingExit.location.accuracy,
            timestamp: new Date(),
            confirmationDelay: this.EXIT_CONFIRMATION_DELAY
          };

          result.confirmedExits.push(exitEvent);
          this.eventEmitter.emit('geofence.exit', exitEvent);

          clearTimeout(pendingExit.timeout);
          this.pendingExits.delete(key);
        }
      }
    }
  }

  /**
   * Check if notification cooldown is active for specific event type
   *
   * Implements intelligent cooldown logic to prevent notification spam
   * while ensuring important alerts are not missed.
   *
   * @param {string} userId - User identifier
   * @param {string} geofenceId - Geofence identifier
   * @param {string} eventType - Type of event (entry, exit, dwell_alert, emergency)
   * @returns {Promise<boolean>} True if cooldown is active
   * @private
   */
  async isCooldownActive(userId, geofenceId, eventType) {
    if (!userId || !geofenceId || !eventType) {
      return false;
    }

    const lastNotification = await this.geofenceRepository.getLastNotification(userId, geofenceId, eventType);

    if (!lastNotification || lastNotification.geofenceId !== geofenceId) {
      return false;
    }

    // Use centralized cooldown periods
    const cooldownPeriod = COOLDOWN_PERIODS[eventType] || this.NOTIFICATION_COOLDOWN;

    // Emergency events never have cooldown
    if (cooldownPeriod === 0) {
      return false;
    }

    const timeSinceLastNotification = Date.now() - new Date(lastNotification.timestamp).getTime();
    return timeSinceLastNotification < cooldownPeriod;
  }

  /**
   * Create new geofence with comprehensive validation
   *
   * Creates a new geofence with full validation of coordinates, radius,
   * user limits, and name uniqueness. Ensures geofence meets all requirements.
   *
   * @param {Object} geofenceData - Geofence configuration data
   * @param {string} geofenceData.name - Geofence name (must be unique per user)
   * @param {string} geofenceData.userId - Owner user identifier
   * @param {Object} geofenceData.center - Center coordinates
   * @param {number} geofenceData.center.lat - Latitude (-90 to 90)
   * @param {number} geofenceData.center.lng - Longitude (-180 to 180)
   * @param {number} geofenceData.radius - Radius in meters (1-2000)
   * @param {string} [geofenceData.type] - Geofence type (safe_zone, danger_zone, notification_zone)
   * @param {boolean} [geofenceData.emergencyEnabled] - Enable emergency alerts
   * @param {Array} [geofenceData.dwellAlertIntervals] - Dwell alert intervals in minutes
   * @returns {Promise<Object>} Created geofence record
   * @throws {Error} When validation fails
   */
  async createGeofence(geofenceData) {
    if (!geofenceData) {
      throw new Error('Geofence data is required');
    }

    // Validate coordinates using constants
    if (!geofenceData.center ||
        geofenceData.center.lat < LOCATION.LATITUDE_RANGE.MIN ||
        geofenceData.center.lat > LOCATION.LATITUDE_RANGE.MAX ||
        geofenceData.center.lng < LOCATION.LONGITUDE_RANGE.MIN ||
        geofenceData.center.lng > LOCATION.LONGITUDE_RANGE.MAX) {
      throw new Error(ERROR_MESSAGES.GEOFENCE_INVALID_COORDINATES);
    }

    // Validate radius using constants
    if (!geofenceData.radius ||
        geofenceData.radius < GEOFENCE.MIN_RADIUS_METERS ||
        geofenceData.radius > GEOFENCE.MAX_RADIUS_METERS) {
      throw new Error(ERROR_MESSAGES.GEOFENCE_INVALID_RADIUS);
    }

    // Check for required fields
    if (!geofenceData.name || !geofenceData.userId) {
      throw new Error(ERROR_MESSAGES.GEOFENCE_MISSING_REQUIRED_FIELDS);
    }

    // Check maximum number of geofences per user
    const userGeofenceCount = await this.geofenceRepository.countUserGeofences(geofenceData.userId);
    if (userGeofenceCount >= GEOFENCE.MAX_GEOFENCES_PER_USER) {
      throw new Error(ERROR_MESSAGES.GEOFENCE_MAX_EXCEEDED);
    }

    // Check for duplicate names
    const existingGeofence = await this.geofenceRepository.findByUserAndName(
      geofenceData.userId,
      geofenceData.name
    );
    if (existingGeofence) {
      throw new Error(ERROR_MESSAGES.GEOFENCE_NAME_EXISTS);
    }

    // Set default values for optional fields
    const geofenceWithDefaults = {
      ...geofenceData,
      type: geofenceData.type || GEOFENCE_TYPES.SAFE_ZONE,
      emergencyEnabled: geofenceData.emergencyEnabled || false,
      dwellTrackingEnabled: geofenceData.dwellTrackingEnabled || true,
      dwellAlertIntervals: geofenceData.dwellAlertIntervals || GEOFENCE.DEFAULT_DWELL_ALERT_INTERVALS,
      createdAt: new Date(),
      active: true
    };

    return await this.geofenceRepository.create(geofenceWithDefaults);
  }

  /**
   * Update geofence with notifications
   */
  async updateGeofence(geofenceId, updates) {
    const originalGeofence = await this.geofenceRepository.findById(geofenceId);
    const updatedGeofence = await this.geofenceRepository.update(geofenceId, updates);

    // Calculate changes for notification
    const changes = {};
    if (updates.radius && updates.radius !== originalGeofence.radius) {
      changes.radius = { from: originalGeofence.radius, to: updates.radius };
    }

    // Send update notification
    await this.notificationService.sendGeofenceUpdateNotification(originalGeofence.userId, {
      type: 'geofence_updated',
      geofenceId,
      changes
    });

    return updatedGeofence;
  }

  /**
   * Batch process multiple user locations efficiently
   *
   * Processes multiple user locations in parallel for improved performance
   * in high-traffic scenarios. Includes error isolation and comprehensive reporting.
   *
   * @param {Array} userLocations - Array of user location data
   * @param {string} userLocations[].userId - User identifier
   * @param {Object} userLocations[].location - Location data
   * @returns {Promise<Array>} Array of processing results for each user
   */
  async batchProcessLocations(userLocations) {
    if (!Array.isArray(userLocations) || userLocations.length === 0) {
      return [];
    }

    const startTime = Date.now();

    // Process all locations in parallel for optimal performance
    const promises = userLocations.map(async ({ userId, location }, index) => {
      try {
        const result = await this.checkGeofenceStatus(userId, location);
        return {
          userId,
          success: true,
          processedAt: new Date(),
          ...result
        };
      } catch (error) {
        return {
          userId,
          success: false,
          error: error.message,
          errorType: error.constructor.name,
          processedAt: new Date(),
          entries: [],
          exits: [],
          confirmedExits: [],
          pendingExits: [],
          cancelledExits: [],
          dwellUpdates: [],
          emergencyAlerts: [],
          errors: [{
            type: 'batch_processing_error',
            error: error.message,
            userIndex: index
          }]
        };
      }
    });

    const results = await Promise.all(promises);
    const processingTime = Date.now() - startTime;

    // Add batch processing metadata
    return {
      results,
      batchMetadata: {
        totalUsers: userLocations.length,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length,
        processingTimeMs: processingTime,
        processedAt: new Date()
      }
    };
  }
}

module.exports = { GeofenceEngine };