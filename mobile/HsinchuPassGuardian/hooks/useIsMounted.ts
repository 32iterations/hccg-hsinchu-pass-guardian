import React, { useEffect, useRef } from 'react';

export function useIsMounted() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}

export function useSafeState<T>(initialState: T): [T, (newState: T | ((prev: T) => T)) => void] {
  const [state, setState] = React.useState(initialState);
  const isMountedRef = useIsMounted();

  const setSafeState = React.useCallback((newState: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setState(newState);
    }
  }, [isMountedRef]);

  return [state, setSafeState];
}