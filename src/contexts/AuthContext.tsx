import React, { createContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
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
      // Mock login implementation
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockUser: User = {
        id: '1',
        email,
        role: UserRole.VERIFIED
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

  const contextValue = {
    user: value?.user !== undefined ? value.user : user,
    isLoading: value?.isLoading !== undefined ? value.isLoading : isLoading,
    login: value?.login || login,
    logout: value?.logout || logout,
    updateUser: value?.updateUser || updateUser
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};