const { DeviceBindingService } = require('../../src/services/safety/device-binding.service');
const { NCCValidationError, DuplicateDeviceError, BLEConnectionError } = require('../../src/services/safety/errors');
const { DeviceRepository } = require('../../src/repositories/device.repository');
const { BLEManager } = require('../../src/hardware/ble-manager');
const { NotificationService } = require('../../src/services/notification.service');

// Mock dependencies
jest.mock('../../src/repositories/device.repository');
jest.mock('../../src/hardware/ble-manager');
jest.mock('../../src/services/notification.service');

describe('DeviceBindingService - RED Phase Tests', () => {
  let deviceBindingService;
  let mockDeviceRepository;
  let mockBLEManager;
  let mockNotificationService;

  beforeEach(() => {
    // Clear all mocks first
    jest.clearAllMocks();

    // Create mock instances with proper London School patterns
    mockDeviceRepository = {
      findBySerialNumber: jest.fn().mockResolvedValue(null),
      checkNCCRegistry: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockResolvedValue({}),
      findById: jest.fn().mockResolvedValue({}),
      updateStatus: jest.fn().mockResolvedValue({}),
      saveUserConsent: jest.fn().mockResolvedValue({}),
      getUserConsent: jest.fn().mockResolvedValue({ consentRecorded: true })
    };

    mockBLEManager = {
      connect: jest.fn().mockResolvedValue({ connected: true }),
      getConnectionStatus: jest.fn().mockResolvedValue({ connected: true }),
      getDeviceMetrics: jest.fn().mockResolvedValue({
        signalStrength: -45,
        batteryLevel: 75,
        lastSeen: new Date()
      })
    };

    mockNotificationService = {
      sendDeviceBindingNotification: jest.fn().mockResolvedValue(true),
      sendConnectionAlert: jest.fn().mockResolvedValue(true)
    };

    deviceBindingService = new DeviceBindingService(
      mockDeviceRepository,
      mockBLEManager,
      mockNotificationService
    );
  });

  describe('NCC Certification Validation', () => {
    describe('validateNCCNumber', () => {
      it('should accept valid NCC format CCAMYYXX#### (12 characters)', async () => {
        const validNCCNumbers = [
          'CCAM2301AB1234',
          'CCAM2402CD5678',
          'CCAM2503EF9012'
        ];

        for (const nccNumber of validNCCNumbers) {
          const result = await deviceBindingService.validateNCCNumber(nccNumber);
          expect(result).toBe(true);
        }
      });

      it('should reject invalid NCC format - wrong prefix', async () => {
        const invalidNCCNumbers = [
          'CCAB2301AB1234', // Wrong prefix
          'XXAM2301AB1234', // Wrong prefix
          'ccam2301AB1234'  // Lowercase
        ];

        for (const nccNumber of invalidNCCNumbers) {
          await expect(deviceBindingService.validateNCCNumber(nccNumber))
            .rejects.toThrow(NCCValidationError);
        }
      });

      it('should reject invalid NCC format - wrong length', async () => {
        const invalidNCCNumbers = [
          'CCAM230AB123',     // Too short (11 chars)
          'CCAM2301AB12345',  // Too long (13 chars)
          'CCAM2301AB',       // Too short (10 chars)
        ];

        for (const nccNumber of invalidNCCNumbers) {
          await expect(deviceBindingService.validateNCCNumber(nccNumber))
            .rejects.toThrow(NCCValidationError);
        }
      });

      it('should reject invalid NCC format - wrong year format', async () => {
        const invalidNCCNumbers = [
          'CCAM2AB1AB1234', // Non-numeric year
          'CCAM99AB1234',   // Wrong year format
          'CCAM1901AB1234'  // Invalid year (too old)
        ];

        for (const nccNumber of invalidNCCNumbers) {
          await expect(deviceBindingService.validateNCCNumber(nccNumber))
            .rejects.toThrow(NCCValidationError);
        }
      });

      it('should reject invalid NCC format - invalid character patterns', async () => {
        const invalidNCCNumbers = [
          'CCAM230111234',  // Missing letter in XX part
          'CCAM2301A11234', // Missing letter in XX part
          'CCAM2301ABCD34', // Non-numeric serial
          'CCAM2301AB12@4'  // Special characters
        ];

        for (const nccNumber of invalidNCCNumbers) {
          await expect(deviceBindingService.validateNCCNumber(nccNumber))
            .rejects.toThrow(NCCValidationError);
        }
      });

      it('should validate NCC number exists in official registry', async () => {
        const nccNumber = 'CCAM2301AB1234';
        mockDeviceRepository.checkNCCRegistry.mockResolvedValue(false);

        await expect(deviceBindingService.validateNCCNumber(nccNumber))
          .rejects.toThrow(NCCValidationError);

        expect(mockDeviceRepository.checkNCCRegistry).toHaveBeenCalledWith(nccNumber);
      });
    });

    describe('getChineseRegulatoryWarning', () => {
      it('should return Chinese regulatory warning text', () => {
        const warning = deviceBindingService.getChineseRegulatoryWarning();

        expect(warning).toContain('本產品符合國家通訊傳播委員會（NCC）');
        expect(warning).toContain('低功率電波輻射性電機管理辦法');
        expect(warning).toContain('審驗合格');
        expect(warning).toContain('使用時不得影響飛航安全及干擾合法通信');
        expect(warning).toContain('經型式認證合格之低功率射頻電機');
      });

      it('should include NCC logo and certification mark requirements', () => {
        const warning = deviceBindingService.getChineseRegulatoryWarning();

        expect(warning).toContain('NCC認證標章');
        expect(warning).toContain('審驗號碼');
        expect(warning).toContain('製造商資訊');
      });
    });
  });

  describe('Device Serial Number Management', () => {
    describe('registerDevice', () => {
      it('should prevent duplicate serial number registration', async () => {
        const deviceData = {
          serialNumber: 'HSC-GUARD-001234',
          nccNumber: 'CCAM2301AB1234',
          userId: 'user-123',
          deviceType: 'safety-tracker'
        };

        mockDeviceRepository.findBySerialNumber.mockResolvedValue({
          id: 'existing-device-id',
          serialNumber: deviceData.serialNumber,
          userId: 'other-user-456'
        });

        await expect(deviceBindingService.registerDevice(deviceData))
          .rejects.toThrow(DuplicateDeviceError);

        expect(mockDeviceRepository.findBySerialNumber)
          .toHaveBeenCalledWith(deviceData.serialNumber);
      });

      it('should allow registration of new serial number', async () => {
        const deviceData = {
          serialNumber: 'HSC-GUARD-001235',
          nccNumber: 'CCAM2301AB1234',
          userId: 'user-123',
          deviceType: 'safety-tracker'
        };

        mockDeviceRepository.findBySerialNumber.mockResolvedValue(null);
        mockDeviceRepository.checkNCCRegistry.mockResolvedValue(true);
        mockDeviceRepository.create.mockResolvedValue({
          id: 'new-device-id',
          ...deviceData,
          status: 'registered',
          createdAt: new Date()
        });

        const result = await deviceBindingService.registerDevice(deviceData);

        expect(result.id).toBe('new-device-id');
        expect(result.status).toBe('registered');
        expect(mockDeviceRepository.create).toHaveBeenCalledWith(deviceData);
      });

      it('should validate serial number format for Hsinchu devices', async () => {
        const invalidSerialNumbers = [
          'INVALID-123',        // Wrong prefix
          'HSC-GUARD-12',       // Too short
          'HSC-GUARD-1234567',  // Too long
          'HSC-GUARD-ABCDEF',   // Non-numeric suffix
          'hsc-guard-001234'    // Lowercase
        ];

        for (const serialNumber of invalidSerialNumbers) {
          const deviceData = {
            serialNumber,
            nccNumber: 'CCAM2301AB1234',
            userId: 'user-123',
            deviceType: 'safety-tracker'
          };

          await expect(deviceBindingService.registerDevice(deviceData))
            .rejects.toThrow('Invalid serial number format');
        }
      });
    });

    describe('transferDevice', () => {
      it('should prevent transfer of non-existent device', async () => {
        const transferData = {
          serialNumber: 'HSC-GUARD-999999',
          fromUserId: 'user-123',
          toUserId: 'user-456',
          reason: 'family transfer'
        };

        mockDeviceRepository.findBySerialNumber.mockResolvedValue(null);

        await expect(deviceBindingService.transferDevice(transferData))
          .rejects.toThrow('Device not found');
      });

      it('should prevent unauthorized device transfer', async () => {
        const transferData = {
          serialNumber: 'HSC-GUARD-001234',
          fromUserId: 'user-123',
          toUserId: 'user-456',
          reason: 'family transfer'
        };

        mockDeviceRepository.findBySerialNumber.mockResolvedValue({
          id: 'device-123',
          serialNumber: transferData.serialNumber,
          userId: 'different-user-789' // Not the fromUserId
        });

        await expect(deviceBindingService.transferDevice(transferData))
          .rejects.toThrow('Unauthorized transfer attempt');
      });
    });
  });

  describe('BLE Connection Management', () => {
    describe('connectToDevice', () => {
      it('should handle BLE connection failures with retry logic', async () => {
        const deviceId = 'device-123';
        const maxRetries = 3;

        mockBLEManager.connect.mockRejectedValue(new BLEConnectionError('Connection timeout'));

        await expect(deviceBindingService.connectToDevice(deviceId, { maxRetries }))
          .rejects.toThrow(BLEConnectionError);

        expect(mockBLEManager.connect).toHaveBeenCalledTimes(maxRetries);
      });

      it('should implement exponential backoff between retries', async () => {
        const deviceId = 'device-123';
        const startTime = Date.now();

        mockBLEManager.connect
          .mockRejectedValueOnce(new BLEConnectionError('First attempt failed'))
          .mockRejectedValueOnce(new BLEConnectionError('Second attempt failed'))
          .mockResolvedValueOnce({ connected: true, deviceId });

        const result = await deviceBindingService.connectToDevice(deviceId);

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        expect(result.connected).toBe(true);
        expect(totalTime).toBeGreaterThan(1500); // At least 1s + 2s backoff
        expect(mockBLEManager.connect).toHaveBeenCalledTimes(3);
      });

      it('should handle different BLE error types appropriately', async () => {
        const deviceId = 'device-123';
        const errorTypes = [
          { error: new BLEConnectionError('Device not found'), shouldRetry: false },
          { error: new BLEConnectionError('Permission denied'), shouldRetry: false },
          { error: new BLEConnectionError('Connection timeout'), shouldRetry: true },
          { error: new BLEConnectionError('Signal weak'), shouldRetry: true }
        ];

        for (const { error, shouldRetry } of errorTypes) {
          jest.clearAllMocks();
          mockBLEManager.connect.mockRejectedValue(error);

          await expect(deviceBindingService.connectToDevice(deviceId))
            .rejects.toThrow(BLEConnectionError);

          const expectedCalls = shouldRetry ? 3 : 1; // 3 retries for retryable errors
          expect(mockBLEManager.connect).toHaveBeenCalledTimes(expectedCalls);
        }
      });
    });

    describe('monitorConnectionHealth', () => {
      it('should detect connection drops and attempt reconnection', async () => {
        const deviceId = 'device-123';

        mockBLEManager.getConnectionStatus.mockResolvedValue({ connected: false });
        mockBLEManager.connect.mockResolvedValue({ connected: true, deviceId });

        const healthStatus = await deviceBindingService.monitorConnectionHealth(deviceId);

        expect(healthStatus.reconnected).toBe(true);
        expect(mockBLEManager.connect).toHaveBeenCalledWith(deviceId);
      });

      it('should track signal strength and battery level', async () => {
        const deviceId = 'device-123';

        mockBLEManager.getDeviceMetrics.mockResolvedValue({
          signalStrength: -45, // dBm
          batteryLevel: 75,    // percentage
          lastSeen: new Date()
        });

        const metrics = await deviceBindingService.getDeviceMetrics(deviceId);

        expect(metrics.signalStrength).toBe(-45);
        expect(metrics.batteryLevel).toBe(75);
        expect(metrics.connectionQuality).toBeDefined();
      });
    });
  });

  describe('Regulatory Compliance', () => {
    describe('displayRegulatoryInfo', () => {
      it('should show complete regulatory information before device binding', async () => {
        const regulatoryInfo = await deviceBindingService.getRegulatoryInfo();

        expect(regulatoryInfo).toHaveProperty('nccWarning');
        expect(regulatoryInfo).toHaveProperty('privacyNotice');
        expect(regulatoryInfo).toHaveProperty('dataRetentionPolicy');
        expect(regulatoryInfo).toHaveProperty('userRights');

        // Chinese regulatory text requirements
        expect(regulatoryInfo.nccWarning).toMatch(/國家通訊傳播委員會/);
        expect(regulatoryInfo.privacyNotice).toMatch(/個人資料保護法/);
      });

      it('should require user consent before proceeding with binding', async () => {
        const consentData = {
          userId: 'user-123',
          nccAcknowledged: true,
          privacyAccepted: true,
          dataProcessingConsent: true,
          timestamp: new Date()
        };

        mockDeviceRepository.saveUserConsent.mockResolvedValue(consentData);

        const result = await deviceBindingService.recordUserConsent(consentData);

        expect(result.consentRecorded).toBe(true);
        expect(mockDeviceRepository.saveUserConsent).toHaveBeenCalledWith(consentData);
      });

      it('should prevent device binding without proper consent', async () => {
        const deviceData = {
          serialNumber: 'HSC-GUARD-001234',
          nccNumber: 'CCAM2301AB1234',
          userId: 'user-123',
          deviceType: 'safety-tracker'
        };

        mockDeviceRepository.getUserConsent.mockResolvedValue(null); // No consent recorded

        await expect(deviceBindingService.registerDevice(deviceData))
          .rejects.toThrow('User consent required before device registration');
      });
    });
  });

  describe('Device Status Management', () => {
    describe('updateDeviceStatus', () => {
      it('should track device lifecycle states', async () => {
        const deviceId = 'device-123';
        const statusTransitions = [
          { from: 'registered', to: 'paired', valid: true },
          { from: 'paired', to: 'active', valid: true },
          { from: 'active', to: 'inactive', valid: true },
          { from: 'inactive', to: 'active', valid: true },
          { from: 'registered', to: 'active', valid: false }, // Invalid transition
          { from: 'deactivated', to: 'paired', valid: false }  // Invalid transition
        ];

        for (const { from, to, valid } of statusTransitions) {
          mockDeviceRepository.findById.mockResolvedValue({
            id: deviceId,
            status: from
          });

          if (valid) {
            mockDeviceRepository.updateStatus.mockResolvedValue({
              id: deviceId,
              status: to,
              updatedAt: new Date()
            });

            const result = await deviceBindingService.updateDeviceStatus(deviceId, to);
            expect(result.status).toBe(to);
          } else {
            await expect(deviceBindingService.updateDeviceStatus(deviceId, to))
              .rejects.toThrow('Invalid status transition');
          }
        }
      });
    });
  });

  describe('Notification Integration', () => {
    describe('deviceStatusNotifications', () => {
      it('should notify users of successful device binding', async () => {
        const deviceData = {
          serialNumber: 'HSC-GUARD-001234',
          nccNumber: 'CCAM2301AB1234',
          userId: 'user-123',
          deviceType: 'safety-tracker'
        };

        mockDeviceRepository.findBySerialNumber.mockResolvedValue(null);
        mockDeviceRepository.checkNCCRegistry.mockResolvedValue(true);
        mockDeviceRepository.getUserConsent.mockResolvedValue({ consentRecorded: true });
        mockDeviceRepository.create.mockResolvedValue({
          id: 'new-device-id',
          ...deviceData,
          status: 'registered'
        });

        mockNotificationService.sendDeviceBindingNotification.mockResolvedValue(true);

        await deviceBindingService.registerDevice(deviceData);

        expect(mockNotificationService.sendDeviceBindingNotification)
          .toHaveBeenCalledWith(deviceData.userId, expect.objectContaining({
            type: 'device_registered',
            deviceId: 'new-device-id',
            serialNumber: deviceData.serialNumber
          }));
      });

      it('should notify users of connection issues', async () => {
        const deviceId = 'device-123';

        mockBLEManager.connect.mockRejectedValue(new BLEConnectionError('Connection failed'));

        try {
          await deviceBindingService.connectToDevice(deviceId, { maxRetries: 1 });
        } catch (error) {
          // Expected to fail
        }

        expect(mockNotificationService.sendConnectionAlert)
          .toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            type: 'connection_failed',
            deviceId
          }));
      });
    });
  });
});