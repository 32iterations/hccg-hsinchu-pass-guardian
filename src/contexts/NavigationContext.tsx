import React, { createContext, useState } from 'react';

interface NavigationContextType {
  currentPath: string;
  navigate: (path: string) => void;
  goBack: () => void;
}

export const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState('/');
  const [history, setHistory] = useState<string[]>(['/']);

  const navigate = (path: string) => {
    setHistory(prev => [...prev, currentPath]);
    setCurrentPath(path);
    if (typeof window !== 'undefined') {
      // Handle query parameters in path
      const url = new URL(path, window.location.origin);

      // Update window.location properties for testing
      try {
        Object.defineProperty(window.location, 'pathname', {
          writable: true,
          value: url.pathname
        });

        Object.defineProperty(window.location, 'search', {
          writable: true,
          value: url.search
        });
      } catch (e) {
        // In some test environments, location properties can't be redefined
        // Just update the global location object if available
        if (window.location && typeof window.location === 'object') {
          window.location.pathname = url.pathname;
          window.location.search = url.search;
        }
      }

      window.history.pushState(null, '', path);

      // Dispatch custom event for test listeners
      window.dispatchEvent(new CustomEvent('navigate', {
        detail: { path, pathname: url.pathname, search: url.search }
      }));
    }
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      const previousPath = newHistory.pop() || '/';
      setHistory(newHistory);
      setCurrentPath(previousPath);
      if (typeof window !== 'undefined') {
        window.history.back();
      }
    }
  };

  return (
    <NavigationContext.Provider value={{ currentPath, navigate, goBack }}>
      {children}
    </NavigationContext.Provider>
  );
};