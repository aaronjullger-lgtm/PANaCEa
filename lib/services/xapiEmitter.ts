/**
 * xAPI (Experience API / Tin Can API) Event Emitter
 *
 * Transforms PANaCEa internal events into xAPI 1.0.3 statements
 * for LRS interoperability. Append-only immutable event log.
 *
 * @see https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-About.md
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

// ============================================================================
// Constants
// ============================================================================

const XAPI_BASE = 'https://studypanacea.com';
const ADL_VERB_BASE = 'http://adlnet.gov/expapi/verbs/';

const VERBS = {
  ANSWERED: { id: `${ADL_VERB_BASE}answered`, display: { 'en-US': 'answered' } },
  COMPLETED: { id: `${ADL_VERB_BASE}completed`, display: { 'en-US': 'completed' } },
  PRACTICED: { id: `${ADL_VERB_BASE}practiced`, display: { 'en-US': 'practiced' } },
  LAUNCHED: { id: `${ADL_VERB_BASE}launched`, display: { 'en-US': 'launched' } },
  TERMINATED: { id: `${ADL_VERB_BASE}terminated`, display: { 'en-US': 'terminated' } },
  INTERACTED: { id: `${ADL_VERB_BASE}interacted`, display: { 'en-US': 'interacted' } },
} as const;

/** PANaCEa extension URIs for xAPI context/result extensions */
const EXT = {
  FSRS_RETENTION: `${XAPI_BASE}/xapi/fsrs-retention`,
  FSRS_STABILITY: `${XAPI_BASE}/xapi/fsrs-stability`,
  FSRS_DIFFICULTY: `${XAPI_BASE}/xapi/fsrs-difficulty`,
  FSRS_INTERVAL_DAYS: `${XAPI_BASE}/xapi/fsrs-interval-days`,
  SESSION_TYPE: `${XAPI_BASE}/xapi/session-type`,
  QUESTION_FORMAT: `${XAPI_BASE}/xapi/question-format`,
  DRILL_TYPE: `${XAPI_BASE}/xapi/drill-type`,
  COGNITIVE_LEVEL: `${XAPI_BASE}/xapi/cognitive-level`,
  SYSTEM_TAG: `${XAPI_BASE}/xapi/system-tag`,
  OSCE_SCORE: `${XAPI_BASE}/xapi/osce-score`,
  CONFIDENCE: `${XAPI_BASE}/xapi/confidence`,
} as const;

// ============================================================================
// Types
// ============================================================================

export type XapiVerbType = keyof typeof VERBS;

export interface XapiActor {
  mbox?: string;
  account?: { homePage: string; name: string };
}

export interface XapiStatement {
  id: string;
  actor: XapiActor;
  verb: { id: string; display: Record<string, string> };
  object: {
    id: string;
    definition?: {
      name?: Record<string, string>;
      description?: Record<string, string>;
      type?: string;
    };
  };
  result?: {
    score?: { raw: number; min: number; max: number; scaled?: number };
    success?: boolean;
    duration?: string;
    completion?: boolean;
    response?: string;
    extensions?: Record<string, unknown>;
  };
  context?: {
    registration?: string;
    platform?: string;
    language?: string;
    extensions?: Record<string, unknown>;
  };
  timestamp: string;
  stored: string;
  version?: string;
  authority?: XapiActor;
}

/** Internal PANaCEa event shape */
export interface PanaceaEvent {
  type: 'question_answered' | 'review_completed' | 'card_reviewed' | 'session_started' | 'session_completed' | 'osce_completed';
  userId: string;
  userEmail?: string;
  timestamp: string;
  sessionId?: string;

  // Question answered
  questionId?: string;
  questionText?: string;
  questionFormat?: string;
  isCorrect?: boolean;
  cognitiveLevel?: string;

  // Review / Card
  cardId?: string;
  drillType?: string;

  // Session
  sessionType?: string;
  durationMs?: number;

  // FSRS metadata
  retention?: number;
  stability?: number;
  difficulty?: number;
  intervalDays?: number;

  // OSCE
  osceScenarioId?: string;
  osceScore?: number;
  osceScenarioName?: string;

  // Confidence
  confidence?: number;

  // Content system tag
  systemTag?: string;
}

/** Configuration for batch emission */
export interface XapiEmitterConfig {
  lrsEndpoint?: string;
  lrsAuth?: string;
  lrsBatchSize?: number;
  platform?: string;
  authority?: XapiActor;
}

// ============================================================================
// Statement Builder
// ============================================================================

function buildActor(userId: string, userEmail?: string): XapiActor {
  if (userEmail) {
    return { mbox: `mailto:${userEmail}` };
  }
  return { account: { homePage: XAPI_BASE, name: userId } };
}

function buildDurationIso(ms: number): string {
  if (ms < 1000) return `PT${ms}M`;
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}H`);
  if (minutes > 0) parts.push(`${minutes}M`);
  if (seconds > 0) parts.push(`${seconds}S`);
  return `PT${parts.join('')}`;
}

function buildContext(event: PanaceaEvent, config: XapiEmitterConfig): XapiStatement['context'] {
  const extensions: Record<string, unknown> = {};

  if (event.retention !== undefined) extensions[EXT.FSRS_RETENTION] = event.retention;
  if (event.stability !== undefined) extensions[EXT.FSRS_STABILITY] = event.stability;
  if (event.difficulty !== undefined) extensions[EXT.FSRS_DIFFICULTY] = event.difficulty;
  if (event.intervalDays !== undefined) extensions[EXT.FSRS_INTERVAL_DAYS] = event.intervalDays;
  if (event.sessionType) extensions[EXT.SESSION_TYPE] = event.sessionType;
  if (event.questionFormat) extensions[EXT.QUESTION_FORMAT] = event.questionFormat;
  if (event.drillType) extensions[EXT.DRILL_TYPE] = event.drillType;
  if (event.cognitiveLevel) extensions[EXT.COGNITIVE_LEVEL] = event.cognitiveLevel;
  if (event.systemTag) extensions[EXT.SYSTEM_TAG] = event.systemTag;
  if (event.confidence !== undefined) extensions[EXT.CONFIDENCE] = event.confidence;

  const ctx: XapiStatement['context'] = {
    platform: config.platform ?? 'StudyPanacea',
    extensions: Object.keys(extensions).length > 0 ? extensions : undefined,
  };

  if (event.sessionId) ctx.registration = event.sessionId;

  return ctx;
}

function buildResult(event: PanaceaEvent): XapiStatement['result'] {
  const result: XapiStatement['result'] = {};

  if (event.isCorrect !== undefined) {
    result.score = { raw: event.isCorrect ? 1 : 0, min: 0, max: 1, scaled: event.isCorrect ? 1 : -1 };
    result.success = event.isCorrect;
  }

  if (event.osceScore !== undefined) {
    result.score = { raw: event.osceScore, min: 0, max: 100, scaled: event.osceScore / 100 };
    result.success = event.osceScore >= 70;
    result.completion = true;
  }

  if (event.durationMs !== undefined) {
    result.duration = buildDurationIso(event.durationMs);
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function mapEventTypeToVerb(type: PanaceaEvent['type']): typeof VERBS[XapiVerbType] {
  const mapping: Record<PanaceaEvent['type'], XapiVerbType> = {
    question_answered: 'ANSWERED',
    review_completed: 'COMPLETED',
    card_reviewed: 'PRACTICED',
    session_started: 'LAUNCHED',
    session_completed: 'TERMINATED',
    osce_completed: 'INTERACTED',
  };
  return VERBS[mapping[type]];
}

function buildObject(event: PanaceaEvent): XapiStatement['object'] {
  switch (event.type) {
    case 'question_answered':
      return {
        id: `${XAPI_BASE}/questions/${event.questionId ?? 'unknown'}`,
        definition: {
          name: { 'en-US': 'Question' },
          description: event.questionText ? { 'en-US': event.questionText.substring(0, 500) } : undefined,
          type: event.questionFormat
            ? `${XAPI_BASE}/xapi/activity-types/${event.questionFormat}`
            : `${XAPI_BASE}/xapi/activity-types/question`,
        },
      };
    case 'review_completed':
    case 'card_reviewed':
      return {
        id: event.drillType
          ? `${XAPI_BASE}/drills/${event.drillType}/${event.cardId ?? 'unknown'}`
          : `${XAPI_BASE}/cards/${event.cardId ?? 'unknown'}`,
        definition: {
          name: { 'en-US': event.drillType ? `Drill: ${event.drillType}` : 'FSRS Card' },
          type: `${XAPI_BASE}/xapi/activity-types/${event.drillType ?? 'card'}`,
        },
      };
    case 'session_started':
    case 'session_completed':
      return {
        id: `${XAPI_BASE}/sessions/${event.sessionId ?? 'unknown'}`,
        definition: {
          name: { 'en-US': 'Study Session' },
          type: `${XAPI_BASE}/xapi/activity-types/session`,
        },
      };
    case 'osce_completed':
      return {
        id: `${XAPI_BASE}/osce/${event.osceScenarioId ?? 'unknown'}`,
        definition: {
          name: { 'en-US': event.osceScenarioName ?? 'OSCE Encounter' },
          description: event.osceScenarioName
            ? { 'en-US': `Clinical simulation: ${event.osceScenarioName}` }
            : undefined,
          type: `${XAPI_BASE}/xapi/activity-types/osce`,
        },
      };
  }
}

// ============================================================================
// Public API
// ============================================================================

const DEFAULT_CONFIG: Required<Pick<XapiEmitterConfig, 'lrsBatchSize' | 'platform'>> = {
  lrsBatchSize: 25,
  platform: 'StudyPanacea',
};

/**
 * Transforms a PANaCEa internal event into an xAPI 1.0.3 statement.
 */
export function createXapiStatement(event: PanaceaEvent, config: XapiEmitterConfig = {}): XapiStatement {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const now = new Date().toISOString();

  const statement: XapiStatement = {
    id: uuidv4(),
    actor: buildActor(event.userId, event.userEmail),
    verb: mapEventTypeToVerb(event.type),
    object: buildObject(event),
    timestamp: event.timestamp || now,
    stored: now,
    version: '1.0.3',
  };

  const result = buildResult(event);
  if (result) statement.result = result;

  const ctx = buildContext(event, mergedConfig);
  if (ctx) statement.context = ctx;

  if (mergedConfig.authority) statement.authority = mergedConfig.authority;

  return statement;
}

/**
 * Batch-creates xAPI statements and sends them to an LRS (or logs).
 * Returns the created statements for auditability.
 */
export async function batchEmitStatements(
  events: PanaceaEvent[],
  config: XapiEmitterConfig = {},
): Promise<{ statements: XapiStatement[]; emitted: number; errors: number }> {
  const statements = events.map((e) => createXapiStatement(e, config));
  let emitted = 0;
  let errors = 0;

  const { lrsEndpoint, lrsAuth } = config;

  if (!lrsEndpoint) {
    // No LRS configured — log and return
    logger.info('[xAPI] Batch created (no LRS endpoint configured)', {
      count: statements.length,
    });
    return { statements, emitted: 0, errors: 0 };
  }

  // Send in batches
  const batchSize = config.lrsBatchSize ?? DEFAULT_CONFIG.lrsBatchSize;
  for (let i = 0; i < statements.length; i += batchSize) {
    const batch = statements.slice(i, i + batchSize);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Experience-API-Version': '1.0.3',
      };
      if (lrsAuth) headers['Authorization'] = lrsAuth;

      const response = await fetch(lrsEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error('[xAPI] LRS rejected batch', { status: response.status, body: text });
        errors += batch.length;
      } else {
        emitted += batch.length;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[xAPI] LRS send failed', { error: message });
      errors += batch.length;
    }
  }

  return { statements, emitted, errors };
}

/**
 * Express/Hono middleware that captures key events and buffers them
 * for xAPI emission. Returns middleware and a `drain()` function.
 */
export function xapiMiddleware(
  config: XapiEmitterConfig = {},
): {
  middleware: (request: Request, userId?: string) => PanaceaEvent | null;
  drain: () => PanaceaEvent[];
} {
  const buffer: PanaceaEvent[] = [];

  return {
    middleware(request: Request, userId?: string): PanaceaEvent | null {
      const url = new URL(request.url);
      const method = request.method;
      const now = new Date().toISOString();

      // Session lifecycle
      if (method === 'POST' && url.pathname.endsWith('/sessions/start') && userId) {
        const event: PanaceaEvent = { type: 'session_started', userId, timestamp: now };
        buffer.push(event);
        return event;
      }

      if (method === 'POST' && url.pathname.endsWith('/sessions/end') && userId) {
        const event: PanaceaEvent = { type: 'session_completed', userId, timestamp: now };
        buffer.push(event);
        return event;
      }

      // Question attempt
      if (method === 'POST' && url.pathname.includes('/questions/attempt') && userId) {
        const event: PanaceaEvent = { type: 'question_answered', userId, timestamp: now, sessionId: url.searchParams.get('sessionId') ?? undefined };
        buffer.push(event);
        return event;
      }

      // Drill review
      if (method === 'POST' && url.pathname.includes('/drills/submit-review') && userId) {
        const event: PanaceaEvent = { type: 'card_reviewed', userId, timestamp: now };
        buffer.push(event);
        return event;
      }

      return null;
    },

    drain(): PanaceaEvent[] {
      const drained = [...buffer];
      buffer.length = 0;
      return drained;
    },
  };
}

// ============================================================================
// Exports for testing / cron
// ============================================================================

export { VERBS, EXT, XAPI_BASE };
