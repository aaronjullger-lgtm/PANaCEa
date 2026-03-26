/**
 * UNIFIED ROUTE REGISTRY — Public API
 *
 * Single source of truth for all application routes.
 * Internal implementation: config/routeRegistry.ts
 *
 * This file is the ONLY place to import routes, constants, and route utilities from.
 * All components and hooks should import from here.
 *
 * Usage:
 * ```ts
 * import { ROUTES_STATIC, isValidRoute, getTrainingModeRoute } from '@/lib/constants/routes';
 * import { isKnownPath } from '@/lib/constants/routes';
 * ```
 */

// Import locally so helper functions below can reference them
import {
  ROUTE_REGISTRY,
  isKnownPath,
} from '../../config/routeRegistry';
import { TRAINING_MODES } from '../../config/training-modes';

// Re-export all route utilities from config/routeRegistry.ts
export type { RouteDefinition } from '../../config/routeRegistry';
export {
  ROUTE_REGISTRY,
  KNOWN_PATHS,
  CANONICAL_PATHS,
  PATH_TO_VIEW_MAP,
  ROUTER_ROUTES,
  VIEW_STATE_ROUTES,
  isKnownPath,
  getViewForPath,
} from '../../config/routeRegistry';

// Re-export static routes
export { ROUTES } from '../../config/routes';

// Re-export training modes (which contain routes)
export {
  TRAINING_MODES,
  MODE_REGISTRY,
  STUDY_PRESETS,
  CATEGORY_INFO,
  getAvailableModes,
  getModeById,
  getModesForUserContext,
  getModesByCategory,
} from '../../config/training-modes';
export type { TrainingModeId } from '../../config/training-modes';

// Re-export navigation items
export { NAV_RAIL_ITEMS, CANONICAL_PATHS as NAVIGATION_CANONICAL_PATHS } from '../../config/navigation';

// ============================================================================
// Convenience exports with common route patterns
// ============================================================================

/**
 * All static app routes (not training modes)
 */
export const ROUTES_STATIC = {
  HOME: '/',
  ADMIN: '/admin',
  ADMIN_CURATION: '/admin/curation',
  CLINICAL_EYE: '/clinical-eye',
  VISUALIZER: '/visualizer',
  STUDY: '/study',
  PRACTICE: '/practice',
  PROGRESS: '/progress',
  STUDY_KNOWLEDGE: '/study/knowledge',
  STUDY_UTILITIES: '/study/utilities',
  STUDY_PATH: '/study/path',
  DAILY_CHALLENGES: '/daily-challenges',
  MENU: '/menu',
} as const;

/**
 * Validates if a route is registered (alias for isKnownPath)
 */
export function isValidRoute(path: string): boolean {
  return isKnownPath(path);
}

/**
 * Get route for a training mode by ID
 */
export function getTrainingModeRoute(modeId: string): string | undefined {
  const mode = TRAINING_MODES.find((m) => m.id === modeId);
  return mode?.route;
}

/**
 * Get all known routes (for debugging/documentation)
 */
export function getAllRoutes(): string[] {
  return ROUTE_REGISTRY.map((r) => r.path).sort();
}
