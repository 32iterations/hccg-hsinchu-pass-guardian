/**
 * RBAC Hook for Console Interface
 * Provides role-based access control functionality for React components
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  checkFieldAccess,
  filterCaseData,
  validateWorkflowTransition,
  canPerformTransition,
  getUserClearanceLevel,
  canAccessKPIDrillDown,
  canExportData,
  getAuditAccessLevel
} from '../utils/rbac';
import { User, UserRole } from '../types';

export interface RBACContext {
  // Permission checks
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;

  // Field access
  checkFieldAccess: (field: string) => { hasAccess: boolean; reason?: string };
  filterCaseData: (caseData: any) => any;

  // Workflow
  validateWorkflowTransition: (fromState: string, toState: string) => {
    valid: boolean;
    allowedTransitions: string[];
    violationType?: string;
  };
  canPerformTransition: (fromState: string, toState: string) => boolean;

  // User info
  clearanceLevel: string;
  isAuthenticated: boolean;
  userRoles: UserRole[];

  // Feature access
  canAccessKPIDrillDown: boolean;
  canExportData: boolean;
  auditAccessLevel: 'none' | 'own' | 'team' | 'full';

  // Role checks
  isCaseWorker: boolean;
  isSocialWorker: boolean;
  isVolunteerCoordinator: boolean;
  isExternalAuditor: boolean;
  isFamilyMember: boolean;
  isCaseManager: boolean;
  isAdmin: boolean;
}

export const useRBAC = (): RBACContext => {
  const { user } = useAuth();

  const rbacContext = useMemo(() => {
    const userRoles = user?.roles || (user?.role ? [user.role] : []);

    return {
      // Permission checks
      hasPermission: (permission: string) => hasPermission(user, permission),
      hasAnyPermission: (permissions: string[]) => hasAnyPermission(user, permissions),
      hasAllPermissions: (permissions: string[]) => hasAllPermissions(user, permissions),

      // Field access
      checkFieldAccess: (field: string) => checkFieldAccess(user, field),
      filterCaseData: (caseData: any) => filterCaseData(user, caseData),

      // Workflow
      validateWorkflowTransition,
      canPerformTransition: (fromState: string, toState: string) =>
        canPerformTransition(user, fromState, toState),

      // User info
      clearanceLevel: getUserClearanceLevel(user),
      isAuthenticated: !!user,
      userRoles,

      // Feature access
      canAccessKPIDrillDown: canAccessKPIDrillDown(user),
      canExportData: canExportData(user),
      auditAccessLevel: getAuditAccessLevel(user),

      // Role checks
      isCaseWorker: userRoles.includes(UserRole.CASE_WORKER),
      isSocialWorker: userRoles.includes(UserRole.SOCIAL_WORKER),
      isVolunteerCoordinator: userRoles.includes(UserRole.VOLUNTEER_COORDINATOR),
      isExternalAuditor: userRoles.includes(UserRole.EXTERNAL_AUDITOR),
      isFamilyMember: userRoles.includes(UserRole.FAMILY_MEMBER),
      isCaseManager: userRoles.includes(UserRole.CASE_MANAGER),
      isAdmin: userRoles.includes(UserRole.ADMIN)
    };
  }, [user]);

  return rbacContext;
};