/**
 * CaseFlowService - P4 RBAC Console
 *
 * Manages case lifecycle: Create → Dispatch → Close with state transitions
 * and data cleanup on closure for missing person cases.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class CaseFlowService {
  constructor(dependencies) {
    this.storage = dependencies.storage;
    this.database = dependencies.database;
    this.auditService = dependencies.auditService;
    this.geoAlertService = dependencies.geoAlertService;
    this.rbacService = dependencies.rbacService;

    this.caseStates = {
      created: 'Created',
      assigned: 'Assigned',
      dispatched: 'Dispatched',
      in_progress: 'In Progress',
      resolved: 'Resolved',
      closed: 'Closed',
      cancelled: 'Cancelled'
    };

    this.validTransitions = {
      created: ['assigned', 'cancelled'],
      assigned: ['dispatched', 'cancelled'],
      dispatched: ['in_progress', 'resolved', 'cancelled'],
      in_progress: ['resolved', 'cancelled'],
      resolved: ['closed'],
      closed: [],
      cancelled: []
    };
  }

  async createCase(caseData, createdBy) {
    // Check permissions
    await this.rbacService?.checkPermission(createdBy, 'create_cases');

    const caseId = this.generateCaseId();
    const timestamp = new Date().toISOString();

    const newCase = {
      id: caseId,
      status: 'created',
      priority: caseData.priority || 'medium',
      createdBy,
      createdAt: timestamp,
      updatedAt: timestamp,
      title: caseData.title,
      description: caseData.description,
      location: {
        area: caseData.location?.area,
        coordinates: caseData.location?.coordinates,
        radius: caseData.location?.radius || 1000
      },
      alertConfig: {
        enabled: false,
        radiusMeters: caseData.location?.radius || 1000,
        priority: 'warning'
      },
      metadata: {
        caseType: 'missing_person',
        urgencyLevel: caseData.urgencyLevel || 'standard',
        estimatedDuration: caseData.estimatedDuration
      }
    };

    await this.storage.setItem(`case_${caseId}`, newCase);

    await this.auditService?.logCaseCreation({
      caseId,
      createdBy,
      status: 'created',
      timestamp,
      priority: newCase.priority
    });

    return newCase;
  }

  async updateCaseStatus(caseId, newStatus, updatedBy, reason) {
    // Check permissions
    await this.rbacService?.checkPermission(updatedBy, 'update_cases');

    const existingCase = await this.getCase(caseId);
    if (!existingCase) {
      throw new Error(`Case ${caseId} not found`);
    }

    // Validate state transition
    if (!this.isValidTransition(existingCase.status, newStatus)) {
      throw new Error(`Invalid transition from ${existingCase.status} to ${newStatus}`);
    }

    const timestamp = new Date().toISOString();
    const previousStatus = existingCase.status;

    existingCase.status = newStatus;
    existingCase.updatedAt = timestamp;
    existingCase.updatedBy = updatedBy;

    // Add state transition record
    if (!existingCase.stateHistory) {
      existingCase.stateHistory = [];
    }

    existingCase.stateHistory.push({
      fromStatus: previousStatus,
      toStatus: newStatus,
      timestamp,
      updatedBy,
      reason
    });

    // Handle status-specific logic
    await this.handleStatusChange(existingCase, newStatus, updatedBy);

    await this.storage.setItem(`case_${caseId}`, existingCase);

    await this.auditService?.logCaseStatusChange({
      caseId,
      fromStatus: previousStatus,
      toStatus: newStatus,
      updatedBy,
      reason,
      timestamp
    });

    return existingCase;
  }

  async handleStatusChange(caseData, newStatus, updatedBy) {
    switch (newStatus) {
      case 'dispatched':
        await this.handleDispatch(caseData, updatedBy);
        break;

      case 'closed':
        await this.handleClosure(caseData, updatedBy);
        break;

      case 'cancelled':
        await this.handleCancellation(caseData, updatedBy);
        break;
    }
  }

  async handleDispatch(caseData, dispatchedBy) {
    // Check dispatch permissions
    await this.rbacService?.checkPermission(dispatchedBy, 'dispatch_alerts');

    // Enable geo alerts
    caseData.alertConfig.enabled = true;
    caseData.alertConfig.dispatchedBy = dispatchedBy;
    caseData.alertConfig.dispatchedAt = new Date().toISOString();

    // Create geo alert
    if (this.geoAlertService) {
      const alert = {
        caseId: caseData.id,
        center: caseData.location.coordinates,
        radius: caseData.alertConfig.radiusMeters,
        priority: caseData.alertConfig.priority,
        message: this.generateAlertMessage(caseData)
      };

      await this.geoAlertService.sendAlert(alert);
    }

    await this.auditService?.logCaseDispatch({
      caseId: caseData.id,
      dispatchedBy,
      alertRadius: caseData.alertConfig.radiusMeters,
      timestamp: new Date().toISOString()
    });
  }

  async handleClosure(caseData, closedBy) {
    caseData.closedBy = closedBy;
    caseData.closedAt = new Date().toISOString();

    // Disable geo alerts
    caseData.alertConfig.enabled = false;

    // Schedule data cleanup
    await this.scheduleDataCleanup(caseData.id);

    await this.auditService?.logCaseClosure({
      caseId: caseData.id,
      closedBy,
      duration: this.calculateCaseDuration(caseData),
      timestamp: new Date().toISOString()
    });
  }

  async handleCancellation(caseData, cancelledBy) {
    caseData.cancelledBy = cancelledBy;
    caseData.cancelledAt = new Date().toISOString();

    // Disable geo alerts
    caseData.alertConfig.enabled = false;

    // Immediate cleanup for cancelled cases
    await this.cleanupCaseData(caseData.id, 'immediate');

    await this.auditService?.logCaseCancellation({
      caseId: caseData.id,
      cancelledBy,
      timestamp: new Date().toISOString()
    });
  }

  async assignCase(caseId, assigneeId, assignedBy) {
    await this.rbacService?.checkPermission(assignedBy, 'update_cases');

    const caseData = await this.getCase(caseId);
    if (!caseData) {
      throw new Error(`Case ${caseId} not found`);
    }

    caseData.assignedTo = assigneeId;
    caseData.assignedBy = assignedBy;
    caseData.assignedAt = new Date().toISOString();

    await this.updateCaseStatus(caseId, 'assigned', assignedBy, `Assigned to ${assigneeId}`);

    return caseData;
  }

  async getCase(caseId) {
    return await this.storage.getItem(`case_${caseId}`);
  }

  async getCases(filters = {}, userId) {
    // Check permissions
    await this.rbacService?.checkPermission(userId, 'read_cases');

    // Mock implementation - in real scenario would query database
    let cases = [];

    if (this.database) {
      let query = 'SELECT * FROM cases WHERE 1=1';
      const params = [];

      if (filters.status) {
        params.push(filters.status);
        query += ` AND status = $${params.length}`;
      }

      if (filters.assignedTo) {
        params.push(filters.assignedTo);
        query += ` AND assigned_to = $${params.length}`;
      }

      if (filters.priority) {
        params.push(filters.priority);
        query += ` AND priority = $${params.length}`;
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        params.push(filters.limit);
        query += ` LIMIT $${params.length}`;
      }

      const result = await this.database.query(query, params);
      cases = result.rows || [];
    }

    // Apply RBAC filtering
    return await this.rbacService?.filterDataByPermissions(userId, cases, 'cases') || cases;
  }

  async scheduleDataCleanup(caseId, delay = 30) {
    // Schedule cleanup after 30 days by default
    const cleanupDate = new Date();
    cleanupDate.setDate(cleanupDate.getDate() + delay);

    const cleanupJob = {
      caseId,
      scheduledFor: cleanupDate.toISOString(),
      type: 'case_data_cleanup',
      status: 'scheduled'
    };

    await this.storage.setItem(`cleanup_job_${caseId}`, cleanupJob);

    return cleanupJob;
  }

  async cleanupCaseData(caseId, mode = 'scheduled') {
    const caseData = await this.getCase(caseId);
    if (!caseData) {
      return false;
    }

    // Preserve audit trail
    await this.auditService?.logDataCleanup({
      caseId,
      mode,
      timestamp: new Date().toISOString(),
      action: 'case_data_cleanup_start'
    });

    // Clean up associated data
    const cleanupResults = {
      geoAlerts: 0,
      notifications: 0,
      temporaryData: 0
    };

    // Remove geo alerts
    if (caseData.alertConfig?.enabled) {
      cleanupResults.geoAlerts = await this.cleanupGeoAlerts(caseId);
    }

    // Clean up temporary data but preserve case record
    await this.storage.removeItem(`temp_data_${caseId}`);
    await this.storage.removeItem(`notification_queue_${caseId}`);

    // Mark case as cleaned
    caseData.dataCleanedAt = new Date().toISOString();
    caseData.cleanupMode = mode;
    await this.storage.setItem(`case_${caseId}`, caseData);

    await this.auditService?.logDataCleanup({
      caseId,
      mode,
      timestamp: new Date().toISOString(),
      action: 'case_data_cleanup_complete',
      results: cleanupResults
    });

    return cleanupResults;
  }

  async cleanupGeoAlerts(caseId) {
    // Mock cleanup of geo alerts for this case
    return 1;
  }

  isValidTransition(fromStatus, toStatus) {
    return this.validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  generateCaseId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 4);
    return `CASE-${timestamp}-${random}`.toUpperCase();
  }

  generateAlertMessage(caseData) {
    // Generic safety message - no PII
    return '安全提醒：此區域有走失個案，請留意周遭。如發現需協助者，請撥打110。切勿自行接近。';
  }

  calculateCaseDuration(caseData) {
    const start = new Date(caseData.createdAt);
    const end = new Date(caseData.closedAt || new Date());
    return Math.round((end - start) / (1000 * 60 * 60)); // Hours
  }

  async getCaseStatistics(userId) {
    await this.rbacService?.checkPermission(userId, 'view_kpis');

    // Mock statistics
    return {
      total: 0,
      byStatus: {
        created: 0,
        assigned: 0,
        dispatched: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        cancelled: 0
      },
      averageDuration: 0,
      resolutionRate: 0
    };
  }

  async getWorkflow() {
    return {
      states: this.caseStates,
      transitions: this.validTransitions
    };
  }

  async validateCaseData(caseData) {
    const required = ['title', 'description', 'location'];
    const missing = required.filter(field => !caseData[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    if (caseData.location && !caseData.location.area) {
      throw new Error('Location area is required');
    }

    return true;
  }

  async processScheduledCleanups() {
    // This would be called by a scheduled job
    const now = new Date();

    // Mock implementation
    return {
      processed: 0,
      failed: 0
    };
  }
}

module.exports = CaseFlowService;