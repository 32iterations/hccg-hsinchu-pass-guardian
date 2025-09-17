const MyDataAdapter = require('../../src/services/mydata-adapter.service');
const axios = require('axios');
const crypto = require('crypto');

jest.mock('axios');
jest.mock('crypto');

describe('MyDataAdapter Service', () => {
  let myDataAdapter;
  let mockLogger;
  let mockCache;
  let mockAuditService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn()
    };

    mockAuditService = {
      logDataAccess: jest.fn(),
      logConsent: jest.fn(),
      logRevocation: jest.fn()
    };

    myDataAdapter = new MyDataAdapter({
      logger: mockLogger,
      cache: mockCache,
      auditService: mockAuditService,
      myDataEndpoint: 'https://mydata.hsinchu.gov.tw',
      clientId: 'hsinchu-pass-guardian',
      clientSecret: 'test-secret',
      callbackUrl: 'https://guardian.hsinchu.gov.tw/callback'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('OAuth Authorization Flow', () => {
    test('should generate authorization URL with required parameters', () => {
      const state = 'test-state-123';
      const scope = ['personal_info', 'medical_records'];
      
      crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from(state));
      
      const authUrl = myDataAdapter.generateAuthorizationUrl({
        familyId: 'FAM001',
        scope,
        purpose: 'emergency_location'
      });

      expect(authUrl).toContain('https://mydata.hsinchu.gov.tw/authorize');
      expect(authUrl).toContain('client_id=hsinchu-pass-guardian');
      expect(authUrl).toContain('scope=' + encodeURIComponent(scope.join(' ')));
      expect(authUrl).toContain('state=');
      expect(authUrl).toContain('redirect_uri=' + encodeURIComponent('https://guardian.hsinchu.gov.tw/callback'));
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('oauth_state:'),
        expect.objectContaining({ familyId: 'FAM001', purpose: 'emergency_location' }),
        300 // 5 minute TTL
      );
    });

    test('should handle authorization callback and exchange code for token', async () => {
      const authCode = 'auth-code-123';
      const state = 'valid-state';
      const mockTokenResponse = {
        data: {
          access_token: 'access-token-xyz',
          refresh_token: 'refresh-token-abc',
          expires_in: 3600,
          scope: 'personal_info medical_records'
        }
      };

      mockCache.get.mockResolvedValue({
        familyId: 'FAM001',
        purpose: 'emergency_location'
      });
      axios.post.mockResolvedValue(mockTokenResponse);

      const result = await myDataAdapter.handleAuthorizationCallback({
        code: authCode,
        state
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://mydata.hsinchu.gov.tw/token',
        expect.objectContaining({
          grant_type: 'authorization_code',
          code: authCode,
          client_id: 'hsinchu-pass-guardian',
          client_secret: 'test-secret'
        })
      );
      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('access-token-xyz');
      expect(mockAuditService.logConsent).toHaveBeenCalled();
    });

    test('should reject callback with invalid state', async () => {
      mockCache.get.mockResolvedValue(null);

      await expect(
        myDataAdapter.handleAuthorizationCallback({
          code: 'any-code',
          state: 'invalid-state'
        })
      ).rejects.toThrow('Invalid OAuth state');

      expect(axios.post).not.toHaveBeenCalled();
    });

    test('should handle token exchange failures', async () => {
      mockCache.get.mockResolvedValue({ familyId: 'FAM001' });
      axios.post.mockRejectedValue(new Error('Token exchange failed'));

      await expect(
        myDataAdapter.handleAuthorizationCallback({
          code: 'bad-code',
          state: 'valid-state'
        })
      ).rejects.toThrow('Token exchange failed');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Data Retrieval with Consent', () => {
    test('should fetch personal data with valid access token', async () => {
      const accessToken = 'valid-token';
      const mockDataResponse = {
        data: {
          personalInfo: {
            name: '王大明',
            idNumber: 'A123456789',
            birthDate: '1950-01-01',
            address: '新竹市東區光復路'
          },
          medicalRecords: {
            diagnosis: 'Mild Cognitive Impairment',
            medications: ['Donepezil'],
            lastVisit: '2024-01-15'
          }
        }
      };

      axios.get.mockResolvedValue(mockDataResponse);

      const result = await myDataAdapter.fetchPersonalData({
        accessToken,
        patientId: 'PAT001',
        scope: ['personal_info', 'medical_records']
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/personal-data'),
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: expect.objectContaining({
            scope: 'personal_info,medical_records'
          })
        })
      );
      expect(result).toEqual(mockDataResponse.data);
      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'PAT001',
          dataTypes: ['personal_info', 'medical_records']
        })
      );
    });

    test('should handle expired token and attempt refresh', async () => {
      const expiredToken = 'expired-token';
      const refreshToken = 'refresh-token';
      const newAccessToken = 'new-access-token';

      axios.get.mockRejectedValueOnce({ response: { status: 401 } });
      axios.post.mockResolvedValueOnce({
        data: { access_token: newAccessToken }
      });
      axios.get.mockResolvedValueOnce({
        data: { personalInfo: { name: '王大明' } }
      });

      const result = await myDataAdapter.fetchPersonalData({
        accessToken: expiredToken,
        refreshToken,
        patientId: 'PAT001'
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/token'),
        expect.objectContaining({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      );
      expect(result.personalInfo.name).toBe('王大明');
    });

    test('should enforce single-use token policy', async () => {
      const accessToken = 'single-use-token';
      mockCache.exists.mockResolvedValue(true);

      await expect(
        myDataAdapter.fetchPersonalData({
          accessToken,
          patientId: 'PAT001'
        })
      ).rejects.toThrow('Token already used');

      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('Data Retention and Cleanup', () => {
    test('should store data with TTL based on purpose', async () => {
      const data = {
        personalInfo: { name: '王大明' },
        timestamp: new Date().toISOString()
      };

      await myDataAdapter.storeWithRetention({
        key: 'patient:PAT001',
        data,
        purpose: 'emergency_location',
        ttlMinutes: 30
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        'patient:PAT001',
        expect.objectContaining({
          data,
          expiresAt: expect.any(Date),
          purpose: 'emergency_location'
        }),
        1800 // 30 minutes in seconds
      );
    });

    test('should enforce maximum retention period', async () => {
      await myDataAdapter.storeWithRetention({
        key: 'patient:PAT001',
        data: { test: 'data' },
        ttlMinutes: 10000 // Too long
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        86400 // Maximum 24 hours
      );
    });

    test('should automatically clean expired data', async () => {
      const expiredKeys = [
        'patient:PAT001',
        'patient:PAT002',
        'consent:CON001'
      ];
      
      mockCache.get.mockImplementation((key) => {
        if (expiredKeys.includes(key)) {
          return Promise.resolve({
            expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
          });
        }
        return Promise.resolve(null);
      });

      await myDataAdapter.cleanupExpiredData();

      expect(mockCache.delete).toHaveBeenCalledTimes(expiredKeys.length);
      expiredKeys.forEach(key => {
        expect(mockCache.delete).toHaveBeenCalledWith(key);
      });
      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auto_cleanup'
        })
      );
    });
  });

  describe('Consent Revocation', () => {
    test('should immediately delete data on consent revocation', async () => {
      const patientId = 'PAT001';
      const familyId = 'FAM001';
      
      mockCache.get.mockResolvedValue({
        patientId,
        familyId,
        data: { personalInfo: { name: '王大明' } }
      });

      await myDataAdapter.revokeConsent({
        patientId,
        familyId,
        reason: 'user_requested'
      });

      expect(mockCache.delete).toHaveBeenCalledWith(`patient:${patientId}`);
      expect(mockCache.delete).toHaveBeenCalledWith(`consent:${familyId}:${patientId}`);
      expect(mockCache.delete).toHaveBeenCalledWith(`token:${familyId}`);
      expect(mockAuditService.logRevocation).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId,
          familyId,
          reason: 'user_requested',
          timestamp: expect.any(Date)
        })
      );
    });

    test('should notify MyData platform of revocation', async () => {
      axios.post.mockResolvedValue({ data: { success: true } });

      await myDataAdapter.revokeConsent({
        patientId: 'PAT001',
        accessToken: 'valid-token'
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/revoke'),
        expect.objectContaining({
          token: 'valid-token',
          token_type_hint: 'access_token'
        })
      );
    });

    test('should handle cascade deletion of related data', async () => {
      const patientId = 'PAT001';
      const relatedKeys = [
        `location:${patientId}`,
        `alert:${patientId}`,
        `device:${patientId}`
      ];

      await myDataAdapter.revokeConsentCascade({
        patientId,
        includeRelated: true
      });

      relatedKeys.forEach(key => {
        expect(mockCache.delete).toHaveBeenCalledWith(key);
      });
    });

    test('should generate revocation receipt', async () => {
      const result = await myDataAdapter.revokeConsent({
        patientId: 'PAT001',
        generateReceipt: true
      });

      expect(result.receipt).toBeDefined();
      expect(result.receipt).toMatchObject({
        revocationId: expect.any(String),
        timestamp: expect.any(Date),
        patientId: 'PAT001',
        dataDeleted: expect.any(Array),
        signature: expect.any(String)
      });
    });
  });

  describe('Audit and Compliance', () => {
    test('should log all data access attempts', async () => {
      await myDataAdapter.fetchPersonalData({
        accessToken: 'token',
        patientId: 'PAT001'
      }).catch(() => {});

      expect(mockAuditService.logDataAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'PAT001',
          timestamp: expect.any(Date),
          success: expect.any(Boolean)
        })
      );
    });

    test('should generate compliance report', async () => {
      const report = await myDataAdapter.generateComplianceReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });

      expect(report).toMatchObject({
        period: expect.any(Object),
        totalAccess: expect.any(Number),
        totalRevocations: expect.any(Number),
        averageRetentionMinutes: expect.any(Number),
        dataMinimization: expect.any(Boolean)
      });
    });

    test('should validate data minimization principle', () => {
      const isMinimal = myDataAdapter.validateDataMinimization({
        requestedScope: ['personal_info'],
        purpose: 'emergency_location'
      });

      expect(isMinimal).toBe(true);

      const isExcessive = myDataAdapter.validateDataMinimization({
        requestedScope: ['personal_info', 'medical_records', 'financial_info'],
        purpose: 'display_name'
      });

      expect(isExcessive).toBe(false);
    });
  });
});
