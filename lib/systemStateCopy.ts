/**
 * Calm, recoverable system-state copy for PANaCEa.
 *
 * Keep raw error text in logs only. User-facing states should explain what is
 * unavailable, whether progress is safe, and the next reasonable action.
 */

export const CLINICAL_LOADING_MESSAGES = [
  'Building your next move...',
  'Checking review timing...',
  'Prioritizing missed patterns...',
  'Balancing blueprint coverage...',
] as const;

export type SystemStateContext =
  | 'default'
  | 'recommendations'
  | 'sync'
  | 'review'
  | 'knowledge'
  | 'profile'
  | 'study'
  | 'tutor';

export interface CalmSystemCopy {
  title: string;
  description: string;
}

const FALLBACK_COPY: Record<SystemStateContext, CalmSystemCopy> = {
  default: {
    title: 'This is temporarily unavailable.',
    description: 'Your progress is safe. Retry when you are ready.',
  },
  recommendations: {
    title: 'Recommendations unavailable.',
    description: 'Your progress is safe. Retry or start a default mixed block.',
  },
  sync: {
    title: 'Sync paused.',
    description: "Your progress is saved locally. We'll sync automatically when the connection returns.",
  },
  review: {
    title: 'Review queue unavailable.',
    description: 'Your progress is safe. Retry or start a short mixed review.',
  },
  knowledge: {
    title: 'Reference unavailable.',
    description: 'Your study session is safe. Retry or continue with the current card.',
  },
  profile: {
    title: 'Profile unavailable.',
    description: 'Your progress is safe. Retry in a moment.',
  },
  study: {
    title: 'Study session unavailable.',
    description: 'Your progress is safe. Retry or return to Study.',
  },
  tutor: {
    title: 'Tutor unavailable.',
    description: 'Continue the question and try the tutor again in a moment.',
  },
};

const RAW_ERROR_PATTERNS = [
  /\bfailed to\b/i,
  /\bfailed loading\b/i,
  /\bfailed fetching\b/i,
  /\bsyntaxerror\b/i,
  /\btypeerror\b/i,
  /\bhttp\s*\d{3}\b/i,
  /\b\d{3}\s+(internal server error|bad request|unauthorized|forbidden)\b/i,
  /\bat\s+[\w$.<>]+\s*\(/i,
  /\bstack trace\b/i,
];

function contextFromMessage(message: string): SystemStateContext {
  const lower = message.toLowerCase();
  if (lower.includes('recommendation')) return 'recommendations';
  if (lower.includes('sync') || lower.includes('offline') || lower.includes('connection')) return 'sync';
  if (lower.includes('review')) return 'review';
  if (lower.includes('knowledge') || lower.includes('reference')) return 'knowledge';
  if (lower.includes('profile')) return 'profile';
  if (lower.includes('question') || lower.includes('session') || lower.includes('study')) return 'study';
  if (lower.includes('tutor') || lower.includes('gemini')) return 'tutor';
  return 'default';
}

export function getClinicalLoadingMessage(index = 0): string {
  const normalizedIndex = Math.abs(index) % CLINICAL_LOADING_MESSAGES.length;
  return CLINICAL_LOADING_MESSAGES[normalizedIndex] ?? CLINICAL_LOADING_MESSAGES[0];
}

export function looksLikeRawError(message: string): boolean {
  return RAW_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getCalmSystemCopy(
  errorOrMessage?: unknown,
  context?: SystemStateContext
): CalmSystemCopy {
  const raw =
    typeof errorOrMessage === 'string'
      ? errorOrMessage
      : errorOrMessage instanceof Error
        ? errorOrMessage.message
        : '';
  const resolvedContext = context ?? contextFromMessage(raw);
  const fallback = FALLBACK_COPY[resolvedContext];

  if (!raw || looksLikeRawError(raw)) {
    return fallback;
  }

  return {
    title: raw,
    description: fallback.description,
  };
}

export function formatSystemToastMessage(
  message: string,
  context?: SystemStateContext
): string {
  const copy = getCalmSystemCopy(message, context);
  return `${copy.title} ${copy.description}`;
}
