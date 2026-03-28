/**
 * Application Routes Configuration
 * Central registry of application routes for type-safe navigation.
 * Only actively used routes are exported; see config/navigation.ts for reserved paths.
 */

export const ROUTES = {
  HOME: '/',
  ADMIN: '/admin',
  ADMIN_CURATION: '/admin/curation',
  ADMIN_REFINERY: '/admin/refinery',
  CLINICAL_EYE: '/clinical-eye',
  VISUALIZER: '/visualizer',
  /** @deprecated Not yet routed in AppRoutes */
  LECTURE_CONVERTER: '/lecture-converter',
  /** @deprecated Not yet routed in AppRoutes */
  TECHNIQUE_CHECK: '/technique-check',
  CROSS_SYSTEM_EXPLORER: '/explorer',
  /** Study hub; path→view sync in App.tsx */
  STUDY: '/study',
  PRACTICE: '/practice',
  PROGRESS: '/progress',
  STUDY_KNOWLEDGE: '/study/knowledge',
  STUDY_UTILITIES: '/study/utilities',
  /** @deprecated Use STUDY_KNOWLEDGE */
  STUDY_REFERENCE: '/study/reference',
  /** @deprecated Use STUDY_UTILITIES */
  STUDY_TOOLKIT: '/study/toolkit',
  STUDY_PATH: '/study/path',
  DAILY_CHALLENGES: '/daily-challenges',
  MENU: '/menu',
} as const;

// Type for route values
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

// Helper function to check if a path matches a route
export const matchesRoute = (currentPath: string, route: AppRoute): boolean => {
  return currentPath === route || currentPath.startsWith(route + '/');
};
