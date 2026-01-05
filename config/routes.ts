/**
 * Application Routes Configuration
 * Central registry of all application routes for type-safe navigation
 */

export const ROUTES = {
  // Overview
  DASHBOARD: '/dashboard',
  PERFORMANCE: '/stats',

  // Education
  ADAPTIVE_REVIEW: '/education/adaptive',
  QUESTION_BANK: '/education/qbank',
  SIMULATED_EXAMS: '/education/simulator',
  CASE_STUDIES: '/education/cases',

  // Reference
  CONDITIONS: '/reference/conditions',
  DRUGS: '/reference/drugs',
  DIAGNOSTICS: '/reference/diagnostics',
  GUIDELINES: '/reference/guidelines',

  // Skills
  MEDICAL_TERMINOLOGY: '/skills/terminology',
  RAPID_RECALL: '/skills/rapid',
  VISUAL_DIAGNOSTICS: '/skills/visuals',

  // Additional routes (if needed)
  HOME: '/',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  ADMIN_CURATION: '/admin/curation',
} as const;

// Type for route values
export type AppRoute = typeof ROUTES[keyof typeof ROUTES];

// Helper function to check if a path matches a route
export const matchesRoute = (currentPath: string, route: AppRoute): boolean => {
  return currentPath === route || currentPath.startsWith(route + '/');
};
