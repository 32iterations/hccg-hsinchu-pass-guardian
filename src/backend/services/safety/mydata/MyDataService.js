/**
 * MyDataService - MyData platform integration service
 * Handles data sharing requests, consent management, and secure data exchange
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class MyDataService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      clientId: process.env.MYDATA_CLIENT_ID,
      clientSecret: process.env.MYDATA_CLIENT_SECRET,
      baseUrl: process.env.MYDATA_BASE_URL || 'https://api.mydata.org.tw',
      redirectUri: process.env.MYDATA_REDIRECT_URI,
      scope: process.env.MYDATA_SCOPE || 'basic_profile emergency_contacts location_history',
      tokenExpiration: process.env.MYDATA_TOKEN_EXPIRATION || 3600000, // 1 hour
      dataRetentionDays: process.env.MYDATA_RETENTION_DAYS || 30,
      webhookSecret: process.env.MYDATA_WEBHOOK_SECRET,
      ...config
    };

    this.activeConsents = new Map();
    this.dataRequests = new Map();
    this.accessTokens = new Map();
    this.auditLog = new Map();
    this.logger = this._initLogger();

    // Validate required configuration
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('MyData client credentials are required');
    }
  }

  /**
   * Initialize the MyData service
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this._loadConsentDataFromDatabase();
      this._startTokenCleanup();
      this._startConsentMonitoring();
      this.logger.info('MyDataService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MyDataService:', error);
      throw error;
    }
  }

  /**
   * Create a data sharing request
   * @param {Object} requestData - Request information
   * @param {string} requestData.userId - User ID requesting data
   * @param {string} requestData.targetUserId - User whose data is being requested
   * @param {Array<string>} requestData.dataTypes - Types of data requested
   * @param {string} requestData.purpose - Purpose of data request
   * @param {Object} requestData.emergency - Emergency context information
   * @returns {Promise<Object>} Created request object
   */
  async createDataRequest(requestData) {
    try {
      this._validateRequestData(requestData);

      const requestId = this._generateRequestId();
      const now = new Date().toISOString();

      const request = {
        requestId,
        userId: requestData.userId,
        targetUserId: requestData.targetUserId,
        dataTypes: requestData.dataTypes,
        purpose: requestData.purpose,
        emergency: requestData.emergency || null,
        status: 'pending',
        priority: this._determinePriority(requestData),
        createdAt: now,
        expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(), // 24 hours
        metadata: {
          requestSource: 'safety_guardian',
          ipAddress: requestData.ipAddress || null,
          userAgent: requestData.userAgent || null,
          caseId: requestData.caseId || null
        }
      };

      this.dataRequests.set(requestId, request);
      await this._saveRequestToDatabase(request);

      // Log the request
      await this._logAuditEvent('request_created', {
        requestId,
        userId: requestData.userId,
        targetUserId: requestData.targetUserId,
        dataTypes: requestData.dataTypes
      });

      this.logger.info(`Data request created: ${requestId}`, {
        userId: requestData.userId,
        targetUserId: requestData.targetUserId,
        dataTypes: requestData.dataTypes
      });

      this.emit('request_created', request);

      // For emergency requests, try to auto-approve if conditions are met
      if (request.emergency && request.priority === 'critical') {
        await this._processEmergencyRequest(requestId);
      }

      return request;
    } catch (error) {
      this.logger.error('Error creating data request:', error, requestData);
      throw error;
    }
  }

  /**
   * Process consent response from user
   * @param {string} requestId - Request ID
   * @param {Object} consentData - Consent response data
   * @param {boolean} consentData.granted - Whether consent is granted
   * @param {Array<string>} consentData.approvedDataTypes - Approved data types
   * @param {string} consentData.consentMethod - Method of consent (explicit, emergency, etc.)
   * @returns {Promise<Object>} Updated request object
   */
  async processConsent(requestId, consentData) {
    try {
      const request = this.dataRequests.get(requestId);
      if (!request) {
        throw new Error(`Request not found: ${requestId}`);
      }

      if (request.status !== 'pending') {
        throw new Error(`Request is not in pending status: ${requestId}`);
      }

      // Check if request has expired
      if (new Date() > new Date(request.expiresAt)) {
        request.status = 'expired';
        await this._saveRequestToDatabase(request);
        throw new Error(`Request has expired: ${requestId}`);
      }

      const now = new Date().toISOString();

      if (consentData.granted) {
        const approvedDataTypes = consentData.approvedDataTypes || request.dataTypes;

        // Create consent record
        const consentId = this._generateConsentId();
        const consent = {
          consentId,
          requestId,
          userId: request.targetUserId,
          requesterId: request.userId,
          approvedDataTypes,
          consentMethod: consentData.consentMethod || 'explicit',
          grantedAt: now,
          expiresAt: new Date(Date.now() + (this.config.dataRetentionDays * 24 * 60 * 60 * 1000)).toISOString(),
          conditions: consentData.conditions || {},
          revocable: consentData.revocable !== false,
          status: 'active'
        };

        this.activeConsents.set(consentId, consent);
        await this._saveConsentToDatabase(consent);

        // Update request
        request.status = 'approved';
        request.consentId = consentId;
        request.approvedAt = now;
        request.approvedDataTypes = approvedDataTypes;

        // Generate access token for data retrieval
        const accessToken = await this._generateAccessToken(requestId, consentId);

        this.logger.info(`Consent granted for request: ${requestId}`, {
          consentId,
          approvedDataTypes
        });

        this.emit('consent_granted', { request, consent, accessToken });
      } else {
        request.status = 'denied';
        request.deniedAt = now;
        request.denialReason = consentData.reason || 'User declined';

        this.logger.info(`Consent denied for request: ${requestId}`, {
          reason: request.denialReason
        });

        this.emit('consent_denied', request);
      }

      this.dataRequests.set(requestId, request);
      await this._saveRequestToDatabase(request);

      // Log the consent decision
      await this._logAuditEvent('consent_processed', {
        requestId,
        granted: consentData.granted,
        userId: request.targetUserId
      });

      return request;
    } catch (error) {
      this.logger.error('Error processing consent:', error, { requestId, consentData });
      throw error;
    }
  }

  /**
   * Retrieve user data with valid consent
   * @param {string} accessToken - Access token for data retrieval
   * @param {Array<string>} dataTypes - Types of data to retrieve
   * @returns {Promise<Object>} Retrieved data object
   */
  async retrieveUserData(accessToken, dataTypes) {
    try {
      const tokenData = this.accessTokens.get(accessToken);
      if (!tokenData) {
        throw new Error('Invalid access token');
      }

      if (new Date() > new Date(tokenData.expiresAt)) {
        this.accessTokens.delete(accessToken);
        throw new Error('Access token has expired');
      }

      const consent = this.activeConsents.get(tokenData.consentId);
      if (!consent || consent.status !== 'active') {
        throw new Error('Consent is not active');
      }

      // Check if requested data types are within approved scope
      const unauthorizedTypes = dataTypes.filter(type => !consent.approvedDataTypes.includes(type));
      if (unauthorizedTypes.length > 0) {
        throw new Error(`Unauthorized data types: ${unauthorizedTypes.join(', ')}`);
      }

      // Retrieve data from MyData platform
      const userData = await this._fetchUserDataFromPlatform(consent.userId, dataTypes);

      // Log data access
      await this._logAuditEvent('data_accessed', {
        requestId: tokenData.requestId,
        consentId: tokenData.consentId,
        userId: consent.userId,
        requesterId: consent.requesterId,
        dataTypes,
        accessToken: this._hashToken(accessToken)
      });

      this.logger.info(`User data retrieved`, {
        requestId: tokenData.requestId,
        userId: consent.userId,
        dataTypes
      });

      this.emit('data_accessed', {
        requestId: tokenData.requestId,
        userId: consent.userId,
        dataTypes,
        timestamp: new Date().toISOString()
      });

      return {
        requestId: tokenData.requestId,
        userId: consent.userId,
        data: userData,
        retrievedAt: new Date().toISOString(),
        dataTypes
      };
    } catch (error) {
      this.logger.error('Error retrieving user data:', error, { accessToken: this._hashToken(accessToken) });
      throw error;
    }
  }

  /**
   * Revoke consent and invalidate access
   * @param {string} consentId - Consent ID to revoke
   * @param {string} revokedBy - User ID who is revoking
   * @param {string} reason - Reason for revocation
   * @returns {Promise<Object>} Revoked consent object
   */
  async revokeConsent(consentId, revokedBy, reason) {
    try {
      const consent = this.activeConsents.get(consentId);
      if (!consent) {
        throw new Error(`Consent not found: ${consentId}`);
      }

      if (consent.status !== 'active') {
        throw new Error(`Consent is not active: ${consentId}`);
      }

      if (!consent.revocable) {
        throw new Error(`Consent is not revocable: ${consentId}`);
      }

      // Only the data owner can revoke consent
      if (consent.userId !== revokedBy) {
        throw new Error('Unauthorized to revoke this consent');
      }

      const now = new Date().toISOString();

      consent.status = 'revoked';
      consent.revokedAt = now;
      consent.revokedBy = revokedBy;
      consent.revocationReason = reason;

      this.activeConsents.set(consentId, consent);
      await this._saveConsentToDatabase(consent);

      // Invalidate all related access tokens
      for (const [token, tokenData] of this.accessTokens) {
        if (tokenData.consentId === consentId) {
          this.accessTokens.delete(token);
        }
      }

      // Update related request
      const request = Array.from(this.dataRequests.values())
        .find(req => req.consentId === consentId);

      if (request) {
        request.status = 'revoked';
        request.revokedAt = now;
        this.dataRequests.set(request.requestId, request);
        await this._saveRequestToDatabase(request);
      }

      // Log revocation
      await this._logAuditEvent('consent_revoked', {
        consentId,
        userId: consent.userId,
        requesterId: consent.requesterId,
        reason
      });

      this.logger.info(`Consent revoked: ${consentId}`, {
        userId: consent.userId,
        reason
      });

      this.emit('consent_revoked', consent);

      return consent;
    } catch (error) {
      this.logger.error('Error revoking consent:', error, { consentId, revokedBy });
      throw error;
    }
  }

  /**
   * Get consent status and details
   * @param {string} consentId - Consent ID
   * @returns {Object|null} Consent object
   */
  getConsent(consentId) {
    return this.activeConsents.get(consentId) || null;
  }

  /**
   * Get user's consent history
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @returns {Array<Object>} User's consent records
   */
  getUserConsents(userId, filters = {}) {
    try {
      let consents = Array.from(this.activeConsents.values())
        .filter(consent => consent.userId === userId);

      if (filters.status) {
        consents = consents.filter(consent => consent.status === filters.status);
      }

      if (filters.requesterId) {
        consents = consents.filter(consent => consent.requesterId === filters.requesterId);
      }

      if (filters.dataType) {
        consents = consents.filter(consent =>
          consent.approvedDataTypes.includes(filters.dataType)
        );
      }

      return consents.sort((a, b) => new Date(b.grantedAt) - new Date(a.grantedAt));
    } catch (error) {
      this.logger.error('Error getting user consents:', error, { userId });
      return [];
    }
  }

  /**
   * Handle MyData platform webhook
   * @param {Object} webhookData - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {Promise<Object>} Processing result
   */
  async handleWebhook(webhookData, signature) {
    try {
      // Verify webhook signature
      if (!this._verifyWebhookSignature(webhookData, signature)) {
        throw new Error('Invalid webhook signature');
      }

      const { eventType, data } = webhookData;

      switch (eventType) {
        case 'consent_updated':
          await this._handleConsentUpdate(data);
          break;
        case 'data_request_status_changed':
          await this._handleRequestStatusChange(data);
          break;
        case 'user_data_updated':
          await this._handleUserDataUpdate(data);
          break;
        default:
          this.logger.warn(`Unknown webhook event type: ${eventType}`);
      }

      this.logger.info(`Webhook processed: ${eventType}`, data);

      return { status: 'processed', eventType };
    } catch (error) {
      this.logger.error('Error handling webhook:', error, webhookData);
      throw error;
    }
  }

  /**
   * Get audit trail for data access
   * @param {Object} filters - Query filters
   * @returns {Array<Object>} Audit log entries
   */
  getAuditTrail(filters = {}) {
    try {
      let entries = Array.from(this.auditLog.values());

      if (filters.userId) {
        entries = entries.filter(entry =>
          entry.data.userId === filters.userId ||
          entry.data.requesterId === filters.userId
        );
      }

      if (filters.requestId) {
        entries = entries.filter(entry => entry.data.requestId === filters.requestId);
      }

      if (filters.eventType) {
        entries = entries.filter(entry => entry.eventType === filters.eventType);
      }

      if (filters.dateFrom) {
        entries = entries.filter(entry =>
          new Date(entry.timestamp) >= new Date(filters.dateFrom)
        );
      }

      if (filters.dateTo) {
        entries = entries.filter(entry =>
          new Date(entry.timestamp) <= new Date(filters.dateTo)
        );
      }

      return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      this.logger.error('Error getting audit trail:', error, filters);
      return [];
    }
  }

  /**
   * Process emergency data request
   * @param {string} requestId - Request ID
   * @private
   */
  async _processEmergencyRequest(requestId) {
    try {
      const request = this.dataRequests.get(requestId);
      if (!request || !request.emergency) return;

      // Check if emergency conditions are met for auto-approval
      const emergencyConditions = [
        request.emergency.type === 'missing_person',
        request.emergency.severity === 'critical',
        request.emergency.timeElapsed > 3600000 // 1 hour
      ];

      if (emergencyConditions.every(condition => condition)) {
        // Auto-approve with limited data types
        const emergencyDataTypes = ['basic_profile', 'emergency_contacts', 'last_known_location'];
        const approvedTypes = request.dataTypes.filter(type =>
          emergencyDataTypes.includes(type)
        );

        if (approvedTypes.length > 0) {
          await this.processConsent(requestId, {
            granted: true,
            approvedDataTypes: approvedTypes,
            consentMethod: 'emergency_override'
          });

          this.logger.info(`Emergency request auto-approved: ${requestId}`, {
            approvedDataTypes: approvedTypes
          });
        }
      }
    } catch (error) {
      this.logger.error('Error processing emergency request:', error, { requestId });
    }
  }

  /**
   * Generate access token for data retrieval
   * @param {string} requestId - Request ID
   * @param {string} consentId - Consent ID
   * @returns {Promise<string>} Access token
   * @private
   */
  async _generateAccessToken(requestId, consentId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.tokenExpiration).toISOString();

    const tokenData = {
      token,
      requestId,
      consentId,
      createdAt: new Date().toISOString(),
      expiresAt
    };

    this.accessTokens.set(token, tokenData);

    // Clean up expired tokens
    setTimeout(() => {
      this.accessTokens.delete(token);
    }, this.config.tokenExpiration);

    return token;
  }

  /**
   * Fetch user data from MyData platform
   * @param {string} userId - User ID
   * @param {Array<string>} dataTypes - Data types to fetch
   * @returns {Promise<Object>} User data
   * @private
   */
  async _fetchUserDataFromPlatform(userId, dataTypes) {
    // This would make actual API calls to MyData platform
    // For now, return mock data structure
    const mockData = {
      basic_profile: {
        name: 'Mock User',
        age: 30,
        gender: 'male'
      },
      emergency_contacts: [
        { name: 'Emergency Contact', phone: '+886-900-000-000', relationship: 'family' }
      ],
      last_known_location: {
        lat: 24.8138,
        lng: 120.9675,
        timestamp: new Date().toISOString(),
        accuracy: 10
      },
      location_history: [
        {
          lat: 24.8138,
          lng: 120.9675,
          timestamp: new Date(Date.now() - 3600000).toISOString()
        }
      ]
    };

    const result = {};
    dataTypes.forEach(type => {
      if (mockData[type]) {
        result[type] = mockData[type];
      }
    });

    return result;
  }

  /**
   * Start token cleanup process
   * @private
   */
  _startTokenCleanup() {
    setInterval(() => {
      const now = new Date();
      for (const [token, tokenData] of this.accessTokens) {
        if (new Date(tokenData.expiresAt) <= now) {
          this.accessTokens.delete(token);
        }
      }
    }, 300000); // Clean up every 5 minutes

    this.logger.debug('Token cleanup process started');
  }

  /**
   * Start consent monitoring
   * @private
   */
  _startConsentMonitoring() {
    setInterval(() => {
      const now = new Date();
      for (const [consentId, consent] of this.activeConsents) {
        if (consent.status === 'active' && new Date(consent.expiresAt) <= now) {
          consent.status = 'expired';
          this.activeConsents.set(consentId, consent);
          this.emit('consent_expired', consent);
        }
      }
    }, 600000); // Check every 10 minutes

    this.logger.debug('Consent monitoring started');
  }

  /**
   * Verify webhook signature
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Signature to verify
   * @returns {boolean} Verification result
   * @private
   */
  _verifyWebhookSignature(payload, signature) {
    if (!this.config.webhookSecret) return true; // Skip if no secret configured

    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }

  /**
   * Hash token for logging purposes
   * @param {string} token - Token to hash
   * @returns {string} Hashed token
   * @private
   */
  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
  }

  /**
   * Log audit event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @private
   */
  async _logAuditEvent(eventType, data) {
    const auditId = this._generateAuditId();
    const auditEntry = {
      auditId,
      eventType,
      data,
      timestamp: new Date().toISOString(),
      source: 'mydata_service'
    };

    this.auditLog.set(auditId, auditEntry);
    await this._saveAuditToDatabase(auditEntry);
  }

  /**
   * Handle webhook events
   * @private
   */
  async _handleConsentUpdate(data) {
    // Handle consent updates from MyData platform
    this.logger.debug('Handling consent update webhook', data);
  }

  async _handleRequestStatusChange(data) {
    // Handle request status changes from MyData platform
    this.logger.debug('Handling request status change webhook', data);
  }

  async _handleUserDataUpdate(data) {
    // Handle user data updates from MyData platform
    this.logger.debug('Handling user data update webhook', data);
  }

  /**
   * Validation methods
   * @private
   */
  _validateRequestData(data) {
    if (!data.userId || !data.targetUserId) {
      throw new Error('User IDs are required');
    }

    if (!data.dataTypes || !Array.isArray(data.dataTypes) || data.dataTypes.length === 0) {
      throw new Error('Data types are required');
    }

    if (!data.purpose) {
      throw new Error('Purpose is required');
    }

    const validDataTypes = [
      'basic_profile',
      'emergency_contacts',
      'location_history',
      'last_known_location',
      'health_records',
      'family_members'
    ];

    const invalidTypes = data.dataTypes.filter(type => !validDataTypes.includes(type));
    if (invalidTypes.length > 0) {
      throw new Error(`Invalid data types: ${invalidTypes.join(', ')}`);
    }
  }

  _determinePriority(requestData) {
    if (requestData.emergency) {
      switch (requestData.emergency.severity) {
        case 'critical': return 'critical';
        case 'high': return 'high';
        default: return 'medium';
      }
    }
    return 'normal';
  }

  /**
   * ID generation methods
   * @private
   */
  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateConsentId() {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _generateAuditId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize logger
   * @returns {Object} Logger instance
   * @private
   */
  _initLogger() {
    return {
      info: (message, meta = {}) => console.log(`[INFO] MyDataService: ${message}`, meta),
      warn: (message, meta = {}) => console.warn(`[WARN] MyDataService: ${message}`, meta),
      error: (message, error = null, meta = {}) => console.error(`[ERROR] MyDataService: ${message}`, error, meta),
      debug: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[DEBUG] MyDataService: ${message}`, meta);
        }
      }
    };
  }

  /**
   * Database methods (placeholders)
   * @private
   */
  async _loadConsentDataFromDatabase() {
    this.logger.debug('Loading consent data from database...');
  }

  async _saveRequestToDatabase(request) {
    this.logger.debug(`Saving request to database: ${request.requestId}`);
  }

  async _saveConsentToDatabase(consent) {
    this.logger.debug(`Saving consent to database: ${consent.consentId}`);
  }

  async _saveAuditToDatabase(auditEntry) {
    this.logger.debug(`Saving audit entry to database: ${auditEntry.auditId}`);
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStats() {
    return {
      totalRequests: this.dataRequests.size,
      activeConsents: Array.from(this.activeConsents.values()).filter(c => c.status === 'active').length,
      revokedConsents: Array.from(this.activeConsents.values()).filter(c => c.status === 'revoked').length,
      activeTokens: this.accessTokens.size,
      auditEntries: this.auditLog.size,
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
      // Clear all access tokens
      this.accessTokens.clear();

      this.logger.info('MyDataService shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = MyDataService;