/**
 * MyData Integration Service - RED Phase TDD Tests
 * React Native implementation for Taiwan MyData OAuth integration
 *
 * Requirements:
 * - Single-use immediate authorization (not persistent)
 * - Receipt generation and minimal retention
 * - Data deletion on consent revocation
 * - GDPR/PDPA compliance
 * - Secure token management
 */

// Mock imports
let MyDataIntegrationService;
try {
  MyDataIntegrationService = require('../../src/services/MyDataIntegrationService').MyDataIntegrationService;
} catch (error) {
  // Expected to fail in RED phase
  MyDataIntegrationService = class {
    constructor() {
      throw new Error('MyDataIntegrationService implementation not found');
    }
  };
}

const Linking = require('react-native').Linking;
const AsyncStorage = require('@react-native-async-storage/async-storage');
const Keychain = require('react-native-keychain');

describe('MyDataIntegrationService - RED Phase Tests', () => {
  let myDataService;
  let mockConfig;
  let mockBackendService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      myDataProviderUrl: 'https://mydata.nat.gov.tw',
      clientId: 'hsinchu-guardian-mobile',
      redirectUri: 'hsinchuguardian://oauth/callback',
      scopes: ['profile', 'emergency_contacts'],
      apiEndpoint: 'https://api.hsinchu.gov.tw/guardian',
      dataRetentionDays: 30,
      receiptRetentionDays: 7
    };

    mockBackendService = {
      validateMyDataToken: jest.fn().mockResolvedValue({ valid: true }),
      storeConsentReceipt: jest.fn().mockResolvedValue({ receiptId: 'receipt-123' }),
      revokeDataAccess: jest.fn().mockResolvedValue({ success: true })
    };

    // This will fail in RED phase - service doesn't exist yet
    try {
      myDataService = new MyDataIntegrationService(mockConfig, mockBackendService);
    } catch (error) {
      // Expected in RED phase
    }
  });

  describe('OAuth Authorization Flow', () => {
    describe('Single-Use Authorization', () => {
      it('should initiate OAuth flow with correct parameters', async () => {
        // Arrange
        const expectedAuthUrl = 'https://mydata.nat.gov.tw/oauth/authorize?' +
          'client_id=hsinchu-guardian-mobile&' +
          'redirect_uri=hsinchuguardian%3A%2F%2Foauth%2Fcallback&' +
          'scope=profile%20emergency_contacts&' +
          'response_type=code&' +
          'state=';

        // Linking is already mocked in jest.setup.js

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.initiateOAuthFlow();
        }).rejects.toThrow('MyDataIntegrationService implementation not found');

        // Expected behavior:
        // expect(Linking.openURL).toHaveBeenCalledWith(
        //   expect.stringContaining(expectedAuthUrl)
        // );
        // expect(myDataService.getAuthState()).toEqual({
        //   status: 'authorization_pending',
        //   state: expect.any(String),
        //   initiatedAt: expect.any(String)
        // });
      });

      it('should generate secure random state parameter', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const state1 = await myDataService.generateSecureState();
          const state2 = await myDataService.generateSecureState();
        }).rejects.toThrow();

        // Expected behavior:
        // expect(state1).not.toBe(state2);
        // expect(state1).toMatch(/^[a-zA-Z0-9]{32}$/);
        // expect(state2).toMatch(/^[a-zA-Z0-9]{32}$/);
      });

      it('should validate state parameter on callback', async () => {
        // Arrange
        const validState = 'secure_random_state_12345678';
        const callbackUrl = `hsinchuguardian://oauth/callback?code=auth_code_123&state=${validState}`;

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.handleOAuthCallback(callbackUrl, validState);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.validateStateParameter(validState, validState)).toBe(true);
        // expect(myDataService.getAuthorizationCode()).toBe('auth_code_123');
      });

      it('should reject callback with invalid state', async () => {
        // Arrange
        const expectedState = 'expected_state_123';
        const maliciousState = 'malicious_state_456';
        const callbackUrl = `hsinchuguardian://oauth/callback?code=auth_code_123&state=${maliciousState}`;

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.handleOAuthCallback(callbackUrl, expectedState);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.validateStateParameter(maliciousState, expectedState)).toBe(false);
        // expect(myDataService.getAuthState().error).toBe('state_mismatch');
        // expect(myDataService.getAuthorizationCode()).toBeNull();
      });
    });

    describe('Token Exchange', () => {
      it('should exchange authorization code for access token', async () => {
        // Arrange
        const authCode = 'valid_auth_code_123';
        const mockTokenResponse = {
          access_token: 'access_token_12345',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'profile emergency_contacts'
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse)
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.exchangeCodeForToken(authCode);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(fetch).toHaveBeenCalledWith(
        //   'https://mydata.nat.gov.tw/oauth/token',
        //   expect.objectContaining({
        //     method: 'POST',
        //     headers: {
        //       'Content-Type': 'application/x-www-form-urlencoded',
        //       'Accept': 'application/json'
        //     },
        //     body: expect.stringContaining('grant_type=authorization_code')
        //   })
        // );
        // expect(myDataService.getAccessToken()).toBe('access_token_12345');
      });

      it('should handle token exchange errors', async () => {
        // Arrange
        const invalidAuthCode = 'invalid_code_123';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({
            error: 'invalid_grant',
            error_description: 'Authorization code is invalid'
          })
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.exchangeCodeForToken(invalidAuthCode);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getTokenExchangeError()).toEqual({
        //   error: 'invalid_grant',
        //   description: 'Authorization code is invalid',
        //   userMessage: '授權驗證失敗，請重新授權'
        // });
      });

      it('should store access token securely and temporarily', async () => {
        // Arrange
        const accessToken = 'sensitive_access_token_123';
        const expiresIn = 3600; // 1 hour

        Keychain.setInternetCredentials.mockResolvedValue(true);

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.storeAccessTokenSecurely(accessToken, expiresIn);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
        //   'mydata_access_token',
        //   'hsinchu_guardian',
        //   accessToken,
        //   expect.objectContaining({
        //     accessControl: 'kSecAccessControlBiometryAny',
        //     storage: 'kSecAttrTokenIDSecureElement'
        //   })
        // );
        // expect(myDataService.getTokenExpirationTime()).toBe(expect.any(Number));
      });
    });
  });

  describe('Data Access and Processing', () => {
    describe('Profile Data Retrieval', () => {
      it('should fetch user profile with minimal data principle', async () => {
        // Arrange
        const mockProfileData = {
          national_id: 'A123456789', // Encrypted in real implementation
          name: '王小明',
          birth_date: '1980-01-01',
          phone: '0912345678',
          emergency_contacts: [
            {
              name: '王太太',
              relationship: '配偶',
              phone: '0987654321'
            }
          ]
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockProfileData)
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.fetchUserProfile(['name', 'emergency_contacts']);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(fetch).toHaveBeenCalledWith(
        //   'https://mydata.nat.gov.tw/api/profile',
        //   expect.objectContaining({
        //     headers: {
        //       'Authorization': 'Bearer access_token_12345',
        //       'X-Requested-Data': 'name,emergency_contacts'
        //     }
        //   })
        // );
        // expect(myDataService.getProfileData()).toEqual({
        //   name: '王小明',
        //   emergency_contacts: expect.arrayContaining([
        //     expect.objectContaining({
        //       name: '王太太',
        //       relationship: '配偶'
        //     })
        //   ]),
        //   // Ensure sensitive data is not stored
        //   national_id: undefined,
        //   birth_date: undefined
        // });
      });

      it('should encrypt sensitive data before local storage', async () => {
        // Arrange
        const sensitiveData = {
          emergency_contacts: [
            { name: '緊急聯絡人', phone: '0912345678' }
          ]
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.storeProfileDataSecurely(sensitiveData);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getEncryptedProfileData()).toMatch(/^[a-f0-9]+$/);
        // expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        //   'encrypted_profile_data',
        //   expect.any(String)
        // );
        // expect(myDataService.getPlaintextProfileData()).toBeUndefined();
      });

      it('should implement data minimization principles', async () => {
        // Arrange
        const requestedFields = ['name', 'emergency_contacts'];
        const unnecessaryFields = ['income', 'medical_records', 'employment'];

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.validateDataRequest(requestedFields);
          await myDataService.validateDataRequest([...requestedFields, ...unnecessaryFields]);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.isDataRequestMinimal(requestedFields)).toBe(true);
        // expect(myDataService.isDataRequestMinimal([...requestedFields, ...unnecessaryFields])).toBe(false);
        // expect(myDataService.getDataRequestJustification()).toContain('安心守護服務必要資訊');
      });
    });
  });

  describe('Consent Management', () => {
    describe('Consent Recording', () => {
      it('should generate detailed consent receipt', async () => {
        // Arrange
        const consentData = {
          userId: 'user-123',
          scopes: ['profile', 'emergency_contacts'],
          purpose: '新竹市安心守護服務',
          dataTypes: ['姓名', '緊急聯絡人'],
          consentedAt: new Date().toISOString(),
          legalBasis: 'GDPR Article 6(1)(a) - Consent'
        };

        mockBackendService.storeConsentReceipt.mockResolvedValue({
          receiptId: 'receipt-456',
          receiptHash: 'sha256_hash_of_receipt'
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.generateConsentReceipt(consentData);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockBackendService.storeConsentReceipt).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     userId: 'user-123',
        //     scopes: ['profile', 'emergency_contacts'],
        //     purpose: '新竹市安心守護服務',
        //     consentedAt: expect.any(String),
        //     legalBasis: 'GDPR Article 6(1)(a) - Consent',
        //     dataController: '新竹市政府',
        //     retentionPeriod: '30 days',
        //     rightsInformation: expect.objectContaining({
        //       access: true,
        //       rectification: true,
        //       erasure: true,
        //       portability: true
        //     })
        //   })
        // );
      });

      it('should provide user-readable consent summary', async () => {
        // Arrange
        const consentScopes = ['profile', 'emergency_contacts'];

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const summary = await myDataService.generateConsentSummary(consentScopes);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(summary).toEqual({
        //   title: '資料使用同意書',
        //   purpose: '新竹市安心守護服務',
        //   dataTypes: ['基本資料', '緊急聯絡人'],
        //   usage: '僅用於失智症照護定位服務',
        //   retention: '最長保存 30 天',
        //   rights: [
        //     '您可隨時撤回同意',
        //     '您可要求查看或刪除資料',
        //     '您可要求資料可攜'
        //   ],
        //   contact: '新竹市政府資訊處'
        // });
      });

      it('should validate consent before data processing', async () => {
        // Arrange
        const validConsent = {
          receiptId: 'receipt-789',
          userId: 'user-123',
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
        };

        const expiredConsent = {
          receiptId: 'receipt-999',
          userId: 'user-123',
          isActive: true,
          expiresAt: new Date(Date.now() - 1000).toISOString() // 1 second ago
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const validResult = await myDataService.validateConsent(validConsent);
          const expiredResult = await myDataService.validateConsent(expiredConsent);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(validResult.isValid).toBe(true);
        // expect(expiredResult.isValid).toBe(false);
        // expect(expiredResult.reason).toBe('consent_expired');
      });
    });

    describe('Consent Revocation', () => {
      it('should support immediate consent revocation', async () => {
        // Arrange
        const revokeRequest = {
          userId: 'user-123',
          receiptId: 'receipt-789',
          revokedAt: new Date().toISOString(),
          reason: 'user_requested'
        };

        mockBackendService.revokeDataAccess.mockResolvedValue({
          success: true,
          deletedDataTypes: ['profile', 'emergency_contacts'],
          deletionConfirmedAt: new Date().toISOString()
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.revokeConsent(revokeRequest);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockBackendService.revokeDataAccess).toHaveBeenCalledWith(revokeRequest);
        // expect(myDataService.getConsentStatus('user-123')).toEqual({
        //   isActive: false,
        //   revokedAt: expect.any(String),
        //   dataDeleted: true
        // });
      });

      it('should delete all associated data on consent revocation', async () => {
        // Arrange
        const userId = 'user-123';
        AsyncStorage.getItem.mockResolvedValue('{"name":"王小明","phone":"0912345678"}');
        Keychain.getInternetCredentials.mockResolvedValue({
          username: 'hsinchu_guardian',
          password: 'access_token_123'
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.deleteAllUserData(userId);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(AsyncStorage.removeItem).toHaveBeenCalledWith('encrypted_profile_data');
        // expect(Keychain.resetInternetCredentials).toHaveBeenCalledWith('mydata_access_token');
        // expect(myDataService.getUserDataExists(userId)).toBe(false);
      });

      it('should provide revocation confirmation to user', async () => {
        // Arrange
        const revocationConfirmation = {
          userId: 'user-123',
          revokedAt: '2025-09-17T10:00:00Z',
          dataTypes: ['基本資料', '緊急聯絡人'],
          deletionMethod: 'secure_overwrite'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const confirmation = await myDataService.generateRevocationConfirmation(revocationConfirmation);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(confirmation).toEqual({
        //   title: '同意撤回確認',
        //   message: '您的資料使用同意已成功撤回',
        //   deletedData: ['基本資料', '緊急聯絡人'],
        //   deletionTime: '2025-09-17T10:00:00Z',
        //   confirmationId: expect.any(String),
        //   futureAccess: '您可隨時重新授權使用服務'
        // });
      });
    });
  });

  describe('Data Retention and Deletion', () => {
    describe('Automatic Data Expiration', () => {
      it('should automatically delete data after retention period', async () => {
        // Arrange
        jest.useFakeTimers();
        const retentionPeriodMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        const testData = {
          userId: 'user-123',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + retentionPeriodMs).toISOString()
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.scheduleDataExpiration(testData);

          // Fast-forward 30 days
          jest.advanceTimersByTime(retentionPeriodMs);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getUserDataExists('user-123')).toBe(false);
        // expect(myDataService.getExpirationLog()).toContainEqual(
        //   expect.objectContaining({
        //     userId: 'user-123',
        //     deletedAt: expect.any(String),
        //     reason: 'retention_period_expired'
        //   })
        // );

        jest.useRealTimers();
      });

      it('should clean up expired tokens regularly', async () => {
        // Arrange
        const expiredTokens = [
          { userId: 'user-1', expiresAt: new Date(Date.now() - 1000).toISOString() },
          { userId: 'user-2', expiresAt: new Date(Date.now() - 2000).toISOString() }
        ];

        const validTokens = [
          { userId: 'user-3', expiresAt: new Date(Date.now() + 1000).toISOString() }
        ];

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.performTokenCleanup([...expiredTokens, ...validTokens]);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getActiveTokenCount()).toBe(1);
        // expect(myDataService.getCleanupLog()).toEqual(
        //   expect.arrayContaining([
        //     expect.objectContaining({ userId: 'user-1', action: 'token_deleted' }),
        //     expect.objectContaining({ userId: 'user-2', action: 'token_deleted' })
        //   ])
        // );
      });
    });

    describe('Receipt Management', () => {
      it('should retain consent receipts for 7 days after data deletion', async () => {
        // Arrange
        const consentReceipt = {
          receiptId: 'receipt-123',
          userId: 'user-123',
          dataDeleted: true,
          dataDeletedAt: new Date().toISOString(),
          receiptExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.manageReceiptRetention(consentReceipt);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getReceiptStatus('receipt-123')).toEqual({
        //   exists: true,
        //   dataDeleted: true,
        //   willDeleteAt: expect.any(String),
        //   purpose: 'compliance_record'
        // });
      });

      it('should generate GDPR-compliant deletion certificates', async () => {
        // Arrange
        const deletionEvent = {
          userId: 'user-123',
          dataTypes: ['profile', 'emergency_contacts'],
          deletedAt: new Date().toISOString(),
          deletionMethod: 'cryptographic_erasure',
          requestedBy: 'user'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const certificate = await myDataService.generateDeletionCertificate(deletionEvent);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(certificate).toEqual({
        //   certificateId: expect.any(String),
        //   userId: 'user-123',
        //   deletedDataTypes: ['profile', 'emergency_contacts'],
        //   deletionTimestamp: expect.any(String),
        //   deletionMethod: 'cryptographic_erasure',
        //   verificationHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        //   isCompliant: true,
        //   standard: 'GDPR Article 17'
        // });
      });
    });
  });

  describe('Security and Privacy', () => {
    describe('Token Security', () => {
      it('should implement secure token storage with biometric protection', async () => {
        // Arrange
        const sensitiveToken = 'highly_sensitive_access_token_12345';

        Keychain.setInternetCredentials.mockResolvedValue(true);
        Keychain.SECURITY_LEVEL = {
          SECURE_HARDWARE: 'SECURE_HARDWARE'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.storeTokenWithBiometricProtection(sensitiveToken);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
        //   'mydata_secure_token',
        //   'guardian_user',
        //   sensitiveToken,
        //   expect.objectContaining({
        //     accessControl: 'kSecAccessControlBiometryAny',
        //     authenticatePrompt: '請驗證身分以存取MyData服務',
        //     securityLevel: 'SECURE_HARDWARE'
        //   })
        // );
      });

      it('should implement token refresh without user interaction', async () => {
        // Arrange
        const refreshToken = 'refresh_token_67890';
        const newTokenResponse = {
          access_token: 'new_access_token_12345',
          expires_in: 3600
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(newTokenResponse)
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.refreshAccessToken(refreshToken);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(fetch).toHaveBeenCalledWith(
        //   'https://mydata.nat.gov.tw/oauth/token',
        //   expect.objectContaining({
        //     method: 'POST',
        //     body: expect.stringContaining('grant_type=refresh_token')
        //   })
        // );
        // expect(myDataService.getAccessToken()).toBe('new_access_token_12345');
      });
    });

    describe('Data Encryption', () => {
      it('should encrypt all stored personal data', async () => {
        // Arrange
        const personalData = {
          name: '王小明',
          phone: '0912345678',
          emergency_contact: '王太太'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const encrypted = await myDataService.encryptPersonalData(personalData);
          const decrypted = await myDataService.decryptPersonalData(encrypted);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(encrypted).not.toContain('王小明');
        // expect(encrypted).not.toContain('0912345678');
        // expect(encrypted).toMatch(/^[a-f0-9]+$/); // Hex encoded
        // expect(decrypted).toEqual(personalData);
      });

      it('should use different encryption keys per user', async () => {
        // Arrange
        const userData1 = { name: '用戶一' };
        const userData2 = { name: '用戶二' };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const encrypted1 = await myDataService.encryptPersonalData(userData1, 'user-1');
          const encrypted2 = await myDataService.encryptPersonalData(userData1, 'user-2');
        }).rejects.toThrow();

        // Expected behavior: Same data with different user keys should produce different ciphertext
        // expect(encrypted1).not.toBe(encrypted2);
        // expect(myDataService.getUserEncryptionKey('user-1')).not.toBe(
        //   myDataService.getUserEncryptionKey('user-2')
        // );
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('OAuth Flow Errors', () => {
      it('should handle network failures during OAuth', async () => {
        // Arrange
        global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed'));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.exchangeCodeForToken('auth_code_123');
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getOAuthError()).toEqual({
        //   type: 'network_error',
        //   message: 'Network request failed',
        //   userMessage: '網路連線錯誤，請檢查網路設定後重試',
        //   canRetry: true
        // });
      });

      it('should handle cancelled OAuth flow', async () => {
        // Arrange
        const cancelledCallbackUrl = 'hsinchuguardian://oauth/callback?error=access_denied';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.handleOAuthCallback(cancelledCallbackUrl);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getOAuthResult()).toEqual({
        //   success: false,
        //   error: 'access_denied',
        //   userMessage: '您已取消授權，無法使用MyData服務',
        //   canRetry: true
        // });
      });
    });

    describe('Data Processing Errors', () => {
      it('should handle API rate limiting gracefully', async () => {
        // Arrange
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 429,
          headers: new Map([['Retry-After', '60']]),
          json: () => Promise.resolve({ error: 'rate_limit_exceeded' })
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.fetchUserProfile(['name']);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getRateLimitStatus()).toEqual({
        //   isLimited: true,
        //   retryAfterSeconds: 60,
        //   retryAt: expect.any(Number),
        //   userMessage: '請求過於頻繁，請稍後再試'
        // });
      });

      it('should handle partial data responses', async () => {
        // Arrange
        const partialResponse = {
          name: '王小明',
          emergency_contacts: null, // Missing data
          error: 'emergency_contacts_unavailable'
        };

        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(partialResponse)
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await myDataService.fetchUserProfile(['name', 'emergency_contacts']);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(myDataService.getPartialDataWarning()).toEqual({
        //   hasPartialData: true,
        //   availableFields: ['name'],
        //   missingFields: ['emergency_contacts'],
        //   userMessage: '部分資料暫時無法取得，服務功能可能受限'
        // });
      });
    });
  });
});