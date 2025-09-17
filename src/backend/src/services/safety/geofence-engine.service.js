/**
 * Geofence Engine Service - 新竹通安心守護地理圍籬引擎
 * Handles boundary detection with 10m accuracy, 30s exit confirmation, and 5-minute cooldowns
 */

const { GeofenceViolationError, LocationAccuracyError, CooldownActiveError } = require('./errors');

class GeofenceEngine {
  constructor(geofenceRepository, locationService, notificationService, eventEmitter) {
    this.geofenceRepository = geofenceRepository;
    this.locationService = locationService;
    this.notificationService = notificationService;
    this.eventEmitter = eventEmitter;

    // Pending exit confirmations
    this.pendingExits = new Map();

    // Configuration
    this.ACCURACY_THRESHOLD = 10; // meters
    this.EXIT_CONFIRMATION_DELAY = 30000; // 30 seconds
    this.NOTIFICATION_COOLDOWN = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Check geofence status for user location
   */
  async checkGeofenceStatus(userId, currentLocation) {
    // Validate GPS accuracy
    if (currentLocation.accuracy > this.ACCURACY_THRESHOLD) {
      throw new LocationAccuracyError(`GPS accuracy ${currentLocation.accuracy}m exceeds ${this.ACCURACY_THRESHOLD}m threshold`);
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
      result.errors.push({
        type: 'location_service_error',
        error: error.message
      });
    }

    return result;
  }

  /**
   * Process individual geofence
   */
  async processGeofence(userId, currentLocation, geofence, result) {
    try {
      const distance = this.locationService.calculateDistance(
        currentLocation,
        geofence.center
      );

      const isInside = distance <= geofence.radius;
      const currentStatus = await this.geofenceRepository.getUserGeofenceStatus(userId, geofence.id);

      if (isInside && (!currentStatus || currentStatus.status !== 'inside')) {
        // Entry detected
        await this.handleGeofenceEntry(userId, geofence, currentLocation, distance, result);
      } else if (!isInside && currentStatus && currentStatus.status === 'inside') {
        // Exit detected - start confirmation
        await this.handleGeofenceExit(userId, geofence, currentLocation, distance, result);
      } else if (isInside && currentStatus && currentStatus.status === 'inside') {
        // User still inside - check dwell time
        await this.handleDwellTime(userId, geofence, currentLocation, currentStatus, result);
      }
    } catch (error) {
      // Re-throw the error so it can be caught by the calling function
      throw error;
    }
  }

  /**
   * Handle geofence entry
   */
  async handleGeofenceEntry(userId, geofence, location, distance, result) {
    // Check notification cooldown
    const cooldownActive = await this.isCooldownActive(userId, geofence.id, 'entry');
    if (cooldownActive) {
      throw new CooldownActiveError('Notification cooldown active for this geofence');
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
      eventType: 'entry',
      distance,
      accuracy: location.accuracy,
      timestamp: new Date(),
      dwellTimeMinutes: 0
    };

    result.entries.push(entryEvent);

    // Update geofence status
    await this.geofenceRepository.updateGeofenceStatus(userId, geofence.id, {
      status: 'inside',
      lastEntry: new Date(),
      dwellStartTime: new Date()
    });

    // Send notification
    await this.notificationService.sendGeofenceAlert(userId, {
      type: 'geofence_entry',
      geofenceId: geofence.id
    });

    // Emit event
    this.eventEmitter.emit('geofence.entry', entryEvent);
  }

  /**
   * Handle geofence exit with 30s confirmation delay
   */
  async handleGeofenceExit(userId, geofence, location, distance, result) {
    const pendingExitKey = `${userId}-${geofence.id}`;

    if (this.pendingExits.has(pendingExitKey)) {
      // Exit already pending
      const pendingExit = this.pendingExits.get(pendingExitKey);
      result.pendingExits.push({
        geofenceId: geofence.id,
        confirmationStarted: pendingExit.startTime,
        timeRemaining: this.EXIT_CONFIRMATION_DELAY - (Date.now() - pendingExit.startTime)
      });
    } else {
      // Start exit confirmation
      const startTime = Date.now();
      const timeout = setTimeout(async () => {
        await this.confirmGeofenceExit(userId, geofence, location, distance);
        this.pendingExits.delete(pendingExitKey);
      }, this.EXIT_CONFIRMATION_DELAY);

      this.pendingExits.set(pendingExitKey, {
        startTime,
        timeout,
        geofence,
        location,
        distance
      });

      result.pendingExits.push({
        geofenceId: geofence.id,
        confirmationStarted: new Date(startTime),
        timeRemaining: this.EXIT_CONFIRMATION_DELAY
      });
    }
  }

  /**
   * Confirm geofence exit after delay
   */
  async confirmGeofenceExit(userId, geofence, location, distance) {
    const exitEvent = {
      geofenceId: geofence.id,
      eventType: 'exit',
      distance,
      accuracy: location.accuracy,
      timestamp: new Date(),
      confirmationDelay: this.EXIT_CONFIRMATION_DELAY
    };

    // Update geofence status
    await this.geofenceRepository.updateGeofenceStatus(userId, geofence.id, {
      status: 'outside',
      lastExit: new Date(),
      dwellStartTime: null
    });

    // Check cooldown before sending notification
    const cooldownActive = await this.isCooldownActive(userId, geofence.id, 'exit');
    if (!cooldownActive) {
      await this.notificationService.sendGeofenceAlert(userId, {
        type: 'geofence_exit',
        geofenceId: geofence.id
      });
    }

    // Emit event
    this.eventEmitter.emit('geofence.exit', exitEvent);
  }

  /**
   * Handle dwell time tracking (5+ minutes)
   */
  async handleDwellTime(userId, geofence, location, currentStatus, result) {
    if (!geofence.dwellTrackingEnabled || !currentStatus.dwellStartTime) {
      return;
    }

    const dwellTimeMs = Date.now() - new Date(currentStatus.dwellStartTime).getTime();
    const dwellTimeMinutes = Math.floor(dwellTimeMs / (60 * 1000));

    if (dwellTimeMinutes >= 5) {
      result.dwellUpdates.push({
        geofenceId: geofence.id,
        dwellTimeMinutes,
        dwellStatus: 'extended'
      });

      // Check for dwell alerts at specific intervals
      const alertIntervals = geofence.dwellAlertIntervals || [5, 15, 30, 60];

      if (alertIntervals.includes(dwellTimeMinutes)) {
        const lastAlert = currentStatus.lastDwellAlert ?
          new Date(currentStatus.lastDwellAlert) : null;

        // Only send alert if enough time has passed since last one
        if (!lastAlert || dwellTimeMinutes > 5) {
          await this.notificationService.sendDwellAlert(userId, {
            geofenceId: geofence.id,
            dwellTimeMinutes,
            alertType: `dwell_${dwellTimeMinutes}min`
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
   * Check if notification cooldown is active
   */
  async isCooldownActive(userId, geofenceId, eventType) {
    const lastNotification = await this.geofenceRepository.getLastNotification(userId, geofenceId);

    if (!lastNotification || lastNotification.geofenceId !== geofenceId) {
      return false;
    }

    // Different cooldown periods for different event types
    const cooldownPeriods = {
      'entry': 5 * 60 * 1000,      // 5 minutes
      'exit': 5 * 60 * 1000,       // 5 minutes
      'dwell_alert': 15 * 60 * 1000, // 15 minutes
      'emergency': 0                // No cooldown
    };

    const cooldownPeriod = cooldownPeriods[eventType] || this.NOTIFICATION_COOLDOWN;

    if (cooldownPeriod === 0) {
      return false;
    }

    const timeSinceLastNotification = Date.now() - new Date(lastNotification.timestamp).getTime();
    return timeSinceLastNotification < cooldownPeriod;
  }

  /**
   * Create new geofence with validation
   */
  async createGeofence(geofenceData) {
    // Validate coordinates
    if (!geofenceData.center ||
        geofenceData.center.lat < -90 || geofenceData.center.lat > 90 ||
        geofenceData.center.lng < -180 || geofenceData.center.lng > 180) {
      throw new Error('Invalid coordinates');
    }

    // Validate radius
    if (!geofenceData.radius || geofenceData.radius <= 0 || geofenceData.radius > 2000) {
      throw new Error('Invalid radius');
    }

    // Check for required fields
    if (!geofenceData.name || !geofenceData.userId) {
      throw new Error('Missing required fields');
    }

    // Check maximum number of geofences per user
    const userGeofenceCount = await this.geofenceRepository.countUserGeofences(geofenceData.userId);
    if (userGeofenceCount >= 10) {
      throw new Error('Maximum number of geofences exceeded');
    }

    // Check for duplicate names
    const existingGeofence = await this.geofenceRepository.findByUserAndName(
      geofenceData.userId,
      geofenceData.name
    );
    if (existingGeofence) {
      throw new Error('Geofence name already exists');
    }

    return await this.geofenceRepository.create(geofenceData);
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
   * Batch process multiple user locations
   */
  async batchProcessLocations(userLocations) {
    const results = [];

    // Process all locations in parallel for better performance
    const promises = userLocations.map(async ({ userId, location }) => {
      try {
        return await this.checkGeofenceStatus(userId, location);
      } catch (error) {
        return {
          userId,
          error: error.message,
          entries: [],
          exits: []
        };
      }
    });

    return await Promise.all(promises);
  }
}

module.exports = { GeofenceEngine };