/**
 * useTrainingActions - Hook for handling training mode navigation and actions.
 *
 * This hook provides functions to navigate to different training modes
 * based on their configuration in the MODE_REGISTRY.
 */

import { useCallback } from 'react';
import {
  MODE_REGISTRY,
  TrainingModeConfig,
  TrainingModeId,
  MODES_WITH_DEDICATED_ROUTES,
} from '@/config/training-modes';

export interface UseTrainingActionsOptions {
  /** Callback when a mode with a route is selected */
  onNavigate?: (route: string, mode: TrainingModeConfig) => void;
  /** Callback when core session should be started (fallback for modes without special handling) */
  onStartCoreSession?: (focus?: string) => void;
}

export interface UseTrainingActionsReturn {
  /** Navigate to a specific training mode by its ID */
  navigateToMode: (modeId: TrainingModeId, focus?: string) => void;
  /** Get the mode configuration by ID */
  getModeById: (modeId: TrainingModeId) => TrainingModeConfig | undefined;
  /** Check if a mode has a dedicated route */
  hasDedicatedRoute: (modeId: TrainingModeId) => boolean;
}

/**
 * Hook for handling training mode navigation and actions.
 */
export function useTrainingActions(
  options: UseTrainingActionsOptions = {}
): UseTrainingActionsReturn {
  const { onNavigate, onStartCoreSession } = options;

  /**
   * Get the mode configuration by ID.
   */
  const getModeById = useCallback((modeId: TrainingModeId): TrainingModeConfig | undefined => {
    return MODE_REGISTRY.find((mode) => mode.id === modeId);
  }, []);

  /**
   * Check if a mode has a dedicated route.
   */
  const hasDedicatedRoute = useCallback((modeId: TrainingModeId): boolean => {
    return MODES_WITH_DEDICATED_ROUTES.includes(modeId);
  }, []);

  /**
   * Navigate to a specific training mode.
   *
   * - If the mode has a dedicated route, calls onNavigate with the route.
   * - Otherwise, falls back to onStartCoreSession for quiz-based modes.
   */
  const navigateToMode = useCallback(
    (modeId: TrainingModeId, focus?: string) => {
      const mode = getModeById(modeId);

      // Debug logging to help troubleshoot routing issues
      if (import.meta.env.DEV) console.debug('[useTrainingActions] navigateToMode called:', {
        modeId,
        focus,
        mode: mode ? { id: mode.id, route: mode.route, label: mode.label } : null,
        hasDedicatedRoute: hasDedicatedRoute(modeId),
      });

      if (!mode) {
        console.warn(`[useTrainingActions] Mode not found in registry: ${modeId}`);
        return;
      }

      // Check if mode is blocked due to "coming soon" status
      if (mode.isComingSoon) {
        console.warn(
          `[useTrainingActions] Mode "${mode.label}" is marked as coming soon. Check config to enable.`
        );
        return;
      }

      // Log the route we're attempting to navigate to (for debugging)
      if (import.meta.env.DEV) console.debug('Attempting nav to:', mode.route);

      // Check if this mode has a dedicated route
      if (hasDedicatedRoute(modeId)) {
        if (import.meta.env.DEV) console.debug(`[useTrainingActions] Navigating to dedicated route: ${mode.route}`);
        if (onNavigate) {
          onNavigate(mode.route, mode);
        } else {
          console.warn(
            '[useTrainingActions] onNavigate callback not provided. Navigation will not occur.'
          );
        }
        return;
      }

      // Fall back to core session for modes without dedicated pages
      if (import.meta.env.DEV) console.debug(`[useTrainingActions] Starting core session for mode: ${modeId}`);
      if (onStartCoreSession) {
        onStartCoreSession(focus);
      } else {
        console.warn(
          '[useTrainingActions] onStartCoreSession callback not provided. Session will not start.'
        );
      }
    },
    [getModeById, hasDedicatedRoute, onNavigate, onStartCoreSession]
  );

  return {
    navigateToMode,
    getModeById,
    hasDedicatedRoute,
  };
}

export default useTrainingActions;
