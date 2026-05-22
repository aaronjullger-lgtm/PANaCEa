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
  ADMIN_AGENTS: '/admin/agents',
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
  STUDY_REVIEW: '/study/review',
  STUDY_PATH: '/study/path',
  STUDY_MAIN_SESSION: '/study/main-session',
  DAILY_CHALLENGES: '/daily-challenges',
  MENU: '/menu',
  /** Core Adaptive FSRS study session */
  CORE_ADAPTIVE: '/core-adaptive',
} as const;

// Type for route values
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
