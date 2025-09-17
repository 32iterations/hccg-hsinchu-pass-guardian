/**
 * RevocationService - P3 MyData Integration
 *
 * Handles immediate data deletion on request, returns 410 Gone status,
 * and maintains audit trail for revocation events.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class RevocationService {
  constructor(dependencies) {
    this.storage = dependencies.storage;
    this.database = dependencies.database;
    this.auditService = dependencies.auditService;
    this.myDataAdapter = dependencies.myDataAdapter;
    this.retentionService = dependencies.retentionService;

    this.revocationStatuses = new Map();
  }

  async revokeUserData(userId, reason = 'user_request') {
    const revocationId = require('crypto').randomUUID();
    const timestamp = new Date().toISOString();

    // Create revocation record first
    const revocation = {
      id: revocationId,
      userId,
      reason,
      timestamp,
      status: 'in_progress',
      deletedDataTypes: [],
      preservedAuditIds: []
    };

    await this.storage.setItem(`revocation_${revocationId}`, revocation);

    try {
      // 1. Revoke MyData authorization
      if (this.myDataAdapter) {
        await this.myDataAdapter.revokeAuthorization(userId);
        revocation.deletedDataTypes.push('mydata_authorization');
      }

      // 2. Delete user data across all systems
      const deletionResults = await this.deleteUserDataCompletely(userId);
      revocation.deletedDataTypes.push(...deletionResults.deletedTypes);

      // 3. Preserve audit trail
      const auditIds = await this.preserveRevocationAudit(userId, revocationId);
      revocation.preservedAuditIds = auditIds;

      // 4. Mark user as revoked (410 Gone)
      await this.markUserAsRevoked(userId, revocationId);

      // 5. Complete revocation
      revocation.status = 'completed';
      revocation.completedAt = new Date().toISOString();
      revocation.totalRecordsDeleted = deletionResults.totalRecords;

      await this.storage.setItem(`revocation_${revocationId}`, revocation);

      // Store revocation status for 410 responses
      this.revocationStatuses.set(userId, {
        revokedAt: timestamp,
        revocationId,
        status: 'revoked'
      });

      await this.auditService?.logDataRevocation({
        userId,
        revocationId,
        reason,
        timestamp,
        status: 'completed',
        deletedDataTypes: revocation.deletedDataTypes,
        totalRecordsDeleted: deletionResults.totalRecords
      });

      return {
        success: true,
        revocationId,
        deletedDataTypes: revocation.deletedDataTypes,
        totalRecordsDeleted: deletionResults.totalRecords,
        timestamp
      };

    } catch (error) {
      revocation.status = 'failed';
      revocation.error = error.message;
      revocation.failedAt = new Date().toISOString();

      await this.storage.setItem(`revocation_${revocationId}`, revocation);

      await this.auditService?.logDataRevocation({
        userId,
        revocationId,
        reason,
        timestamp,
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  async deleteUserDataCompletely(userId) {
    const deletedTypes = [];
    let totalRecords = 0;

    // Define all data types to delete
    const dataTypes = [
      'user_profiles',
      'volunteer_consents',
      'mydata_tokens',
      'mydata_receipts',
      'volunteer_hits',
      'geo_alert_preferences',
      'location_history',
      'device_bindings',
      'push_tokens',
      'user_sessions',
      'user_preferences'
    ];

    for (const dataType of dataTypes) {
      try {
        const deleted = await this.deleteDataType(userId, dataType);
        if (deleted > 0) {
          deletedTypes.push(dataType);
          totalRecords += deleted;
        }
      } catch (error) {
        // Log but continue with other deletions
        await this.auditService?.logDeletionError({
          userId,
          dataType,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return {
      deletedTypes,
      totalRecords
    };
  }

  async deleteDataType(userId, dataType) {
    let deletedCount = 0;

    if (this.database) {
      // Database deletion
      const query = `DELETE FROM ${dataType} WHERE user_id = $1`;
      const result = await this.database.query(query, [userId]);
      deletedCount += result.rowCount || 0;
    }

    // Storage deletion
    const storageKeys = await this.findStorageKeys(userId, dataType);
    for (const key of storageKeys) {
      await this.storage.removeItem(key);
      deletedCount++;
    }

    return deletedCount;
  }

  async findStorageKeys(userId, dataType) {
    // Mock implementation - in real scenario would scan storage
    const possibleKeys = [
      `${dataType}_${userId}`,
      `user_${userId}_${dataType}`,
      `${userId}_${dataType}`,
      `mydata_tokens_${userId}`,
      `volunteer_consent_${userId}`,
      `oauth_state_${userId}`
    ];

    const existingKeys = [];
    for (const key of possibleKeys) {
      const exists = await this.storage.getItem(key);
      if (exists) {
        existingKeys.push(key);
      }
    }

    return existingKeys;
  }

  async preserveRevocationAudit(userId, revocationId) {
    // Find all audit records for this user
    const auditRecords = await this.findUserAuditRecords(userId);

    const preservedIds = [];
    for (const record of auditRecords) {
      const preservedRecord = {
        originalId: record.id,
        revocationId,
        userId: 'REVOKED', // Anonymize user ID
        timestamp: record.timestamp,
        action: record.action,
        dataType: record.dataType,
        preservedAt: new Date().toISOString(),
        reason: 'legal_compliance'
      };

      const preservedId = `audit_preserved_${require('crypto').randomUUID()}`;
      await this.storage.setItem(preservedId, preservedRecord);
      preservedIds.push(preservedId);
    }

    return preservedIds;
  }

  async findUserAuditRecords(userId) {
    // Mock implementation
    if (this.database) {
      const query = `SELECT * FROM audit_logs WHERE user_id = $1`;
      const result = await this.database.query(query, [userId]);
      return result.rows || [];
    }

    return [];
  }

  async markUserAsRevoked(userId, revocationId) {
    const revokedMarker = {
      userId,
      revocationId,
      revokedAt: new Date().toISOString(),
      status: 'revoked',
      message: 'User data has been deleted at user request'
    };

    await this.storage.setItem(`user_revoked_${userId}`, revokedMarker);
    await this.storage.setItem(`revocation_marker_${revocationId}`, revokedMarker);
  }

  async checkRevocationStatus(userId) {
    // Check in-memory cache first
    if (this.revocationStatuses.has(userId)) {
      return this.revocationStatuses.get(userId);
    }

    // Check storage
    const revokedMarker = await this.storage.getItem(`user_revoked_${userId}`);
    if (revokedMarker) {
      this.revocationStatuses.set(userId, {
        revokedAt: revokedMarker.revokedAt,
        revocationId: revokedMarker.revocationId,
        status: 'revoked'
      });

      return this.revocationStatuses.get(userId);
    }

    return null;
  }

  async handleRevokedUserRequest(userId) {
    const revocationStatus = await this.checkRevocationStatus(userId);

    if (revocationStatus) {
      return {
        statusCode: 410,
        error: 'Gone',
        message: 'User data has been permanently deleted',
        revokedAt: revocationStatus.revokedAt,
        revocationId: revocationStatus.revocationId
      };
    }

    return null;
  }

  async getRevocationRecord(revocationId) {
    return await this.storage.getItem(`revocation_${revocationId}`);
  }

  async listRevocations(limit = 100, offset = 0) {
    // Mock implementation - in real scenario would query storage/database
    return {
      revocations: [],
      total: 0,
      limit,
      offset
    };
  }

  async validateRevocationRequest(userId, requestDetails) {
    // Validate that the request is legitimate
    const validationChecks = {
      userExists: await this.userExists(userId),
      notAlreadyRevoked: !(await this.checkRevocationStatus(userId)),
      hasRequiredConsent: requestDetails.consentGiven === true,
      reasonProvided: !!requestDetails.reason
    };

    const isValid = Object.values(validationChecks).every(check => check === true);

    return {
      isValid,
      checks: validationChecks,
      message: isValid ? 'Request valid' : 'Request validation failed'
    };
  }

  async userExists(userId) {
    // Check if user exists in any system
    const userProfile = await this.storage.getItem(`user_profile_${userId}`);
    return !!userProfile;
  }

  async scheduleDelayedDeletion(userId, delayDays = 30) {
    // Some jurisdictions require a grace period
    const scheduledDeletion = {
      userId,
      scheduledFor: new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'grace_period',
      status: 'scheduled'
    };

    await this.storage.setItem(`scheduled_deletion_${userId}`, scheduledDeletion);

    return scheduledDeletion;
  }

  async cancelScheduledDeletion(userId) {
    await this.storage.removeItem(`scheduled_deletion_${userId}`);

    await this.auditService?.logDeletionCancellation({
      userId,
      timestamp: new Date().toISOString(),
      reason: 'user_cancelled'
    });

    return true;
  }

  async processScheduledDeletions() {
    // This would be called by a scheduled job
    const now = new Date();

    // Mock implementation - would scan for scheduled deletions
    return {
      processed: 0,
      failed: 0
    };
  }

  async generateRevocationCertificate(revocationId) {
    const revocation = await this.getRevocationRecord(revocationId);
    if (!revocation) {
      throw new Error('Revocation record not found');
    }

    const certificate = {
      revocationId,
      userId: 'REDACTED',
      timestamp: revocation.timestamp,
      deletedDataTypes: revocation.deletedDataTypes,
      totalRecordsDeleted: revocation.totalRecordsDeleted,
      certificateId: require('crypto').randomUUID(),
      issuedAt: new Date().toISOString(),
      issuer: 'HsinchuPass Guardian System'
    };

    await this.storage.setItem(`revocation_certificate_${certificate.certificateId}`, certificate);

    return certificate;
  }
}

module.exports = RevocationService;