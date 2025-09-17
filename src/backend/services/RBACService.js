/**
 * RBACService - P4 RBAC Console
 *
 * Manages Role-Based Access Control with roles (Viewer, Operator, Admin),
 * permission matrix, and column visibility control for console access.
 *
 * London School TDD: Mock-driven implementation with minimal contract fulfillment.
 */

class RBACService {
  constructor(dependencies) {
    this.storage = dependencies.storage;
    this.database = dependencies.database;
    this.auditService = dependencies.auditService;

    this.roles = {
      viewer: {
        name: 'Viewer',
        permissions: ['read_cases', 'view_kpis', 'view_basic_info'],
        allowedColumns: ['case_id', 'status', 'created_at', 'priority'],
        restrictions: {
          piiAccess: false,
          exportData: false,
          deleteRecords: false
        }
      },
      operator: {
        name: 'Operator',
        permissions: ['read_cases', 'update_cases', 'create_cases', 'view_kpis', 'dispatch_alerts'],
        allowedColumns: ['case_id', 'status', 'created_at', 'priority', 'assigned_to', 'location_area'],
        restrictions: {
          piiAccess: false,
          exportData: true,
          deleteRecords: false
        }
      },
      admin: {
        name: 'Admin',
        permissions: ['*'], // All permissions
        allowedColumns: ['*'], // All columns
        restrictions: {
          piiAccess: true,
          exportData: true,
          deleteRecords: true
        }
      }
    };

    this.permissions = {
      read_cases: 'View case information',
      create_cases: 'Create new cases',
      update_cases: 'Update existing cases',
      delete_cases: 'Delete cases',
      view_kpis: 'View KPI dashboard',
      export_data: 'Export data',
      manage_users: 'Manage user accounts',
      manage_roles: 'Manage roles and permissions',
      dispatch_alerts: 'Send geo alerts',
      view_audit_logs: 'View audit trail',
      access_admin_panel: 'Access admin panel'
    };

    this.userRoles = new Map();
  }

  async assignRole(userId, roleName, assignedBy) {
    if (!this.roles[roleName]) {
      throw new Error(`Invalid role: ${roleName}`);
    }

    // Check if assigner has permission
    const canAssign = await this.hasPermission(assignedBy, 'manage_roles');
    if (!canAssign) {
      throw new Error('Insufficient permissions to assign roles');
    }

    const assignment = {
      userId,
      roleName,
      assignedBy,
      assignedAt: new Date().toISOString(),
      status: 'active'
    };

    await this.storage.setItem(`user_role_${userId}`, assignment);
    this.userRoles.set(userId, assignment);

    await this.auditService?.logRoleAssignment({
      userId,
      roleName,
      assignedBy,
      timestamp: new Date().toISOString(),
      action: 'role_assigned'
    });

    return assignment;
  }

  async getUserRole(userId) {
    // Check cache first
    if (this.userRoles.has(userId)) {
      return this.userRoles.get(userId);
    }

    // Check storage
    const assignment = await this.storage.getItem(`user_role_${userId}`);
    if (assignment && assignment.status === 'active') {
      this.userRoles.set(userId, assignment);
      return assignment;
    }

    return null;
  }

  async hasPermission(userId, permission) {
    const roleAssignment = await this.getUserRole(userId);
    if (!roleAssignment) {
      return false;
    }

    const role = this.roles[roleAssignment.roleName];
    if (!role) {
      return false;
    }

    // Admin has all permissions
    if (role.permissions.includes('*')) {
      return true;
    }

    return role.permissions.includes(permission);
  }

  async hasAnyPermission(userId, permissions) {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  async checkPermission(userId, permission) {
    const hasPermission = await this.hasPermission(userId, permission);

    if (!hasPermission) {
      await this.auditService?.logAccessDenied({
        userId,
        permission,
        timestamp: new Date().toISOString(),
        reason: 'insufficient_permissions'
      });

      throw new Error(`Access denied: requires ${permission} permission`);
    }

    return true;
  }

  async getVisibleColumns(userId, dataType) {
    const roleAssignment = await this.getUserRole(userId);
    if (!roleAssignment) {
      return [];
    }

    const role = this.roles[roleAssignment.roleName];
    if (!role) {
      return [];
    }

    // Admin sees all columns
    if (role.allowedColumns.includes('*')) {
      return this.getAllColumnsForDataType(dataType);
    }

    return role.allowedColumns;
  }

  getAllColumnsForDataType(dataType) {
    const columnMap = {
      cases: ['case_id', 'status', 'created_at', 'updated_at', 'priority', 'assigned_to', 'location_area', 'description'],
      kpis: ['metric_name', 'value', 'timestamp', 'category'],
      audit_logs: ['log_id', 'user_id', 'action', 'timestamp', 'resource', 'result'],
      users: ['user_id', 'username', 'role', 'last_login', 'status']
    };

    return columnMap[dataType] || [];
  }

  async filterDataByPermissions(userId, data, dataType) {
    const visibleColumns = await this.getVisibleColumns(userId, dataType);
    const roleAssignment = await this.getUserRole(userId);

    if (!roleAssignment) {
      return [];
    }

    const role = this.roles[roleAssignment.roleName];

    return data.map(record => {
      const filteredRecord = {};

      // Filter columns
      for (const column of visibleColumns) {
        if (record.hasOwnProperty(column)) {
          filteredRecord[column] = record[column];
        }
      }

      // Apply PII restrictions
      if (!role.restrictions.piiAccess) {
        // Remove or mask PII fields
        delete filteredRecord.personal_info;
        delete filteredRecord.contact_details;
        delete filteredRecord.sensitive_data;

        // Mask partial IDs
        if (filteredRecord.case_id) {
          filteredRecord.case_id = this.maskSensitiveId(filteredRecord.case_id);
        }
      }

      return filteredRecord;
    });
  }

  maskSensitiveId(id) {
    // Mask middle portion of ID
    if (id.length > 8) {
      return id.substr(0, 4) + '****' + id.substr(-4);
    }
    return id;
  }

  async canExportData(userId) {
    const roleAssignment = await this.getUserRole(userId);
    if (!roleAssignment) {
      return false;
    }

    const role = this.roles[roleAssignment.roleName];
    return role.restrictions.exportData === true;
  }

  async canDeleteRecords(userId) {
    const roleAssignment = await this.getUserRole(userId);
    if (!roleAssignment) {
      return false;
    }

    const role = this.roles[roleAssignment.roleName];
    return role.restrictions.deleteRecords === true;
  }

  async revokeRole(userId, revokedBy, reason) {
    const canRevoke = await this.hasPermission(revokedBy, 'manage_roles');
    if (!canRevoke) {
      throw new Error('Insufficient permissions to revoke roles');
    }

    const assignment = await this.getUserRole(userId);
    if (assignment) {
      assignment.status = 'revoked';
      assignment.revokedBy = revokedBy;
      assignment.revokedAt = new Date().toISOString();
      assignment.revocationReason = reason;

      await this.storage.setItem(`user_role_${userId}`, assignment);
      this.userRoles.delete(userId);

      await this.auditService?.logRoleRevocation({
        userId,
        roleName: assignment.roleName,
        revokedBy,
        reason,
        timestamp: new Date().toISOString(),
        action: 'role_revoked'
      });
    }

    return true;
  }

  async getRoleMatrix() {
    const matrix = {};

    for (const [roleName, role] of Object.entries(this.roles)) {
      matrix[roleName] = {
        name: role.name,
        permissions: role.permissions,
        restrictions: role.restrictions,
        allowedColumns: role.allowedColumns
      };
    }

    return matrix;
  }

  async getUsersByRole(roleName) {
    // Mock implementation - in real scenario would query database
    if (this.database) {
      const query = `SELECT user_id, assigned_at FROM user_roles WHERE role_name = $1 AND status = 'active'`;
      const result = await this.database.query(query, [roleName]);
      return result.rows || [];
    }

    return [];
  }

  async updateRolePermissions(roleName, permissions, updatedBy) {
    const canUpdate = await this.hasPermission(updatedBy, 'manage_roles');
    if (!canUpdate) {
      throw new Error('Insufficient permissions to update roles');
    }

    if (!this.roles[roleName]) {
      throw new Error(`Role ${roleName} does not exist`);
    }

    const oldPermissions = [...this.roles[roleName].permissions];
    this.roles[roleName].permissions = permissions;

    await this.auditService?.logRoleUpdate({
      roleName,
      oldPermissions,
      newPermissions: permissions,
      updatedBy,
      timestamp: new Date().toISOString(),
      action: 'role_permissions_updated'
    });

    return this.roles[roleName];
  }

  async validateAccess(userId, resource, action) {
    const requiredPermission = this.getRequiredPermission(resource, action);

    if (!requiredPermission) {
      return true; // No permission required
    }

    const hasAccess = await this.hasPermission(userId, requiredPermission);

    await this.auditService?.logAccessAttempt({
      userId,
      resource,
      action,
      requiredPermission,
      granted: hasAccess,
      timestamp: new Date().toISOString()
    });

    return hasAccess;
  }

  getRequiredPermission(resource, action) {
    const permissionMap = {
      'cases': {
        'read': 'read_cases',
        'create': 'create_cases',
        'update': 'update_cases',
        'delete': 'delete_cases'
      },
      'kpis': {
        'read': 'view_kpis'
      },
      'alerts': {
        'dispatch': 'dispatch_alerts'
      },
      'users': {
        'manage': 'manage_users'
      },
      'admin': {
        'access': 'access_admin_panel'
      }
    };

    return permissionMap[resource]?.[action];
  }

  async createSession(userId, sessionData) {
    const roleAssignment = await this.getUserRole(userId);

    const session = {
      sessionId: require('crypto').randomUUID(),
      userId,
      role: roleAssignment?.roleName,
      permissions: roleAssignment ? this.roles[roleAssignment.roleName]?.permissions : [],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ...sessionData
    };

    await this.storage.setItem(`session_${session.sessionId}`, session);

    return session;
  }

  async validateSession(sessionId) {
    const session = await this.storage.getItem(`session_${sessionId}`);

    if (!session) {
      return null;
    }

    // Check session expiry (24 hours)
    const sessionAge = new Date() - new Date(session.createdAt);
    if (sessionAge > 24 * 60 * 60 * 1000) {
      await this.storage.removeItem(`session_${sessionId}`);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    await this.storage.setItem(`session_${sessionId}`, session);

    return session;
  }

  async invalidateSession(sessionId) {
    await this.storage.removeItem(`session_${sessionId}`);
    return true;
  }
}

module.exports = RBACService;