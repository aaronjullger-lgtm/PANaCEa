import React, { createContext, useState, useContext, ReactNode } from 'react';
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

  const setContext = (context: NavRailContextType['currentContext']) => {
    setCurrentContext(context);
    // In a real application, you would fetch related modules here
    // For now, we'll use mock data
    if (context) {
      setRelatedModules([
        { type: 'drug', id: '1', label: 'Aspirin', icon: {} as LucideIcon, href: '/d/aspirin' },
        { type: 'lab', id: '2', label: 'Troponin', icon: {} as LucideIcon, href: '/l/troponin' },
      ]);
    } else {
      setRelatedModules([]);
    }
  };

  const clearContext = () => {
    setCurrentContext(null);
    setRelatedModules([]);
  };

  return (
    <NavRailContext.Provider value={{ currentContext, relatedModules, setContext, clearContext }}>
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
