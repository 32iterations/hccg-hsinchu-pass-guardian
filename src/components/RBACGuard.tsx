/**
 * RBAC Guard Component
 * Provides role-based access control for React components
 */

import React from 'react';
import { useRBAC } from '../hooks/useRBAC';
import { UserRole } from '../types';

interface RBACGuardProps {
  children: React.ReactNode;

  // Permission-based access
  permission?: string;
  permissions?: string[];
  requireAll?: boolean; // If true, requires ALL permissions; if false, requires ANY

  // Role-based access
  roles?: UserRole[];

  // Field-level access
  field?: string;

  // Clearance level
  clearanceLevel?: 'public' | 'restricted' | 'confidential' | 'audit_only';

  // Fallback components
  fallback?: React.ReactNode;
  unauthorized?: React.ReactNode;

  // Custom validation function
  customValidation?: (rbac: ReturnType<typeof useRBAC>) => boolean;

  // Props to pass additional context
  onAccessDenied?: (reason: string) => void;
}

export const RBACGuard: React.FC<RBACGuardProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  roles,
  field,
  clearanceLevel,
  fallback = null,
  unauthorized,
  customValidation,
  onAccessDenied
}) => {
  const rbac = useRBAC();

  // Check authentication
  if (!rbac.isAuthenticated) {
    onAccessDenied?.('not_authenticated');
    return unauthorized || fallback || null;
  }

  // Check single permission
  if (permission && !rbac.hasPermission(permission)) {
    onAccessDenied?.(`missing_permission_${permission}`);
    return unauthorized || fallback || null;
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    const hasAccess = requireAll
      ? rbac.hasAllPermissions(permissions)
      : rbac.hasAnyPermission(permissions);

    if (!hasAccess) {
      onAccessDenied?.(`missing_permissions_${permissions.join(',')}`);
      return unauthorized || fallback || null;
    }
  }

  // Check roles
  if (roles && roles.length > 0) {
    const hasRole = roles.some(role => rbac.userRoles.includes(role));
    if (!hasRole) {
      onAccessDenied?.(`missing_role_${roles.join(',')}`);
      return unauthorized || fallback || null;
    }
  }

  // Check field access
  if (field) {
    const fieldAccess = rbac.checkFieldAccess(field);
    if (!fieldAccess.hasAccess) {
      onAccessDenied?.(`field_access_denied_${fieldAccess.reason}`);
      return unauthorized || fallback || null;
    }
  }

  // Check clearance level
  if (clearanceLevel) {
    const clearanceLevels = ['public', 'restricted', 'confidential', 'audit_only'];
    const userLevel = clearanceLevels.indexOf(rbac.clearanceLevel);
    const requiredLevel = clearanceLevels.indexOf(clearanceLevel);

    if (userLevel < requiredLevel) {
      onAccessDenied?.(`insufficient_clearance_${clearanceLevel}`);
      return unauthorized || fallback || null;
    }
  }

  // Custom validation
  if (customValidation && !customValidation(rbac)) {
    onAccessDenied?.('custom_validation_failed');
    return unauthorized || fallback || null;
  }

  return <>{children}</>;
};

// Convenience components for common use cases

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback
}) => (
  <RBACGuard permission={permission} fallback={fallback}>
    {children}
  </RBACGuard>
);

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  roles,
  children,
  fallback
}) => (
  <RBACGuard roles={roles} fallback={fallback}>
    {children}
  </RBACGuard>
);

interface ClearanceGuardProps {
  level: 'public' | 'restricted' | 'confidential' | 'audit_only';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ClearanceGuard: React.FC<ClearanceGuardProps> = ({
  level,
  children,
  fallback
}) => (
  <RBACGuard clearanceLevel={level} fallback={fallback}>
    {children}
  </RBACGuard>
);

// Higher-order component for RBAC protection
export interface WithRBACOptions {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  roles?: UserRole[];
  clearanceLevel?: 'public' | 'restricted' | 'confidential' | 'audit_only';
  customValidation?: (rbac: ReturnType<typeof useRBAC>) => boolean;
  fallback?: React.ComponentType;
  unauthorized?: React.ComponentType;
}

export function withRBAC<P extends object>(
  Component: React.ComponentType<P>,
  options: WithRBACOptions
) {
  return function RBACWrappedComponent(props: P) {
    const {
      permission,
      permissions,
      requireAll,
      roles,
      clearanceLevel,
      customValidation,
      fallback: FallbackComponent,
      unauthorized: UnauthorizedComponent
    } = options;

    return (
      <RBACGuard
        permission={permission}
        permissions={permissions}
        requireAll={requireAll}
        roles={roles}
        clearanceLevel={clearanceLevel}
        customValidation={customValidation}
        fallback={FallbackComponent ? <FallbackComponent /> : undefined}
        unauthorized={UnauthorizedComponent ? <UnauthorizedComponent /> : undefined}
      >
        <Component {...props} />
      </RBACGuard>
    );
  };
}