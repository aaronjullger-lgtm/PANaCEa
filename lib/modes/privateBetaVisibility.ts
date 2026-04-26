import type { TrainingModeConfig, TrainingModeId } from '@/config/training-modes';
import { getStudyModeContract } from './studyModeContracts';

const PRIVATE_BETA_ENABLED =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_PRIVATE_BETA_LAUNCH ?? 'true') !== 'false';

/**
 * Private beta exposes only the core study loop and verified question-based
 * practice surfaces. Mock-heavy, media-inventory-dependent, social, and
 * experimental tools stay addressable for development but hidden from beta
 * discovery and direct in-app launches.
 */
export const PRIVATE_BETA_VISIBLE_MODE_IDS = new Set<TrainingModeId>([
  'core_adaptive',
  'system_drill',
  'condition_drill',
  'subcategory_drill',
  'pharmacology',
  'first_line_treatment',
  'rapid_recall',
  'mini_lab',
  'contrastive_drill',
  'cram_mode',
]);

const PRIVATE_BETA_HIDDEN_ROUTES = new Set([
  '/live-collaboration',
  '/explorer',
  '/clinical-eye',
  '/visualizer',
  '/lecture-converter',
  '/technique-check',
]);

export function isPrivateBetaLaunchEnabled(): boolean {
  return PRIVATE_BETA_ENABLED;
}

export function isPrivateBetaModeVisible(modeId: string): boolean {
  if (!PRIVATE_BETA_ENABLED) return true;
  const contract = getStudyModeContract(modeId);
  if (!contract) return true;
  if (!PRIVATE_BETA_VISIBLE_MODE_IDS.has(modeId as TrainingModeId)) return false;
  return contract?.productionStatus === 'fully_functional' && contract.blockingIssues.length === 0;
}

export function filterPrivateBetaModes<T extends Pick<TrainingModeConfig, 'id' | 'isComingSoon'>>(
  modes: T[]
): T[] {
  if (!PRIVATE_BETA_ENABLED) return modes;
  return modes.filter((mode) => !mode.isComingSoon && isPrivateBetaModeVisible(mode.id));
}

export function isPrivateBetaRouteVisible(path: string): boolean {
  if (!PRIVATE_BETA_ENABLED) return true;
  const normalized = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
  return !PRIVATE_BETA_HIDDEN_ROUTES.has(normalized);
}
