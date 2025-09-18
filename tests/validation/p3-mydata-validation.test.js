/**
 * P3 MyData Production Validation Tests
 *
 * Validates:
 * - Contract tests for callback schema validation
 * - TTL (Time To Live) functionality with real timing
 * - Data deletion on revocation (撤回即刪) compliance
 * - OAuth2 flow compliance with Taiwan MyData standards
 */

const request = require('supertest');
const app = require('../../src/backend/src/app');
const { MyDataAdapter } = require('../../src/backend/services/MyDataAdapter');
const { RevocationService } = require('../../src/backend/services/RevocationService');
const { RetentionService } = require('../../src/backend/services/RetentionService');

describe('P3 MyData Production Validation', () => {
  let myDataAdapter;
  let revocationService;
  let retentionService;
  let realApiConfig;

  beforeAll(async () => {
    // Real MyData Taiwan configuration
    realApiConfig = {
      baseUrl: process.env.MYDATA_BASE_URL || 'https://mydata.nat.gov.tw',
      clientId: process.env.MYDATA_CLIENT_ID || 'test-client-id',
      clientSecret: process.env.MYDATA_CLIENT_SECRET || 'test-secret',
      redirectUri: process.env.MYDATA_REDIRECT_URI || 'https://app.hsinchu.gov.tw/callback',
      scopes: ['location_tracking', 'emergency_contact', 'health_data'],
      apiVersion: 'v1'
    };

    myDataAdapter = new MyDataAdapter(realApiConfig);

    // Initialize services with proper dependencies
    const mockStorage = {
      data: new Map(),
      setItem: async function(key, value) {
        this.data.set(key, JSON.stringify(value));
      },
      getItem: async function(key) {
        const value = this.data.get(key);
        return value ? JSON.parse(value) : null;
      },
      removeItem: async function(key) {
        this.data.delete(key);
      }
    };

    const mockAuditService = {
      logDataRevocation: async () => {},
      logDeletionError: async () => {},
      logDataCleanup: async () => {},
      logPolicyChange: async () => {},
      logJobStart: async () => {},
      logBatchProgress: async () => {},
      logJobComplete: async () => {},
      logJobError: async () => {},
      logManualCleanup: async () => {}
    };

    retentionService = new RetentionService({
      storage: mockStorage,
      auditService: mockAuditService,
      defaultTTL: 2592000000, // 30 days in ms
      gracePeriod: 86400000,  // 24 hours
      auditEnabled: true
    });

    revocationService = new RevocationService({
      storage: mockStorage,
      auditService: mockAuditService,
      retentionService: retentionService,
      immediateProcessing: true,
      auditTrail: true
    });
  });

  describe('Contract Tests for Callback Schema Validation', () => {
    it('should validate MyData Taiwan authorization callback schema', async () => {
      // Arrange - Taiwan MyData standard callback format
      const validCallbackSchema = {
        code: 'AUTH_CODE_123456789ABCDEF',
        state: 'CSRF_PROTECTION_TOKEN_789',
        scope: 'location_tracking emergency_contact',
        expires_in: 3600,
        token_type: 'Bearer',
        timestamp: new Date().toISOString(),
        session_id: 'SESSION_456',

        // Taiwan MyData specific fields
        citizen_digital_certificate: true,
        data_subject_consent: true,
        purpose_limitation: 'safety_monitoring',
        data_minimization: true,
        retention_period: '30_days',

        // Required checksums for data integrity
        checksum: 'SHA256_HASH_OF_PAYLOAD',
        signature: 'DIGITAL_SIGNATURE'
      };

      // Act
      const validationResult = await myDataAdapter.validateCallbackSchema(validCallbackSchema);

      // Assert
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(validationResult.taiwanCompliant).toBe(true);

      // Verify specific Taiwan MyData requirements
      expect(validationResult.validatedFields).toEqual(expect.objectContaining({
        authorizationCode: expect.stringMatching(/^AUTH_CODE_[A-F0-9]+$/),
        stateParameter: expect.any(String),
        consentVerified: true,
        citizenCertificatePresent: true,
        purposeLimitation: 'safety_monitoring',
        dataMinimizationApplied: true,
        retentionPeriodSpecified: '30_days'
      }));
    });

    it('should reject malformed callback schemas', async () => {
      const invalidSchemas = [
        {
          name: 'missing_required_fields',
          data: { code: 'test' } // Missing state, scope, etc.
        },
        {
          name: 'invalid_authorization_code',
          data: {
            code: 'INVALID_FORMAT',
            state: 'valid_state',
            scope: 'location_tracking'
          }
        },
        {
          name: 'missing_citizen_certificate',
          data: {
            code: 'AUTH_CODE_123456789ABCDEF',
            state: 'valid_state',
            scope: 'location_tracking',
            citizen_digital_certificate: false // Should be true
          }
        },
        {
          name: 'invalid_purpose_limitation',
          data: {
            code: 'AUTH_CODE_123456789ABCDEF',
            state: 'valid_state',
            scope: 'location_tracking',
            citizen_digital_certificate: true,
            purpose_limitation: 'unauthorized_use' // Invalid purpose
          }
        }
      ];

      for (const invalidSchema of invalidSchemas) {
        const validationResult = await myDataAdapter.validateCallbackSchema(invalidSchema.data);

        expect(validationResult.isValid).toBe(false);
        expect(validationResult.errors.length).toBeGreaterThan(0);
        expect(validationResult.taiwanCompliant).toBe(false);
        expect(validationResult.rejectionReason).toContain(invalidSchema.name);
      }
    });

    it('should validate OAuth2 PKCE extension for mobile apps', async () => {
      // Arrange - PKCE flow for mobile security
      const pkceCallback = {
        code: 'AUTH_CODE_PKCE_123456789',
        state: 'PKCE_STATE_TOKEN',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', // Base64URL
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', // SHA256
        code_challenge_method: 'S256',

        // Mobile-specific security enhancements
        device_fingerprint: 'MOBILE_DEVICE_HASH',
        app_attestation: 'APP_INTEGRITY_TOKEN',
        biometric_verified: true
      };

      // Act
      const pkceValidation = await myDataAdapter.validatePKCECallback(pkceCallback);

      // Assert
      expect(pkceValidation.isValid).toBe(true);
      expect(pkceValidation.pkceVerified).toBe(true);
      expect(pkceValidation.codeVerifierValid).toBe(true);
      expect(pkceValidation.challengeMethodSupported).toBe(true);
      expect(pkceValidation.mobileSecurityEnhanced).toBe(true);

      // Verify PKCE challenge verification
      const challengeVerification = await myDataAdapter.verifyCodeChallenge(
        pkceCallback.code_verifier,
        pkceCallback.code_challenge,
        pkceCallback.code_challenge_method
      );
      expect(challengeVerification.verified).toBe(true);
    });

    it('should handle real-time callback validation with Taiwan MyData API', async () => {
      if (!process.env.MYDATA_CLIENT_ID) {
        console.warn('Skipping real MyData API test - credentials not configured');
        return;
      }

      // Arrange - simulate real callback from Taiwan MyData
      const realTimeCallback = {
        code: 'REAL_AUTH_CODE_FROM_MYDATA',
        state: 'REAL_STATE_TOKEN',
        scope: 'location_tracking emergency_contact',
        session_id: 'REAL_SESSION_ID',
        timestamp: new Date().toISOString()
      };

      // Act
      const realTimeValidation = await myDataAdapter.validateWithMyDataAPI(realTimeCallback);

      // Assert
      expect(realTimeValidation.apiReachable).toBe(true);
      expect(realTimeValidation.responseTime).toBeLessThan(5000); // <5 seconds
      expect(realTimeValidation.callbackFormat).toBe('taiwan_mydata_compliant');

      if (realTimeValidation.success) {
        expect(realTimeValidation.tokenExchangeReady).toBe(true);
        expect(realTimeValidation.consentVerified).toBe(true);
      }
    });
  });

  describe('TTL (Time To Live) Functionality', () => {
    it('should enforce TTL on MyData access tokens', async () => {
      // Arrange - create token with specific TTL
      const tokenData = {
        accessToken: 'ACCESS_TOKEN_WITH_TTL',
        refreshToken: 'REFRESH_TOKEN_TTL',
        expiresIn: 3600, // 1 hour
        scope: 'location_tracking',
        userId: 'test-user-123',
        grantedAt: new Date().toISOString()
      };

      // Act
      const ttlResult = await retentionService.setTokenTTL(tokenData, 3600000); // 1 hour in ms

      // Assert
      expect(ttlResult.ttlSet).toBe(true);
      expect(ttlResult.expiresAt).toBeDefined();
      expect(ttlResult.ttlMs).toBe(3600000);

      const remainingTTL = await retentionService.getTokenTTL(tokenData.accessToken);
      expect(remainingTTL).toBeLessThanOrEqual(3600000);
      expect(remainingTTL).toBeGreaterThan(3590000); // Should be close to 1 hour
    });

    it('should automatically expire and clean up TTL data', async () => {
      // Arrange - create data with very short TTL for testing
      const shortTTLData = {
        dataId: 'SHORT_TTL_TEST_DATA',
        content: 'This data should expire quickly',
        userId: 'test-user-ttl',
        type: 'location_data'
      };

      const shortTTL = 1000; // 1 second for faster tests

      // Act
      await retentionService.storeWithTTL(shortTTLData, shortTTL);

      // Verify data exists immediately
      let dataExists = await retentionService.dataExists(shortTTLData.dataId);
      expect(dataExists).toBe(true);

      // Wait for TTL expiration with shorter wait time
      await new Promise(resolve => setTimeout(resolve, 1200)); // Wait 1.2 seconds

      // Verify data is automatically deleted
      dataExists = await retentionService.dataExists(shortTTLData.dataId);
      expect(dataExists).toBe(false);

      // Verify cleanup audit trail
      const cleanupLog = await retentionService.getCleanupAuditTrail(shortTTLData.dataId);
      expect(cleanupLog).toEqual(expect.objectContaining({
        dataId: shortTTLData.dataId,
        cleanupReason: 'ttl_expired',
        cleanupTimestamp: expect.any(String),
        originalTTL: 1000,
        actualDuration: expect.any(Number)
      }));
    });

    it('should handle TTL extension for active consents', async () => {
      // Arrange - user with active consent
      const activeConsent = {
        consentId: 'ACTIVE_CONSENT_123',
        userId: 'active-user',
        scopes: ['location_tracking'],
        grantedAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        originalTTL: 3600000 // 1 hour
      };

      await retentionService.storeWithTTL(activeConsent, activeConsent.originalTTL);

      // Act - simulate user activity that should extend TTL
      const extensionResult = await retentionService.extendTTL(
        activeConsent.consentId,
        1800000 // Extend by 30 minutes
      );

      // Assert
      expect(extensionResult.extended).toBe(true);
      expect(extensionResult.newTTL).toBe(activeConsent.originalTTL + 1800000);

      const updatedTTL = await retentionService.getTokenTTL(activeConsent.consentId);
      expect(updatedTTL).toBeGreaterThan(activeConsent.originalTTL); // Should be extended

      // Verify extension audit
      const extensionAudit = await retentionService.getExtensionAuditTrail(activeConsent.consentId);
      expect(extensionAudit.extensionsGranted).toBeGreaterThan(0);
      expect(extensionAudit.lastExtension).toBeDefined();
    });

    it('should enforce maximum TTL limits per data type', async () => {
      const dataTypes = [
        { type: 'location_data', maxTTL: 2592000000, requestedTTL: 5184000000 }, // 30 days max, requesting 60 days
        { type: 'emergency_contact', maxTTL: 7776000000, requestedTTL: 15552000000 }, // 90 days max, requesting 180 days
        { type: 'health_data', maxTTL: 1296000000, requestedTTL: 2592000000 }, // 15 days max, requesting 30 days
        { type: 'general_profile', maxTTL: 31536000000, requestedTTL: 63072000000 } // 365 days max, requesting 730 days
      ];

      for (const dataType of dataTypes) {
        // Arrange
        const testData = {
          dataId: `TTL_LIMIT_TEST_${dataType.type}`,
          content: `Test data for ${dataType.type}`,
          type: dataType.type
        };

        // Act
        const limitResult = await retentionService.storeWithTTL(testData, dataType.requestedTTL);

        // Assert
        expect(limitResult.ttlEnforced).toBe(true);
        expect(limitResult.actualTTL).toBe(dataType.maxTTL); // Should be capped at maximum
        expect(limitResult.requestedTTL).toBe(dataType.requestedTTL);
        expect(limitResult.ttlCapped).toBe(true);

        // Verify the actual TTL set is the maximum allowed
        const actualTTL = await retentionService.getTokenTTL(testData.dataId);
        expect(actualTTL).toBeLessThanOrEqual(dataType.maxTTL);
      }
    });
  });

  describe('Data Deletion on Revocation (撤回即刪)', () => {
    it('should immediately delete all user data upon revocation', async () => {
      // Arrange - user with comprehensive data across system
      const userData = {
        userId: 'REVOCATION_TEST_USER',
        personalData: {
          profile: { name: 'Test User', phone: '0912345678' },
          locations: [
            { lat: 24.8067, lng: 120.9687, timestamp: new Date().toISOString() },
            { lat: 24.8015, lng: 120.9692, timestamp: new Date().toISOString() }
          ],
          emergencyContacts: [
            { name: 'Emergency Contact', phone: '0987654321' }
          ]
        },
        systemData: {
          geofences: [{ id: 'user-geofence-1', radius: 100 }],
          alerts: [{ id: 'alert-1', message: 'Test alert' }],
          auditLogs: [{ action: 'login', timestamp: new Date().toISOString() }]
        },
        consentRecords: [
          { consentId: 'consent-1', scope: 'location_tracking' },
          { consentId: 'consent-2', scope: 'emergency_contact' }
        ]
      };

      // Store data across multiple services
      await retentionService.storeUserData(userData);

      // Verify data exists before revocation
      const dataExistsBefore = await retentionService.userDataExists(userData.userId);
      expect(dataExistsBefore).toBe(true);

      // Act - initiate revocation
      const revocationResult = await revocationService.initiateRevocation({
        userId: userData.userId,
        reason: 'User requested data deletion',
        confirmRevocation: true,
        immediateProcessing: true
      });

      // Assert - immediate deletion
      expect(revocationResult.success).toBe(true);
      expect(revocationResult.processedImmediately).toBe(true);
      expect(revocationResult.deletionCompleted).toBe(true);

      // Verify all data categories deleted
      const deletionResults = revocationResult.deletionResults;
      expect(deletionResults.personalDataDeleted).toBe(true);
      expect(deletionResults.systemDataDeleted).toBe(true);
      expect(deletionResults.consentRecordsDeleted).toBe(true);
      expect(deletionResults.auditLogsPreserved).toBe(true); // Audit logs preserved for compliance

      // Verify no user data remains
      const dataExistsAfter = await retentionService.userDataExists(userData.userId);
      expect(dataExistsAfter).toBe(false);
    });

    it('should handle cross-service data deletion coordination', async () => {
      // Arrange - data distributed across multiple services
      const distributedUserId = 'CROSS_SERVICE_USER';
      const serviceDataMap = [
        { service: 'geofence_service', data: ['geofence-1', 'geofence-2'] },
        { service: 'alert_service', data: ['alert-1', 'alert-2', 'alert-3'] },
        { service: 'location_service', data: ['location-1', 'location-2'] },
        { service: 'contact_service', data: ['contact-1'] },
        { service: 'notification_service', data: ['notification-1', 'notification-2'] }
      ];

      // Store data in each service
      for (const serviceData of serviceDataMap) {
        await retentionService.storeServiceData(serviceData.service, distributedUserId, serviceData.data);
      }

      // Act - coordinate cross-service deletion
      const crossServiceDeletion = await revocationService.coordinateCrossServiceDeletion(distributedUserId);

      // Assert
      expect(crossServiceDeletion.success).toBe(true);
      expect(crossServiceDeletion.servicesProcessed).toBe(serviceDataMap.length);
      expect(crossServiceDeletion.failures).toHaveLength(0);

      // Verify each service completed deletion
      for (const serviceData of serviceDataMap) {
        const serviceResult = crossServiceDeletion.serviceResults[serviceData.service];
        expect(serviceResult.deleted).toBe(true);
        expect(serviceResult.itemsDeleted).toBe(serviceData.data.length);

        // Verify no data remains in service
        const remainingData = await retentionService.getServiceData(serviceData.service, distributedUserId);
        expect(remainingData).toHaveLength(0);
      }
    });

    it('should maintain deletion audit trail while removing personal data', async () => {
      // Arrange
      const auditUserId = 'AUDIT_TRAIL_USER';
      const sensitiveData = {
        personalInfo: 'Sensitive personal information',
        locationHistory: [
          { lat: 24.8067, lng: 120.9687, timestamp: new Date().toISOString() }
        ],
        emergencyContacts: ['0912345678']
      };

      await retentionService.storeUserData({ userId: auditUserId, ...sensitiveData });

      // Act
      const revocationWithAudit = await revocationService.initiateRevocation({
        userId: auditUserId,
        reason: 'GDPR deletion request',
        confirmRevocation: true,
        maintainAuditTrail: true
      });

      // Assert
      expect(revocationWithAudit.success).toBe(true);
      expect(revocationWithAudit.auditTrailMaintained).toBe(true);

      // Verify personal data deleted
      const personalDataExists = await retentionService.personalDataExists(auditUserId);
      expect(personalDataExists).toBe(false);

      // Verify audit trail exists with anonymized references
      const auditTrail = await revocationService.getRevocationAuditTrail(auditUserId);
      expect(auditTrail).toEqual(expect.objectContaining({
        revocationId: expect.any(String),
        anonymizedUserId: expect.any(String), // User ID should be anonymized
        revocationTimestamp: expect.any(String),
        reason: 'GDPR deletion request',
        dataTypesDeleted: expect.arrayContaining(['personalInfo', 'locationHistory', 'emergencyContacts']),
        deletionConfirmed: true,
        legalBasisForRetention: 'audit_compliance'
      }));

      // Verify audit contains no personal data
      const auditString = JSON.stringify(auditTrail);
      expect(auditString).not.toContain('Sensitive personal information');
      expect(auditString).not.toContain('24.8067');
      expect(auditString).not.toContain('0912345678');
    });

    it('should handle partial deletion failures gracefully', async () => {
      // Arrange - simulate service failures during deletion
      const partialFailureUserId = 'PARTIAL_FAILURE_USER';

      // Mock some services to fail deletion
      const mockServiceFailures = {
        'external_service_1': new Error('Service temporarily unavailable'),
        'external_service_2': new Error('Database connection timeout')
      };

      await retentionService.storeUserData({
        userId: partialFailureUserId,
        data: 'test data for partial failure'
      });

      // Act
      const partialDeletionResult = await revocationService.initiateRevocation({
        userId: partialFailureUserId,
        reason: 'Test partial failure handling',
        confirmRevocation: true,
        serviceFailures: mockServiceFailures
      });

      // Assert
      expect(partialDeletionResult.success).toBe(false); // Overall failed due to partial failures
      expect(partialDeletionResult.partialSuccess).toBe(true);
      expect(partialDeletionResult.failedServices).toHaveLength(2);
      expect(partialDeletionResult.retryScheduled).toBe(true);

      // Verify failed services are queued for retry
      const retryQueue = await revocationService.getRetryQueue(partialFailureUserId);
      expect(retryQueue.pendingServices).toEqual(expect.arrayContaining([
        'external_service_1',
        'external_service_2'
      ]));
      expect(retryQueue.nextRetryAt).toBeDefined();
      expect(retryQueue.maxRetries).toBeGreaterThan(0);

      // Verify user is notified of partial completion
      expect(partialDeletionResult.userNotification).toEqual(expect.objectContaining({
        type: 'partial_deletion_completed',
        message: expect.stringContaining('部分資料刪除完成'),
        pendingServices: 2,
        estimatedCompletionTime: expect.any(String)
      }));
    });
  });

  describe('OAuth2 Flow Compliance', () => {
    it('should implement complete OAuth2 authorization code flow', async () => {
      // Act - simulate complete OAuth2 flow
      const authFlowSteps = [];

      // Step 1: Authorization request
      const authRequest = await request(app)
        .get('/api/v1/mydata/authorize')
        .set('Authorization', 'Bearer oauth-test-user-token')
        .query({
          userId: 'oauth-test-user',
          scopes: 'location_tracking,emergency_contact',
          purpose: 'safety_monitoring',
          redirectUri: realApiConfig.redirectUri,
          state: 'oauth2-csrf-token-123'
        })
        .expect(200);

      authFlowSteps.push({ step: 'authorization_request', success: true, data: authRequest.body });

      // Step 2: User consent (simulated)
      const consentSimulation = {
        userConsent: true,
        consentTimestamp: new Date().toISOString(),
        scopesApproved: ['location_tracking', 'emergency_contact']
      };
      authFlowSteps.push({ step: 'user_consent', success: true, data: consentSimulation });

      // Step 3: Authorization callback
      const callbackRequest = await request(app)
        .post('/api/v1/mydata/callback')
        .send({
          code: 'AUTH_CODE_OAUTH2_FLOW_123',
          state: 'oauth2-csrf-token-123',
          sessionId: authRequest.body.data.sessionId
        })
        .expect(200);

      authFlowSteps.push({ step: 'authorization_callback', success: true, data: callbackRequest.body });

      // Step 4: Token exchange (internal)
      const tokenExchange = await myDataAdapter.exchangeCodeForToken(
        'AUTH_CODE_OAUTH2_FLOW_123',
        authRequest.body.data.sessionId
      );

      authFlowSteps.push({ step: 'token_exchange', success: tokenExchange.success, data: tokenExchange });

      // Assert - complete flow validation
      expect(authFlowSteps).toHaveLength(4);
      expect(authFlowSteps.every(step => step.success)).toBe(true);

      // Verify OAuth2 compliance
      const flowValidation = await myDataAdapter.validateOAuth2Compliance(authFlowSteps);
      expect(flowValidation.compliant).toBe(true);
      expect(flowValidation.standardsMetRequired).toEqual(expect.arrayContaining([
        'RFC6749', // OAuth 2.0 Authorization Framework
        'RFC7636', // PKCE
        'RFC6750', // Bearer Token Usage
        'Taiwan_MyData_Standards'
      ]));
    });

    it('should handle OAuth2 error scenarios correctly', async () => {
      const errorScenarios = [
        {
          name: 'invalid_client',
          params: { client_id: 'invalid_client', client_secret: 'wrong_secret' },
          expectedError: 'invalid_client'
        },
        {
          name: 'unauthorized_client',
          params: { client_id: realApiConfig.clientId, redirect_uri: 'https://malicious.com/callback' },
          expectedError: 'unauthorized_client'
        },
        {
          name: 'access_denied',
          params: { code: 'USER_DENIED_ACCESS', state: 'valid_state' },
          expectedError: 'access_denied'
        },
        {
          name: 'invalid_grant',
          params: { code: 'EXPIRED_AUTH_CODE', state: 'valid_state' },
          expectedError: 'invalid_grant'
        },
        {
          name: 'invalid_scope',
          params: { scope: 'unauthorized_scope invalid_scope' },
          expectedError: 'invalid_scope'
        }
      ];

      for (const scenario of errorScenarios) {
        const errorResult = await myDataAdapter.handleOAuth2Error(scenario.params);

        expect(errorResult.error).toBe(scenario.expectedError);
        expect(errorResult.errorHandled).toBe(true);
        expect(errorResult.userFriendlyMessage).toBeDefined();
        expect(errorResult.loggedForAudit).toBe(true);

        // Verify error response format follows OAuth2 standard
        expect(errorResult.standardCompliant).toBe(true);
        expect(errorResult.errorDescription).toBeDefined();
      }
    });

    it('should implement secure token refresh mechanism', async () => {
      // Arrange - expired access token scenario
      const expiredTokenData = {
        accessToken: 'EXPIRED_ACCESS_TOKEN',
        refreshToken: 'VALID_REFRESH_TOKEN_123',
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
        scope: 'location_tracking emergency_contact',
        userId: 'token-refresh-user'
      };

      // Act
      const refreshResult = await myDataAdapter.refreshAccessToken({
        refreshToken: expiredTokenData.refreshToken,
        clientId: realApiConfig.clientId,
        clientSecret: realApiConfig.clientSecret
      });

      // Assert
      expect(refreshResult.success).toBe(true);
      expect(refreshResult.newAccessToken).toBeDefined();
      expect(refreshResult.newAccessToken).not.toBe(expiredTokenData.accessToken);
      expect(refreshResult.tokenType).toBe('Bearer');
      expect(refreshResult.expiresIn).toBeGreaterThan(0);

      // Verify old refresh token is invalidated (if rotating)
      if (refreshResult.refreshTokenRotated) {
        expect(refreshResult.newRefreshToken).toBeDefined();
        expect(refreshResult.newRefreshToken).not.toBe(expiredTokenData.refreshToken);

        // Verify old refresh token cannot be used again
        const secondRefreshAttempt = await myDataAdapter.refreshAccessToken({
          refreshToken: expiredTokenData.refreshToken, // Old token
          clientId: realApiConfig.clientId,
          clientSecret: realApiConfig.clientSecret
        });
        expect(secondRefreshAttempt.success).toBe(false);
        expect(secondRefreshAttempt.error).toBe('invalid_grant');
      }

      // Verify token security properties
      expect(refreshResult.securityValidation).toEqual(expect.objectContaining({
        tokenEntropyValid: true,
        tokenFormatSecure: true,
        scopePreserved: true,
        userContextMaintained: true
      }));
    });

    it('should validate Taiwan MyData API integration compliance', async () => {
      if (!process.env.MYDATA_CLIENT_ID) {
        console.warn('Skipping real Taiwan MyData API compliance test - credentials not configured');
        return;
      }

      // Act - comprehensive compliance validation
      const complianceCheck = await myDataAdapter.validateTaiwanMyDataCompliance();

      // Assert
      expect(complianceCheck.overallCompliant).toBe(true);
      expect(complianceCheck.complianceAreas).toEqual(expect.objectContaining({
        // Technical compliance
        oauth2StandardsCompliant: true,
        apiVersionSupported: true,
        securityStandardsMet: true,

        // Legal compliance
        personalDataProtectionAct: true,
        citizenDigitalCertificateSupport: true,
        consentManagementCompliant: true,
        dataMinimizationImplemented: true,

        // Operational compliance
        auditTrailMaintained: true,
        dataRetentionPolicyEnforced: true,
        revocationProcessCompliant: true,
        crossBorderDataProtected: true
      }));

      // Verify specific Taiwan requirements
      expect(complianceCheck.taiwanSpecificRequirements).toEqual(expect.objectContaining({
        traditionalChineseSupport: true,
        localizedErrorMessages: true,
        governmentAPICompliance: true,
        nationalIDIntegration: true,
        localizedTimeZone: 'Asia/Taipei'
      }));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup test data
    await retentionService?.cleanup?.();
    await revocationService?.cleanup?.();
  });
});