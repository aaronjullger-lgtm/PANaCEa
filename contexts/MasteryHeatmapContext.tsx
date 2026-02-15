/**
 * MasteryHeatmapContext – global toggle for "Mastery Heatmap" overlay on dashboard.
 * When on: curriculum cards and list items can show faint red/green glow by data-mastery.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'pance-ai-mastery-heatmap-overlay';

function getInitial(): boolean {
  if (globalThis.window == null) return false;
  return globalThis.localStorage.getItem(STORAGE_KEY) === 'true';
}

type MasteryHeatmapContextValue = {
  masteryHeatmapOverlay: boolean;
  setMasteryHeatmapOverlay: Dispatch<SetStateAction<boolean>>;
};

const MasteryHeatmapContextInstance = createContext<MasteryHeatmapContextValue | null>(null);

export function MasteryHeatmapProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [masteryHeatmapOverlay, setMasteryHeatmapOverlay] = useState(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (masteryHeatmapOverlay) {
      root.classList.add('mastery-heatmap-overlay');
    } else {
      root.classList.remove('mastery-heatmap-overlay');
    }
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, String(masteryHeatmapOverlay));
    } catch {
      // ignore
    }
  }, [masteryHeatmapOverlay]);

  const value = useMemo(
    () => ({ masteryHeatmapOverlay, setMasteryHeatmapOverlay }),
    [masteryHeatmapOverlay]
  );

  return (
    <MasteryHeatmapContextInstance.Provider value={value}>
      {children}
    </MasteryHeatmapContextInstance.Provider>
  );
}

export function useMasteryHeatmap(): MasteryHeatmapContextValue {
  const ctx = useContext(MasteryHeatmapContextInstance);
  if (!ctx) {
    throw new Error('useMasteryHeatmap must be used within MasteryHeatmapProvider');
  }
  return ctx;
}
