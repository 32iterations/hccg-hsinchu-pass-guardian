/**
 * Volunteer Consent Service - GDPR Compliant Consent Management
 * Handles volunteer opt-in/out, permission management, and data persistence
 */

class VolunteerConsentService {
  constructor(dependencies = {}) {
    this.storage = dependencies.storage;
    this.pushNotifications = dependencies.pushNotifications;
    this.bleScanner = dependencies.bleScanner;
    this.analytics = dependencies.analytics;

    this.currentConsentVersion = '2.1';
    this.retentionPeriod = '2 years';
  }

  /**
   * Grant volunteer consent and enable background scanning
   */
  async grantConsent(userId, consentVersion) {
    try {
      // Generate anonymous user ID if needed
      const anonymousUserId = this._generateAnonymousId(userId);

      // Check for existing consent
      const existingConsent = await this._getStoredConsent();

      // Handle version updates
      if (existingConsent && existingConsent.version !== consentVersion) {
        await this._handleConsentVersionUpdate(existingConsent, consentVersion);
      }

      // Create consent record
      const consentRecord = {
        userId: anonymousUserId,
        granted: true,
        timestamp: new Date().toISOString(),
        version: consentVersion,
        gdprCompliant: true,
        retentionPeriod: this.retentionPeriod,
        ipAddress: null, // Must not store IP
        deviceFingerprint: this._generateMinimalFingerprint()
      };

      if (existingConsent) {
        consentRecord.previousVersions = existingConsent.previousVersions || [];
        consentRecord.previousVersions.push(existingConsent.version);
        consentRecord.versionUpdateTimestamp = new Date().toISOString();
      }

      // Store consent
      await this.storage.setItem('volunteer_consent', JSON.stringify(consentRecord));

      // Start BLE scanning
      await this.bleScanner.start();

      // Track analytics (anonymized)
      await this.analytics.track('volunteer_consent_granted', {
        version: consentVersion,
        timestamp: consentRecord.timestamp
      });

      return { success: true, consentRecord };
    } catch (error) {
      throw new Error(`Failed to grant consent: ${error.message}`);
    }
  }

  /**
   * Withdraw volunteer consent and stop all data collection
   */
  async withdrawConsent(userId) {
    try {
      const existingConsent = await this._getStoredConsent();

      if (!existingConsent) {
        throw new Error('No existing consent found');
      }

      // Stop BLE scanning immediately
      await this.bleScanner.stop();

      // Update consent record with withdrawal
      const withdrawalRecord = {
        ...existingConsent,
        granted: false,
        withdrawalTimestamp: new Date().toISOString(),
        withdrawalReason: 'user_request'
      };

      await this.storage.setItem('volunteer_consent', JSON.stringify(withdrawalRecord));

      // Purge volunteer data
      await this._purgeVolunteerData();

      // Track withdrawal
      await this.analytics.track('volunteer_consent_withdrawn', {
        timestamp: withdrawalRecord.withdrawalTimestamp
      });

      return { success: true, withdrawalRecord };
    } catch (error) {
      throw new Error(`Failed to withdraw consent: ${error.message}`);
    }
  }

  /**
   * Check current consent status
   */
  async checkConsentStatus(userId) {
    try {
      const storedConsent = await this._getStoredConsent();

      if (!storedConsent) {
        return {
          granted: false,
          timestamp: null,
          version: null,
          isValid: false,
          requiresUpdate: false
        };
      }

      const requiresUpdate = storedConsent.version !== this.currentConsentVersion;

      return {
        granted: storedConsent.granted,
        timestamp: storedConsent.timestamp,
        version: storedConsent.version,
        isValid: storedConsent.granted && !requiresUpdate,
        requiresUpdate,
        currentVersion: storedConsent.version,
        latestVersion: this.currentConsentVersion
      };
    } catch (error) {
      throw new Error(`Failed to check consent status: ${error.message}`);
    }
  }

  /**
   * Request Android BLE permissions based on configuration
   */
  async requestAndroidBLEPermissions(permissionsModule, options = {}) {
    try {
      const permissions = [
        'android.permission.BLUETOOTH_SCAN',
        'android.permission.BLUETOOTH_CONNECT'
      ];

      // Add location permission if inference is enabled
      if (options.enableLocationInference) {
        permissions.push('android.permission.ACCESS_FINE_LOCATION');
      }

      const result = await permissionsModule.request(permissions);

      // Configure BLE scanner based on options
      if (options.enableLocationInference === false) {
        await this.bleScanner.configure({
          neverForLocation: true,
          requireLocationPermission: false
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to request Android BLE permissions: ${error.message}`);
    }
  }

  /**
   * Configure iOS BLE background mode
   */
  async configureIOSBLEBackground(iosBluetoothModule) {
    try {
      await iosBluetoothModule.configureBackgroundMode('bluetooth-central');

      await iosBluetoothModule.setupStatePreservation({
        restoreIdentifier: 'HsinchuPassVolunteerScanner',
        preservePeripherals: true
      });

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to configure iOS BLE background: ${error.message}`);
    }
  }

  /**
   * Restore consent state on app startup
   */
  async restoreConsentOnStartup() {
    try {
      const storedConsent = await this._getStoredConsent();

      if (storedConsent && storedConsent.granted) {
        if (storedConsent.scanningActive !== false) {
          await this.bleScanner.start({
            resumeFromPreviousSession: true,
            preserveConfiguration: true
          });
        }
        return { restored: true, consentActive: true };
      }

      return { restored: false, consentActive: false };
    } catch (error) {
      throw new Error(`Failed to restore consent on startup: ${error.message}`);
    }
  }

  /**
   * Check if volunteer mode is enabled
   */
  isVolunteerModeEnabled() {
    // This would be implemented based on current state
    return this._isVolunteerActive;
  }

  /**
   * Get volunteer status
   */
  getVolunteerStatus() {
    return this._volunteerStatus || {
      enabled: false,
      reason: 'not_initialized',
      canRetry: true
    };
  }

  /**
   * Handle permission denied scenarios
   */
  async handlePermissionDenied(missingPermissions) {
    try {
      const consentRecord = await this._getStoredConsent();

      if (consentRecord) {
        consentRecord.status = 'pending_permissions';
        consentRecord.missingPermissions = missingPermissions;
        consentRecord.canRetryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

        await this.storage.setItem('volunteer_consent', JSON.stringify(consentRecord));
      }

      this._volunteerStatus = {
        enabled: false,
        reason: 'permissions_required',
        requiredPermissions: missingPermissions,
        canRetry: true
      };

      return this._volunteerStatus;
    } catch (error) {
      throw new Error(`Failed to handle permission denied: ${error.message}`);
    }
  }

  // Private helper methods
  async _getStoredConsent() {
    try {
      const stored = await this.storage.getItem('volunteer_consent');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      return null;
    }
  }

  _generateAnonymousId(originalUserId) {
    // Generate anonymous UUID-based ID
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(originalUserId || '').digest('hex');
    return `anonymous-${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
  }

  _generateMinimalFingerprint() {
    // Minimal 8-character device fingerprint only
    const crypto = require('crypto');
    return crypto.randomBytes(4).toString('hex');
  }

  async _handleConsentVersionUpdate(existingConsent, newVersion) {
    // Stop scanning during version update
    await this.bleScanner.stop();
  }

  async _purgeVolunteerData() {
    // Remove volunteer-specific data
    await this.storage.removeItem('volunteer_hits_cache');
    await this.storage.removeItem('volunteer_scan_history');
  }
}

module.exports = VolunteerConsentService;