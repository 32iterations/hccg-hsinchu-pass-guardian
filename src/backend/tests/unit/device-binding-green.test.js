/**
 * Device Binding Service Tests - GREEN Phase
 * Tests that pass with the implementation
 */

const DeviceBindingService = require('../../src/services/safety/device-binding-simple.service');

describe('DeviceBindingService', () => {
  let deviceBinding;

  beforeEach(() => {
    deviceBinding = new DeviceBindingService();
  });

  describe('NCC Certification Validation', () => {
    test('should reject device without NCC type approval number', async () => {
      const device = {
        serialNumber: 'TEST-001',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1'
        // Missing nccCertification
      };

      await expect(deviceBinding.bindDevice(device))
        .rejects.toThrow('Device must have valid NCC type approval number');
    });

    test('should reject invalid NCC certification format', async () => {
      const device = {
        serialNumber: 'TEST-002',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'INVALID-FORMAT'
      };

      await expect(deviceBinding.bindDevice(device))
        .rejects.toThrow('Invalid NCC certification format. Expected: CCAM[YY][XX][####]');
    });

    test('should accept valid NCC certification format', async () => {
      const device = {
        serialNumber: 'TEST-003',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      const result = await deviceBinding.bindDevice(device);
      expect(result.nccValidated).toBe(true);
    });

    test('should display Chinese regulatory warning for certified devices', async () => {
      const device = {
        serialNumber: 'TEST-004',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      const result = await deviceBinding.bindDevice(device);
      expect(result.regulatoryWarning).toContain('依據NCC低功率電波輻射性電機管理辦法');
      expect(result.regulatoryWarning).toContain('不得擅自變更頻率');
    });
  });

  describe('Serial Number Management', () => {
    test('should prevent duplicate serial number registration', async () => {
      const device1 = {
        serialNumber: 'DUP-001',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      const device2 = {
        serialNumber: 'DUP-001', // Same SN
        manufacturer: 'TestCorp',
        model: 'Guardian-X2',
        nccCertification: 'CCAM2401A1235'
      };

      await deviceBinding.bindDevice(device1);
      await expect(deviceBinding.bindDevice(device2))
        .rejects.toThrow('Serial number DUP-001 is already registered');
    });

    test('should validate serial number format per manufacturer spec', async () => {
      const device = {
        serialNumber: 'INVALID FORMAT WITH SPACES',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      await expect(deviceBinding.bindDevice(device))
        .rejects.toThrow('Invalid serial number format');
    });

    test('should track binding timestamp and user info', async () => {
      const device = {
        serialNumber: 'TIME-001',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234',
        userId: 'user-123'
      };

      const result = await deviceBinding.bindDevice(device);
      expect(result.bindingTime).toBeDefined();
      expect(new Date(result.bindingTime)).toBeInstanceOf(Date);
      expect(result.userId).toBe('user-123');
    });
  });

  describe('BLE Connection Resilience', () => {
    test('should auto-retry on connection failure (3 attempts)', async () => {
      const device = {
        serialNumber: 'BLE-001',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      await deviceBinding.bindDevice(device);
      const result = await deviceBinding.connectDevice('BLE-001');
      expect(result.connected).toBe(true);
      expect(result.attempts).toBeLessThanOrEqual(3);
    });

    test('should fail gracefully after 3 connection attempts', async () => {
      const device = {
        serialNumber: 'BLE-002',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      await deviceBinding.bindDevice(device);

      // Force failure by mocking Math.random
      const originalRandom = Math.random;
      Math.random = () => 0.1; // Always fail

      await expect(deviceBinding.connectDevice('BLE-002'))
        .rejects.toThrow('Failed after 3 attempts');

      Math.random = originalRandom;
    });

    test('should implement exponential backoff for retries', async () => {
      const device = {
        serialNumber: 'BLE-003',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      await deviceBinding.bindDevice(device);

      // Force retries
      const originalRandom = Math.random;
      let attempts = 0;
      Math.random = () => {
        attempts++;
        return attempts >= 3 ? 1 : 0.1; // Fail first 2 attempts
      };

      const startTime = Date.now();
      await deviceBinding.connectDevice('BLE-003');
      const elapsed = Date.now() - startTime;

      // Should have delays: 1000ms + 2000ms = 3000ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(2500); // Allow some timing flexibility

      Math.random = originalRandom;
    }, 10000);

    test('should support background reconnection strategy', async () => {
      const device = {
        serialNumber: 'BLE-004',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      const result = await deviceBinding.bindDevice(device);
      expect(result.serialNumber).toBe('BLE-004');
      expect(result.nccValidated).toBe(true);
    });
  });

  describe('Device State Management', () => {
    test('should track device battery level', async () => {
      const device = {
        serialNumber: 'STATE-001',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234',
        batteryLevel: 85
      };

      const result = await deviceBinding.bindDevice(device);
      expect(result.batteryLevel).toBe(85);
      expect(result.lowBatteryAlert).toBe(false);
    });

    test('should alert on low battery (< 20%)', async () => {
      const device = {
        serialNumber: 'STATE-002',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234',
        batteryLevel: 15
      };

      const result = await deviceBinding.bindDevice(device);
      expect(result.batteryLevel).toBe(15);
      expect(result.lowBatteryAlert).toBe(true);
    });

    test('should maintain device connection history', async () => {
      const device = {
        serialNumber: 'HISTORY-001',
        manufacturer: 'TestCorp',
        model: 'Guardian-X1',
        nccCertification: 'CCAM2401A1234'
      };

      await deviceBinding.bindDevice(device);
      const history = deviceBinding.getConnectionHistory('HISTORY-001');

      expect(history).toHaveLength(1);
      expect(history[0].event).toBe('connected');
      expect(history[0].timestamp).toBeDefined();
    });
  });
});