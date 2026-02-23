import { useContext } from 'react';
import { NavRailContext, NavRailContextType } from '@/contexts/NavRailContext';

export const useNavRailContext = (): NavRailContextType => {
  const context = useContext(NavRailContext);
  if (context === undefined) {
    throw new Error('useNavRailContext must be used within a NavRailProvider');
  }
  return context;
};
