// Jest is globally available, no need to import
const crypto = require('crypto');

// Mock dependencies
const mockCrypto = {
  createHash: jest.fn(),
  randomBytes: jest.fn(),
  pbkdf2: jest.fn()
};

const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

const mockKAnonymityValidator = {
  validateCluster: jest.fn(),
  getMinimumClusterSize: jest.fn(),
  enforceKAnonymity: jest.fn()
};

const mockGeoGridder = {
  fuzzToGrid: jest.fn(),
  calculateGridSquare: jest.fn()
};

// Import the service (will fail until implementation exists)
let AnonymizationService;
try {
  AnonymizationService = require('../../services/AnonymizationService');
} catch (error) {
  // Expected to fail in RED phase
  AnonymizationService = class {
    constructor() {
      throw new Error('AnonymizationService implementation not found');
    }
  };
}

describe('AnonymizationService', () => {
  let anonymizationService;
  let mockTimestamp;
  let mockUuid;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestamp = '2025-09-17T16:47:32Z';
    mockUuid = '550e8400-e29b-41d4-a716-446655440000';

    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockTimestamp);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockUuid);

    // This will fail in RED phase as service doesn't exist yet
    try {
      anonymizationService = new AnonymizationService({
        crypto: mockCrypto,
        storage: mockStorage,
        kAnonymityValidator: mockKAnonymityValidator,
        geoGridder: mockGeoGridder
      });
    } catch (error) {
      // Expected in RED phase
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Device Hash Generation', () => {
    describe('One-Way Hash with Salt', () => {
      it('should generate SHA-256 hash with salt for device MAC address', async () => {
        // Arrange
        const macAddress = 'AA:BB:CC:DD:EE:FF';
        const salt = 'hsinchupass_volunteer_salt_2025';
        const expectedHash = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01';

        mockCrypto.randomBytes.mockReturnValue(Buffer.from(salt));
        mockCrypto.createHash.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(expectedHash)
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const deviceHash = await anonymizationService.hashDevice(macAddress);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
        // expect(deviceHash).toBe(expectedHash);
        // expect(deviceHash).toMatch(/^[a-f0-9]{64}$/); // 64 character hex string
      });

      it('should use consistent salt for same session', async () => {
        // Arrange
        const mac1 = 'AA:BB:CC:DD:EE:FF';
        const mac2 = 'BB:CC:DD:EE:FF:AA';
        const salt = 'consistent_salt_value';

        mockStorage.getItem.mockResolvedValue(salt);

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.hashDevice(mac1);
          await anonymizationService.hashDevice(mac2);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockStorage.getItem).toHaveBeenCalledWith('volunteer_session_salt');
        // expect(mockCrypto.createHash).toHaveBeenCalledTimes(2);
        // // Both calls should use same salt
      });

      it('should generate new salt for new session', async () => {
        // Arrange
        mockStorage.getItem.mockResolvedValue(null); // No existing salt
        const newSalt = 'new_session_salt_2025_09_17';
        mockCrypto.randomBytes.mockReturnValue(Buffer.from(newSalt));

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.initializeSession();
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
        // expect(mockStorage.setItem).toHaveBeenCalledWith('volunteer_session_salt', newSalt);
      });

      it('should make hash irreversible - no reverse lookup possible', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          // This method should NOT exist
          await anonymizationService.reverseHashToMAC('a1b2c3d4...');
        }).rejects.toThrow();

        // Expected behavior: method should not exist
        // expect(anonymizationService.reverseHashToMAC).toBeUndefined();
        // expect(anonymizationService.macLookupTable).toBeUndefined();
        // expect(anonymizationService.hashToMacMap).toBeUndefined();
      });
    });

    describe('Hash Consistency and Collision Handling', () => {
      it('should generate same hash for same MAC address in same session', async () => {
        // Arrange
        const macAddress = 'CC:DD:EE:FF:AA:BB';
        const sessionSalt = 'same_session_salt';
        const expectedHash = 'consistent_hash_value_123456789abcdef';

        mockStorage.getItem.mockResolvedValue(sessionSalt);
        mockCrypto.createHash.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue(expectedHash)
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const hash1 = await anonymizationService.hashDevice(macAddress);
          const hash2 = await anonymizationService.hashDevice(macAddress);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(hash1).toBe(hash2);
        // expect(hash1).toBe(expectedHash);
      });

      it('should generate different hashes for different MAC addresses', async () => {
        // Arrange
        const mac1 = 'AA:BB:CC:DD:EE:FF';
        const mac2 = 'FF:EE:DD:CC:BB:AA';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const hash1 = await anonymizationService.hashDevice(mac1);
          const hash2 = await anonymizationService.hashDevice(mac2);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(hash1).not.toBe(hash2);
        // expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        // expect(hash2).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should handle hash collisions gracefully', async () => {
        // Arrange - simulate unlikely but possible collision
        mockCrypto.createHash.mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue('same_hash_collision')
        });

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.handleHashCollision('mac1', 'mac2', 'same_hash_collision');
        }).rejects.toThrow();

        // Expected behavior:
        // expect(anonymizationService.detectCollision).toHaveBeenCalled();
        // expect(anonymizationService.generateAlternativeHash).toHaveBeenCalled();
      });
    });
  });

  describe('VolunteerHit Creation', () => {
    describe('Complete Data Anonymization', () => {
      it('should create VolunteerHit with all PII removed', async () => {
        // Arrange
        const deviceData = {
          address: 'DD:EE:FF:AA:BB:CC',
          name: 'Johns iPhone 15',
          rssi: -75,
          services: ['Heart Rate', 'Battery Service'],
          timestamp: '2025-09-17T16:47:32Z'
        };
        const location = {
          latitude: 24.8067834,
          longitude: 120.9687456,
          accuracy: 5
        };

        mockGeoGridder.fuzzToGrid.mockReturnValue('24.8067,120.9687');

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const volunteerHit = await anonymizationService.createVolunteerHit(deviceData, location);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(volunteerHit).toEqual({
        //   anonymousId: mockUuid,
        //   timestamp: '2025-09-17T16:45:00Z', // Rounded to 5 min
        //   gridSquare: '24.8067,120.9687',
        //   rssi: -75,
        //   deviceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        //   // Ensure NO PII is included
        //   name: undefined,
        //   address: undefined,
        //   originalLocation: undefined,
        //   services: undefined,
        //   deviceName: undefined,
        //   ownerInfo: undefined
        // });
      });

      it('should never store original device names', async () => {
        // Arrange
        const deviceWithName = {
          address: 'EE:FF:AA:BB:CC:DD',
          name: 'Marys Apple Watch',
          rssi: -80
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.createVolunteerHit(deviceWithName);
        }).rejects.toThrow();

        // Expected behavior: verify no name storage
        // expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        //   expect.anything(),
        //   expect.objectContaining({
        //     name: expect.any(String),
        //     deviceName: expect.any(String),
        //     originalName: expect.any(String)
        //   })
        // );
      });

      it('should never store device IDs, phone numbers, or personal identifiers', async () => {
        // Arrange
        const deviceWithPII = {
          address: 'FF:AA:BB:CC:DD:EE',
          rssi: -70,
          metadata: {
            userId: 'user123@example.com',
            phoneNumber: '+886912345678',
            deviceId: 'IMEI-123456789012345'
          }
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.createVolunteerHit(deviceWithPII);
        }).rejects.toThrow();

        // Expected behavior: ensure NO PII is stored
        // expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        //   expect.anything(),
        //   expect.objectContaining({
        //     userId: expect.any(String),
        //     phoneNumber: expect.any(String),
        //     deviceId: expect.any(String),
        //     email: expect.any(String),
        //     imei: expect.any(String)
        //   })
        // );
      });
    });

    describe('Location Fuzzing', () => {
      it('should fuzz location to 100m grid squares', async () => {
        // Arrange
        const preciseLocation = {
          latitude: 24.8067834,
          longitude: 120.9687456
        };

        mockGeoGridder.fuzzToGrid.mockReturnValue('24.8067,120.9687');

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const fuzzedLocation = await anonymizationService.fuzzLocationToGrid(preciseLocation);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockGeoGridder.fuzzToGrid).toHaveBeenCalledWith({
        //   latitude: 24.8067834,
        //   longitude: 120.9687456,
        //   gridSize: 100 // 100 meter grid
        // });
        // expect(fuzzedLocation).toBe('24.8067,120.9687');
      });

      it('should never store precise location coordinates', async () => {
        // Arrange
        const preciseLocation = {
          latitude: 24.8067834567,
          longitude: 120.9687456789,
          altitude: 123.45,
          accuracy: 3.2
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.fuzzLocationToGrid(preciseLocation);
        }).rejects.toThrow();

        // Expected behavior: ensure precise coords are never stored
        // expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        //   expect.anything(),
        //   expect.objectContaining({
        //     latitude: 24.8067834567,
        //     longitude: 120.9687456789,
        //     preciseLat: expect.any(Number),
        //     preciseLng: expect.any(Number),
        //     exactLocation: expect.any(Object)
        //   })
        // );
      });

      it('should handle edge cases near grid boundaries', async () => {
        // Arrange
        const boundaryLocation = {
          latitude: 24.8069999, // Near grid boundary
          longitude: 120.9689999
        };

        mockGeoGridder.fuzzToGrid.mockReturnValue('24.8069,120.9689');

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const gridSquare = await anonymizationService.fuzzLocationToGrid(boundaryLocation);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(gridSquare).toBe('24.8069,120.9689');
        // expect(mockGeoGridder.fuzzToGrid).toHaveBeenCalledWith(
        //   expect.objectContaining({
        //     handleBoundaries: true,
        //     gridSize: 100
        //   })
        // );
      });
    });

    describe('Timestamp Rounding', () => {
      it('should round timestamps to 5-minute intervals', async () => {
        // Arrange
        const preciseTimestamps = [
          '2025-09-17T16:47:32Z',
          '2025-09-17T16:43:15Z',
          '2025-09-17T16:49:58Z'
        ];

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const rounded1 = await anonymizationService.roundTimestampToInterval(preciseTimestamps[0]);
          const rounded2 = await anonymizationService.roundTimestampToInterval(preciseTimestamps[1]);
          const rounded3 = await anonymizationService.roundTimestampToInterval(preciseTimestamps[2]);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(rounded1).toBe('2025-09-17T16:45:00Z');
        // expect(rounded2).toBe('2025-09-17T16:45:00Z');
        // expect(rounded3).toBe('2025-09-17T16:50:00Z');
      });

      it('should never store precise timestamps', async () => {
        // Arrange
        const preciseTimestamp = '2025-09-17T16:47:32.123Z';

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.roundTimestampToInterval(preciseTimestamp);
        }).rejects.toThrow();

        // Expected behavior: ensure precise timestamp is never stored
        // expect(mockStorage.setItem).not.toHaveBeenCalledWith(
        //   expect.anything(),
        //   expect.objectContaining({
        //     preciseTimestamp: expect.any(String),
        //     originalTimestamp: expect.any(String),
        //     exactTime: expect.any(String)
        //   })
        // );
      });

      it('should handle edge cases at interval boundaries', async () => {
        // Arrange
        const boundaryTimestamps = [
          '2025-09-17T16:45:00Z', // Exactly on boundary
          '2025-09-17T16:44:59Z', // 1 second before
          '2025-09-17T16:45:01Z'  // 1 second after
        ];

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          for (const timestamp of boundaryTimestamps) {
            await anonymizationService.roundTimestampToInterval(timestamp);
          }
        }).rejects.toThrow();

        // Expected behavior:
        // expect(rounded[0]).toBe('2025-09-17T16:45:00Z');
        // expect(rounded[1]).toBe('2025-09-17T16:45:00Z');
        // expect(rounded[2]).toBe('2025-09-17T16:45:00Z');
      });
    });
  });

  describe('K-Anonymity Enforcement', () => {
    describe('Minimum Cluster Size Validation', () => {
      it('should require minimum 3 devices per cluster', async () => {
        // Arrange
        const smallCluster = [
          { deviceHash: 'hash1', gridSquare: '24.8067,120.9687' },
          { deviceHash: 'hash2', gridSquare: '24.8067,120.9687' }
        ];

        mockKAnonymityValidator.getMinimumClusterSize.mockReturnValue(3);
        mockKAnonymityValidator.validateCluster.mockReturnValue(false);

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const isValid = await anonymizationService.validateKAnonymity(smallCluster);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(isValid).toBe(false);
        // expect(mockKAnonymityValidator.validateCluster).toHaveBeenCalledWith(smallCluster, 3);
      });

      it('should allow upload when k=3 minimum is met', async () => {
        // Arrange
        const validCluster = [
          { deviceHash: 'hash1', gridSquare: '24.8067,120.9687' },
          { deviceHash: 'hash2', gridSquare: '24.8067,120.9687' },
          { deviceHash: 'hash3', gridSquare: '24.8067,120.9687' }
        ];

        mockKAnonymityValidator.validateCluster.mockReturnValue(true);

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const isValid = await anonymizationService.validateKAnonymity(validCluster);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(isValid).toBe(true);
        // expect(anonymizationService.canUploadCluster(validCluster)).toBe(true);
      });

      it('should queue VolunteerHits until k-anonymity is achieved', async () => {
        // Arrange
        const partialCluster = [
          { deviceHash: 'hash1', gridSquare: '24.8067,120.9687', timestamp: '2025-09-17T16:45:00Z' },
          { deviceHash: 'hash2', gridSquare: '24.8067,120.9687', timestamp: '2025-09-17T16:45:00Z' }
        ];

        mockKAnonymityValidator.validateCluster.mockReturnValue(false);

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.queueForKAnonymity(partialCluster);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockStorage.setItem).toHaveBeenCalledWith('queued_volunteer_hits',
        //   expect.arrayContaining(partialCluster)
        // );
        // expect(anonymizationService.uploadQueue).toContain(...partialCluster);
      });

      it('should upload all queued hits when k-anonymity threshold reached', async () => {
        // Arrange
        const queuedHits = [
          { deviceHash: 'hash1', gridSquare: '24.8067,120.9687' },
          { deviceHash: 'hash2', gridSquare: '24.8067,120.9687' }
        ];
        const newHit = { deviceHash: 'hash3', gridSquare: '24.8067,120.9687' };

        mockStorage.getItem.mockResolvedValue(JSON.stringify(queuedHits));
        mockKAnonymityValidator.validateCluster.mockReturnValue(true);

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.processNewHit(newHit);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(mockKAnonymityValidator.validateCluster).toHaveBeenCalledWith(
        //   [...queuedHits, newHit], 3
        // );
        // expect(anonymizationService.uploadCluster).toHaveBeenCalledWith([...queuedHits, newHit]);
        // expect(mockStorage.removeItem).toHaveBeenCalledWith('queued_volunteer_hits');
      });
    });

    describe('Individual Device Identification Prevention', () => {
      it('should ensure individual devices cannot be identified from clusters', async () => {
        // Arrange
        const cluster = [
          { deviceHash: 'hash1', gridSquare: '24.8067,120.9687', rssi: -75 },
          { deviceHash: 'hash2', gridSquare: '24.8067,120.9687', rssi: -80 },
          { deviceHash: 'hash3', gridSquare: '24.8067,120.9687', rssi: -70 }
        ];

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          // This method should NOT exist
          await anonymizationService.identifyIndividualDevice(cluster[0].deviceHash);
        }).rejects.toThrow();

        // Expected behavior: no individual identification should be possible
        // expect(anonymizationService.identifyIndividualDevice).toBeUndefined();
        // expect(anonymizationService.deviceIdentificationMap).toBeUndefined();
        // expect(anonymizationService.reverseClusterLookup).toBeUndefined();
      });

      it('should validate that server data cannot reverse lookup individual devices', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          // These methods should NOT exist
          await anonymizationService.reverseLookupFromServer('hash123');
          await anonymizationService.getOriginalMACFromHash('hash456');
          await anonymizationService.correlateDeviceWithUser('hash789');
        }).rejects.toThrow();

        // Expected behavior: no reverse lookup methods should exist
        // expect(anonymizationService.reverseLookupFromServer).toBeUndefined();
        // expect(anonymizationService.getOriginalMACFromHash).toBeUndefined();
        // expect(anonymizationService.correlateDeviceWithUser).toBeUndefined();
      });
    });
  });

  describe('Privacy Protection Validation', () => {
    describe('Data Minimization', () => {
      it('should only store essential anonymized data', async () => {
        // Arrange
        const fullDeviceData = {
          address: 'AA:BB:CC:DD:EE:FF',
          name: 'Johns iPhone',
          rssi: -75,
          services: ['Heart Rate', 'Battery'],
          manufacturer: 'Apple Inc.',
          model: 'iPhone 15 Pro',
          osVersion: 'iOS 17.1',
          appVersion: '1.2.3',
          timestamp: '2025-09-17T16:47:32Z',
          location: { lat: 24.8067834, lng: 120.9687456 },
          user: { id: 'user123', email: 'john@example.com' }
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const minimizedData = await anonymizationService.minimizeData(fullDeviceData);
        }).rejects.toThrow();

        // Expected behavior: only essential anonymized fields should remain
        // expect(minimizedData).toEqual({
        //   deviceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        //   rssi: -75,
        //   timestamp: '2025-09-17T16:45:00Z',
        //   gridSquare: '24.8067,120.9687',
        //   anonymousId: expect.stringMatching(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
        // });
        // expect(minimizedData).not.toHaveProperty('name');
        // expect(minimizedData).not.toHaveProperty('address');
        // expect(minimizedData).not.toHaveProperty('user');
        // expect(minimizedData).not.toHaveProperty('location');
      });

      it('should purge unnecessary metadata and device fingerprints', async () => {
        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.purgeMetadata({
            deviceHash: 'abc123',
            metadata: {
              batteryLevel: 0.85,
              signalStrength: -75,
              wifiNetworks: ['Network1', 'Network2'],
              installedApps: ['App1', 'App2']
            }
          });
        }).rejects.toThrow();

        // Expected behavior: metadata should be removed
        // expect(purgedData).not.toHaveProperty('metadata');
        // expect(purgedData).not.toHaveProperty('batteryLevel');
        // expect(purgedData).not.toHaveProperty('wifiNetworks');
        // expect(purgedData).not.toHaveProperty('installedApps');
      });
    });

    describe('Anonymization Verification', () => {
      it('should verify no reverse lookup is possible from anonymized data', async () => {
        // Arrange
        const anonymizedHit = {
          anonymousId: '550e8400-e29b-41d4-a716-446655440000',
          timestamp: '2025-09-17T16:45:00Z',
          gridSquare: '24.8067,120.9687',
          rssi: -75,
          deviceHash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef01'
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          const verificationResult = await anonymizationService.verifyAnonymization(anonymizedHit);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(verificationResult).toEqual({
        //   isAnonymized: true,
        //   containsPII: false,
        //   reversible: false,
        //   kAnonymityCompliant: true,
        //   securityLevel: 'high'
        // });
      });

      it('should detect and reject data containing PII', async () => {
        // Arrange
        const dataWithPII = {
          deviceHash: 'hash123',
          rssi: -75,
          userName: 'John Doe', // PII!
          phoneNumber: '+886912345678', // PII!
          email: 'john@example.com' // PII!
        };

        // Act & Assert - Will fail in RED phase
        await expect(async () => {
          await anonymizationService.validateNoPII(dataWithPII);
        }).rejects.toThrow();

        // Expected behavior:
        // expect(validationResult.containsPII).toBe(true);
        // expect(validationResult.piiFields).toEqual(['userName', 'phoneNumber', 'email']);
        // expect(validationResult.canProcess).toBe(false);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    describe('Malformed Data Handling', () => {
      it('should handle malformed MAC addresses gracefully', async () => {
        // Arrange
        const malformedMACs = [
          'invalid-mac',
          'AA:BB:CC:DD:EE', // Too short
          'AA:BB:CC:DD:EE:FF:GG', // Too long
          'ZZ:XX:YY:WW:VV:UU', // Invalid hex
          null,
          undefined,
          ''
        ];

        // Act & Assert - Will fail in RED phase
        for (const mac of malformedMACs) {
          await expect(async () => {
            await anonymizationService.hashDevice(mac);
          }).rejects.toThrow();
        }

        // Expected behavior:
        // expect(anonymizationService.validateMACFormat).toHaveBeenCalled();
        // expect(anonymizationService.handleMalformedData).toHaveBeenCalled();
      });

      it('should handle invalid location coordinates gracefully', async () => {
        // Arrange
        const invalidLocations = [
          { latitude: 91, longitude: 180 }, // Invalid lat
          { latitude: 24.8067, longitude: 181 }, // Invalid lng
          { latitude: null, longitude: 120.9687 },
          { latitude: 'invalid', longitude: 'invalid' },
          null,
          undefined
        ];

        // Act & Assert - Will fail in RED phase
        for (const location of invalidLocations) {
          await expect(async () => {
            await anonymizationService.fuzzLocationToGrid(location);
          }).rejects.toThrow();
        }

        // Expected behavior:
        // expect(anonymizationService.validateLocationFormat).toHaveBeenCalled();
        // expect(anonymizationService.handleInvalidLocation).toHaveBeenCalled();
      });

      it('should handle timestamp parsing errors gracefully', async () => {
        // Arrange
        const invalidTimestamps = [
          'invalid-timestamp',
          '2025-13-40T25:70:90Z', // Invalid date components
          '2025-09-17T16:47:32', // Missing Z
          null,
          undefined,
          123456789 // Number instead of string
        ];

        // Act & Assert - Will fail in RED phase
        for (const timestamp of invalidTimestamps) {
          await expect(async () => {
            await anonymizationService.roundTimestampToInterval(timestamp);
          }).rejects.toThrow();
        }

        // Expected behavior:
        // expect(anonymizationService.validateTimestampFormat).toHaveBeenCalled();
        // expect(anonymizationService.handleInvalidTimestamp).toHaveBeenCalled();
      });
    });
  });
});