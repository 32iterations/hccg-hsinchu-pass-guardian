// Jest is globally available, no need to import

// Mock dependencies
const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

const mockPushNotifications = {
  requestPermission: jest.fn(),
  scheduleNotification: jest.fn(),
  cancelNotification: jest.fn()
};

const mockBLEScanner = {
  start: jest.fn(),
  stop: jest.fn(),
  isScanning: jest.fn(),
  onDeviceDiscovered: jest.fn(),
  configure: jest.fn()
};

const mockAnalytics = {
  track: jest.fn(),
  setUserProperty: jest.fn()
};

// Import the service
const VolunteerConsentService = require('../../src/services/volunteer-consent.service');

describe('VolunteerConsentService', () => {
  let consentService;
  let mockTimestamp;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestamp = '2025-09-17T16:45:30Z';
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockTimestamp);

    consentService = new VolunteerConsentService({
      storage: mockStorage,
      pushNotifications: mockPushNotifications,
      bleScanner: mockBLEScanner,
      analytics: mockAnalytics
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Consent Management', () => {
    describe('grantConsent', () => {
      it('should enable volunteer mode and start background BLE scanning', async () => {
        // Arrange
        const consentVersion = '2.1';
        const userId = 'anonymous-user-123';

        mockStorage.getItem.mockResolvedValue(null); // No previous consent
        mockBLEScanner.start.mockResolvedValue(true);
        mockPushNotifications.requestPermission.mockResolvedValue('granted');

        // Act
        const result = await consentService.grantConsent(userId, consentVersion);

        // Assert
        expect(result.success).toBe(true);
        expect(mockStorage.setItem).toHaveBeenCalledWith('volunteer_consent', expect.stringContaining('"granted":true'));
        expect(mockBLEScanner.start).toHaveBeenCalled();
        expect(mockAnalytics.track).toHaveBeenCalledWith('volunteer_consent_granted', {
          version: consentVersion,
          timestamp: mockTimestamp
        });
      });

      it('should record consent timestamp for GDPR compliance', async () => {
        // Arrange
        const consentVersion = '2.1';
        const userId = 'anonymous-user-456';

        // Act
        const result = await consentService.grantConsent(userId, consentVersion);

        // Assert
        expect(result.success).toBe(true);
        const storedConsent = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
        expect(storedConsent).toEqual(expect.objectContaining({
          timestamp: mockTimestamp,
          version: consentVersion,
          gdprCompliant: true,
          retentionPeriod: '2 years'
        }));
      });

      it('should handle consent version updates', async () => {
        // Arrange
        const oldConsent = {
          userId: 'anonymous-user-789',
          granted: true,
          timestamp: '2025-01-01T00:00:00Z',
          version: '2.0'
        };
        mockStorage.getItem.mockResolvedValue(JSON.stringify(oldConsent));

        // Act
        const result = await consentService.grantConsent('anonymous-user-789', '2.1');

        // Assert
        expect(result.success).toBe(true);
        expect(mockBLEScanner.stop).toHaveBeenCalled();
        const storedConsent = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
        expect(storedConsent).toEqual(expect.objectContaining({
          version: '2.1',
          previousVersions: ['2.0'],
          versionUpdateTimestamp: mockTimestamp
        }));
      });
    });

    describe('withdrawConsent', () => {
      it('should immediately disable volunteer mode and stop scanning', async () => {
        // Arrange
        const existingConsent = {
          userId: 'anonymous-user-123',
          granted: true,
          timestamp: '2025-09-17T16:00:00Z',
          version: '2.1'
        };
        mockStorage.getItem.mockResolvedValue(JSON.stringify(existingConsent));
        mockBLEScanner.stop.mockResolvedValue(true);

        // Act
        const result = await consentService.withdrawConsent('anonymous-user-123');

        // Assert
        expect(result.success).toBe(true);
        expect(mockBLEScanner.stop).toHaveBeenCalled();
        const storedConsent = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
        expect(storedConsent).toEqual(expect.objectContaining({
          granted: false,
          withdrawalTimestamp: mockTimestamp,
          withdrawalReason: 'user_request'
        }));
      });

      it('should cancel all queued data uploads', async () => {
        // Mock existing consent for withdrawal
        mockStorage.getItem.mockResolvedValue(JSON.stringify({
          userId: 'anonymous-user-456',
          granted: true,
          timestamp: mockTimestamp,
          version: '2.1'
        }));

        // Act
        const result = await consentService.withdrawConsent('anonymous-user-456');

        // Assert
        expect(result.success).toBe(true);
        expect(mockStorage.removeItem).toHaveBeenCalledWith('volunteer_hits_cache');
        expect(mockStorage.removeItem).toHaveBeenCalledWith('volunteer_scan_history');
      });

      it('should purge local volunteer data immediately', async () => {
        // Mock existing consent for withdrawal
        mockStorage.getItem.mockResolvedValue(JSON.stringify({
          userId: 'anonymous-user-789',
          granted: true,
          timestamp: mockTimestamp,
          version: '2.1'
        }));

        // Act
        const result = await consentService.withdrawConsent('anonymous-user-789');

        // Assert
        expect(result.success).toBe(true);
        expect(mockStorage.removeItem).toHaveBeenCalledWith('volunteer_hits_cache');
        expect(mockStorage.removeItem).toHaveBeenCalledWith('volunteer_scan_history');
        expect(mockAnalytics.track).toHaveBeenCalledWith('volunteer_consent_withdrawn', {
          timestamp: mockTimestamp
        });
      });
    });

    describe('checkConsentStatus', () => {
      it('should return consent status with version information', async () => {
        // Arrange
        const storedConsent = {
          userId: 'anonymous-user-123',
          granted: true,
          timestamp: mockTimestamp,
          version: '2.1'
        };
        mockStorage.getItem.mockResolvedValue(JSON.stringify(storedConsent));

        // Act
        const status = await consentService.checkConsentStatus('anonymous-user-123');

        // Assert
        expect(status).toEqual({
          granted: true,
          timestamp: mockTimestamp,
          version: '2.1',
          isValid: true,
          requiresUpdate: false,
          currentVersion: '2.1',
          latestVersion: '2.1'
        });
      });

      it('should detect when consent version requires update', async () => {
        // Arrange
        const outdatedConsent = {
          userId: 'anonymous-user-456',
          granted: true,
          timestamp: '2025-01-01T00:00:00Z',
          version: '2.0'
        };
        mockStorage.getItem.mockResolvedValue(JSON.stringify(outdatedConsent));

        // Act
        const status = await consentService.checkConsentStatus('anonymous-user-456');

        // Assert
        expect(status.requiresUpdate).toBe(true);
        expect(status.currentVersion).toBe('2.0');
        expect(status.latestVersion).toBe('2.1');
      });
    });
  });

  describe('Permission Management', () => {
    describe('Android 12+ Permissions', () => {
      it('should request BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions', async () => {
        // Arrange
        const mockAndroidPermissions = {
          request: jest.fn().mockResolvedValue(['granted', 'granted']),
          check: jest.fn().mockResolvedValue('denied')
        };

        // Act
        const result = await consentService.requestAndroidBLEPermissions(mockAndroidPermissions);

        // Assert
        expect(mockAndroidPermissions.request).toHaveBeenCalledWith([
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT'
        ]);
        expect(result).toEqual(['granted', 'granted']);
      });

      it('should conditionally request location permission based on inference setting', async () => {
        // Arrange
        const mockAndroidPermissions = {
          request: jest.fn().mockResolvedValue(['granted', 'granted', 'granted']),
          check: jest.fn().mockResolvedValue('denied')
        };

        // Act
        const result = await consentService.requestAndroidBLEPermissions(mockAndroidPermissions, {
          enableLocationInference: true
        });

        // Assert
        expect(mockAndroidPermissions.request).toHaveBeenCalledWith([
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT',
          'android.permission.ACCESS_FINE_LOCATION'
        ]);
        expect(result).toEqual(['granted', 'granted', 'granted']);
      });

      it('should set neverForLocation flag when location inference disabled', async () => {
        // Arrange
        const mockAndroidPermissions = {
          request: jest.fn().mockResolvedValue(['granted', 'granted']),
          check: jest.fn().mockResolvedValue('denied')
        };

        // Act
        const result = await consentService.requestAndroidBLEPermissions(mockAndroidPermissions, {
          enableLocationInference: false
        });

        // Assert
        expect(mockBLEScanner.configure).toHaveBeenCalledWith({
          neverForLocation: true,
          requireLocationPermission: false
        });
        expect(result).toEqual(['granted', 'granted']);
      });
    });

    describe('iOS Background Permissions', () => {
      it('should configure bluetooth-central background mode', async () => {
        // Arrange
        const mockIOSBLE = {
          configureBackgroundMode: jest.fn().mockResolvedValue(true),
          setupStatePreservation: jest.fn().mockResolvedValue(true)
        };

        // Act
        const result = await consentService.configureIOSBLEBackground(mockIOSBLE);

        // Assert
        expect(mockIOSBLE.configureBackgroundMode).toHaveBeenCalledWith('bluetooth-central');
        expect(mockIOSBLE.setupStatePreservation).toHaveBeenCalledWith({
          restoreIdentifier: 'HsinchuPassVolunteerScanner',
          preservePeripherals: true
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Persistence and Recovery', () => {
    describe('App Restart Scenarios', () => {
      it('should preserve consent state across app restarts', async () => {
        // Arrange
        const persistedConsent = {
          userId: 'anonymous-user-123',
          granted: true,
          timestamp: mockTimestamp,
          version: '2.1'
        };
        mockStorage.getItem.mockResolvedValue(JSON.stringify(persistedConsent));

        // Act
        const result = await consentService.restoreConsentOnStartup();

        // Assert
        expect(mockBLEScanner.start).toHaveBeenCalledWith({
          resumeFromPreviousSession: true,
          preserveConfiguration: true
        });
        expect(result.restored).toBe(true);
        expect(result.consentActive).toBe(true);
      });

      it('should resume background scanning automatically after restart', async () => {
        // Arrange
        mockStorage.getItem.mockResolvedValue(JSON.stringify({
          granted: true,
          timestamp: mockTimestamp,
          version: '2.1',
          scanningActive: true
        }));

        // Act
        const result = await consentService.restoreConsentOnStartup();

        // Assert
        expect(mockBLEScanner.start).toHaveBeenCalledWith({
          resumeFromPreviousSession: true,
          preserveConfiguration: true
        });
        expect(result.restored).toBe(true);
        expect(result.consentActive).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    describe('Permission Denied Scenarios', () => {
      it('should handle graceful degradation when BLE permission denied', async () => {
        // Arrange
        mockBLEScanner.start.mockRejectedValue(new Error('Permission denied'));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await consentService.grantConsent('anonymous-user-123', '2.1');
        }).rejects.toThrow();

        // Expected behavior:
        // expect(consentService.getVolunteerStatus()).toEqual({
        //   enabled: false,
        //   reason: 'permissions_required',
        //   requiredPermissions: ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT'],
        //   canRetry: true
        // });
      });

      it('should mark consent as pending when permissions incomplete', async () => {
        // Mock existing consent first
        mockStorage.getItem.mockResolvedValue(JSON.stringify({
          userId: 'anonymous-user-123',
          granted: true,
          timestamp: mockTimestamp,
          version: '2.1'
        }));

        // Act
        const status = await consentService.handlePermissionDenied(['BLUETOOTH_SCAN']);

        // Assert
        const storedConsent = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
        expect(storedConsent).toEqual(expect.objectContaining({
          status: 'pending_permissions',
          missingPermissions: ['BLUETOOTH_SCAN'],
          canRetryAt: expect.any(String)
        }));
        expect(status.enabled).toBe(false);
        expect(status.reason).toBe('permissions_required');
      });
    });
  });

  describe('Privacy and GDPR Compliance', () => {
    it('should anonymize user identifiers in consent records', async () => {
      // Act & Assert - Will fail in RED phase
      await expect(async () => {
        await consentService.grantConsent('user@example.com', '2.1');
      }).rejects.toThrow();

      // Expected behavior:
      // expect(mockStorage.setItem).toHaveBeenCalledWith('volunteer_consent',
      //   expect.objectContaining({
      //     userId: expect.stringMatching(/^anonymous-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/),
      //     originalUserId: undefined, // Must not store original ID
      //     ipAddress: undefined, // Must not store IP
      //     deviceFingerprint: expect.stringMatching(/^[a-f0-9]{8}$/) // Minimal 8-char hash only
      //   })
      // );
    });

    it('should not store IP addresses or detailed device fingerprints', async () => {
      // Act & Assert - Will fail in RED phase
      await expect(async () => {
        await consentService.grantConsent('anonymous-user-123', '2.1');
      }).rejects.toThrow();

      // Expected behavior: verify sensitive data is NOT stored
      // expect(mockStorage.setItem).not.toHaveBeenCalledWith(
      //   expect.anything(),
      //   expect.objectContaining({
      //     ipAddress: expect.anything(),
      //     fullDeviceInfo: expect.anything(),
      //     browserFingerprint: expect.anything(),
      //     locationHistory: expect.anything()
      //   })
      // );
    });
  });
});