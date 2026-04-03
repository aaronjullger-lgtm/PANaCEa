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
  LECTURE_CONVERTER: '/lecture-converter',
  TECHNIQUE_CHECK: '/technique-check',
  CROSS_SYSTEM_EXPLORER: '/explorer',
  /** Study hub; path→view sync in App.tsx */
  STUDY: '/study',
  PRACTICE: '/practice',
  PROGRESS: '/progress',
  STUDY_KNOWLEDGE: '/study/knowledge',
  STUDY_UTILITIES: '/study/utilities',
  /**
   * @deprecated Use STUDY_KNOWLEDGE ('/study/knowledge') — legacy path redirects automatically.
   * TODO: Remove once all callsites are migrated (Sprint 3).
   */
  STUDY_REFERENCE: '/study/knowledge',
  /**
   * @deprecated Use STUDY_UTILITIES ('/study/utilities') — legacy path redirects automatically.
   * TODO: Remove once all callsites are migrated (Sprint 3).
   */
  STUDY_TOOLKIT: '/study/utilities',
  STUDY_PATH: '/study/path',
  DAILY_CHALLENGES: '/daily-challenges',
  MENU: '/menu',
  /** Core Adaptive FSRS study session */
  CORE_ADAPTIVE: '/core-adaptive',
} as const;

// Type for route values
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

// Helper function to check if a path matches a route
export const matchesRoute = (currentPath: string, route: AppRoute): boolean => {
  return currentPath === route || currentPath.startsWith(route + '/');
};
