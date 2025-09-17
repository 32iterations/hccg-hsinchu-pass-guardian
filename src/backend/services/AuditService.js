/**
 * AuditService - P4 RBAC Console
 *
 * Manages append-only audit logging, watermark generation,
 * and export tracking for compliance and security monitoring.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class AuditService {
  constructor(dependencies) {
    this.storage = dependencies.storage;
    this.database = dependencies.database;
    this.cryptoService = dependencies.cryptoService;

    this.auditTypes = {
      authentication: 'Authentication',
      authorization: 'Authorization',
      data_access: 'Data Access',
      data_modification: 'Data Modification',
      case_management: 'Case Management',
      system_event: 'System Event',
      export_event: 'Export Event',
      security_event: 'Security Event'
    };

    this.logLevel = {
      info: 'INFO',
      warning: 'WARNING',
      error: 'ERROR',
      critical: 'CRITICAL'
    };
  }

  async logEvent(eventData) {
    const logEntry = {
      id: require('crypto').randomUUID(),
      timestamp: new Date().toISOString(),
      type: eventData.type || 'system_event',
      level: eventData.level || 'info',
      userId: eventData.userId,
      action: eventData.action,
      resource: eventData.resource,
      details: eventData.details || {},
      ipAddress: eventData.ipAddress,
      userAgent: eventData.userAgent,
      sessionId: eventData.sessionId,
      result: eventData.result || 'success',
      watermark: await this.generateWatermark(eventData)
    };

    // Append-only storage
    await this.appendToAuditLog(logEntry);

    return logEntry;
  }

  async appendToAuditLog(logEntry) {
    // Store in both database and file storage for redundancy
    if (this.database) {
      const query = `
        INSERT INTO audit_logs (id, timestamp, type, level, user_id, action, resource, details, result, watermark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      await this.database.query(query, [
        logEntry.id,
        logEntry.timestamp,
        logEntry.type,
        logEntry.level,
        logEntry.userId,
        logEntry.action,
        logEntry.resource,
        JSON.stringify(logEntry.details),
        logEntry.result,
        logEntry.watermark
      ]);
    }

    // Also store in append-only file
    await this.storage.setItem(`audit_log_${logEntry.id}`, logEntry);

    // Maintain daily log index
    const dateKey = logEntry.timestamp.split('T')[0];
    await this.addToDateIndex(dateKey, logEntry.id);
  }

  async addToDateIndex(date, logId) {
    const indexKey = `audit_index_${date}`;
    const existingIndex = await this.storage.getItem(indexKey) || [];

    existingIndex.push(logId);
    await this.storage.setItem(indexKey, existingIndex);
  }

  async generateWatermark(eventData) {
    // Create tamper-evident watermark
    const watermarkData = {
      timestamp: eventData.timestamp || new Date().toISOString(),
      userId: eventData.userId,
      action: eventData.action,
      resource: eventData.resource
    };

    const dataString = JSON.stringify(watermarkData);

    if (this.cryptoService && this.cryptoService.sign) {
      return this.cryptoService.sign(dataString);
    }

    // Fallback: simple hash
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  // Authentication Events
  async logLogin(userId, sessionId, ipAddress, userAgent) {
    return await this.logEvent({
      type: 'authentication',
      level: 'info',
      userId,
      action: 'login',
      resource: 'auth_system',
      sessionId,
      ipAddress,
      userAgent,
      details: { loginMethod: 'password' }
    });
  }

  async logLogout(userId, sessionId) {
    return await this.logEvent({
      type: 'authentication',
      level: 'info',
      userId,
      action: 'logout',
      resource: 'auth_system',
      sessionId
    });
  }

  async logFailedLogin(username, ipAddress, reason) {
    return await this.logEvent({
      type: 'authentication',
      level: 'warning',
      userId: username,
      action: 'login_failed',
      resource: 'auth_system',
      ipAddress,
      result: 'failure',
      details: { reason }
    });
  }

  // Authorization Events
  async logAccessAttempt(data) {
    return await this.logEvent({
      type: 'authorization',
      level: data.granted ? 'info' : 'warning',
      userId: data.userId,
      action: 'access_attempt',
      resource: data.resource,
      result: data.granted ? 'success' : 'failure',
      details: {
        requiredPermission: data.requiredPermission,
        granted: data.granted
      }
    });
  }

  async logAccessDenied(data) {
    return await this.logEvent({
      type: 'authorization',
      level: 'warning',
      userId: data.userId,
      action: 'access_denied',
      resource: data.permission,
      result: 'failure',
      details: { reason: data.reason }
    });
  }

  // Role Management Events
  async logRoleAssignment(data) {
    return await this.logEvent({
      type: 'authorization',
      level: 'info',
      userId: data.assignedBy,
      action: 'role_assigned',
      resource: 'user_roles',
      details: {
        targetUserId: data.userId,
        roleName: data.roleName
      }
    });
  }

  async logRoleRevocation(data) {
    return await this.logEvent({
      type: 'authorization',
      level: 'info',
      userId: data.revokedBy,
      action: 'role_revoked',
      resource: 'user_roles',
      details: {
        targetUserId: data.userId,
        roleName: data.roleName,
        reason: data.reason
      }
    });
  }

  async logRoleUpdate(data) {
    return await this.logEvent({
      type: 'authorization',
      level: 'info',
      userId: data.updatedBy,
      action: 'role_updated',
      resource: 'role_permissions',
      details: {
        roleName: data.roleName,
        oldPermissions: data.oldPermissions,
        newPermissions: data.newPermissions
      }
    });
  }

  // Data Access Events
  async logDataAccess(data) {
    return await this.logEvent({
      type: 'data_access',
      level: 'info',
      userId: data.userId,
      action: 'data_read',
      resource: data.dataType,
      details: {
        receiptId: data.receiptId,
        recordCount: data.recordCount
      }
    });
  }

  async logDataExport(data) {
    return await this.logEvent({
      type: 'export_event',
      level: 'info',
      userId: data.userId,
      action: 'data_export',
      resource: data.dataType,
      details: {
        exportFormat: data.format,
        recordCount: data.recordCount,
        fileName: data.fileName,
        exportId: data.exportId
      }
    });
  }

  async logDataRevocation(data) {
    return await this.logEvent({
      type: 'data_modification',
      level: 'info',
      userId: 'system',
      action: 'data_revoked',
      resource: 'user_data',
      details: {
        targetUserId: data.userId,
        revocationId: data.revocationId,
        reason: data.reason,
        status: data.status,
        deletedDataTypes: data.deletedDataTypes,
        totalRecordsDeleted: data.totalRecordsDeleted
      }
    });
  }

  // Case Management Events
  async logCaseCreation(data) {
    return await this.logEvent({
      type: 'case_management',
      level: 'info',
      userId: data.createdBy,
      action: 'case_created',
      resource: 'cases',
      details: {
        caseId: data.caseId,
        priority: data.priority
      }
    });
  }

  async logCaseStatusChange(data) {
    return await this.logEvent({
      type: 'case_management',
      level: 'info',
      userId: data.updatedBy,
      action: 'case_status_changed',
      resource: 'cases',
      details: {
        caseId: data.caseId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        reason: data.reason
      }
    });
  }

  async logCaseDispatch(data) {
    return await this.logEvent({
      type: 'case_management',
      level: 'info',
      userId: data.dispatchedBy,
      action: 'case_dispatched',
      resource: 'cases',
      details: {
        caseId: data.caseId,
        alertRadius: data.alertRadius
      }
    });
  }

  async logCaseClosure(data) {
    return await this.logEvent({
      type: 'case_management',
      level: 'info',
      userId: data.closedBy,
      action: 'case_closed',
      resource: 'cases',
      details: {
        caseId: data.caseId,
        duration: data.duration
      }
    });
  }

  async logCaseCancellation(data) {
    return await this.logEvent({
      type: 'case_management',
      level: 'info',
      userId: data.cancelledBy,
      action: 'case_cancelled',
      resource: 'cases',
      details: {
        caseId: data.caseId
      }
    });
  }

  // System Events
  async logSystemEvent(data) {
    return await this.logEvent({
      type: 'system_event',
      level: data.level || 'info',
      userId: 'system',
      action: data.action,
      resource: data.resource,
      details: data.details
    });
  }

  async logJobStart(data) {
    return await this.logEvent({
      type: 'system_event',
      level: 'info',
      userId: 'system',
      action: 'job_started',
      resource: 'background_jobs',
      details: {
        jobId: data.jobId,
        jobType: data.type,
        dataType: data.dataType
      }
    });
  }

  async logJobComplete(data) {
    return await this.logEvent({
      type: 'system_event',
      level: 'info',
      userId: 'system',
      action: 'job_completed',
      resource: 'background_jobs',
      details: {
        jobId: data.jobId,
        jobType: data.type,
        dataType: data.dataType,
        totalRecordsProcessed: data.totalRecordsDeleted,
        batchesProcessed: data.batchesProcessed
      }
    });
  }

  async logJobError(data) {
    return await this.logEvent({
      type: 'system_event',
      level: 'error',
      userId: 'system',
      action: 'job_failed',
      resource: 'background_jobs',
      result: 'failure',
      details: {
        jobId: data.jobId,
        jobType: data.type,
        dataType: data.dataType,
        error: data.error
      }
    });
  }

  // Security Events
  async logSecurityEvent(data) {
    return await this.logEvent({
      type: 'security_event',
      level: data.level || 'warning',
      userId: data.userId || 'system',
      action: data.action,
      resource: data.resource,
      result: data.result || 'detected',
      details: data.details
    });
  }

  // Query and Export Functions
  async queryAuditLogs(filters = {}, limit = 100, offset = 0) {
    if (this.database) {
      let query = 'SELECT * FROM audit_logs WHERE 1=1';
      const params = [];

      if (filters.userId) {
        params.push(filters.userId);
        query += ` AND user_id = $${params.length}`;
      }

      if (filters.type) {
        params.push(filters.type);
        query += ` AND type = $${params.length}`;
      }

      if (filters.action) {
        params.push(filters.action);
        query += ` AND action = $${params.length}`;
      }

      if (filters.startDate) {
        params.push(filters.startDate);
        query += ` AND timestamp >= $${params.length}`;
      }

      if (filters.endDate) {
        params.push(filters.endDate);
        query += ` AND timestamp <= $${params.length}`;
      }

      query += ' ORDER BY timestamp DESC';

      params.push(limit);
      query += ` LIMIT $${params.length}`;

      params.push(offset);
      query += ` OFFSET $${params.length}`;

      const result = await this.database.query(query, params);
      return result.rows || [];
    }

    return [];
  }

  async exportAuditLogs(filters, format = 'json', requestedBy) {
    const exportId = require('crypto').randomUUID();
    const timestamp = new Date().toISOString();

    const logs = await this.queryAuditLogs(filters, 10000); // Large limit for export

    await this.logDataExport({
      userId: requestedBy,
      dataType: 'audit_logs',
      format,
      recordCount: logs.length,
      fileName: `audit_export_${timestamp}.${format}`,
      exportId
    });

    return {
      exportId,
      data: logs,
      format,
      recordCount: logs.length,
      timestamp
    };
  }

  async verifyWatermark(logEntry) {
    const expectedWatermark = await this.generateWatermark({
      timestamp: logEntry.timestamp,
      userId: logEntry.userId,
      action: logEntry.action,
      resource: logEntry.resource
    });

    return logEntry.watermark === expectedWatermark;
  }

  async getAuditStatistics(dateRange) {
    // Mock implementation
    return {
      totalEvents: 0,
      eventsByType: {},
      eventsByLevel: {},
      userActivity: {},
      dailyCounts: {}
    };
  }

  async archiveOldLogs(olderThanDays = 2555) {
    // Archive logs older than specified days (default 7 years)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    // Mock implementation
    return {
      archived: 0,
      failed: 0
    };
  }
}

module.exports = AuditService;