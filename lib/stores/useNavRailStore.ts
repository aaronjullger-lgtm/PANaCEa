/**
 * NavRail Zustand Store
 *
 * Replaces NavRailContext with a Zustand atom store.
 * No Provider wrapper needed — components import the hook directly.
 *
 * Phase 3 migration: contexts/NavRailContext.tsx → lib/stores/useNavRailStore.ts
 *
 * Usage:
 *   import { useNavRailStore } from '@/lib/stores/useNavRailStore';
 *
 *   const { currentContext, relatedModules, setContext, clearContext } = useNavRailStore();
 */

import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';

export interface NavRailModule {
  type: string;
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
}

export interface NavRailCurrentContext {
  type: 'condition' | 'drug' | 'lab';
  id: string;
  name: string;
}

interface NavRailState {
  currentContext: NavRailCurrentContext | null;
  relatedModules: NavRailModule[];
  setContext: (context: NavRailCurrentContext | null) => void;
  clearContext: () => void;
}

export const useNavRailStore = create<NavRailState>((set) => ({
  currentContext: null,
  relatedModules: [],

  setContext: (context) =>
    set(() => {
      if (!context) {
        return { currentContext: null, relatedModules: [] };
      }
      // In production, relatedModules will be fetched from the API
      // based on the context type/id. For now, replicate the placeholder
      // behavior from the original NavRailContext.
      return {
        currentContext: context,
        relatedModules: [
          { type: 'drug', id: '1', label: 'Aspirin', icon: {} as LucideIcon, href: '/d/aspirin' },
          { type: 'lab', id: '2', label: 'Troponin', icon: {} as LucideIcon, href: '/l/troponin' },
        ],
      };
    }),

  clearContext: () => set({ currentContext: null, relatedModules: [] }),
}));

/**
 * Backward-compatible hook alias.
 * Drop-in replacement for the old useNavRail() / useNavRailContext() hooks.
 */
export const useNavRail = useNavRailStore;
