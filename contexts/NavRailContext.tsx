import React, { createContext, useState, useContext, useCallback, useMemo, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface NavRailContextType {
  currentContext: {
    type: 'condition' | 'drug' | 'lab';
    id: string;
    name: string;
  } | null;
  relatedModules: Array<{
    type: string;
    id: string;
    label: string;
    icon: LucideIcon;
    href?: string;
  }>;
  setContext: (context: NavRailContextType['currentContext']) => void;
  clearContext: () => void;
}

export const NavRailContext = createContext<NavRailContextType | undefined>(undefined);

export const NavRailProvider = ({ children }: { children: ReactNode }) => {
  const [currentContext, setCurrentContext] = useState<NavRailContextType['currentContext']>(null);
  const [relatedModules, setRelatedModules] = useState<NavRailContextType['relatedModules']>([]);

  // useCallback keeps function references stable so context consumers that
  // spread these as deps (e.g. useEffect([setContext])) don't re-run needlessly.
  const setContext = useCallback((context: NavRailContextType['currentContext']) => {
    setCurrentContext(context);
    // Related modules will be populated when a real data source is wired.
    // Previously held hardcoded stub data with unsafe {} as LucideIcon casts.
    if (!context) {
      setRelatedModules([]);
    }
  }, []);

  const clearContext = useCallback(() => {
    setCurrentContext(null);
    setRelatedModules([]);
  }, []);

  // useMemo prevents a new object reference on every render of NavRailProvider.
  // Without this, every consumer of useNavRail() re-renders even when none of
  // the values have changed (React compares context value by reference).
  const value = useMemo(
    () => ({ currentContext, relatedModules, setContext, clearContext }),
    [currentContext, relatedModules, setContext, clearContext]
  );

  return (
    <NavRailContext.Provider value={value}>
      {children}
    </NavRailContext.Provider>
  );
};

export const useNavRail = () => {
  const context = useContext(NavRailContext);
  if (context === undefined) {
    throw new Error('useNavRail must be used within a NavRailProvider');
  }
  return context;
};
