/**
 * Console RBAC Provider
 * Provides console-specific RBAC context and validation
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useRBAC } from '../hooks/useRBAC';
import { User, UserRole, AuditEntry } from '../types';

interface ConsoleRBACContextType {
  // Console session info
  sessionId: string;
  lastActivity: Date;

  // Audit trail
  auditTrail: AuditEntry[];
  logActivity: (action: string, resource?: string, resourceId?: string) => void;

  // Field masking
  maskSensitiveData: (data: any, fields: string[]) => any;

  // Workflow validation
  validateWorkflowAction: (action: string, currentState: string, targetState?: string) => {
    allowed: boolean;
    reason?: string;
  };

  // KPI access control
  getKPIAccessLevel: () => 'none' | 'basic' | 'detailed' | 'full';

  // Data export validation
  canExportData: (dataType: string) => boolean;

  // Session management
  extendSession: () => void;
  endSession: () => void;
}

const ConsoleRBACContext = createContext<ConsoleRBACContextType | undefined>(undefined);

export const useConsoleRBAC = () => {
  const context = useContext(ConsoleRBACContext);
  if (!context) {
    throw new Error('useConsoleRBAC must be used within a ConsoleRBACProvider');
  }
  return context;
};

interface ConsoleRBACProviderProps {
  children: React.ReactNode;
  sessionTimeout?: number; // in minutes
  autoLogActivity?: boolean;
}

export const ConsoleRBACProvider: React.FC<ConsoleRBACProviderProps> = ({
  children,
  sessionTimeout = 30,
  autoLogActivity = true
}) => {
  const { user } = useAuth();
  const rbac = useRBAC();

  const [sessionId] = useState(() => `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [lastActivity, setLastActivity] = useState(new Date());
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);

  // Auto-log page navigation and user activity
  useEffect(() => {
    if (autoLogActivity && user) {
      logActivity('console_session_start', 'session', sessionId);
    }

    return () => {
      if (autoLogActivity && user) {
        logActivity('console_session_end', 'session', sessionId);
      }
    };
  }, [user, sessionId, autoLogActivity]);

  // Session timeout handling
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeDiff = now.getTime() - lastActivity.getTime();
      const timeoutMs = sessionTimeout * 60 * 1000;

      if (timeDiff > timeoutMs) {
        endSession();
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [lastActivity, sessionTimeout]);

  const logActivity = (action: string, resource?: string, resourceId?: string) => {
    if (!user) return;

    const auditEntry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      action,
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
      result: 'success'
    };

    // Add watermark for sensitive operations
    if (['data_export', 'case_access', 'personal_data_view'].includes(action)) {
      auditEntry.watermark = generateWatermark();
    }

    setAuditTrail(prev => [auditEntry, ...prev.slice(0, 99)]); // Keep last 100 entries
    setLastActivity(new Date());

    // In a real app, this would send to the backend
    console.log('Console RBAC Audit:', auditEntry);
  };

  const generateWatermark = (): string => {
    const timestamp = Date.now().toString(16).toUpperCase();
    const random = Math.random().toString(36).substr(2, 8).toUpperCase();
    return `WM_CONSOLE_${random}_${timestamp.substr(-8)}`;
  };

  const maskSensitiveData = (data: any, fields: string[]): any => {
    if (!data || typeof data !== 'object') return data;

    const masked = { ...data };

    fields.forEach(field => {
      const fieldAccess = rbac.checkFieldAccess(field);
      if (!fieldAccess.hasAccess) {
        // Mask the field based on its path
        const parts = field.split('.');
        let current = masked;

        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) return;
          current = current[parts[i]];
        }

        const lastPart = parts[parts.length - 1];
        if (current[lastPart] !== undefined) {
          if (typeof current[lastPart] === 'string') {
            current[lastPart] = '[受保護資料]';
          } else {
            current[lastPart] = '[已遮罩]';
          }
        }
      }
    });

    return masked;
  };

  const validateWorkflowAction = (action: string, currentState: string, targetState?: string): {
    allowed: boolean;
    reason?: string;
  } => {
    // Check if user has workflow permissions
    if (!rbac.hasPermission('manage_case_workflow') && !rbac.hasPermission('update_case_status')) {
      return {
        allowed: false,
        reason: 'insufficient_workflow_permissions'
      };
    }

    // If target state is provided, validate transition
    if (targetState) {
      const transition = rbac.validateWorkflowTransition(currentState, targetState);
      if (!transition.valid) {
        return {
          allowed: false,
          reason: 'invalid_state_transition'
        };
      }
    }

    // Role-specific workflow restrictions
    if (rbac.isSocialWorker && ['approve_case_closure', 'assign_primary_worker'].includes(action)) {
      return {
        allowed: false,
        reason: 'role_workflow_restriction'
      };
    }

    if (rbac.isVolunteerCoordinator && !['assign_volunteers', 'update_volunteer_assignment'].includes(action)) {
      return {
        allowed: false,
        reason: 'volunteer_coordinator_scope_restriction'
      };
    }

    return { allowed: true };
  };

  const getKPIAccessLevel = (): 'none' | 'basic' | 'detailed' | 'full' => {
    if (!rbac.isAuthenticated) return 'none';

    if (rbac.isAdmin || rbac.isExternalAuditor) return 'full';
    if (rbac.isCaseManager || rbac.canAccessKPIDrillDown) return 'detailed';
    if (rbac.hasPermission('view_kpis')) return 'basic';

    return 'none';
  };

  const canExportData = (dataType: string): boolean => {
    if (!rbac.canExportData) return false;

    // Additional console-specific export restrictions
    const exportRestrictions: Record<string, UserRole[]> = {
      'personal_data': [UserRole.CASE_WORKER, UserRole.CASE_MANAGER, UserRole.ADMIN],
      'location_data': [UserRole.CASE_WORKER, UserRole.CASE_MANAGER, UserRole.VOLUNTEER_COORDINATOR, UserRole.ADMIN],
      'audit_logs': [UserRole.EXTERNAL_AUDITOR, UserRole.ADMIN],
      'kpi_detailed': [UserRole.CASE_MANAGER, UserRole.ADMIN],
      'case_reports': [UserRole.CASE_WORKER, UserRole.CASE_MANAGER, UserRole.SOCIAL_WORKER, UserRole.ADMIN]
    };

    const allowedRoles = exportRestrictions[dataType];
    if (!allowedRoles) return true; // No restrictions for this data type

    return rbac.userRoles.some(role => allowedRoles.includes(role));
  };

  const extendSession = () => {
    setLastActivity(new Date());
    logActivity('session_extended', 'session', sessionId);
  };

  const endSession = () => {
    logActivity('session_ended', 'session', sessionId);
    // In a real app, this would redirect to login or clear session
    console.log('Console session ended due to timeout');
  };

  const contextValue: ConsoleRBACContextType = {
    sessionId,
    lastActivity,
    auditTrail,
    logActivity,
    maskSensitiveData,
    validateWorkflowAction,
    getKPIAccessLevel,
    canExportData,
    extendSession,
    endSession
  };

  return (
    <ConsoleRBACContext.Provider value={contextValue}>
      {children}
    </ConsoleRBACContext.Provider>
  );
};