/**
 * Audit Log Service - Simple version for CaseFlow tests
 * TDD GREEN phase - minimal implementation
 */

class AuditLogService {
  constructor() {
    this.logs = [];
  }

  async log(auditData) {
    const logEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: auditData.timestamp || new Date(),
      ...auditData
    };
    this.logs.push(logEntry);
    return logEntry;
  }
}

module.exports = AuditLogService;