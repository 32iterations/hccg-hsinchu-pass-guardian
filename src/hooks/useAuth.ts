import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { UserRole } from '../types';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  // Derive role from user data
  const role = context.user?.role || UserRole.GUEST;

  return {
    ...context,
    role
  };
};