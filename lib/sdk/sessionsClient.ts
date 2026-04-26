/**
 * PANaCEa SDK — Sessions Domain Client
 *
 * Wraps POST /api/study/session/generate
 *
 * @module lib/sdk/sessionsClient
 */

import type { ApiClient } from './core';
import type {
  SessionGeneratePayload,
  SessionGenerateResult,
  SessionQuestionsResult,
} from './types';

export interface SessionsClient {
  generate(opts?: SessionGeneratePayload): Promise<SessionGenerateResult>;
  getQuestions(sessionId: string): Promise<SessionQuestionsResult>;
}

export function createSessionsClient(api: ApiClient): SessionsClient {
  return {
    generate(opts) {
      return api.post<SessionGenerateResult>(
        '/api/study/session/generate',
        opts ?? ({} as SessionGeneratePayload)
      );
    },
    getQuestions(sessionId) {
      return api.get<SessionQuestionsResult>(`/api/study/session/${sessionId}/questions`);
    },
  };
}
