import { fsrsLogger } from '../logger';
import { unwrapApiEnvelope } from '../utils/apiEnvelope';

export interface VariantNextResponse {
  srsItemId: string | null;
  cardId?: string | null;
  topicProgressId?: string;
  question: any;
  isVariant: boolean;
  taskType: string;
  progressContext?: 'READINESS' | 'TARGETED' | string | null;
  message?: string;
}

export interface VariantSubmitPayload {
  srsItemId?: string | null;
  topicProgressId?: string;
  questionId: string;
  variantId?: string;
  rating: number;
  isCorrect: boolean;
  userAnswer?: string;
  timeSpent?: number;
  progressContext?: 'READINESS' | 'TARGETED' | string | null;
}

export interface VariantSubmitResponse {
  success: boolean;
  nextReviewDate?: string;
  queuedVariantId?: string | null;
  triggerVisualRegeneration?: boolean;
  questionId?: string;
  conditionId?: string;
  topicProgressId?: string;
  visualRegenerationHint?: string;
}

export interface SrsAuthOptions {
  getToken?: () => Promise<string | null>;
}

export async function fetchNextVariantCard(
  options?: SrsAuthOptions
): Promise<VariantNextResponse | null> {
  try {
    const token = options?.getToken ? await options.getToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch('/api/srs/next', {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 401) {
        fsrsLogger.warn('User not authenticated for variant fetch');
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      fsrsLogger.error('Failed to fetch next card', { errorData });
      return null;
    }

    return unwrapApiEnvelope<VariantNextResponse>(await response.json());
  } catch (error) {
    fsrsLogger.error('Error fetching next variant card', { error });
    return null;
  }
}

export async function submitVariantReview(
  payload: VariantSubmitPayload,
  options?: SrsAuthOptions
): Promise<VariantSubmitResponse | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    fsrsLogger.warn('Offline SRS submit blocked; canonical FSRS review writes require server confirmation');
    return null;
  }

  try {
    const token = options?.getToken ? await options.getToken() : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch('/api/srs/submit', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 401) {
        fsrsLogger.warn('User not authenticated for variant submit');
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      fsrsLogger.error('Failed to submit review', { errorData });
      return null;
    }

    return unwrapApiEnvelope<VariantSubmitResponse>(await response.json());
  } catch (error) {
    fsrsLogger.error('Error submitting variant review', { error });
    return null;
  }
}
