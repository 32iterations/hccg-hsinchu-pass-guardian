/**
 * Safety Guardian Services - Main service orchestrator
 * Coordinates all safety-related services and provides unified API
 */

const EventStreamService = require('./events/EventStreamService');
const GeofenceService = require('./geofence/GeofenceService');
const MatchingService = require('./matching/MatchingService');
const CaseManagementService = require('./case/CaseManagementService');
const MyDataService = require('./mydata/MyDataService');

class SafetyGuardianServices {
  constructor(config = {}) {
    this.config = {
      enableEventStream: process.env.ENABLE_EVENT_STREAM !== 'false',
      enableGeofencing: process.env.ENABLE_GEOFENCING !== 'false',
      enableMatching: process.env.ENABLE_MATCHING !== 'false',
      enableCaseManagement: process.env.ENABLE_CASE_MANAGEMENT !== 'false',
      enableMyData: process.env.ENABLE_MYDATA !== 'false',
      ...config
    };

    this.services = {};
    this.logger = this._initLogger();
    this.isInitialized = false;
  }

  /**
   * Initialize all safety services
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.logger.info('Initializing Safety Guardian Services...');

      // Initialize Event Stream Service
      if (this.config.enableEventStream) {
        this.services.eventStream = new EventStreamService();
        await this.services.eventStream.initialize();
        this.logger.info('Event Stream Service initialized');
      }

      // Initialize Geofence Service
      if (this.config.enableGeofencing) {
        this.services.geofence = new GeofenceService();
        await this.services.geofence.initialize();
        this.logger.info('Geofence Service initialized');
      }

      // Initialize Matching Service
      if (this.config.enableMatching) {
        this.services.matching = new MatchingService();
        await this.services.matching.initialize();
        this.logger.info('Matching Service initialized');
      }

      // Initialize Case Management Service
      if (this.config.enableCaseManagement) {
        this.services.caseManagement = new CaseManagementService();
        await this.services.caseManagement.initialize();
        this.logger.info('Case Management Service initialized');
      }

      // Initialize MyData Service
      if (this.config.enableMyData) {
        this.services.myData = new MyDataService();
        await this.services.myData.initialize();
        this.logger.info('MyData Service initialized');
      }

      // Set up service interconnections
      this._setupServiceConnections();

      this.isInitialized = true;
      this.logger.info('All Safety Guardian Services initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize Safety Guardian Services:', error);
      throw error;
    }
  }

  /**
   * Get a specific service instance
   * @param {string} serviceName - Name of the service
   * @returns {Object|null} Service instance
   */
  getService(serviceName) {
    return this.services[serviceName] || null;
  }

  /**
   * Get all service instances
   * @returns {Object} All service instances
   */
  getAllServices() {
    return { ...this.services };
  }

  /**
   * Check if services are initialized
   * @returns {boolean} Initialization status
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get health status of all services
   * @returns {Object} Health status of each service
   */
  getHealthStatus() {
    const status = {
      overall: 'healthy',
      services: {},
      timestamp: new Date().toISOString()
    };

    for (const [name, service] of Object.entries(this.services)) {
      try {
        if (service && typeof service.getStats === 'function') {
          status.services[name] = {
            status: 'healthy',
            stats: service.getStats()
          };
        } else {
          status.services[name] = {
            status: 'unknown',
            error: 'Service does not provide stats'
          };
        }
      } catch (error) {
        status.services[name] = {
          status: 'unhealthy',
          error: error.message
        };
        status.overall = 'degraded';
      }
    }

    return status;
  }

  /**
   * Get comprehensive service statistics
   * @returns {Object} Combined statistics from all services
   */
  getStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      services: {}
    };

    for (const [name, service] of Object.entries(this.services)) {
      try {
        if (service && typeof service.getStats === 'function') {
          stats.services[name] = service.getStats();
        }
      } catch (error) {
        stats.services[name] = { error: error.message };
      }
    }

    return stats;
  }

  /**
   * Gracefully shutdown all services
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down Safety Guardian Services...');

      const shutdownPromises = [];

      for (const [name, service] of Object.entries(this.services)) {
        if (service && typeof service.shutdown === 'function') {
          shutdownPromises.push(
            service.shutdown().catch(error => {
              this.logger.error(`Error shutting down ${name} service:`, error);
            })
          );
        }
      }

      await Promise.all(shutdownPromises);

      this.isInitialized = false;
      this.logger.info('All Safety Guardian Services shut down successfully');

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Set up connections and event handling between services
   * @private
   */
  _setupServiceConnections() {
    // Connect Geofence Service to Event Stream
    if (this.services.geofence && this.services.eventStream) {
      this.services.geofence.on('geofence_entry', (event) => {
        this.services.eventStream.broadcastToChannel('geofence_alerts', {
          type: 'geofence_entry',
          ...event
        });
      });

      this.services.geofence.on('geofence_exit', (event) => {
        this.services.eventStream.broadcastToChannel('geofence_alerts', {
          type: 'geofence_exit',
          ...event
        });
      });
    }

    // Connect Case Management to Event Stream
    if (this.services.caseManagement && this.services.eventStream) {
      this.services.caseManagement.on('case_created', (caseObj) => {
        this.services.eventStream.broadcastToChannel('case_updates', {
          type: 'case_created',
          caseId: caseObj.caseId,
          priority: caseObj.priority,
          timestamp: caseObj.createdAt
        });
      });

      this.services.caseManagement.on('case_updated', (caseObj) => {
        this.services.eventStream.broadcastToChannel('case_updates', {
          type: 'case_updated',
          caseId: caseObj.caseId,
          status: caseObj.status,
          timestamp: caseObj.updatedAt
        });
      });

      this.services.caseManagement.on('case_closed', (caseObj) => {
        this.services.eventStream.broadcastToChannel('case_updates', {
          type: 'case_closed',
          caseId: caseObj.caseId,
          outcome: caseObj.closure?.outcome,
          timestamp: caseObj.closedAt
        });
      });
    }

    // Connect Case Management to Matching Service
    if (this.services.caseManagement && this.services.matching) {
      this.services.caseManagement.on('case_created', async (caseObj) => {
        try {
          // Automatically create a case in the matching service
          await this.services.matching.createCase({
            caseId: caseObj.caseId,
            reporterId: caseObj.reporterId,
            missingPerson: caseObj.missingPerson,
            lastKnownLocation: caseObj.lastKnownLocation,
            priority: caseObj.priority
          });
        } catch (error) {
          this.logger.error('Error creating case in matching service:', error);
        }
      });
    }

    // Connect Matching Service to Event Stream
    if (this.services.matching && this.services.eventStream) {
      this.services.matching.on('volunteer_assigned', (match) => {
        this.services.eventStream.broadcastToChannel('volunteer_notifications', {
          type: 'volunteer_assigned',
          matchId: match.matchId,
          caseId: match.caseId,
          volunteerUserId: match.volunteerUserId,
          timestamp: match.assignedAt
        });
      });

      this.services.matching.on('assignment_accepted', (match) => {
        this.services.eventStream.broadcastToChannel('volunteer_notifications', {
          type: 'assignment_accepted',
          matchId: match.matchId,
          caseId: match.caseId,
          volunteerUserId: match.volunteerUserId,
          timestamp: match.acceptedAt
        });
      });
    }

    // Connect MyData Service to Event Stream
    if (this.services.myData && this.services.eventStream) {
      this.services.myData.on('consent_granted', (data) => {
        this.services.eventStream.broadcastToChannel('system_alerts', {
          type: 'mydata_consent_granted',
          requestId: data.request.requestId,
          timestamp: data.consent.grantedAt
        });
      });

      this.services.myData.on('consent_revoked', (consent) => {
        this.services.eventStream.broadcastToChannel('system_alerts', {
          type: 'mydata_consent_revoked',
          consentId: consent.consentId,
          timestamp: consent.revokedAt
        });
      });
    }

    this.logger.info('Service connections established');
  }

  /**
   * Initialize logger
   * @returns {Object} Logger instance
   * @private
   */
  _initLogger() {
    return {
      info: (message, meta = {}) => console.log(`[INFO] SafetyGuardianServices: ${message}`, meta),
      warn: (message, meta = {}) => console.warn(`[WARN] SafetyGuardianServices: ${message}`, meta),
      error: (message, error = null, meta = {}) => console.error(`[ERROR] SafetyGuardianServices: ${message}`, error, meta),
      debug: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DEBUG] SafetyGuardianServices: ${message}`, meta);
        }
      }
    };
  }
}

module.exports = SafetyGuardianServices;