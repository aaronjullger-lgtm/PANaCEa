/**
 * Zustand Store Barrel Export
 *
 * Central import point for all Zustand stores.
 *
 * Usage:
 *   import { useToastStore, useNavRailStore, useTooltipStore } from '@/lib/stores';
 */

export { useNavRailStore, useNavRail } from './useNavRailStore';
export type { NavRailCurrentContext, NavRailModule } from './useNavRailStore';

export { useToastStore, useToast } from './useToastStore';
export type { Toast, ToastVariant } from './useToastStore';

export { useTooltipStore, useTooltip } from './useTooltipStore';
export type { MedicalTermDefinition } from './useTooltipStore';
