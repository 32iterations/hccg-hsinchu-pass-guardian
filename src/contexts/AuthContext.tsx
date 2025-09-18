import React, { createContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { ROLE_PERMISSIONS } from '../utils/rbac';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  // Enhanced RBAC methods
  hasPermission: (permission: string) => boolean;
  switchRole: (role: UserRole) => void;
  getUserRoles: () => UserRole[];
  getClearanceLevel: () => string;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  value?: Partial<AuthContextType>;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, value }) => {
  const [user, setUser] = useState<User | null>(value?.user || null);
  const [isLoading, setIsLoading] = useState(value?.isLoading ?? false);

  useEffect(() => {
    // Mock authentication check
    const checkAuth = () => {
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Mock login implementation with console RBAC roles
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock different user types based on email for testing
      let role = UserRole.VERIFIED;
      let roles: UserRole[] = [UserRole.VERIFIED];
      let clearanceLevel: 'public' | 'restricted' | 'confidential' | 'audit_only' = 'public';

      if (email.includes('case-worker')) {
        role = UserRole.CASE_WORKER;
        roles = [UserRole.CASE_WORKER];
        clearanceLevel = 'confidential';
      } else if (email.includes('social-worker')) {
        role = UserRole.SOCIAL_WORKER;
        roles = [UserRole.SOCIAL_WORKER];
        clearanceLevel = 'restricted';
      } else if (email.includes('volunteer-coord')) {
        role = UserRole.VOLUNTEER_COORDINATOR;
        roles = [UserRole.VOLUNTEER_COORDINATOR];
        clearanceLevel = 'restricted';
      } else if (email.includes('auditor')) {
        role = UserRole.EXTERNAL_AUDITOR;
        roles = [UserRole.EXTERNAL_AUDITOR];
        clearanceLevel = 'audit_only';
      } else if (email.includes('family')) {
        role = UserRole.FAMILY_MEMBER;
        roles = [UserRole.FAMILY_MEMBER];
        clearanceLevel = 'restricted';
      } else if (email.includes('admin')) {
        role = UserRole.ADMIN;
        roles = [UserRole.ADMIN];
        clearanceLevel = 'confidential';
      }

      const mockUser: User = {
        id: '1',
        email,
        role,
        roles,
        clearanceLevel,
        permissions: ROLE_PERMISSIONS[role]?.permissions || []
      };

      setUser(mockUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  // Enhanced RBAC methods
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return user.permissions?.includes(permission) || user.permissions?.includes('*') || false;
  };

  const switchRole = (role: UserRole) => {
    if (!user) return;
    const rolePermissions = ROLE_PERMISSIONS[role];
    if (!rolePermissions) return;

    setUser(prev => prev ? {
      ...prev,
      role,
      clearanceLevel: rolePermissions.clearanceLevel,
      permissions: rolePermissions.permissions
    } : null);
  };

  const getUserRoles = (): UserRole[] => {
    return user?.roles || (user?.role ? [user.role] : []);
  };

  const getClearanceLevel = (): string => {
    return user?.clearanceLevel || ROLE_PERMISSIONS[user?.role || UserRole.GUEST]?.clearanceLevel || 'public';
  };

  const contextValue = {
    user: value?.user !== undefined ? value.user : user,
    isLoading: value?.isLoading !== undefined ? value.isLoading : isLoading,
    login: value?.login || login,
    logout: value?.logout || logout,
    updateUser: value?.updateUser || updateUser,
    hasPermission,
    switchRole,
    getUserRoles,
    getClearanceLevel
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};