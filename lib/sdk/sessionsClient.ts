/**
 * PANaCEa SDK — Sessions Domain Client
 *
 * Wraps POST /api/study/session/generate
 *
 * @module lib/sdk/sessionsClient
 */

import type { ApiClient } from './core';
import type { SessionGeneratePayload, SessionGenerateResult } from './types';

export interface SessionsClient {
  generate(opts?: SessionGeneratePayload): Promise<SessionGenerateResult>;
}

export function createSessionsClient(api: ApiClient): SessionsClient {
  return {
    generate(opts) {
      return api.post<SessionGenerateResult>(
        '/api/study/session/generate',
        opts ?? ({} as SessionGeneratePayload)
      );
    },
  };
}
