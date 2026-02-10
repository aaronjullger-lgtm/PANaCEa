/**
 * Application Routes Configuration
 * Central registry of application routes for type-safe navigation.
 * Only actively used routes are exported; see config/navigation.ts for reserved paths.
 */

export const ROUTES = {
  HOME: '/',
  ADMIN: '/admin',
  ADMIN_CURATION: '/admin/curation',
  CLINICAL_EYE: '/clinical-eye',
  VISUALIZER: '/visualizer',
  LECTURE_CONVERTER: '/lecture-converter',
  TECHNIQUE_CHECK: '/technique-check',
} as const;

// Type for route values
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

// Helper function to check if a path matches a route
export const matchesRoute = (currentPath: string, route: AppRoute): boolean => {
  return currentPath === route || currentPath.startsWith(route + '/');
};
