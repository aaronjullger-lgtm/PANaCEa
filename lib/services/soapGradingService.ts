// lib/services/soapGradingService.ts
// SOAP Note grading — browser client that calls the server grading endpoint.
//
// Migration notes (Sprint 4):
//   - Previously posted to the deprecated /geminiProxy endpoint (410 Gone).
//   - Now calls POST /api/drills/soap/grade, which wraps the unified AI
//     Gateway on the Cloudflare edge. The client therefore:
//       • never sees a model key,
//       • never parses raw model output,
//       • receives a pre-validated, schema-reconciled SoapBriefGrade.
//   - The external shape `GradingResult` is preserved verbatim so
//     SOAPNoteTrainer and the analytics helpers don't change.

import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { geminiLogger } from '../logger';

const LOG_SCOPE = 'SOAPGrading';

export interface GradingResult {
  totalScore: number; // 0-100
  breakdown: {
    subjective: number; // 0-25
    objective: number; // 0-25
    assessment: number; // 0-25
    plan: number; // 0-25
  };
  feedback: {
    strengths: string[];
    missedConcepts: string[]; // Critical findings they forgot
    suggestions: string[]; // Style/Medical phrasing improvements
  };
}

const isTestEnv =
  typeof process !== 'undefined' &&
  Boolean(
    (process.env as Record<string, string | undefined>)?.VITEST ??
      (process.env as Record<string, string | undefined>)?.NODE_ENV === 'test',
  );

/**
 * Minimal adapter type so callers can pass either a pre-fetched Clerk token
 * (`string | null`) or the Clerk `getToken` function itself. Keeps the
 * service transport-agnostic and easy to test.
 */
export type TokenProvider = string | null | (() => Promise<string | null>);

async function resolveToken(provider: TokenProvider | undefined): Promise<string | null> {
  if (!provider) return null;
  if (typeof provider === 'function') {
    try {
      return await provider();
    } catch (err) {
      geminiLogger.warn(`[${LOG_SCOPE}] token provider threw`, { err });
      return null;
    }
  }
  return provider;
}

/**
 * Grade a SOAP note on the server. Returns the structured grading result
 * consumed by SOAPNoteTrainer.
 *
 * @param userNote     The student's full SOAP note text (already concatenated).
 * @param caseContext  The answer-key case context (CC, HPI, vitals, PE, labs).
 * @param token        Optional Clerk token or async getter. When omitted the
 *                     endpoint's auth middleware will 401 — supply one in all
 *                     production call-sites.
 */
export async function gradeSoapNote(
  userNote: string,
  caseContext: string,
  token?: TokenProvider,
): Promise<GradingResult> {
  const trimmedNote = userNote.trim();
  if (!trimmedNote) {
    throw new Error('SOAP note is empty');
  }
  const trimmedContext = caseContext.trim();

  if (isTestEnv) {
    // Deterministic mock for tests — mirrors the server contract so
    // integration tests don't need a live edge function.
    return {
      totalScore: 80,
      breakdown: {
        subjective: 18,
        objective: 20,
        assessment: 22,
        plan: 20,
      },
      feedback: {
        strengths: ['Clear HPI structure', 'Appropriate vital sign interpretation'],
        missedConcepts: ['Did not mention red-flag symptom X'],
        suggestions: ['Tighten assessment wording', 'Add follow-up safety net instructions'],
      },
    };
  }

  const authToken = await resolveToken(token);
  const endpoint = getApiEndpoint('/api/drills/soap/grade');

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        studentNote: trimmedNote,
        caseContext: trimmedContext,
      }),
    });
  } catch (err) {
    geminiLogger.error(`[${LOG_SCOPE}] Network error calling SOAP grader`, { err });
    throw new Error('Network error while grading — check your connection and try again.');
  }

  if (!response.ok) {
    let serverMessage: string | undefined;
    try {
      const errBody = (await response.json()) as { error?: string };
      serverMessage = errBody?.error;
    } catch {
      /* ignore JSON parse failure on error body */
    }
    geminiLogger.error(`[${LOG_SCOPE}] Grader endpoint returned ${response.status}`, {
      status: response.status,
      serverMessage,
    });
    throw new Error(serverMessage ?? `SOAP grader returned HTTP ${response.status}`);
  }

  let envelope: { data?: GradingResult };
  try {
    envelope = (await response.json()) as { data?: GradingResult };
  } catch (err) {
    geminiLogger.error(`[${LOG_SCOPE}] Failed to parse grader response`, { err });
    throw new Error('Failed to parse grading result.');
  }

  const grade = envelope.data;
  if (!grade || typeof grade.totalScore !== 'number' || !grade.breakdown || !grade.feedback) {
    geminiLogger.error(`[${LOG_SCOPE}] Grader returned malformed envelope`, { envelope });
    throw new Error('Grader returned an incomplete response.');
  }
  return grade;
}
