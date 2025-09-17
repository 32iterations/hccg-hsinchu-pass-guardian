/**
 * VolunteerConsentService - P2 Volunteer BLE & Geo Alerts
 *
 * Manages volunteer consent for BLE scanning and geo-location services.
 * Implements GDPR compliance with timestamps and version management.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class VolunteerConsentService {
  constructor(dependencies) {
    this.storage = dependencies.storage;
    this.pushNotifications = dependencies.pushNotifications;
    this.bleScanner = dependencies.bleScanner;
    this.analytics = dependencies.analytics;
    this.status = {
      volunteerModeEnabled: false,
      consentGranted: false,
      version: null
    };
  }

  async grantConsent(userId, consentVersion) {
    // Mock implementation - minimal viable to pass tests
    const timestamp = new Date().toISOString();
    const consent = {
      userId: userId,
      granted: true,
      timestamp: timestamp,
      version: consentVersion,
      ipAddress: null, // Must not store IP
      deviceFingerprint: this.generateMinimalFingerprint(),
      gdprCompliant: true,
      retentionPeriod: '2 years'
    };

    await this.storage.setItem('volunteer_consent', consent);

    // Start BLE scanning
    await this.bleScanner.start();

    // Track analytics
    this.analytics.track('volunteer_consent_granted', {
      version: consentVersion,
      timestamp: timestamp
    });

    this.status.volunteerModeEnabled = true;
    this.status.consentGranted = true;
    this.status.version = consentVersion;
  }

  async withdrawConsent(userId) {
    const timestamp = new Date().toISOString();
    const existingConsent = await this.getStoredConsent();

    if (existingConsent) {
      const updatedConsent = {
        ...existingConsent,
        granted: false,
        withdrawalTimestamp: timestamp,
        withdrawalReason: 'user_request'
      };

      await this.storage.setItem('volunteer_consent', updatedConsent);
    }

    // Stop BLE scanning immediately
    await this.bleScanner.stop();

    // Purge volunteer data
    await this.storage.removeItem('volunteer_hits_cache');
    await this.storage.removeItem('volunteer_scan_history');

    this.analytics.track('volunteer_consent_withdrawn');

    this.status.volunteerModeEnabled = false;
    this.status.consentGranted = false;
  }

  async checkConsentStatus(userId) {
    const consent = await this.getStoredConsent();

    if (!consent) {
      return {
        granted: false,
        timestamp: null,
        version: null,
        isValid: false,
        requiresUpdate: false
      };
    }

    const requiresUpdate = consent.version !== '2.1'; // Current version

    return {
      granted: consent.granted,
      timestamp: consent.timestamp,
      version: consent.version,
      isValid: consent.granted && !requiresUpdate,
      requiresUpdate: requiresUpdate,
      currentVersion: consent.version,
      latestVersion: '2.1'
    };
  }

  async requestAndroidBLEPermissions(androidPermissions, options = {}) {
    const requiredPermissions = [
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT'
    ];

    if (options.enableLocationInference) {
      requiredPermissions.push('android.permission.ACCESS_FINE_LOCATION');
    }

    const result = await androidPermissions.request(requiredPermissions);

    if (!options.enableLocationInference) {
      // Configure scanner for no location inference
      await this.bleScanner.configure?.({
        neverForLocation: true,
        requireLocationPermission: false
      });
    }

    return result;
  }

  async configureIOSBLEBackground(iosBLE) {
    await iosBLE.configureBackgroundMode('bluetooth-central');
    await iosBLE.setupStatePreservation({
      restoreIdentifier: 'HsinchuPassVolunteerScanner',
      preservePeripherals: true
    });
  }

  async restoreConsentOnStartup() {
    const consent = await this.getStoredConsent();

    if (consent && consent.granted) {
      this.status.volunteerModeEnabled = true;
      this.status.consentGranted = true;
      this.status.version = consent.version;

      if (consent.scanningActive) {
        await this.bleScanner.start({
          resumeFromPreviousSession: true,
          preserveConfiguration: true
        });
      }
    }
  }

  async handlePermissionDenied(missingPermissions) {
    const timestamp = new Date().toISOString();
    const consent = await this.getStoredConsent();

    if (consent) {
      const updatedConsent = {
        ...consent,
        status: 'pending_permissions',
        missingPermissions: missingPermissions,
        canRetryAt: timestamp
      };

      await this.storage.setItem('volunteer_consent', updatedConsent);
    }
  }

  isVolunteerModeEnabled() {
    return this.status.volunteerModeEnabled;
  }

  getVolunteerStatus() {
    if (!this.status.consentGranted) {
      return {
        enabled: false,
        reason: 'permissions_required',
        requiredPermissions: ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT'],
        canRetry: true
      };
    }

    return {
      enabled: this.status.volunteerModeEnabled,
      version: this.status.version
    };
  }

  // Private helper methods
  async getStoredConsent() {
    const stored = await this.storage.getItem('volunteer_consent');
    return stored ? (typeof stored === 'string' ? JSON.parse(stored) : stored) : null;
  }

  generateMinimalFingerprint() {
    // Generate minimal 8-character hash for device identification
    return Math.random().toString(16).substr(2, 8);
  }
}

module.exports = VolunteerConsentService;