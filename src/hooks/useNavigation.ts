import { useContext } from 'react';
import { NavigationContext } from '../contexts/NavigationContext';

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

// Mock navigation implementation for testing
export const mockNavigate = (path: string) => {
  if (typeof window !== 'undefined') {
    window.history.pushState(null, '', path);
    // Trigger a location change event for tests
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
};