/**
 * Backward-compatible re-export.
 * Phase 3: Migrated from React Context to Zustand store.
 * All consumers can import from here or directly from '@/lib/stores/useNavRailStore'.
 */
export { useNavRailStore as useNavRailContext } from '@/lib/stores/useNavRailStore';
export type { NavRailCurrentContext, NavRailModule } from '@/lib/stores/useNavRailStore';
