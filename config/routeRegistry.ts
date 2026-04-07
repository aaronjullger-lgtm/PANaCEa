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
  { path: '/admin/refinery', view: null, label: 'Admin Refinery', isRouterRoute: true, includeIn404Check: true },
  { path: '/admin/taxonomies', view: null, label: 'Admin Taxonomies', isRouterRoute: true, includeIn404Check: true },
  { path: '/admin/system-mappings', view: null, label: 'Admin System Mappings', isRouterRoute: true, includeIn404Check: true },
  { path: '/admin/question-generator', view: null, label: 'Admin Question Generator', isRouterRoute: true, includeIn404Check: true },
  { path: '/clinical-eye', view: null, label: 'Clinical Eye', isRouterRoute: true, includeIn404Check: true },
  { path: '/visualizer', view: null, label: 'Visualizer', isRouterRoute: true, includeIn404Check: true },
  { path: '/lecture-converter', view: null, label: 'Lecture Converter', isRouterRoute: true, includeIn404Check: true },
  { path: '/technique-check', view: null, label: 'Technique Check', isRouterRoute: true, includeIn404Check: true },
  
  // View-state routes (isRouterRoute: false) - these need to be migrated to React Router
  // Note: 8 routes migrated to React Router in Sprint 4 — now isRouterRoute: true, view: null
  { path: '/study/knowledge', view: null, label: 'Knowledge Base', isRouterRoute: true, includeIn404Check: true, parentPath: '/study' },
  { path: '/study/utilities', view: null, label: 'Tools', isRouterRoute: true, includeIn404Check: true, parentPath: '/study' },
  { path: '/study/path', view: null, label: 'Study Path', isRouterRoute: true, includeIn404Check: true, parentPath: '/study' },
  { path: '/gap-analysis', view: null, label: 'Gap Analysis', isRouterRoute: true, includeIn404Check: true },
  { path: '/clinical-profile', view: null, label: 'Clinical Profile', isRouterRoute: true, includeIn404Check: true },
  { path: '/medical-database', view: null, label: 'Medical Database', isRouterRoute: true, includeIn404Check: true },
  { path: '/live-collaboration', view: null, label: 'Live Collaboration', isRouterRoute: true, includeIn404Check: true },
  { path: '/explorer', view: null, label: 'Cross System Explorer', isRouterRoute: true, includeIn404Check: true },
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
 * Helper to check if a path is known.
 *
 * Strategy:
 * 1. Exact match against the full registry (fast path).
 * 2. Dynamic session route pattern — `/session/<id>`.
 * 3. For paths under whitelisted prefixes (/admin, /study), accept the path
 *    only if a *more-specific* registered child route matches it exactly or
 *    is a direct parent of it.  The prefix root (e.g. `/study` itself) does
 *    NOT count — it must be a child like `/study/knowledge`.
 *
 * This prevents false positives like `/studyxyz`, `/admin/nonexistent`, or
 * `/study/nonexistent` while keeping legitimate nested paths working.
 */
export function isKnownPath(path: string): boolean {
  // Strip trailing slash for consistency (but '/' stays as-is)
  const normalized = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;

  // 1. Exact match
  if (KNOWN_PATHS.has(normalized)) return true;

  // 2. Dynamic session route — /session/<id> (single segment only)
  if (normalized.startsWith('/session/')) {
    const rest = normalized.slice('/session/'.length);
    return rest.length > 0 && !rest.includes('/');
  }

  // 3. Whitelisted prefix children — only accept if a CHILD route matches
  //    (not the prefix root itself, which would match any suffix).
  for (const route of ROUTE_REGISTRY) {
    // Skip root-level routes (they're covered by exact match above)
    if (route.path === '/' || route.path === '/study' || route.path === '/admin') continue;
    // Only consider routes that are children of known parent prefixes
    if (
      (route.path.startsWith('/study/') || route.path.startsWith('/admin/')) &&
      normalized.startsWith(route.path) &&
      (normalized === route.path || normalized.charAt(route.path.length) === '/')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Get view for a path.
 * Uses the same normalisation and matching strategy as isKnownPath.
 */
export function getViewForPath(path: string): View | null {
  const normalized = path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;

  // 1. Exact match
  const exact = PATH_TO_VIEW_MAP.get(normalized);
  if (exact) return exact;

  // 2. Dynamic session route
  if (normalized.startsWith('/session/')) {
    const rest = normalized.slice('/session/'.length);
    if (rest.length > 0 && !rest.includes('/')) return 'session_runner';
    return null;
  }

  // 3. Longest child-route match under /study or /admin
  let best: View | null = null;
  let bestLen = 0;
  for (const route of ROUTE_REGISTRY) {
    if (route.path === '/' || route.path === '/study' || route.path === '/admin') continue;
    if (
      (route.path.startsWith('/study/') || route.path.startsWith('/admin/')) &&
      normalized.startsWith(route.path) &&
      (normalized === route.path || normalized.charAt(route.path.length) === '/') &&
      route.path.length > bestLen
    ) {
      best = route.view;
      bestLen = route.path.length;
    }
  }

  return best;
}
