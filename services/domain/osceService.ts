/**
 * OSCE Service
 * Handles persistence for Patient Encounter sessions
 */

import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
import type { PatientEncounterCase, PatientQuestion } from '@/types/drill-modes';

export interface OSCESession {
  id: string;
  userId: string;
  caseId: string;
  status: string;
  messages: any[];
  startTime: string;
  updatedAt: string;
}

/**
 * Helper to check if response is JSON and parse it
 */
async function parseJsonResponse(response: Response): Promise<any | null> {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    console.error('Response is not JSON. Backend server may not be running.');
    return null;
  }
  return response.json();
}

/**
 * Fetch a random patient encounter case
 */
export async function getRandomEncounterCase(
  token?: string | null,
  filters?: { targetSystems?: string[]; difficulty?: string }
): Promise<PatientEncounterCase | null> {
  try {
    const params = new URLSearchParams();
    if (filters?.targetSystems?.length) {
      params.set('targetSystem', filters.targetSystems.join(','));
    }
    if (filters?.difficulty) {
      params.set('difficulty', filters.difficulty);
    }
    const qs = params.toString();
    const response = await fetch(`/api/osce/cases/random${qs ? `?${qs}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      console.error('Failed to fetch case:', response.statusText);
      return null;
    }

    const json = await parseJsonResponse(response);
    return unwrapApiEnvelope<PatientEncounterCase | null>(json);
  } catch (error) {
    console.error('Error fetching random case:', error);
    return null;
  }
}

/**
 * Create or get active session
 */
export async function startOSCESession(
  caseId: string,
  token?: string | null
): Promise<OSCESession | null> {
  try {
    const response = await fetch('/api/osce/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body: { caseId } }),
    });

    if (!response.ok) return null;

    const data = await parseJsonResponse(response);
    return data?.data?.session ?? data?.session ?? null;
  } catch (error) {
    console.error('Error starting OSCE session:', error);
    return null;
  }
}

/**
 * Save chat history (append new messages)
 */
export async function saveOSCEChat(
  sessionId: string,
  messages: any[],
  token?: string | null
): Promise<boolean> {
  try {
    const response = await fetch('/api/osce/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body: { sessionId, messages } }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error saving OSCE chat:', error);
    return false;
  }
}

/**
 * Complete session
 */
export interface OSCETelemetryPayload {
  totalTimeMs?: number;
  clinicalConfidenceIndex?: number;
  redFlagsMissed?: number;
  unnecessaryOrders?: number;
  implicitRating?: { rating: number; confidence: number; components?: Record<string, number> };
  efficiencyScore?: number;
  speechMetrics?: Record<string, unknown>;
  diagnosticEfficiency?: Record<string, unknown>;
  rapportMetrics?: Record<string, unknown>;
  actionCount?: number;
}

export async function completeOSCESession(
  sessionId: string,
  diagnosis: string,
  treatmentPlan: string,
  token?: string | null,
  osceTelemetry?: OSCETelemetryPayload
): Promise<boolean> {
  try {
    const response = await fetch('/api/osce/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        body: {
          sessionId,
          diagnosis,
          treatmentPlan,
          ...(osceTelemetry ? { osceTelemetry } : {}),
        },
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error completing OSCE session:', error);
    return false;
  }
}

/** Bedside manner / soft skills from Ghost Listener analysis */
export interface SoftSkillsReport {
  empathy: { score: number; feedback: string };
  professionalism: { score: number; feedback: string };
  pacing: { score: number; feedback: string };
}

/** Grade API response: checklist (item, status, feedback), redFlagsMissed, score, etc. */
export interface OsceGradeResult {
  resultId: string;
  score: number;
  checklist: Array<{ item: string; status: 'PASS' | 'FAIL'; feedback: string }>;
  redFlagsMissed: string[];
  clinicalReasoningScore: number;
  billingCodeSuggestion: string;
  softSkillsReport?: SoftSkillsReport | null;
  conceptGapCreated?: boolean;
  communicationScore?: number;
  differentialScore?: number;
  dangerousActionsDetected?: Array<{ description: string; penalty: number }>;
}

/**
 * Grade completed OSCE session (rubric checklist + red flags).
 * Session must be completed first via completeOSCESession.
 */
export async function gradeOSCESession(
  sessionId: string,
  token?: string | null,
  differentials?: string[]
): Promise<OsceGradeResult | null> {
  try {
    const bodyPayload: Record<string, unknown> = { sessionId };
    if (differentials && differentials.length > 0) {
      bodyPayload.differentials = differentials;
    }
    const response = await fetch(getApiEndpoint(API_ENDPOINTS.OSCE_ANALYSIS_GRADE), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body: bodyPayload }),
    });

    if (!response.ok) return null;

    const data = await parseJsonResponse(response);
    // API returns handler { data: payload }; middleware sends result.data as body, so we get payload directly
    if (!data) return null;
    const payload = data.data ?? data;
    return typeof payload?.score === 'number' ? (payload as OsceGradeResult) : null;
  } catch (error) {
    console.error('Error grading OSCE session:', error);
    return null;
  }
}

/**
 * Generate a unique session ID (fallback if API fails)
 */
export function generateSessionId(): string {
  return `osce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Save a single chat message to the session history
 */
export async function saveChatMessage(
  sessionId: string,
  role: 'user' | 'patient',
  content: string,
  token?: string | null
): Promise<boolean> {
  try {
    // Map 'patient' to 'assistant' for API schema; wrap in body for Cloudflare Pages Functions
    const apiRole = role === 'patient' ? 'assistant' : 'user';
    const response = await fetch('/api/osce/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ body: { sessionId, messages: [{ role: apiRole, content }] } }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error saving chat message:', error);
    return false;
  }
}

/**
 * Retrieve session chat history
 */
export async function getSessionHistory(
  sessionId: string,
  token?: string | null
): Promise<Array<{
  id: string;
  role: 'user' | 'patient';
  message: string;
  timestamp: string;
  phase?: string;
}> | null> {
  try {
    const response = await fetch(`/api/osce/history?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) return null;

    const json: any = await response.json();
    // API returns { ok: true, data: { history } } — handle both wrapped and unwrapped shapes
    const data = unwrapApiEnvelope<{ history?: Array<any> }>(json);
    return data?.history ?? json?.history ?? [];
  } catch (error) {
    console.error('Error fetching session history:', error);
    return null;
  }
}

/**
 * Clear all chat messages for a session
 */
export async function clearSession(sessionId: string, token?: string | null): Promise<boolean> {
  try {
    const response = await fetch(`/api/osce/cleanup?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    return response.ok;
  } catch (error) {
    console.error('Error clearing session:', error);
    return false;
  }
}

/**
 * Calculate score for encounter session
 */
export function calculateEncounterScore(
  questions: PatientQuestion[],
  patientCase: PatientEncounterCase
): { efficiency: number; thoroughness: number; overall: number } {
  // Calculate thoroughness: percentage of essential questions asked
  const essentialAsked = questions.filter((q) => q.relevance === 'essential').length;
  const totalEssential = patientCase.essentialQuestions?.length || 1;
  const thoroughness = Math.min(100, (essentialAsked / totalEssential) * 100);

  // Calculate efficiency: penalize for unnecessary questions
  const unnecessaryAsked = questions.filter((q) => q.relevance === 'unnecessary').length;
  const totalQuestions = questions.length || 1;
  const efficiency = Math.max(0, 100 - (unnecessaryAsked / totalQuestions) * 50);

  // Overall score is weighted average
  const overall = thoroughness * 0.6 + efficiency * 0.4;

  return { efficiency, thoroughness, overall };
}
