/**
 * API Configuration Utility
 * Stub implementation for test environment
 */

export const API_ENDPOINTS = {
  CONTENT_ALL: '/api/content/all',
  CONTENT_BY_ID: (id: string) => `/api/content/${id}`,
  CONDITIONS: '/api/conditions',
  QUESTIONS: '/api/questions',
  QUESTIONS_POOL: '/api/questions/pool',
  QUESTIONS_ANSWER_DISTRIBUTION: '/api/questions/answer-distribution',
  QUESTIONS_CURATE: '/api/questions/curate',
  LAB_TESTS: '/api/labtests',
  LAB_CASES: '/api/labcases',
  LABS_CASES: '/api/labs/cases', // Alternative naming for lab cases
  LAB_CASES_RANDOM: (count: number) => `/api/labcases/random/${count}`,
  IMAGING: '/api/imaging',
  DRUGS: '/api/drugs',
  DRUGS_ALL: '/api/drugs/all',
  GEMINI_PROXY: '/api/gemini',
  GEMINI_STREAM: '/api/gemini/stream',
  STUDY_CHAT: '/api/study/chat',
  STUDY_RESOURCES: '/api/study/resources',
  STUDY_RESOURCE_META: (id: string) => `/api/study/resources/${encodeURIComponent(id)}`,
  STUDY_RESOURCE_FILE: (id: string) => `/api/study/resources/${encodeURIComponent(id)}/file`,
  KNOWLEDGE_UPLOAD: '/api/knowledge/upload',
  KNOWLEDGE_CACHE: '/api/knowledge/cache',
  KNOWLEDGE_CACHE_DELETE: (name: string) => `/api/knowledge/cache/${encodeURIComponent(name)}`,
  KNOWLEDGE_CACHES: '/api/knowledge/caches',
  KNOWLEDGE_STUDENT_CONTEXT: '/api/knowledge/cache/student-context',
  DDX_GENERATE: '/api/ddx/generate',
  SESSIONS: '/api/sessions',
  REVIEWS: '/api/reviews',
  SYNC: '/api/sync',
  INTELLIGENCE_PROFILE: '/api/intelligence/profile',
  SRS_SUBMIT: '/api/srs/submit',
  RECOMMENDATIONS: '/api/recommendations',
  SUBMIT_REVIEW: '/api/drills/submit-review',
  USER_STATS: '/api/user/stats',
  USER_PREFERENCES: '/api/user/preferences',
  USER_SESSION: '/api/user/session',
  // Analytics (use getApiEndpoint for base URL consistency)
  ANALYTICS_CALIBRATION: '/api/analytics/calibration',
  ANALYTICS_PERFORMANCE_DELTAS: '/api/analytics/performance-deltas',
  ANALYTICS_PEER_STATS: (questionId: string) => `/api/analytics/peer-stats?questionId=${questionId}`,
  QUESTION_STATISTICS: (questionId: string) => `/api/question-statistics/${questionId}`,
  USER_STABILITY_TREND: '/api/user/stability-trend',
  // Study Path Optimizer (Phase 6.3)
  STUDY_PATH_RECOMMENDATION: '/api/study-path/recommendation',
  STUDY_PATH_PROGRESS: '/api/study-path/progress',
  STUDY_PATH_ACCEPT: '/api/study-path/accept',
  STUDY_PATH_REGENERATE: '/api/study-path/regenerate',
  // System Mapping Enrichment Assistant (Phase 6.2)
  MAPPING_ENRICHMENT_SUGGESTIONS: '/api/mapping-enrichment/suggestions',
  MAPPING_ENRICHMENT_SUGGESTION: (id: string) => `/api/mapping-enrichment/suggestions/${id}`,
  MAPPING_ENRICHMENT_BULK_APPROVE: '/api/mapping-enrichment/bulk-approve',
  MAPPING_ENRICHMENT_GAPS: '/api/mapping-enrichment/gaps',
  MAPPING_ENRICHMENT_SUGGEST: '/api/mapping-enrichment/suggest',
  MAPPING_ENRICHMENT_PREVIEW: '/api/mapping-enrichment/preview',
  MAPPING_ENRICHMENT_AUDIT_LOGS: '/api/mapping-enrichment/audit-logs',
} as const;

export type ApiEndpoint = keyof typeof API_ENDPOINTS;

/**
 * Get full API endpoint URL
 * In production, this would include the full domain
 * In development/test, returns relative paths
 */
export function getApiEndpoint(endpoint: ApiEndpoint | string): string {
  // Defensive check for undefined/null
  if (!endpoint) {
    console.warn('[apiConfig] getApiEndpoint called with undefined/null endpoint');
    return '/api';
  }

  // If it's a known endpoint constant, use it (only string values; some keys are functions)
  if (endpoint in API_ENDPOINTS) {
    const value = API_ENDPOINTS[endpoint as ApiEndpoint];
    if (typeof value === 'string') return value;
  }

  // If it's already a full path, return as-is
  if (endpoint.startsWith('/') || endpoint.startsWith('http')) {
    return endpoint;
  }

  // Default: assume it's a relative API path
  return `/api/${endpoint}`;
}

/**
 * Get base API URL
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side or test environment
  return process.env.API_BASE_URL || 'http://localhost:5173';
}

/**
 * Build full API URL
 */
export function buildApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const path = getApiEndpoint(endpoint);
  return `${base}${path}`;
}
