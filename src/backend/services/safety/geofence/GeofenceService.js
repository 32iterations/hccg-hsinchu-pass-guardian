/**
 * GeofenceService - Geofence management and monitoring service
 * Handles creation, monitoring, and alerts for geographical safe zones
 */

const EventEmitter = require('events');

class GeofenceService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      defaultRadius: process.env.DEFAULT_GEOFENCE_RADIUS || 500, // meters
      maxRadius: process.env.MAX_GEOFENCE_RADIUS || 5000, // meters
      minRadius: process.env.MIN_GEOFENCE_RADIUS || 50, // meters
      checkInterval: process.env.GEOFENCE_CHECK_INTERVAL || 30000, // 30 seconds
      maxGeofencesPerUser: process.env.MAX_GEOFENCES_PER_USER || 10,
      ...config
    };

    this.geofences = new Map();
    this.userLocations = new Map();
    this.monitoringTimer = null;
    this.logger = this._initLogger();
  }

  /**
   * Initialize the geofence service
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this._loadGeofencesFromDatabase();
      this._startMonitoring();
      this.logger.info('GeofenceService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize GeofenceService:', error);
      throw error;
    }
  }

  /**
   * Create a new geofence
   * @param {Object} geofenceData - Geofence configuration
   * @param {string} geofenceData.userId - User ID who owns this geofence
   * @param {string} geofenceData.name - Geofence name
   * @param {Object} geofenceData.center - Center coordinates {lat, lng}
   * @param {number} geofenceData.radius - Radius in meters
   * @param {string} geofenceData.type - Geofence type ('safe_zone', 'restricted_area')
   * @param {Object} geofenceData.settings - Additional settings
   * @returns {Promise<Object>} Created geofence object
   */
  async createGeofence(geofenceData) {
    try {
      this._validateGeofenceData(geofenceData);

      const userGeofences = Array.from(this.geofences.values())
        .filter(gf => gf.userId === geofenceData.userId);

      if (userGeofences.length >= this.config.maxGeofencesPerUser) {
        throw new Error(`Maximum number of geofences (${this.config.maxGeofencesPerUser}) reached for user`);
      }

      const geofenceId = this._generateGeofenceId();
      const geofence = {
        id: geofenceId,
        userId: geofenceData.userId,
        name: geofenceData.name,
        center: geofenceData.center,
        radius: geofenceData.radius,
        type: geofenceData.type || 'safe_zone',
        settings: {
          alertOnEntry: true,
          alertOnExit: true,
          enabled: true,
          ...geofenceData.settings
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active'
      };

      this.geofences.set(geofenceId, geofence);
      await this._saveGeofenceToDatabase(geofence);

      this.logger.info(`Geofence created: ${geofenceId}`, {
        userId: geofenceData.userId,
        name: geofenceData.name
      });

      this.emit('geofence_created', geofence);
      return geofence;
    } catch (error) {
      this.logger.error('Error creating geofence:', error, geofenceData);
      throw error;
    }
  }

  /**
   * Update an existing geofence
   * @param {string} geofenceId - Geofence ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated geofence object
   */
  async updateGeofence(geofenceId, updates) {
    try {
      const geofence = this.geofences.get(geofenceId);
      if (!geofence) {
        throw new Error(`Geofence not found: ${geofenceId}`);
      }

      // Validate updates
      if (updates.center || updates.radius) {
        this._validateGeofenceData({
          center: updates.center || geofence.center,
          radius: updates.radius || geofence.radius
        });
      }

      const updatedGeofence = {
        ...geofence,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.geofences.set(geofenceId, updatedGeofence);
      await this._saveGeofenceToDatabase(updatedGeofence);

      this.logger.info(`Geofence updated: ${geofenceId}`, updates);
      this.emit('geofence_updated', updatedGeofence);
      return updatedGeofence;
    } catch (error) {
      this.logger.error('Error updating geofence:', error, { geofenceId, updates });
      throw error;
    }
  }

  /**
   * Delete a geofence
   * @param {string} geofenceId - Geofence ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  async deleteGeofence(geofenceId, userId) {
    try {
      const geofence = this.geofences.get(geofenceId);
      if (!geofence) {
        throw new Error(`Geofence not found: ${geofenceId}`);
      }

      if (geofence.userId !== userId) {
        throw new Error('Unauthorized to delete this geofence');
      }

      this.geofences.delete(geofenceId);
      await this._deleteGeofenceFromDatabase(geofenceId);

      this.logger.info(`Geofence deleted: ${geofenceId}`, { userId });
      this.emit('geofence_deleted', { geofenceId, userId });
      return true;
    } catch (error) {
      this.logger.error('Error deleting geofence:', error, { geofenceId, userId });
      throw error;
    }
  }

  /**
   * Get geofences for a specific user
   * @param {string} userId - User ID
   * @returns {Array<Object>} User's geofences
   */
  getUserGeofences(userId) {
    try {
      const userGeofences = Array.from(this.geofences.values())
        .filter(geofence => geofence.userId === userId && geofence.status === 'active');

      this.logger.debug(`Retrieved ${userGeofences.length} geofences for user: ${userId}`);
      return userGeofences;
    } catch (error) {
      this.logger.error('Error getting user geofences:', error, { userId });
      throw error;
    }
  }

  /**
   * Update user location and check geofence violations
   * @param {string} userId - User ID
   * @param {Object} location - Location data {lat, lng, timestamp, accuracy}
   * @returns {Promise<Array<Object>>} Array of geofence events
   */
  async updateUserLocation(userId, location) {
    try {
      this._validateLocationData(location);

      const previousLocation = this.userLocations.get(userId);
      this.userLocations.set(userId, {
        ...location,
        updatedAt: new Date().toISOString()
      });

      const events = await this._checkGeofenceViolations(userId, location, previousLocation);

      if (events.length > 0) {
        this.logger.info(`Geofence events detected for user: ${userId}`, {
          eventsCount: events.length,
          events: events.map(e => ({ type: e.type, geofenceId: e.geofenceId }))
        });
      }

      return events;
    } catch (error) {
      this.logger.error('Error updating user location:', error, { userId, location });
      throw error;
    }
  }

  /**
   * Get current location for a user
   * @param {string} userId - User ID
   * @returns {Object|null} Current location data
   */
  getUserLocation(userId) {
    return this.userLocations.get(userId) || null;
  }

  /**
   * Check if a location is within a specific geofence
   * @param {Object} location - Location coordinates {lat, lng}
   * @param {string} geofenceId - Geofence ID
   * @returns {boolean} Whether location is within geofence
   */
  isLocationInGeofence(location, geofenceId) {
    try {
      const geofence = this.geofences.get(geofenceId);
      if (!geofence || geofence.status !== 'active') {
        return false;
      }

      const distance = this._calculateDistance(location, geofence.center);
      return distance <= geofence.radius;
    } catch (error) {
      this.logger.error('Error checking location in geofence:', error, { location, geofenceId });
      return false;
    }
  }

  /**
   * Get geofences near a specific location
   * @param {Object} location - Location coordinates {lat, lng}
   * @param {number} searchRadius - Search radius in meters
   * @returns {Array<Object>} Nearby geofences
   */
  getNearbyGeofences(location, searchRadius = 5000) {
    try {
      const nearbyGeofences = Array.from(this.geofences.values())
        .filter(geofence => {
          if (geofence.status !== 'active') return false;
          const distance = this._calculateDistance(location, geofence.center);
          return distance <= (searchRadius + geofence.radius);
        })
        .map(geofence => ({
          ...geofence,
          distance: this._calculateDistance(location, geofence.center)
        }))
        .sort((a, b) => a.distance - b.distance);

      return nearbyGeofences;
    } catch (error) {
      this.logger.error('Error getting nearby geofences:', error, { location, searchRadius });
      return [];
    }
  }

  /**
   * Check geofence violations for a user
   * @param {string} userId - User ID
   * @param {Object} currentLocation - Current location
   * @param {Object} previousLocation - Previous location
   * @returns {Promise<Array<Object>>} Array of geofence events
   * @private
   */
  async _checkGeofenceViolations(userId, currentLocation, previousLocation) {
    const events = [];

    try {
      const userGeofences = this.getUserGeofences(userId);

      for (const geofence of userGeofences) {
        if (!geofence.settings.enabled) continue;

        const isCurrentlyInside = this.isLocationInGeofence(currentLocation, geofence.id);
        const wasPreviouslyInside = previousLocation
          ? this.isLocationInGeofence(previousLocation, geofence.id)
          : false;

        // Entry event
        if (isCurrentlyInside && !wasPreviouslyInside && geofence.settings.alertOnEntry) {
          const event = {
            type: 'geofence_entry',
            userId,
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            location: currentLocation,
            timestamp: new Date().toISOString(),
            metadata: {
              geofenceType: geofence.type,
              distance: this._calculateDistance(currentLocation, geofence.center)
            }
          };

          events.push(event);
          this.emit('geofence_entry', event);
          await this._saveEventToDatabase(event);
        }

        // Exit event
        if (!isCurrentlyInside && wasPreviouslyInside && geofence.settings.alertOnExit) {
          const event = {
            type: 'geofence_exit',
            userId,
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            location: currentLocation,
            timestamp: new Date().toISOString(),
            metadata: {
              geofenceType: geofence.type,
              distance: this._calculateDistance(currentLocation, geofence.center)
            }
          };

          events.push(event);
          this.emit('geofence_exit', event);
          await this._saveEventToDatabase(event);
        }
      }
    } catch (error) {
      this.logger.error('Error checking geofence violations:', error, { userId });
    }

    return events;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {Object} coord1 - First coordinate {lat, lng}
   * @param {Object} coord2 - Second coordinate {lat, lng}
   * @returns {number} Distance in meters
   * @private
   */
  _calculateDistance(coord1, coord2) {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = coord1.lat * Math.PI / 180;
    const lat2Rad = coord2.lat * Math.PI / 180;
    const deltaLatRad = (coord2.lat - coord1.lat) * Math.PI / 180;
    const deltaLngRad = (coord2.lng - coord1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Start continuous monitoring
   * @private
   */
  _startMonitoring() {
    this.monitoringTimer = setInterval(async () => {
      try {
        await this._performPeriodicChecks();
      } catch (error) {
        this.logger.error('Error during periodic monitoring:', error);
      }
    }, this.config.checkInterval);

    this.logger.info('Geofence monitoring started');
  }

  /**
   * Perform periodic checks and cleanup
   * @private
   */
  async _performPeriodicChecks() {
    try {
      // Clean up old location data (older than 1 hour)
      const oneHourAgo = Date.now() - 3600000;
      for (const [userId, location] of this.userLocations) {
        if (new Date(location.updatedAt).getTime() < oneHourAgo) {
          this.userLocations.delete(userId);
        }
      }

      // Check for inactive geofences
      const inactiveGeofences = Array.from(this.geofences.values())
        .filter(gf => gf.status === 'inactive');

      if (inactiveGeofences.length > 0) {
        this.logger.debug(`Found ${inactiveGeofences.length} inactive geofences for cleanup`);
      }
    } catch (error) {
      this.logger.error('Error during periodic checks:', error);
    }
  }

  /**
   * Validate geofence data
   * @param {Object} data - Geofence data to validate
   * @private
   */
  _validateGeofenceData(data) {
    if (!data.center || typeof data.center.lat !== 'number' || typeof data.center.lng !== 'number') {
      throw new Error('Invalid center coordinates');
    }

    if (data.center.lat < -90 || data.center.lat > 90) {
      throw new Error('Invalid latitude: must be between -90 and 90');
    }

    if (data.center.lng < -180 || data.center.lng > 180) {
      throw new Error('Invalid longitude: must be between -180 and 180');
    }

    if (!data.radius || data.radius < this.config.minRadius || data.radius > this.config.maxRadius) {
      throw new Error(`Invalid radius: must be between ${this.config.minRadius} and ${this.config.maxRadius} meters`);
    }
  }

  /**
   * Validate location data
   * @param {Object} location - Location data to validate
   * @private
   */
  _validateLocationData(location) {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      throw new Error('Invalid location coordinates');
    }

    if (location.lat < -90 || location.lat > 90) {
      throw new Error('Invalid latitude');
    }

    if (location.lng < -180 || location.lng > 180) {
      throw new Error('Invalid longitude');
    }

    if (location.accuracy && (location.accuracy < 0 || location.accuracy > 10000)) {
      throw new Error('Invalid accuracy value');
    }
  }

  /**
   * Generate unique geofence ID
   * @returns {string} Geofence ID
   * @private
   */
  _generateGeofenceId() {
    return `gf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize logger
   * @returns {Object} Logger instance
   * @private
   */
  _initLogger() {
    return {
      info: (message, meta = {}) => console.log(`[INFO] GeofenceService: ${message}`, meta),
      warn: (message, meta = {}) => console.warn(`[WARN] GeofenceService: ${message}`, meta),
      error: (message, error = null, meta = {}) => console.error(`[ERROR] GeofenceService: ${message}`, error, meta),
      debug: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DEBUG] GeofenceService: ${message}`, meta);
        }
      }
    };
  }

  /**
   * Load geofences from database (placeholder)
   * @private
   */
  async _loadGeofencesFromDatabase() {
    // Placeholder for database loading logic
    this.logger.debug('Loading geofences from database...');
  }

  /**
   * Save geofence to database (placeholder)
   * @param {Object} geofence - Geofence object
   * @private
   */
  async _saveGeofenceToDatabase(geofence) {
    // Placeholder for database save logic
    this.logger.debug(`Saving geofence to database: ${geofence.id}`);
  }

  /**
   * Delete geofence from database (placeholder)
   * @param {string} geofenceId - Geofence ID
   * @private
   */
  async _deleteGeofenceFromDatabase(geofenceId) {
    // Placeholder for database delete logic
    this.logger.debug(`Deleting geofence from database: ${geofenceId}`);
  }

  /**
   * Save event to database (placeholder)
   * @param {Object} event - Event object
   * @private
   */
  async _saveEventToDatabase(event) {
    // Placeholder for database save logic
    this.logger.debug(`Saving event to database: ${event.type}`);
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      totalGeofences: this.geofences.size,
      activeGeofences: Array.from(this.geofences.values()).filter(gf => gf.status === 'active').length,
      trackedUsers: this.userLocations.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Gracefully shutdown the service
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
      }

      this.logger.info('GeofenceService shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = GeofenceService;