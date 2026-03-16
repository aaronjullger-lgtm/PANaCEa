/**
 * Route Registry - Single Source of Truth
 * 
 * This file is the ONLY place where routes should be defined.
 * All other files (routes.ts, navigation.ts, useAppNavigation.ts) should derive from this.
 */

import type { View } from './appViews';
import { TRAINING_MODES } from './training-modes';

export interface RouteDefinition {
  /** The URL path */
  path: string;
  /** The view state (null = React Router native, no view state needed) */
  view: View | null;
  /** Human-readable label */
  label: string;
  /** Whether this is a React Router route (true) or view-state route (false) */
  isRouterRoute: boolean;
  /** Whether this path should be included in 404 detection */
  includeIn404Check: boolean;
  /** Optional: parent path for nested routes */
  parentPath?: string;
}

/**
 * Single source of truth for all application routes
 */
export const ROUTE_REGISTRY: RouteDefinition[] = [
  // React Router routes (isRouterRoute: true)
  { path: '/', view: null, label: 'Home', isRouterRoute: true, includeIn404Check: true },
  { path: '/study', view: 'command_center', label: 'Home', isRouterRoute: true, includeIn404Check: true },
  { path: '/practice', view: null, label: 'Practice', isRouterRoute: true, includeIn404Check: true },
  { path: '/progress', view: null, label: 'Progress', isRouterRoute: true, includeIn404Check: true },
  { path: '/daily-challenges', view: null, label: 'Daily Challenges', isRouterRoute: true, includeIn404Check: true },
  { path: '/admin', view: null, label: 'Admin', isRouterRoute: true, includeIn404Check: true },
  { path: '/admin/curation', view: null, label: 'Admin Curation', isRouterRoute: true, includeIn404Check: true },
  { path: '/clinical-eye', view: null, label: 'Clinical Eye', isRouterRoute: true, includeIn404Check: true },
  { path: '/visualizer', view: null, label: 'Visualizer', isRouterRoute: true, includeIn404Check: true },
  
  // View-state routes (isRouterRoute: false) - these need to be migrated to React Router
  { path: '/study/knowledge', view: 'reference_library', label: 'Knowledge Base', isRouterRoute: false, includeIn404Check: true, parentPath: '/study' },
  { path: '/study/utilities', view: 'toolkit', label: 'Tools', isRouterRoute: false, includeIn404Check: true, parentPath: '/study' },
  { path: '/study/path', view: 'study_path_dashboard', label: 'Study Path', isRouterRoute: false, includeIn404Check: true, parentPath: '/study' },
  { path: '/gap-analysis', view: 'gap_analysis', label: 'Gap Analysis', isRouterRoute: false, includeIn404Check: true },
  { path: '/clinical-profile', view: 'clinical_profile', label: 'Clinical Profile', isRouterRoute: false, includeIn404Check: true },
  { path: '/medical-database', view: 'medical_database', label: 'Medical Database', isRouterRoute: false, includeIn404Check: true },
  { path: '/live-collaboration', view: 'live_collaboration', label: 'Live Collaboration', isRouterRoute: false, includeIn404Check: true },
  { path: '/explorer', view: 'cross_system_explorer', label: 'Cross System Explorer', isRouterRoute: false, includeIn404Check: true },
  { path: '/menu', view: 'menu', label: 'Menu', isRouterRoute: false, includeIn404Check: true },
  
  // Legacy redirects (handled in useAppNavigation)
  { path: '/study/reference', view: 'reference_library', label: 'Reference (Legacy)', isRouterRoute: false, includeIn404Check: true, parentPath: '/study' },
  { path: '/study/toolkit', view: 'toolkit', label: 'Toolkit (Legacy)', isRouterRoute: false, includeIn404Check: true, parentPath: '/study' },
  { path: '/study/main-session', view: 'command_center', label: 'Main Session (Legacy)', isRouterRoute: false, includeIn404Check: true, parentPath: '/study' },
  
  // Training mode routes (from TRAINING_MODES)
  ...TRAINING_MODES.map((mode) => ({
    path: mode.route,
    view: mode.id as View,
    label: mode.label,
    isRouterRoute: false, // Currently all use view-state, should migrate to React Router
    includeIn404Check: true,
  })),
  
  // Session routes
  { path: '/session/:sessionId', view: 'session_runner', label: 'Session', isRouterRoute: false, includeIn404Check: true },
];

/**
 * Derived exports for backward compatibility
 */

// All known paths (for 404 detection)
export const KNOWN_PATHS = new Set(ROUTE_REGISTRY.map((r) => r.path));

// Paths that should be included in 404 checks
export const CANONICAL_PATHS = ROUTE_REGISTRY
  .filter((r) => r.includeIn404Check)
  .map((r) => r.path);

// Paths that map to views (for useAppNavigation)
export const PATH_TO_VIEW_MAP = new Map<string, View>(
  ROUTE_REGISTRY
    .filter((r) => r.view !== null)
    .map((r) => [r.path, r.view!])
);

// React Router routes only
export const ROUTER_ROUTES = ROUTE_REGISTRY.filter((r) => r.isRouterRoute);

// View-state routes only
export const VIEW_STATE_ROUTES = ROUTE_REGISTRY.filter((r) => !r.isRouterRoute && r.view !== null);

/**
 * Helper to check if a path is known
 */
export function isKnownPath(path: string): boolean {
  // Exact match
  if (KNOWN_PATHS.has(path)) return true;
  
  // Check for path prefixes (e.g., /study/knowledge/... matches /study/knowledge)
  for (const route of ROUTE_REGISTRY) {
    if (path.startsWith(route.path + '/') || path === route.path) {
      return true;
    }
  }
  
  // Special case: session routes
  if (path.startsWith('/session/')) return true;
  
  return false;
}

/**
 * Get view for a path
 */
export function getViewForPath(path: string): View | null {
  // Exact match
  const exact = PATH_TO_VIEW_MAP.get(path);
  if (exact) return exact;
  
  // Prefix match
  for (const route of ROUTE_REGISTRY) {
    if (path.startsWith(route.path + '/') || path === route.path) {
      return route.view;
    }
  }
  
  // Session routes
  if (path.startsWith('/session/')) return 'session_runner';
  
  return null;
}
