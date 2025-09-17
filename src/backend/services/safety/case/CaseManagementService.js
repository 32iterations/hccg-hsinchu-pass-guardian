/**
 * CaseManagementService - Missing person case management system
 * Handles case lifecycle, status updates, and coordination with other services
 */

const EventEmitter = require('events');

class CaseManagementService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      autoArchiveDays: process.env.AUTO_ARCHIVE_DAYS || 30,
      maxActiveCasesPerUser: process.env.MAX_ACTIVE_CASES_PER_USER || 5,
      requiredUpdateInterval: process.env.REQUIRED_UPDATE_INTERVAL || 3600000, // 1 hour
      escalationThresholds: {
        medium: process.env.ESCALATION_MEDIUM || 7200000, // 2 hours
        high: process.env.ESCALATION_HIGH || 3600000, // 1 hour
        critical: process.env.ESCALATION_CRITICAL || 1800000 // 30 minutes
      },
      ...config
    };

    this.cases = new Map();
    this.caseHistory = new Map();
    this.watchers = new Map(); // Users watching specific cases
    this.escalationTimer = null;
    this.logger = this._initLogger();
  }

  /**
   * Initialize the case management service
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this._loadCasesFromDatabase();
      this._startEscalationMonitoring();
      this.logger.info('CaseManagementService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize CaseManagementService:', error);
      throw error;
    }
  }

  /**
   * Create a new missing person case
   * @param {Object} caseData - Case information
   * @param {string} caseData.reporterId - Reporter user ID
   * @param {Object} caseData.missingPerson - Missing person details
   * @param {Object} caseData.lastKnownLocation - Last known location
   * @param {string} caseData.priority - Case priority
   * @param {Object} caseData.circumstances - Circumstances of disappearance
   * @returns {Promise<Object>} Created case object
   */
  async createCase(caseData) {
    try {
      this._validateCaseData(caseData);

      // Check if user has too many active cases
      const userActiveCases = Array.from(this.cases.values())
        .filter(c => c.reporterId === caseData.reporterId && c.status !== 'closed');

      if (userActiveCases.length >= this.config.maxActiveCasesPerUser) {
        throw new Error(`Maximum active cases (${this.config.maxActiveCasesPerUser}) reached for user`);
      }

      const caseId = this._generateCaseId();
      const now = new Date().toISOString();

      const caseObj = {
        caseId,
        reporterId: caseData.reporterId,
        missingPerson: {
          name: caseData.missingPerson.name,
          age: caseData.missingPerson.age,
          gender: caseData.missingPerson.gender,
          description: caseData.missingPerson.description,
          photo: caseData.missingPerson.photo || null,
          medicalConditions: caseData.missingPerson.medicalConditions || [],
          clothing: caseData.missingPerson.clothing || '',
          distinguishingFeatures: caseData.missingPerson.distinguishingFeatures || []
        },
        lastKnownLocation: {
          lat: caseData.lastKnownLocation.lat,
          lng: caseData.lastKnownLocation.lng,
          address: caseData.lastKnownLocation.address || '',
          timestamp: caseData.lastKnownLocation.timestamp || now,
          accuracy: caseData.lastKnownLocation.accuracy || null
        },
        circumstances: {
          timeOfDisappearance: caseData.circumstances.timeOfDisappearance || now,
          lastSeenWith: caseData.circumstances.lastSeenWith || '',
          behaviorBeforeDisappearance: caseData.circumstances.behaviorBeforeDisappearance || '',
          possibleDestinations: caseData.circumstances.possibleDestinations || [],
          transportationMethod: caseData.circumstances.transportationMethod || 'walking',
          ...caseData.circumstances
        },
        priority: caseData.priority || 'medium',
        status: 'active',
        category: this._determineCaseCategory(caseData),
        riskLevel: this._assessRiskLevel(caseData),
        searchRadius: this._calculateSearchRadius(caseData),
        publicVisibility: caseData.publicVisibility !== false, // Default to public
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        timeline: [],
        assignedOfficers: [],
        involvedVolunteers: [],
        leads: [],
        evidence: [],
        communications: [],
        statistics: {
          viewCount: 0,
          shareCount: 0,
          tipCount: 0,
          volunteerCount: 0
        }
      };

      // Add initial timeline entry
      caseObj.timeline.push({
        id: this._generateTimelineId(),
        type: 'case_created',
        description: 'Case created and reported',
        timestamp: now,
        userId: caseData.reporterId,
        data: {
          priority: caseObj.priority,
          location: caseObj.lastKnownLocation
        }
      });

      this.cases.set(caseId, caseObj);
      await this._saveCaseToDatabase(caseObj);

      this.logger.info(`Case created: ${caseId}`, {
        reporterId: caseData.reporterId,
        priority: caseObj.priority,
        missingPersonName: caseObj.missingPerson.name
      });

      this.emit('case_created', caseObj);

      // Auto-escalate if critical priority
      if (caseObj.priority === 'critical') {
        await this._escalateCase(caseId, 'auto_escalation_critical');
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
   * @param {string} updatedBy - User ID of who is updating
   * @returns {Promise<Object>} Updated case object
   */
  async updateCase(caseId, updates, updatedBy) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const now = new Date().toISOString();
      const previousStatus = caseObj.status;

      // Validate updates
      if (updates.priority && !['low', 'medium', 'high', 'critical'].includes(updates.priority)) {
        throw new Error('Invalid priority level');
      }

      if (updates.status && !['active', 'investigating', 'resolved', 'closed'].includes(updates.status)) {
        throw new Error('Invalid status');
      }

      const updatedCase = {
        ...caseObj,
        ...updates,
        updatedAt: now,
        lastActivityAt: now
      };

      // Recalculate derived fields if relevant data changed
      if (updates.missingPerson || updates.circumstances) {
        updatedCase.riskLevel = this._assessRiskLevel(updatedCase);
        updatedCase.searchRadius = this._calculateSearchRadius(updatedCase);
        updatedCase.category = this._determineCaseCategory(updatedCase);
      }

      // Add timeline entry for significant changes
      if (updates.status && updates.status !== previousStatus) {
        updatedCase.timeline.push({
          id: this._generateTimelineId(),
          type: 'status_changed',
          description: `Case status changed from ${previousStatus} to ${updates.status}`,
          timestamp: now,
          userId: updatedBy,
          data: {
            previousStatus,
            newStatus: updates.status,
            reason: updates.statusReason || ''
          }
        });
      }

      if (updates.priority && updates.priority !== caseObj.priority) {
        updatedCase.timeline.push({
          id: this._generateTimelineId(),
          type: 'priority_changed',
          description: `Case priority changed from ${caseObj.priority} to ${updates.priority}`,
          timestamp: now,
          userId: updatedBy,
          data: {
            previousPriority: caseObj.priority,
            newPriority: updates.priority,
            reason: updates.priorityReason || ''
          }
        });
      }

      this.cases.set(caseId, updatedCase);
      await this._saveCaseToDatabase(updatedCase);

      this.logger.info(`Case updated: ${caseId}`, {
        updatedBy,
        changes: Object.keys(updates)
      });

      this.emit('case_updated', updatedCase, updates);

      // Notify watchers
      await this._notifyWatchers(caseId, 'case_updated', updatedCase);

      return updatedCase;
    } catch (error) {
      this.logger.error('Error updating case:', error, { caseId, updates });
      throw error;
    }
  }

  /**
   * Add a timeline entry to a case
   * @param {string} caseId - Case ID
   * @param {Object} entry - Timeline entry data
   * @param {string} userId - User ID of who is adding the entry
   * @returns {Promise<Object>} Updated case object
   */
  async addTimelineEntry(caseId, entry, userId) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const timelineEntry = {
        id: this._generateTimelineId(),
        type: entry.type || 'update',
        description: entry.description,
        timestamp: entry.timestamp || new Date().toISOString(),
        userId,
        data: entry.data || {},
        location: entry.location || null,
        attachments: entry.attachments || []
      };

      caseObj.timeline.push(timelineEntry);
      caseObj.updatedAt = new Date().toISOString();
      caseObj.lastActivityAt = new Date().toISOString();

      this.cases.set(caseId, caseObj);
      await this._saveCaseToDatabase(caseObj);

      this.logger.info(`Timeline entry added to case: ${caseId}`, {
        entryType: timelineEntry.type,
        userId
      });

      this.emit('timeline_entry_added', { caseId, entry: timelineEntry });

      // Notify watchers
      await this._notifyWatchers(caseId, 'timeline_entry_added', timelineEntry);

      return caseObj;
    } catch (error) {
      this.logger.error('Error adding timeline entry:', error, { caseId, entry });
      throw error;
    }
  }

  /**
   * Add a lead to a case
   * @param {string} caseId - Case ID
   * @param {Object} lead - Lead information
   * @param {string} reportedBy - User ID of who reported the lead
   * @returns {Promise<Object>} Updated case object
   */
  async addLead(caseId, lead, reportedBy) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const leadEntry = {
        id: this._generateLeadId(),
        type: lead.type || 'sighting',
        description: lead.description,
        location: lead.location || null,
        timestamp: lead.timestamp || new Date().toISOString(),
        reportedBy,
        reportedAt: new Date().toISOString(),
        status: 'new',
        priority: lead.priority || 'medium',
        credibility: lead.credibility || 'unverified',
        followUpRequired: lead.followUpRequired !== false,
        evidence: lead.evidence || [],
        contacts: lead.contacts || []
      };

      caseObj.leads.push(leadEntry);
      caseObj.statistics.tipCount += 1;
      caseObj.updatedAt = new Date().toISOString();
      caseObj.lastActivityAt = new Date().toISOString();

      // Add timeline entry
      caseObj.timeline.push({
        id: this._generateTimelineId(),
        type: 'lead_added',
        description: `New lead reported: ${leadEntry.type}`,
        timestamp: leadEntry.reportedAt,
        userId: reportedBy,
        data: {
          leadId: leadEntry.id,
          leadType: leadEntry.type,
          priority: leadEntry.priority
        }
      });

      this.cases.set(caseId, caseObj);
      await this._saveCaseToDatabase(caseObj);

      this.logger.info(`Lead added to case: ${caseId}`, {
        leadId: leadEntry.id,
        leadType: leadEntry.type,
        reportedBy
      });

      this.emit('lead_added', { caseId, lead: leadEntry });

      // Notify watchers
      await this._notifyWatchers(caseId, 'lead_added', leadEntry);

      return caseObj;
    } catch (error) {
      this.logger.error('Error adding lead:', error, { caseId, lead });
      throw error;
    }
  }

  /**
   * Update lead status
   * @param {string} caseId - Case ID
   * @param {string} leadId - Lead ID
   * @param {Object} updates - Lead updates
   * @param {string} updatedBy - User ID
   * @returns {Promise<Object>} Updated case object
   */
  async updateLead(caseId, leadId, updates, updatedBy) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      const leadIndex = caseObj.leads.findIndex(lead => lead.id === leadId);
      if (leadIndex === -1) {
        throw new Error(`Lead not found: ${leadId}`);
      }

      const previousStatus = caseObj.leads[leadIndex].status;
      caseObj.leads[leadIndex] = {
        ...caseObj.leads[leadIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy
      };

      caseObj.updatedAt = new Date().toISOString();

      // Add timeline entry if status changed
      if (updates.status && updates.status !== previousStatus) {
        caseObj.timeline.push({
          id: this._generateTimelineId(),
          type: 'lead_updated',
          description: `Lead status changed from ${previousStatus} to ${updates.status}`,
          timestamp: new Date().toISOString(),
          userId: updatedBy,
          data: {
            leadId,
            previousStatus,
            newStatus: updates.status
          }
        });
      }

      this.cases.set(caseId, caseObj);
      await this._saveCaseToDatabase(caseObj);

      this.logger.info(`Lead updated: ${leadId} in case: ${caseId}`, {
        updates: Object.keys(updates),
        updatedBy
      });

      this.emit('lead_updated', { caseId, leadId, lead: caseObj.leads[leadIndex] });

      return caseObj;
    } catch (error) {
      this.logger.error('Error updating lead:', error, { caseId, leadId, updates });
      throw error;
    }
  }

  /**
   * Close a case
   * @param {string} caseId - Case ID
   * @param {Object} closure - Closure information
   * @param {string} closedBy - User ID of who is closing the case
   * @returns {Promise<Object>} Closed case object
   */
  async closeCase(caseId, closure, closedBy) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      if (caseObj.status === 'closed') {
        throw new Error('Case is already closed');
      }

      const now = new Date().toISOString();

      const updatedCase = {
        ...caseObj,
        status: 'closed',
        closedAt: now,
        closedBy,
        closure: {
          outcome: closure.outcome || 'resolved', // resolved, unresolved, false_alarm
          description: closure.description || '',
          foundLocation: closure.foundLocation || null,
          foundBy: closure.foundBy || null,
          condition: closure.condition || null, // safe, injured, deceased
          circumstances: closure.circumstances || '',
          ...closure
        },
        updatedAt: now
      };

      // Add closure timeline entry
      updatedCase.timeline.push({
        id: this._generateTimelineId(),
        type: 'case_closed',
        description: `Case closed - Outcome: ${updatedCase.closure.outcome}`,
        timestamp: now,
        userId: closedBy,
        data: {
          outcome: updatedCase.closure.outcome,
          condition: updatedCase.closure.condition
        }
      });

      this.cases.set(caseId, updatedCase);
      await this._saveCaseToDatabase(updatedCase);

      this.logger.info(`Case closed: ${caseId}`, {
        outcome: updatedCase.closure.outcome,
        closedBy
      });

      this.emit('case_closed', updatedCase);

      // Notify all watchers
      await this._notifyWatchers(caseId, 'case_closed', updatedCase);

      return updatedCase;
    } catch (error) {
      this.logger.error('Error closing case:', error, { caseId, closure });
      throw error;
    }
  }

  /**
   * Reopen a closed case
   * @param {string} caseId - Case ID
   * @param {string} reason - Reason for reopening
   * @param {string} reopenedBy - User ID
   * @returns {Promise<Object>} Reopened case object
   */
  async reopenCase(caseId, reason, reopenedBy) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) {
        throw new Error(`Case not found: ${caseId}`);
      }

      if (caseObj.status !== 'closed') {
        throw new Error('Case is not closed');
      }

      const now = new Date().toISOString();

      const updatedCase = {
        ...caseObj,
        status: 'active',
        reopenedAt: now,
        reopenedBy,
        reopenReason: reason,
        updatedAt: now,
        lastActivityAt: now
      };

      // Add reopen timeline entry
      updatedCase.timeline.push({
        id: this._generateTimelineId(),
        type: 'case_reopened',
        description: `Case reopened - Reason: ${reason}`,
        timestamp: now,
        userId: reopenedBy,
        data: { reason }
      });

      this.cases.set(caseId, updatedCase);
      await this._saveCaseToDatabase(updatedCase);

      this.logger.info(`Case reopened: ${caseId}`, {
        reason,
        reopenedBy
      });

      this.emit('case_reopened', updatedCase);

      return updatedCase;
    } catch (error) {
      this.logger.error('Error reopening case:', error, { caseId, reason });
      throw error;
    }
  }

  /**
   * Get case by ID
   * @param {string} caseId - Case ID
   * @returns {Object|null} Case object
   */
  getCase(caseId) {
    return this.cases.get(caseId) || null;
  }

  /**
   * Search cases with filters
   * @param {Object} filters - Search filters
   * @returns {Array<Object>} Filtered cases
   */
  searchCases(filters = {}) {
    try {
      let cases = Array.from(this.cases.values());

      // Apply filters
      if (filters.status) {
        cases = cases.filter(c => c.status === filters.status);
      }

      if (filters.priority) {
        cases = cases.filter(c => c.priority === filters.priority);
      }

      if (filters.reporterId) {
        cases = cases.filter(c => c.reporterId === filters.reporterId);
      }

      if (filters.publicOnly) {
        cases = cases.filter(c => c.publicVisibility);
      }

      if (filters.location && filters.radius) {
        cases = cases.filter(c => {
          const distance = this._calculateDistance(
            filters.location,
            c.lastKnownLocation
          );
          return distance <= filters.radius;
        });
      }

      if (filters.dateFrom) {
        cases = cases.filter(c => new Date(c.createdAt) >= new Date(filters.dateFrom));
      }

      if (filters.dateTo) {
        cases = cases.filter(c => new Date(c.createdAt) <= new Date(filters.dateTo));
      }

      if (filters.category) {
        cases = cases.filter(c => c.category === filters.category);
      }

      if (filters.riskLevel) {
        cases = cases.filter(c => c.riskLevel === filters.riskLevel);
      }

      // Sort results
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'desc';

      cases.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      cases = cases.slice(offset, offset + limit);

      return cases;
    } catch (error) {
      this.logger.error('Error searching cases:', error, filters);
      return [];
    }
  }

  /**
   * Add a watcher to a case
   * @param {string} caseId - Case ID
   * @param {string} userId - User ID to add as watcher
   * @returns {boolean} Success status
   */
  addWatcher(caseId, userId) {
    try {
      if (!this.watchers.has(caseId)) {
        this.watchers.set(caseId, new Set());
      }

      this.watchers.get(caseId).add(userId);
      this.logger.debug(`Watcher added to case: ${caseId}`, { userId });
      return true;
    } catch (error) {
      this.logger.error('Error adding watcher:', error, { caseId, userId });
      return false;
    }
  }

  /**
   * Remove a watcher from a case
   * @param {string} caseId - Case ID
   * @param {string} userId - User ID to remove
   * @returns {boolean} Success status
   */
  removeWatcher(caseId, userId) {
    try {
      const caseWatchers = this.watchers.get(caseId);
      if (caseWatchers) {
        caseWatchers.delete(userId);
        if (caseWatchers.size === 0) {
          this.watchers.delete(caseId);
        }
      }
      this.logger.debug(`Watcher removed from case: ${caseId}`, { userId });
      return true;
    } catch (error) {
      this.logger.error('Error removing watcher:', error, { caseId, userId });
      return false;
    }
  }

  /**
   * Notify watchers of case updates
   * @param {string} caseId - Case ID
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  async _notifyWatchers(caseId, eventType, data) {
    try {
      const caseWatchers = this.watchers.get(caseId);
      if (!caseWatchers || caseWatchers.size === 0) return;

      const notification = {
        type: eventType,
        caseId,
        data,
        timestamp: new Date().toISOString()
      };

      for (const userId of caseWatchers) {
        this.emit('watcher_notification', { userId, notification });
      }
    } catch (error) {
      this.logger.error('Error notifying watchers:', error, { caseId, eventType });
    }
  }

  /**
   * Start escalation monitoring
   * @private
   */
  _startEscalationMonitoring() {
    this.escalationTimer = setInterval(async () => {
      try {
        await this._checkForEscalations();
      } catch (error) {
        this.logger.error('Error during escalation monitoring:', error);
      }
    }, 300000); // Check every 5 minutes

    this.logger.info('Escalation monitoring started');
  }

  /**
   * Check for cases that need escalation
   * @private
   */
  async _checkForEscalations() {
    const now = Date.now();
    const activeCases = Array.from(this.cases.values())
      .filter(c => c.status === 'active');

    for (const caseObj of activeCases) {
      const timeSinceCreation = now - new Date(caseObj.createdAt).getTime();
      const threshold = this.config.escalationThresholds[caseObj.priority];

      if (threshold && timeSinceCreation > threshold) {
        await this._escalateCase(caseObj.caseId, 'time_threshold_exceeded');
      }
    }
  }

  /**
   * Escalate a case
   * @param {string} caseId - Case ID
   * @param {string} reason - Escalation reason
   * @private
   */
  async _escalateCase(caseId, reason) {
    try {
      const caseObj = this.cases.get(caseId);
      if (!caseObj) return;

      // Don't escalate if already at highest priority
      if (caseObj.priority === 'critical') return;

      const newPriority = caseObj.priority === 'low' ? 'medium' :
        caseObj.priority === 'medium' ? 'high' : 'critical';

      await this.updateCase(caseId, {
        priority: newPriority,
        priorityReason: `Auto-escalated: ${reason}`
      }, 'system');

      this.logger.info(`Case escalated: ${caseId}`, {
        oldPriority: caseObj.priority,
        newPriority,
        reason
      });

      this.emit('case_escalated', {
        caseId,
        oldPriority: caseObj.priority,
        newPriority,
        reason
      });
    } catch (error) {
      this.logger.error('Error escalating case:', error, { caseId, reason });
    }
  }

  /**
   * Validate case data
   * @param {Object} data - Case data
   * @private
   */
  _validateCaseData(data) {
    if (!data.reporterId) {
      throw new Error('Reporter ID is required');
    }

    if (!data.missingPerson || !data.missingPerson.name) {
      throw new Error('Missing person information is required');
    }

    if (!data.lastKnownLocation || !data.lastKnownLocation.lat || !data.lastKnownLocation.lng) {
      throw new Error('Last known location is required');
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      throw new Error('Invalid priority level');
    }
  }

  /**
   * Determine case category based on missing person data
   * @param {Object} caseData - Case data
   * @returns {string} Case category
   * @private
   */
  _determineCaseCategory(caseData) {
    const age = caseData.missingPerson.age;
    const medicalConditions = caseData.missingPerson.medicalConditions || [];

    if (age < 18) {
      return 'child';
    } else if (age >= 65 || medicalConditions.includes('dementia') || medicalConditions.includes('alzheimer')) {
      return 'vulnerable_adult';
    } else {
      return 'adult';
    }
  }

  /**
   * Assess risk level based on case data
   * @param {Object} caseData - Case data
   * @returns {string} Risk level
   * @private
   */
  _assessRiskLevel(caseData) {
    const age = caseData.missingPerson.age;
    const medicalConditions = caseData.missingPerson.medicalConditions || [];
    const circumstances = caseData.circumstances || {};

    let riskScore = 0;

    // Age-based risk
    if (age < 5 || age > 80) riskScore += 3;
    else if (age < 12 || age > 65) riskScore += 2;
    else if (age < 18) riskScore += 1;

    // Medical conditions
    if (medicalConditions.includes('dementia') || medicalConditions.includes('alzheimer')) {
      riskScore += 3;
    }
    if (medicalConditions.includes('diabetes') || medicalConditions.includes('heart_condition')) {
      riskScore += 2;
    }
    if (medicalConditions.length > 0) {
      riskScore += 1;
    }

    // Circumstances
    if (circumstances.transportationMethod === 'vehicle') riskScore += 1;
    if (circumstances.behaviorBeforeDisappearance?.includes('distressed')) riskScore += 2;

    // Time factor (increases over time)
    const timeElapsed = Date.now() - new Date(caseData.circumstances?.timeOfDisappearance || Date.now()).getTime();
    const hoursElapsed = timeElapsed / (1000 * 60 * 60);
    if (hoursElapsed > 24) riskScore += 2;
    else if (hoursElapsed > 12) riskScore += 1;

    if (riskScore >= 6) return 'critical';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Calculate search radius based on case data
   * @param {Object} caseData - Case data
   * @returns {number} Search radius in meters
   * @private
   */
  _calculateSearchRadius(caseData) {
    const baseRadius = 2000; // 2km base
    const age = caseData.missingPerson.age;
    const circumstances = caseData.circumstances || {};

    let multiplier = 1;

    // Age factor
    if (age < 5) multiplier *= 0.5;
    else if (age < 12) multiplier *= 0.7;
    else if (age > 65) multiplier *= 0.8;

    // Transportation
    if (circumstances.transportationMethod === 'vehicle') multiplier *= 3;
    else if (circumstances.transportationMethod === 'bicycle') multiplier *= 2;

    // Time factor
    const timeElapsed = Date.now() - new Date(circumstances.timeOfDisappearance || Date.now()).getTime();
    const hoursElapsed = timeElapsed / (1000 * 60 * 60);
    multiplier *= Math.min(1 + (hoursElapsed * 0.1), 3); // Max 3x for time

    return Math.round(baseRadius * multiplier);
  }

  /**
   * Calculate distance between two coordinates
   * @param {Object} coord1 - First coordinate
   * @param {Object} coord2 - Second coordinate
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
   * Generate unique case ID
   * @returns {string} Case ID
   * @private
   */
  _generateCaseId() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `CASE-${year}${month}${day}-${random}`;
  }

  /**
   * Generate timeline ID
   * @returns {string} Timeline ID
   * @private
   */
  _generateTimelineId() {
    return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate lead ID
   * @returns {string} Lead ID
   * @private
   */
  _generateLeadId() {
    return `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize logger
   * @returns {Object} Logger instance
   * @private
   */
  _initLogger() {
    return {
      info: (message, meta = {}) => console.log(`[INFO] CaseManagementService: ${message}`, meta),
      warn: (message, meta = {}) => console.warn(`[WARN] CaseManagementService: ${message}`, meta),
      error: (message, error = null, meta = {}) => console.error(`[ERROR] CaseManagementService: ${message}`, error, meta),
      debug: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DEBUG] CaseManagementService: ${message}`, meta);
        }
      }
    };
  }

  /**
   * Database methods (placeholders)
   */
  async _loadCasesFromDatabase() {
    this.logger.debug('Loading cases from database...');
  }

  async _saveCaseToDatabase(caseObj) {
    this.logger.debug(`Saving case to database: ${caseObj.caseId}`);
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    const cases = Array.from(this.cases.values());
    return {
      totalCases: cases.length,
      activeCases: cases.filter(c => c.status === 'active').length,
      resolvedCases: cases.filter(c => c.status === 'resolved').length,
      closedCases: cases.filter(c => c.status === 'closed').length,
      criticalCases: cases.filter(c => c.priority === 'critical').length,
      totalWatchers: Array.from(this.watchers.values()).reduce((sum, watchers) => sum + watchers.size, 0),
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
      if (this.escalationTimer) {
        clearInterval(this.escalationTimer);
      }

      this.logger.info('CaseManagementService shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = CaseManagementService;