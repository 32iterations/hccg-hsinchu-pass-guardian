/**
 * MyDataAdapter - Extended for API endpoints
 *
 * Provides MyData Taiwan integration for authorization flows,
 * consent management, and data access with proper privacy controls.
 */

class MyDataAdapter {
  constructor(dependencies = {}) {
    this.storage = dependencies.storage;
    this.database = dependencies.database;
    this.auditService = dependencies.auditService;

    this.mydataConfig = {
      baseUrl: 'https://mydata.nat.gov.tw',
      clientId: process.env.MYDATA_CLIENT_ID || 'hsinchu-safety-guardian',
      clientSecret: process.env.MYDATA_CLIENT_SECRET || 'development-secret',
      redirectUri: process.env.MYDATA_REDIRECT_URI || 'https://app.hsinchu.gov.tw/callback'
    };

    this.validScopes = [
      'location_tracking',
      'emergency_contact',
      'health_info',
      'movement_patterns'
    ];

    this.sessions = new Map();
    this.consents = new Map();
  }

  async initiateAuthorization({ userId, scopes, purpose, redirectUri, state }) {
    // Validate scopes
    for (const scope of scopes) {
      if (!this.validScopes.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}`);
      }
    }

    // Create authorization session
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const session = {
      id: sessionId,
      userId,
      scopes,
      purpose,
      redirectUri,
      state,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    };

    this.sessions.set(sessionId, session);
    await this.storage?.setItem(`mydata_session_${sessionId}`, session);

    // Generate MyData authorization URL
    const authorizationUrl = this.buildAuthorizationUrl(session);

    await this.auditService?.logMyDataAuthorization({
      userId,
      sessionId,
      scopes,
      purpose,
      timestamp: new Date().toISOString(),
      action: 'authorization_initiated'
    });

    return {
      authorizationUrl,
      sessionId,
      expiresAt: expiresAt.toISOString()
    };
  }

  buildAuthorizationUrl(session) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.mydataConfig.clientId,
      redirect_uri: this.mydataConfig.redirectUri,
      scope: session.scopes.join(' '),
      state: session.state,
      purpose: session.purpose
    });

    return `${this.mydataConfig.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  async getSession(sessionId) {
    // Check memory cache first
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    // Check storage
    const session = await this.storage?.getItem(`mydata_session_${sessionId}`);
    if (session) {
      // Check if expired
      if (new Date(session.expiresAt) < new Date()) {
        session.status = 'expired';
      }
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  async exchangeCodeForToken(code, sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Invalid session');
    }

    if (session.status === 'expired') {
      throw new Error('Session expired');
    }

    // Mock token exchange - in real implementation would call MyData API
    const tokenData = {
      accessToken: this.generateAccessToken(),
      refreshToken: this.generateRefreshToken(),
      expiresIn: 3600, // 1 hour
      scopes: session.scopes,
      userId: session.userId
    };

    // Update session status
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.tokens = tokenData;

    this.sessions.set(sessionId, session);
    await this.storage?.setItem(`mydata_session_${sessionId}`, session);

    // Create consent record
    const consentId = this.generateConsentId();
    const consent = {
      id: consentId,
      userId: session.userId,
      scopes: session.scopes,
      purpose: session.purpose,
      status: 'active',
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      sessionId: sessionId
    };

    this.consents.set(consentId, consent);
    await this.storage?.setItem(`mydata_consent_${consentId}`, consent);

    await this.auditService?.logMyDataTokenExchange({
      userId: session.userId,
      sessionId,
      consentId,
      scopes: session.scopes,
      timestamp: new Date().toISOString(),
      action: 'token_exchange_completed'
    });

    return tokenData;
  }

  async getAuthorizationProgress(sessionId) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    let progressPercentage = 10; // Initial
    const steps = [
      { name: 'authorization_initiated', status: 'completed', timestamp: session.createdAt },
      { name: 'user_redirect', status: 'pending', timestamp: null },
      { name: 'user_consent', status: 'pending', timestamp: null },
      { name: 'token_exchange', status: 'pending', timestamp: null },
      { name: 'consent_created', status: 'pending', timestamp: null }
    ];

    if (session.status === 'completed') {
      progressPercentage = 100;
      steps.forEach(step => {
        step.status = 'completed';
        step.timestamp = step.timestamp || session.completedAt;
      });
    } else if (session.status === 'expired') {
      progressPercentage = 10;
      steps[1].status = 'expired';
    } else {
      progressPercentage = 25; // In progress
      steps[1].status = 'in_progress';
    }

    return {
      status: session.status,
      progressPercentage,
      steps,
      estimatedCompletion: this.calculateEstimatedCompletion(session),
      lastUpdated: new Date().toISOString()
    };
  }

  calculateEstimatedCompletion(session) {
    if (session.status === 'completed') {
      return session.completedAt;
    }

    if (session.status === 'expired') {
      return session.expiresAt;
    }

    // Estimate 5 minutes for user to complete authorization
    return new Date(Date.now() + 5 * 60 * 1000).toISOString();
  }

  async getConsent(consentId) {
    // Check memory cache
    if (this.consents.has(consentId)) {
      return this.consents.get(consentId);
    }

    // Check storage
    const consent = await this.storage?.getItem(`mydata_consent_${consentId}`);
    if (consent) {
      this.consents.set(consentId, consent);
    }

    return consent;
  }

  async revokeConsent(consentId, revocationData) {
    const consent = await this.getConsent(consentId);
    if (!consent) {
      throw new Error('Consent not found');
    }

    const { reason, revokedBy, immediateAnonymization } = revocationData;

    // Update consent status
    consent.status = 'revoked';
    consent.revokedAt = new Date().toISOString();
    consent.revokedBy = revokedBy;
    consent.revocationReason = reason;

    this.consents.set(consentId, consent);
    await this.storage?.setItem(`mydata_consent_${consentId}`, consent);

    // Schedule data deletion/anonymization
    const deletionScheduled = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    const revocationResult = {
      revokedAt: consent.revokedAt,
      deletionScheduled,
      anonymizationComplete: immediateAnonymization || false
    };

    if (immediateAnonymization) {
      await this.anonymizeUserData(consent.userId, consentId);
      revocationResult.anonymizationComplete = true;
    }

    await this.auditService?.logMyDataRevocation({
      userId: consent.userId,
      consentId,
      revokedBy,
      reason,
      immediateAnonymization,
      timestamp: consent.revokedAt,
      action: 'consent_revoked'
    });

    return revocationResult;
  }

  async getUserConsents(userId, options = {}) {
    const { page = 1, limit = 20, status } = options;

    // Mock implementation - in real system would query database
    const mockConsents = [
      {
        id: 'consent123',
        scopes: ['location_tracking', 'emergency_contact'],
        grantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        purpose: 'safety_monitoring'
      },
      {
        id: 'consent456',
        scopes: ['health_info'],
        grantedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'expired',
        purpose: 'health_monitoring'
      }
    ];

    // Filter by status if provided
    let filteredConsents = mockConsents;
    if (status) {
      filteredConsents = mockConsents.filter(c => c.status === status);
    }

    // Calculate pagination
    const start = (page - 1) * limit;
    const paginatedConsents = filteredConsents.slice(start, start + limit);

    const activeCount = mockConsents.filter(c => c.status === 'active').length;

    return {
      records: paginatedConsents,
      total: filteredConsents.length,
      activeCount,
      page,
      limit
    };
  }

  async anonymizeUserData(userId, consentId) {
    // Mock anonymization process
    await this.auditService?.logDataAnonymization({
      userId,
      consentId,
      timestamp: new Date().toISOString(),
      action: 'data_anonymization_completed'
    });

    return true;
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateConsentId() {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateAccessToken() {
    return `access_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  generateRefreshToken() {
    return `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}

module.exports = { MyDataAdapter };