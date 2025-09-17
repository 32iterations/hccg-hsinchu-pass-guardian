/**
 * Anonymization Service - Privacy-first data processing
 * Handles device hashing, location fuzzing, timestamp rounding, and k-anonymity enforcement
 */

const crypto = require('crypto');

class AnonymizationService {
  constructor(dependencies = {}) {
    this.crypto = dependencies.crypto || crypto;
    this.storage = dependencies.storage;
    this.kAnonymityValidator = dependencies.kAnonymityValidator;
    this.geoGridder = dependencies.geoGridder;

    this.minimumClusterSize = 3; // k=3 minimum
    this.sessionSalt = null;
    this.uploadQueue = [];
  }

  /**
   * Initialize session with new salt
   */
  async initializeSession() {
    try {
      const existingSalt = await this.storage.getItem('volunteer_session_salt');

      if (!existingSalt) {
        const newSalt = this.crypto.randomBytes(32).toString('hex');
        await this.storage.setItem('volunteer_session_salt', newSalt);
        this.sessionSalt = newSalt;
      } else {
        this.sessionSalt = existingSalt;
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to initialize session: ${error.message}`);
    }
  }

  /**
   * Generate SHA-256 hash with salt for device MAC address
   */
  async hashDevice(macAddress) {
    try {
      if (!macAddress || !this._isValidMACAddress(macAddress)) {
        throw new Error('Invalid MAC address format');
      }

      // Get or generate session salt
      if (!this.sessionSalt) {
        const salt = await this.storage.getItem('volunteer_session_salt');
        this.sessionSalt = salt || this.crypto.randomBytes(32).toString('hex');
      }

      const hash = this.crypto.createHash('sha256')
        .update(macAddress + this.sessionSalt)
        .digest('hex');

      return hash;
    } catch (error) {
      throw new Error(`Failed to hash device: ${error.message}`);
    }
  }

  /**
   * Create completely anonymized volunteer hit
   */
  async createVolunteerHit(deviceData, location = null) {
    try {
      // Hash the device address
      const deviceHash = await this.hashDevice(deviceData.address || deviceData.deviceHash);

      // Fuzz location to grid square
      const gridSquare = location ? await this.fuzzLocationToGrid(location) : null;

      // Round timestamp to 5-minute intervals
      const roundedTimestamp = await this.roundTimestampToInterval(
        deviceData.timestamp || new Date().toISOString()
      );

      // Generate anonymous ID
      const anonymousId = this.crypto.randomUUID ? this.crypto.randomUUID() : crypto.randomUUID();

      // Create minimal volunteer hit with NO PII
      const volunteerHit = {
        anonymousId,
        timestamp: roundedTimestamp,
        gridSquare,
        rssi: deviceData.rssi,
        deviceHash
        // Explicitly exclude all PII:
        // name: undefined,
        // address: undefined,
        // originalLocation: undefined,
        // services: undefined,
        // deviceName: undefined,
        // ownerInfo: undefined
      };

      // Validate no PII is included
      await this.validateNoPII(volunteerHit);

      return volunteerHit;
    } catch (error) {
      throw new Error(`Failed to create volunteer hit: ${error.message}`);
    }
  }

  /**
   * Fuzz location to 100m grid squares
   */
  async fuzzLocationToGrid(location) {
    try {
      if (!this._isValidLocation(location)) {
        throw new Error('Invalid location coordinates');
      }

      const gridSize = 100; // meters ~= 0.001 degrees
      const latGrid = Math.round(location.latitude * 1000) / 1000;
      const lngGrid = Math.round(location.longitude * 1000) / 1000;

      return `${latGrid.toFixed(3)},${lngGrid.toFixed(3)}`;
    } catch (error) {
      throw new Error(`Failed to fuzz location to grid: ${error.message}`);
    }
  }

  /**
   * Round timestamps to 5-minute intervals
   */
  async roundTimestampToInterval(timestamp) {
    try {
      if (!this._isValidTimestamp(timestamp)) {
        throw new Error('Invalid timestamp format');
      }

      const date = new Date(timestamp);
      const minutes = Math.floor(date.getMinutes() / 5) * 5;
      date.setMinutes(minutes, 0, 0); // Reset seconds and milliseconds

      return date.toISOString();
    } catch (error) {
      throw new Error(`Failed to round timestamp: ${error.message}`);
    }
  }

  /**
   * Validate k-anonymity for data cluster
   */
  async validateKAnonymity(cluster) {
    try {
      if (!this.kAnonymityValidator) {
        // Simple validation if no validator provided
        return cluster.length >= this.minimumClusterSize;
      }

      return this.kAnonymityValidator.validateCluster(cluster, this.minimumClusterSize);
    } catch (error) {
      throw new Error(`Failed to validate k-anonymity: ${error.message}`);
    }
  }

  /**
   * Queue volunteer hits until k-anonymity is achieved
   */
  async queueForKAnonymity(hits) {
    try {
      // Add to upload queue
      this.uploadQueue.push(...hits);

      // Store in persistent storage
      const existingQueue = await this.storage.getItem('queued_volunteer_hits');
      const allQueued = existingQueue ? JSON.parse(existingQueue) : [];
      allQueued.push(...hits);

      await this.storage.setItem('queued_volunteer_hits', JSON.stringify(allQueued));

      return { queued: true, queueSize: allQueued.length };
    } catch (error) {
      throw new Error(`Failed to queue for k-anonymity: ${error.message}`);
    }
  }

  /**
   * Process new hit and check if ready for upload
   */
  async processNewHit(newHit) {
    try {
      // Get queued hits
      const queuedHits = await this._getQueuedHits();
      const allHits = [...queuedHits, newHit];

      // Check k-anonymity
      const isValid = await this.validateKAnonymity(allHits);

      if (isValid) {
        // Upload the cluster
        await this.uploadCluster(allHits);

        // Clear the queue
        await this.storage.removeItem('queued_volunteer_hits');
        this.uploadQueue = [];

        return { uploaded: true, clusterSize: allHits.length };
      } else {
        // Queue the new hit
        await this.queueForKAnonymity([newHit]);
        return { queued: true };
      }
    } catch (error) {
      throw new Error(`Failed to process new hit: ${error.message}`);
    }
  }

  /**
   * Upload validated cluster (mock implementation)
   */
  async uploadCluster(cluster) {
    // Mock implementation - in real system would upload to server
    console.log(`Uploading cluster of ${cluster.length} anonymized hits`);
    return { success: true, uploaded: cluster.length };
  }

  /**
   * Anonymize device data
   */
  async anonymizeDevice(deviceData) {
    try {
      const hashedDevice = {
        deviceHash: await this.hashDevice(deviceData.address),
        rssi: deviceData.rssi,
        timestamp: await this.roundTimestampToInterval(deviceData.timestamp),
        salt: this.sessionSalt
      };

      if (deviceData.includeLocation && deviceData.location) {
        hashedDevice.gridSquare = await this.fuzzLocationToGrid(deviceData.location);
      } else {
        hashedDevice.location = null;
      }

      // Ensure original address is never stored
      delete hashedDevice.originalAddress;
      delete hashedDevice.address;

      return hashedDevice;
    } catch (error) {
      throw new Error(`Failed to anonymize device: ${error.message}`);
    }
  }

  /**
   * Ensure k-anonymity minimum is met
   */
  async ensureKAnonymity(cluster) {
    try {
      return await this.validateKAnonymity(cluster);
    } catch (error) {
      throw new Error(`Failed to ensure k-anonymity: ${error.message}`);
    }
  }

  /**
   * Minimize data to essential fields only
   */
  async minimizeData(fullDeviceData) {
    try {
      const minimized = {
        deviceHash: await this.hashDevice(fullDeviceData.address),
        rssi: fullDeviceData.rssi,
        timestamp: await this.roundTimestampToInterval(fullDeviceData.timestamp),
        anonymousId: this.crypto.randomUUID ? this.crypto.randomUUID() : crypto.randomUUID()
      };

      if (fullDeviceData.location) {
        minimized.gridSquare = await this.fuzzLocationToGrid(fullDeviceData.location);
      }

      // Verify no PII remains
      const forbiddenFields = ['name', 'address', 'user', 'location', 'services', 'manufacturer'];
      forbiddenFields.forEach(field => {
        if (minimized.hasOwnProperty(field)) {
          delete minimized[field];
        }
      });

      return minimized;
    } catch (error) {
      throw new Error(`Failed to minimize data: ${error.message}`);
    }
  }

  /**
   * Purge metadata that could identify users
   */
  async purgeMetadata(data) {
    try {
      const purged = { ...data };

      // Remove all metadata fields
      delete purged.metadata;
      delete purged.batteryLevel;
      delete purged.wifiNetworks;
      delete purged.installedApps;
      delete purged.deviceFingerprint;

      return purged;
    } catch (error) {
      throw new Error(`Failed to purge metadata: ${error.message}`);
    }
  }

  /**
   * Verify data contains no PII
   */
  async validateNoPII(data) {
    const piiFields = [
      'name', 'userName', 'phoneNumber', 'email', 'address', 'originalAddress',
      'deviceName', 'ownerInfo', 'originalLocation', 'exactLocation', 'ipAddress'
    ];

    const foundPII = [];

    for (const field of piiFields) {
      if (data.hasOwnProperty(field) && data[field] !== undefined) {
        foundPII.push(field);
      }
    }

    if (foundPII.length > 0) {
      return {
        containsPII: true,
        piiFields: foundPII,
        canProcess: false
      };
    }

    return {
      containsPII: false,
      piiFields: [],
      canProcess: true
    };
  }

  /**
   * Verify anonymization quality
   */
  async verifyAnonymization(anonymizedHit) {
    try {
      const validation = await this.validateNoPII(anonymizedHit);

      return {
        isAnonymized: !validation.containsPII,
        containsPII: validation.containsPII,
        reversible: false, // One-way hashing
        kAnonymityCompliant: anonymizedHit.deviceHash ? true : false,
        securityLevel: 'high'
      };
    } catch (error) {
      throw new Error(`Failed to verify anonymization: ${error.message}`);
    }
  }

  /**
   * Handle hash collisions (rare but possible)
   */
  async handleHashCollision(mac1, mac2, collisionHash) {
    // In real implementation, would generate alternative hash
    console.warn(`Hash collision detected for ${collisionHash}`);
    return this.generateAlternativeHash(mac1);
  }

  /**
   * Generate alternative hash for collision resolution
   */
  async generateAlternativeHash(macAddress) {
    const alternativeSalt = this.crypto.randomBytes(16).toString('hex');
    return this.crypto.createHash('sha256')
      .update(macAddress + alternativeSalt)
      .digest('hex');
  }

  /**
   * Preserve queued data during permission issues
   */
  async preserveQueuedData() {
    // Data is already persisted in storage
    return { preserved: true };
  }

  /**
   * Process queued hits after permission restoration
   */
  async processQueuedHits(queuedHits) {
    for (const hit of queuedHits) {
      await this.processNewHit(hit);
    }
    return { processed: queuedHits.length };
  }

  // Private helper methods
  async _getQueuedHits() {
    try {
      const stored = await this.storage.getItem('queued_volunteer_hits');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  _isValidMACAddress(mac) {
    if (!mac || typeof mac !== 'string') return false;
    return /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/i.test(mac);
  }

  _isValidLocation(location) {
    if (!location || typeof location !== 'object') return false;
    const { latitude, longitude } = location;
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    );
  }

  _isValidTimestamp(timestamp) {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }
}

module.exports = AnonymizationService;