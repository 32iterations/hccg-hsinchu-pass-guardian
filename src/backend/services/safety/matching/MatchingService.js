/**
 * MatchingService - Volunteer-case matching service based on proximity and availability
 * Handles automatic and manual matching of volunteers to missing person cases
 */

const EventEmitter = require('events');

class MatchingService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      maxDistance: process.env.MAX_VOLUNTEER_DISTANCE || 5000, // meters
      minDistance: process.env.MIN_VOLUNTEER_DISTANCE || 100, // meters
      maxVolunteersPerCase: process.env.MAX_VOLUNTEERS_PER_CASE || 10,
      matchingInterval: process.env.MATCHING_INTERVAL || 60000, // 1 minute
      priorityWeight: process.env.PRIORITY_WEIGHT || 1.5,
      distanceWeight: process.env.DISTANCE_WEIGHT || 1.0,
      availabilityWeight: process.env.AVAILABILITY_WEIGHT || 2.0,
      ...config
    };

    this.volunteers = new Map();
    this.cases = new Map();
    this.matches = new Map();
    this.matchingTimer = null;
    this.logger = this._initLogger();
  }

  /**
   * Initialize the matching service
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this._loadDataFromDatabase();
      this._startPeriodicMatching();
      this.logger.info('MatchingService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MatchingService:', error);
      throw error;
    }
  }

  /**
   * Register a volunteer for matching
   * @param {Object} volunteerData - Volunteer information
   * @param {string} volunteerData.userId - Volunteer user ID
   * @param {Object} volunteerData.location - Current location {lat, lng, timestamp}
   * @param {Object} volunteerData.preferences - Volunteer preferences
   * @param {Object} volunteerData.capabilities - Volunteer capabilities
   * @returns {Promise<Object>} Registered volunteer object
   */
  async registerVolunteer(volunteerData) {
    try {
      this._validateVolunteerData(volunteerData);

      const volunteer = {
        userId: volunteerData.userId,
        location: volunteerData.location,
        preferences: {
          maxDistance: this.config.maxDistance,
          caseTypes: ['missing_person'],
          timeAvailability: ['24/7'],
          ...volunteerData.preferences
        },
        capabilities: {
          hasVehicle: false,
          canProvideTransport: false,
          hasFirstAid: false,
          languages: ['zh-TW'],
          ...volunteerData.capabilities
        },
        status: 'available',
        rating: volunteerData.rating || 5.0,
        totalCases: volunteerData.totalCases || 0,
        successfulCases: volunteerData.successfulCases || 0,
        registeredAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        currentMatches: []
      };

      this.volunteers.set(volunteerData.userId, volunteer);
      await this._saveVolunteerToDatabase(volunteer);

      this.logger.info(`Volunteer registered: ${volunteerData.userId}`, {
        location: volunteerData.location,
        preferences: volunteer.preferences
      });

      this.emit('volunteer_registered', volunteer);
      return volunteer;
    } catch (error) {
      this.logger.error('Error registering volunteer:', error, volunteerData);
      throw error;
    }
  }

  /**
   * Update volunteer availability and location
   * @param {string} userId - Volunteer user ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated volunteer object
   */
  async updateVolunteer(userId, updates) {
    try {
      const volunteer = this.volunteers.get(userId);
      if (!volunteer) {
        throw new Error(`Volunteer not found: ${userId}`);
      }

      if (updates.location) {
        this._validateLocationData(updates.location);
      }

      const updatedVolunteer = {
        ...volunteer,
        ...updates,
        lastActiveAt: new Date().toISOString()
      };

      this.volunteers.set(userId, updatedVolunteer);
      await this._saveVolunteerToDatabase(updatedVolunteer);

      this.logger.debug(`Volunteer updated: ${userId}`, updates);
      this.emit('volunteer_updated', updatedVolunteer);

      return updatedVolunteer;
    } catch (error) {
      this.logger.error('Error updating volunteer:', error, { userId, updates });
      throw error;
    }
  }

  /**
   * Create a new missing person case
   * @param {Object} caseData - Case information
   * @param {string} caseData.caseId - Case ID
   * @param {string} caseData.reporterId - Reporter user ID
   * @param {Object} caseData.missingPerson - Missing person details
   * @param {Object} caseData.lastKnownLocation - Last known location {lat, lng, timestamp}
   * @param {string} caseData.priority - Case priority ('low', 'medium', 'high', 'critical')
   * @returns {Promise<Object>} Created case object
   */
  async createCase(caseData) {
    try {
      this._validateCaseData(caseData);

      const caseObj = {
        caseId: caseData.caseId,
        reporterId: caseData.reporterId,
        missingPerson: caseData.missingPerson,
        lastKnownLocation: caseData.lastKnownLocation,
        priority: caseData.priority || 'medium',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedVolunteers: [],
        searchArea: this._calculateSearchArea(caseData.lastKnownLocation, caseData.priority),
        requiredCapabilities: caseData.requiredCapabilities || [],
        timeElapsed: 0
      };

      this.cases.set(caseData.caseId, caseObj);
      await this._saveCaseToDatabase(caseObj);

      this.logger.info(`Case created: ${caseData.caseId}`, {
        priority: caseObj.priority,
        location: caseData.lastKnownLocation
      });

      this.emit('case_created', caseObj);

      // Immediately try to find matches for urgent cases
      if (caseObj.priority === 'high' || caseObj.priority === 'critical') {
        await this._findMatchesForCase(caseObj.caseId);
      }

      return caseObj;
    } catch (error) {
      this.logger.error('Error creating case:', error, caseData);
      throw error;
    }
  }

  /**
   * Update case information
   * @param {string} caseId - Case ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated case object
   */
  async updateCase(caseId, updates) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const updatedCase = {
        ...caseObj,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Recalculate search area if location or priority changed
      if (updates.lastKnownLocation || updates.priority) {
        updatedCase.searchArea = this._calculateSearchArea(
          updatedCase.lastKnownLocation,
          updatedCase.priority
        );
      }

      this.cases.set(caseId, updatedCase);
      await this._saveCaseToDatabase(updatedCase);

      this.logger.info(`Case updated: ${caseId}`, updates);
      this.emit('case_updated', updatedCase);

      return updatedCase;
    } catch (error) {
      this.logger.error('Error updating case:', error, { caseId, updates });
      throw error;
    }
  }

  /**
   * Find optimal volunteer matches for a specific case
   * @param {string} caseId - Case ID
   * @param {Object} options - Matching options
   * @returns {Promise<Array<Object>>} Array of potential matches
   */
  async findMatchesForCase(caseId, options = {}) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const matches = await this._findMatchesForCase(caseId, options);
      this.logger.info(`Found ${matches.length} potential matches for case: ${caseId}`);

      return matches;
    } catch (error) {
      this.logger.error('Error finding matches for case:', error, { caseId });
      throw error;
    }
  }

  /**
   * Assign a volunteer to a case
   * @param {string} caseId - Case ID
   * @param {string} volunteerUserId - Volunteer user ID
   * @param {Object} assignment - Assignment details
   * @returns {Promise<Object>} Assignment object
   */
  async assignVolunteer(caseId, volunteerUserId, assignment = {}) {
    try {
      const caseObj = this.cases.get(caseId);
      const volunteer = this.volunteers.get(volunteerUserId);

      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      if (!volunteer) {
        throw new Error(`Volunteer not found: ${volunteerUserId}`);
      }

      if (volunteer.status !== 'available') {
        throw new Error(`Volunteer is not available: ${volunteerUserId}`);
      }

      if (caseObj.assignedVolunteers.length >= this.config.maxVolunteersPerCase) {
        throw new Error(`Maximum volunteers already assigned to case: ${caseId}`);
      }

      const matchId = this._generateMatchId();
      const match = {
        matchId,
        caseId,
        volunteerUserId,
        status: 'assigned',
        assignedAt: new Date().toISOString(),
        acceptedAt: null,
        completedAt: null,
        role: assignment.role || 'searcher',
        searchArea: assignment.searchArea || caseObj.searchArea,
        estimatedArrival: this._calculateEstimatedArrival(volunteer.location, caseObj.lastKnownLocation),
        priority: assignment.priority || 'normal'
      };

      // Update case
      caseObj.assignedVolunteers.push({
        volunteerUserId,
        matchId,
        role: match.role,
        assignedAt: match.assignedAt
      });

      // Update volunteer
      volunteer.currentMatches.push(matchId);
      volunteer.status = 'assigned';

      // Store match
      this.matches.set(matchId, match);

      // Save to database
      await Promise.all([
        this._saveCaseToDatabase(caseObj),
        this._saveVolunteerToDatabase(volunteer),
        this._saveMatchToDatabase(match)
      ]);

      this.logger.info(`Volunteer assigned to case`, {
        matchId,
        caseId,
        volunteerUserId,
        role: match.role
      });

      this.emit('volunteer_assigned', match);
      return match;
    } catch (error) {
      this.logger.error('Error assigning volunteer:', error, { caseId, volunteerUserId });
      throw error;
    }
  }

  /**
   * Volunteer accepts or rejects an assignment
   * @param {string} matchId - Match ID
   * @param {boolean} accepted - Whether the volunteer accepts
   * @param {string} reason - Reason for rejection (if applicable)
   * @returns {Promise<Object>} Updated match object
   */
  async respondToAssignment(matchId, accepted, reason = null) {
    try {
      const match = this.matches.get(matchId);
      if (!match) {
        throw new Error(`Match not found: ${matchId}`);
      }

      if (match.status !== 'assigned') {
        throw new Error(`Match is not in assigned status: ${matchId}`);
      }

      const volunteer = this.volunteers.get(match.volunteerUserId);
      const caseObj = this.cases.get(match.caseId);

      if (accepted) {
        match.status = 'accepted';
        match.acceptedAt = new Date().toISOString();
        volunteer.status = 'active';

        this.logger.info(`Assignment accepted`, { matchId, volunteerUserId: match.volunteerUserId });
        this.emit('assignment_accepted', match);
      } else {
        match.status = 'rejected';
        match.rejectedAt = new Date().toISOString();
        match.rejectionReason = reason;

        // Remove volunteer from case
        caseObj.assignedVolunteers = caseObj.assignedVolunteers.filter(
          v => v.volunteerUserId !== match.volunteerUserId
        );

        // Update volunteer status
        volunteer.currentMatches = volunteer.currentMatches.filter(id => id !== matchId);
        if (volunteer.currentMatches.length === 0) {
          volunteer.status = 'available';
        }

        this.logger.info(`Assignment rejected`, {
          matchId,
          volunteerUserId: match.volunteerUserId,
          reason
        });

        this.emit('assignment_rejected', match);

        // Try to find new matches for the case
        await this._findMatchesForCase(match.caseId);
      }

      // Save updates
      await Promise.all([
        this._saveMatchToDatabase(match),
        this._saveVolunteerToDatabase(volunteer),
        this._saveCaseToDatabase(caseObj)
      ]);

      return match;
    } catch (error) {
      this.logger.error('Error responding to assignment:', error, { matchId, accepted });
      throw error;
    }
  }

  /**
   * Complete a volunteer assignment
   * @param {string} matchId - Match ID
   * @param {Object} completion - Completion details
   * @returns {Promise<Object>} Completed match object
   */
  async completeAssignment(matchId, completion = {}) {
    try {
      const match = this.matches.get(matchId);
      if (!match) {
        throw new Error(`Match not found: ${matchId}`);
      }

      if (match.status !== 'accepted') {
        throw new Error(`Match is not in accepted status: ${matchId}`);
      }

      const volunteer = this.volunteers.get(match.volunteerUserId);
      const caseObj = this.cases.get(match.caseId);

      match.status = 'completed';
      match.completedAt = new Date().toISOString();
      match.completion = {
        outcome: completion.outcome || 'completed',
        notes: completion.notes || '',
        foundPerson: completion.foundPerson || false,
        ...completion
      };

      // Update volunteer
      volunteer.currentMatches = volunteer.currentMatches.filter(id => id !== matchId);
      volunteer.totalCases += 1;

      if (match.completion.foundPerson) {
        volunteer.successfulCases += 1;
      }

      if (volunteer.currentMatches.length === 0) {
        volunteer.status = 'available';
      }

      // Update case if person was found
      if (match.completion.foundPerson) {
        caseObj.status = 'resolved';
        caseObj.resolvedAt = new Date().toISOString();
        caseObj.resolvedBy = match.volunteerUserId;
      }

      // Save updates
      await Promise.all([
        this._saveMatchToDatabase(match),
        this._saveVolunteerToDatabase(volunteer),
        this._saveCaseToDatabase(caseObj)
      ]);

      this.logger.info(`Assignment completed`, {
        matchId,
        volunteerUserId: match.volunteerUserId,
        outcome: match.completion.outcome
      });

      this.emit('assignment_completed', match);
      return match;
    } catch (error) {
      this.logger.error('Error completing assignment:', error, { matchId });
      throw error;
    }
  }

  /**
   * Get matches for a specific volunteer
   * @param {string} volunteerUserId - Volunteer user ID
   * @returns {Array<Object>} Array of matches
   */
  getVolunteerMatches(volunteerUserId) {
    try {
      const matches = Array.from(this.matches.values())
        .filter(match => match.volunteerUserId === volunteerUserId)
        .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));

      return matches;
    } catch (error) {
      this.logger.error('Error getting volunteer matches:', error, { volunteerUserId });
      return [];
    }
  }

  /**
   * Get matches for a specific case
   * @param {string} caseId - Case ID
   * @returns {Array<Object>} Array of matches
   */
  getCaseMatches(caseId) {
    try {
      const matches = Array.from(this.matches.values())
        .filter(match => match.caseId === caseId)
        .sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));

      return matches;
    } catch (error) {
      this.logger.error('Error getting case matches:', error, { caseId });
      return [];
    }
  }

  /**
   * Find matches for a case
   * @param {string} caseId - Case ID
   * @param {Object} options - Matching options
   * @returns {Promise<Array<Object>>} Array of potential matches
   * @private
   */
  async _findMatchesForCase(caseId, options = {}) {
    const caseObj = this.cases.get(caseId);
    if (!caseObj) return [];

    const availableVolunteers = Array.from(this.volunteers.values())
      .filter(volunteer => volunteer.status === 'available');

    const potentialMatches = availableVolunteers
      .map(volunteer => ({
        volunteer,
        score: this._calculateMatchScore(caseObj, volunteer),
        distance: this._calculateDistance(volunteer.location, caseObj.lastKnownLocation)
      }))
      .filter(match =>
        match.distance <= volunteer.preferences.maxDistance &&
        match.score > 0
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, options.maxResults || this.config.maxVolunteersPerCase);

    return potentialMatches;
  }

  /**
   * Calculate match score between case and volunteer
   * @param {Object} caseObj - Case object
   * @param {Object} volunteer - Volunteer object
   * @returns {number} Match score
   * @private
   */
  _calculateMatchScore(caseObj, volunteer) {
    let score = 0;

    // Distance score (closer is better)
    const distance = this._calculateDistance(volunteer.location, caseObj.lastKnownLocation);
    const maxDistance = volunteer.preferences.maxDistance;
    const distanceScore = Math.max(0, (maxDistance - distance) / maxDistance) * this.config.distanceWeight;

    // Priority score
    const priorityMultiplier = {
      'low': 1.0,
      'medium': 1.2,
      'high': 1.5,
      'critical': 2.0
    };
    const priorityScore = (priorityMultiplier[caseObj.priority] || 1.0) * this.config.priorityWeight;

    // Availability score
    const availabilityScore = volunteer.status === 'available' ? this.config.availabilityWeight : 0;

    // Experience score
    const successRate = volunteer.totalCases > 0 ? volunteer.successfulCases / volunteer.totalCases : 0.5;
    const experienceScore = (volunteer.rating / 5.0) * (1 + successRate);

    score = (distanceScore + availabilityScore + experienceScore) * priorityScore;

    return score;
  }

  /**
   * Calculate search area based on location and priority
   * @param {Object} location - Last known location
   * @param {string} priority - Case priority
   * @returns {Object} Search area definition
   * @private
   */
  _calculateSearchArea(location, priority) {
    const baseRadius = {
      'low': 1000,
      'medium': 2000,
      'high': 3000,
      'critical': 5000
    };

    return {
      center: location,
      radius: baseRadius[priority] || 2000,
      type: 'circular'
    };
  }

  /**
   * Calculate estimated arrival time
   * @param {Object} volunteerLocation - Volunteer location
   * @param {Object} targetLocation - Target location
   * @returns {number} Estimated minutes to arrival
   * @private
   */
  _calculateEstimatedArrival(volunteerLocation, targetLocation) {
    const distance = this._calculateDistance(volunteerLocation, targetLocation);
    const averageSpeed = 30; // km/h average speed
    return Math.round((distance / 1000) / averageSpeed * 60); // minutes
  }

  /**
   * Calculate distance between two coordinates
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
   * Start periodic matching process
   * @private
   */
  _startPeriodicMatching() {
    this.matchingTimer = setInterval(async () => {
      try {
        await this._performPeriodicMatching();
      } catch (error) {
        this.logger.error('Error during periodic matching:', error);
      }
    }, this.config.matchingInterval);

    this.logger.info('Periodic matching started');
  }

  /**
   * Perform periodic matching for all active cases
   * @private
   */
  async _performPeriodicMatching() {
    const activeCases = Array.from(this.cases.values())
      .filter(caseObj => caseObj.status === 'active');

    for (const caseObj of activeCases) {
      if (caseObj.assignedVolunteers.length < this.config.maxVolunteersPerCase) {
        await this._findMatchesForCase(caseObj.caseId);
      }
    }
  }

  /**
   * Validate volunteer data
   * @param {Object} data - Volunteer data
   * @private
   */
  _validateVolunteerData(data) {
    if (!data.userId) {
      throw new Error('User ID is required');
    }

    if (!data.location) {
      throw new Error('Location is required');
    }

    this._validateLocationData(data.location);
  }

  /**
   * Validate case data
   * @param {Object} data - Case data
   * @private
   */
  _validateCaseData(data) {
    if (!data.caseId) {
      throw new Error('Case ID is required');
    }

    if (!data.reporterId) {
      throw new Error('Reporter ID is required');
    }

    if (!data.lastKnownLocation) {
      throw new Error('Last known location is required');
    }

    this._validateLocationData(data.lastKnownLocation);

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      throw new Error('Invalid priority level');
    }
  }

  /**
   * Validate location data
   * @param {Object} location - Location data
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
  }

  /**
   * Generate unique match ID
   * @returns {string} Match ID
   * @private
   */
  _generateMatchId() {
    return `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize logger
   * @returns {Object} Logger instance
   * @private
   */
  _initLogger() {
    return {
      info: (message, meta = {}) => console.log(`[INFO] MatchingService: ${message}`, meta),
      warn: (message, meta = {}) => console.warn(`[WARN] MatchingService: ${message}`, meta),
      error: (message, error = null, meta = {}) => console.error(`[ERROR] MatchingService: ${message}`, error, meta),
      debug: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DEBUG] MatchingService: ${message}`, meta);
        }
      }
    };
  }

  /**
   * Database methods (placeholders)
   */
  async _loadDataFromDatabase() {
    this.logger.debug('Loading data from database...');
  }

  async _saveVolunteerToDatabase(volunteer) {
    this.logger.debug(`Saving volunteer to database: ${volunteer.userId}`);
  }

  async _saveCaseToDatabase(caseObj) {
    this.logger.debug(`Saving case to database: ${caseObj.caseId}`);
  }

  async _saveMatchToDatabase(match) {
    this.logger.debug(`Saving match to database: ${match.matchId}`);
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      totalVolunteers: this.volunteers.size,
      availableVolunteers: Array.from(this.volunteers.values()).filter(v => v.status === 'available').length,
      activeCases: Array.from(this.cases.values()).filter(c => c.status === 'active').length,
      totalMatches: this.matches.size,
      activeMatches: Array.from(this.matches.values()).filter(m => m.status === 'accepted').length,
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
      if (this.matchingTimer) {
        clearInterval(this.matchingTimer);
      }

      this.logger.info('MatchingService shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = MatchingService;