/**
 * Frontend Console RBAC Utilities
 * Provides role-based access control for the console interface
 */

import { UserRole, User, Permission, RolePermissions, FieldAccessControl } from '../types';

// Role hierarchy and permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.GUEST]: {
    role: UserRole.GUEST,
    permissions: [],
    clearanceLevel: 'public'
  },
  [UserRole.MEMBER]: {
    role: UserRole.MEMBER,
    permissions: ['read_public_data'],
    clearanceLevel: 'public'
  },
  [UserRole.VERIFIED]: {
    role: UserRole.VERIFIED,
    permissions: ['read_public_data', 'read_restricted_data'],
    clearanceLevel: 'restricted'
  },
  [UserRole.ADMIN]: {
    role: UserRole.ADMIN,
    permissions: ['*'],
    clearanceLevel: 'confidential'
  },
  [UserRole.CASE_WORKER]: {
    role: UserRole.CASE_WORKER,
    permissions: [
      'read_cases',
      'create_cases',
      'update_case_status',
      'assign_cases',
      'read_sensitive_data',
      'access_location_data',
      'view_personal_information'
    ],
    clearanceLevel: 'confidential'
  },
  [UserRole.SOCIAL_WORKER]: {
    role: UserRole.SOCIAL_WORKER,
    permissions: [
      'read_cases',
      'update_case_status',
      'view_basic_metrics',
      'access_anonymized_data'
    ],
    clearanceLevel: 'restricted'
  },
  [UserRole.VOLUNTEER_COORDINATOR]: {
    role: UserRole.VOLUNTEER_COORDINATOR,
    permissions: [
      'read_cases',
      'assign_volunteers',
      'manage_volunteer_assignments',
      'view_volunteer_performance',
      'coordinate_search_efforts'
    ],
    clearanceLevel: 'restricted'
  },
  [UserRole.EXTERNAL_AUDITOR]: {
    role: UserRole.EXTERNAL_AUDITOR,
    permissions: [
      'read_audit_logs',
      'view_anonymized_metrics',
      'access_compliance_data',
      'export_audit_reports'
    ],
    clearanceLevel: 'audit_only'
  },
  [UserRole.FAMILY_MEMBER]: {
    role: UserRole.FAMILY_MEMBER,
    permissions: [
      'read_own_cases',
      'view_case_progress',
      'communicate_with_workers'
    ],
    clearanceLevel: 'restricted'
  },
  [UserRole.CASE_MANAGER]: {
    role: UserRole.CASE_MANAGER,
    permissions: [
      'read_cases',
      'create_cases',
      'update_case_status',
      'assign_cases',
      'read_sensitive_data',
      'access_location_data',
      'view_personal_information',
      'manage_case_workflow',
      'approve_case_closure'
    ],
    clearanceLevel: 'confidential'
  }
};

// Field-level access control configuration
export const FIELD_ACCESS_CONTROLS: FieldAccessControl[] = [
  {
    field: 'personalData.patientName',
    accessLevel: 'confidential',
    allowedRoles: [UserRole.CASE_WORKER, UserRole.CASE_MANAGER],
    reason: 'personal_data_protection'
  },
  {
    field: 'personalData.address',
    accessLevel: 'confidential',
    allowedRoles: [UserRole.CASE_WORKER, UserRole.CASE_MANAGER],
    reason: 'personal_data_protection'
  },
  {
    field: 'personalData.medicalHistory',
    accessLevel: 'confidential',
    allowedRoles: [UserRole.CASE_WORKER, UserRole.CASE_MANAGER],
    reason: 'medical_data_protection'
  },
  {
    field: 'personalData.emergencyContacts',
    accessLevel: 'confidential',
    allowedRoles: [UserRole.CASE_WORKER, UserRole.CASE_MANAGER],
    reason: 'contact_data_protection'
  },
  {
    field: 'locationData',
    accessLevel: 'restricted',
    allowedRoles: [UserRole.CASE_WORKER, UserRole.CASE_MANAGER, UserRole.VOLUNTEER_COORDINATOR],
    reason: 'location_tracking_access'
  },
  {
    field: 'assignedVolunteers',
    accessLevel: 'restricted',
    allowedRoles: [UserRole.CASE_WORKER, UserRole.CASE_MANAGER, UserRole.VOLUNTEER_COORDINATOR],
    reason: 'volunteer_coordinator_volunteer_management'
  }
];

// Workflow state transitions
export const WORKFLOW_TRANSITIONS: Record<string, string[]> = {
  '建立': ['派遣'],
  '派遣': ['執行中', '暫停'],
  '執行中': ['結案', '暫停'],
  '暫停': ['執行中', '結案'],
  '結案': []
};

/**
 * Check if user has specific permission
 */
export const hasPermission = (user: User | null, permission: string): boolean => {
  if (!user || !user.role) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.role];
  if (!rolePermissions) return false;

  // Admin has all permissions
  if (rolePermissions.permissions.includes('*')) return true;

  // Check explicit permissions from role
  if (rolePermissions.permissions.includes(permission)) return true;

  // Check user-specific permissions if available
  if (user.permissions?.includes(permission)) return true;

  return false;
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (user: User | null, permissions: string[]): boolean => {
  return permissions.some(permission => hasPermission(user, permission));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (user: User | null, permissions: string[]): boolean => {
  return permissions.every(permission => hasPermission(user, permission));
};

/**
 * Check field-level access
 */
export const checkFieldAccess = (user: User | null, field: string): {
  hasAccess: boolean;
  reason?: string;
} => {
  if (!user || !user.role) {
    return { hasAccess: false, reason: 'unauthenticated' };
  }

  const fieldControl = FIELD_ACCESS_CONTROLS.find(control => control.field === field);
  if (!fieldControl) {
    // If no specific control, allow based on clearance level
    return { hasAccess: true };
  }

  const userRoles = user.roles || [user.role];
  const hasRoleAccess = fieldControl.allowedRoles.some(role => userRoles.includes(role));

  if (!hasRoleAccess) {
    return {
      hasAccess: false,
      reason: fieldControl.reason || 'insufficient_clearance'
    };
  }

  // Check clearance level
  const userClearance = user.clearanceLevel || ROLE_PERMISSIONS[user.role]?.clearanceLevel || 'public';
  const requiredClearance = fieldControl.accessLevel;

  const clearanceLevels = ['public', 'restricted', 'confidential', 'audit_only'];
  const userLevel = clearanceLevels.indexOf(userClearance);
  const requiredLevel = clearanceLevels.indexOf(requiredClearance);

  if (userLevel < requiredLevel) {
    return {
      hasAccess: false,
      reason: fieldControl.reason || 'insufficient_clearance'
    };
  }

  return { hasAccess: true };
};

/**
 * Filter sensitive data from case object based on user permissions
 */
export const filterCaseData = (user: User | null, caseData: any): any => {
  if (!user || !caseData) return caseData;

  const filtered = { ...caseData };

  // Check each field in personalData
  if (filtered.personalData) {
    const personalData = { ...filtered.personalData };

    Object.keys(personalData).forEach(key => {
      const fieldPath = `personalData.${key}`;
      const access = checkFieldAccess(user, fieldPath);
      if (!access.hasAccess) {
        delete personalData[key];
      }
    });

    filtered.personalData = personalData;
  }

  // Check location data access
  const locationAccess = checkFieldAccess(user, 'locationData');
  if (!locationAccess.hasAccess && filtered.locationData) {
    delete filtered.locationData;
  }

  // Check volunteer assignment access
  const volunteerAccess = checkFieldAccess(user, 'assignedVolunteers');
  if (!volunteerAccess.hasAccess && filtered.assignedVolunteers) {
    delete filtered.assignedVolunteers;
  }

  return filtered;
};

/**
 * Validate workflow state transition
 */
export const validateWorkflowTransition = (fromState: string, toState: string): {
  valid: boolean;
  allowedTransitions: string[];
  violationType?: string;
} => {
  const allowedTransitions = WORKFLOW_TRANSITIONS[fromState] || [];
  const valid = allowedTransitions.includes(toState);

  return {
    valid,
    allowedTransitions,
    violationType: valid ? undefined : 'invalid_transition'
  };
};

/**
 * Check if user can perform workflow transition
 */
export const canPerformTransition = (user: User | null, fromState: string, toState: string): boolean => {
  if (!user) return false;

  // Check basic workflow validation
  const validation = validateWorkflowTransition(fromState, toState);
  if (!validation.valid) return false;

  // Check user permissions for workflow management
  return hasPermission(user, 'manage_case_workflow') ||
         hasPermission(user, 'update_case_status');
};

/**
 * Get user's clearance level
 */
export const getUserClearanceLevel = (user: User | null): string => {
  if (!user || !user.role) return 'public';

  return user.clearanceLevel ||
         ROLE_PERMISSIONS[user.role]?.clearanceLevel ||
         'public';
};

/**
 * Check if user can access KPI drill-down
 */
export const canAccessKPIDrillDown = (user: User | null): boolean => {
  if (!user) return false;

  const authorizedRoles = [
    UserRole.CASE_WORKER,
    UserRole.CASE_MANAGER,
    UserRole.ADMIN
  ];

  const userRoles = user.roles || [user.role];
  return userRoles.some(role => authorizedRoles.includes(role));
};

/**
 * Check if user can export data
 */
export const canExportData = (user: User | null): boolean => {
  if (!user) return false;

  return hasPermission(user, 'export_audit_reports') ||
         hasPermission(user, 'read_sensitive_data');
};

/**
 * Get audit trail access level for user
 */
export const getAuditAccessLevel = (user: User | null): 'none' | 'own' | 'team' | 'full' => {
  if (!user) return 'none';

  if (user.role === UserRole.EXTERNAL_AUDITOR || user.role === UserRole.ADMIN) {
    return 'full';
  }

  if (user.role === UserRole.CASE_MANAGER) {
    return 'team';
  }

  if (user.role === UserRole.CASE_WORKER || user.role === UserRole.SOCIAL_WORKER) {
    return 'own';
  }

  return 'none';
};