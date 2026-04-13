/**
 * Tests for xAPI Event Emitter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createXapiStatement,
  batchEmitStatements,
  xapiMiddleware,
  VERBS,
  EXT,
  XAPI_BASE,
  type PanaceaEvent,
  type XapiStatement,
} from '../lib/services/xapiEmitter';

// ============================================================================
// Helpers
// ============================================================================

const BASE_ACTOR = { account: { homePage: 'https://studypanacea.com', name: 'user-1' } };
const EMAIL_ACTOR = { mbox: 'mailto:aaron@example.com' };
const NOW = '2026-04-13T12:00:00.000Z';

function validStatement(stmt: XapiStatement): void {
  expect(stmt.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(stmt.actor).toBeDefined();
  expect(stmt.verb).toBeDefined();
  expect(stmt.verb.id).toBeTruthy();
  expect(stmt.object).toBeDefined();
  expect(stmt.object.id).toBeTruthy();
  expect(stmt.timestamp).toBeTruthy();
  expect(stmt.stored).toBeTruthy();
  expect(stmt.version).toBe('1.0.3');
}

// ============================================================================
// createXapiStatement
// ============================================================================

describe('createXapiStatement', () => {
  it('creates a valid question_answered statement', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'user-1',
      timestamp: NOW,
      questionId: 'q-42',
      questionText: 'What is the first-line treatment for hypertension?',
      isCorrect: true,
      cognitiveLevel: 'Apply',
      questionFormat: 'MCQ',
      durationMs: 30000,
      retention: 0.92,
      confidence: 0.85,
    };

    const stmt = createXapiStatement(event);
    validStatement(stmt);

    expect(stmt.actor).toEqual(BASE_ACTOR);
    expect(stmt.verb).toEqual(VERBS.ANSWERED);
    expect(stmt.object.id).toBe(`${XAPI_BASE}/questions/q-42`);
    expect(stmt.object.definition?.name).toEqual({ 'en-US': 'Question' });
    expect(stmt.object.definition?.type).toBe(`${XAPI_BASE}/xapi/activity-types/MCQ`);
    expect(stmt.result?.success).toBe(true);
    expect(stmt.result?.score).toEqual({ raw: 1, min: 0, max: 1, scaled: 1 });
    expect(stmt.result?.duration).toBe('PT30S');
    expect(stmt.context?.registration).toBeUndefined();
    expect(stmt.context?.extensions?.[EXT.FSRS_RETENTION]).toBe(0.92);
    expect(stmt.context?.extensions?.[EXT.COGNITIVE_LEVEL]).toBe('Apply');
    expect(stmt.context?.extensions?.[EXT.QUESTION_FORMAT]).toBe('MCQ');
    expect(stmt.context?.extensions?.[EXT.CONFIDENCE]).toBe(0.85);
  });

  it('creates a question_answered statement with wrong answer', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'user-1',
      timestamp: NOW,
      questionId: 'q-99',
      isCorrect: false,
      durationMs: 55000,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.result?.success).toBe(false);
    expect(stmt.result?.score?.raw).toBe(0);
    expect(stmt.result?.score?.scaled).toBe(-1);
    expect(stmt.result?.duration).toBe('PT55S');
  });

  it('creates a review_completed statement for drills', () => {
    const event: PanaceaEvent = {
      type: 'review_completed',
      userId: 'user-2',
      timestamp: NOW,
      cardId: 'card-7',
      drillType: 'PharmDrill',
      sessionId: 'sess-abc',
      isCorrect: true,
      retention: 0.78,
      stability: 5.2,
      difficulty: 6.1,
      intervalDays: 14,
    };

    const stmt = createXapiStatement(event);
    validStatement(stmt);

    expect(stmt.verb).toEqual(VERBS.COMPLETED);
    expect(stmt.object.id).toBe(`${XAPI_BASE}/drills/PharmDrill/card-7`);
    expect(stmt.object.definition?.name).toEqual({ 'en-US': 'Drill: PharmDrill' });
    expect(stmt.context?.registration).toBe('sess-abc');
    expect(stmt.context?.extensions?.[EXT.DRILL_TYPE]).toBe('PharmDrill');
    expect(stmt.context?.extensions?.[EXT.FSRS_STABILITY]).toBe(5.2);
    expect(stmt.context?.extensions?.[EXT.FSRS_DIFFICULTY]).toBe(6.1);
    expect(stmt.context?.extensions?.[EXT.FSRS_INTERVAL_DAYS]).toBe(14);
  });

  it('creates a card_reviewed statement', () => {
    const event: PanaceaEvent = {
      type: 'card_reviewed',
      userId: 'user-3',
      timestamp: NOW,
      cardId: 'card-12',
      isCorrect: true,
      retention: 0.95,
    };

    const stmt = createXapiStatement(event);
    validStatement(stmt);

    expect(stmt.verb).toEqual(VERBS.PRACTICED);
    expect(stmt.object.id).toBe(`${XAPI_BASE}/cards/card-12`);
    expect(stmt.object.definition?.name).toEqual({ 'en-US': 'FSRS Card' });
  });

  it('creates a session_started statement', () => {
    const event: PanaceaEvent = {
      type: 'session_started',
      userId: 'user-4',
      timestamp: NOW,
      sessionId: 'sess-123',
      sessionType: 'MAIN',
    };

    const stmt = createXapiStatement(event);
    validStatement(stmt);

    expect(stmt.verb).toEqual(VERBS.LAUNCHED);
    expect(stmt.object.id).toBe(`${XAPI_BASE}/sessions/sess-123`);
    expect(stmt.object.definition?.name).toEqual({ 'en-US': 'Study Session' });
    expect(stmt.context?.extensions?.[EXT.SESSION_TYPE]).toBe('MAIN');
  });

  it('creates a session_completed statement with duration', () => {
    const event: PanaceaEvent = {
      type: 'session_completed',
      userId: 'user-4',
      timestamp: NOW,
      sessionId: 'sess-123',
      sessionType: 'DRILL',
      durationMs: 3600000,
    };

    const stmt = createXapiStatement(event);
    validStatement(stmt);

    expect(stmt.verb).toEqual(VERBS.TERMINATED);
    expect(stmt.result?.duration).toBe('PT1H');
  });

  it('creates an osce_completed statement', () => {
    const event: PanaceaEvent = {
      type: 'osce_completed',
      userId: 'user-5',
      timestamp: NOW,
      osceScenarioId: 'osce-chest-pain',
      osceScenarioName: 'Chest Pain Evaluation',
      osceScore: 82,
      durationMs: 900000,
      confidence: 0.9,
    };

    const stmt = createXapiStatement(event);
    validStatement(stmt);

    expect(stmt.verb).toEqual(VERBS.INTERACTED);
    expect(stmt.object.id).toBe(`${XAPI_BASE}/osce/osce-chest-pain`);
    expect(stmt.object.definition?.name).toEqual({ 'en-US': 'Chest Pain Evaluation' });
    expect(stmt.object.definition?.description).toEqual({
      'en-US': 'Clinical simulation: Chest Pain Evaluation',
    });
    expect(stmt.result?.score).toEqual({ raw: 82, min: 0, max: 100, scaled: 0.82 });
    expect(stmt.result?.success).toBe(true);
    expect(stmt.result?.completion).toBe(true);
    expect(stmt.result?.duration).toBe('PT15M');
    expect(stmt.context?.extensions?.[EXT.CONFIDENCE]).toBe(0.9);
  });

  it('uses email actor when userEmail is provided', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'user-1',
      userEmail: 'aaron@example.com',
      timestamp: NOW,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.actor).toEqual(EMAIL_ACTOR);
  });

  it('falls back to account actor without email', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'uid-xyz',
      timestamp: NOW,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.actor).toEqual({
      account: { homePage: XAPI_BASE, name: 'uid-xyz' },
    });
  });

  it('uses provided timestamp or defaults to now', () => {
    const event: PanaceaEvent = {
      type: 'session_started',
      userId: 'u1',
      timestamp: NOW,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.timestamp).toBe(NOW);
  });

  it('defaults timestamp when not provided', () => {
    const event: PanaceaEvent = {
      type: 'session_started',
      userId: 'u1',
    };

    const stmt = createXapiStatement(event);
    expect(stmt.timestamp).toBeTruthy();
    expect(new Date(stmt.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('includes authority when configured', () => {
    const authority = { account: { homePage: XAPI_BASE, name: 'system' } };
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'u1',
      timestamp: NOW,
    };

    const stmt = createXapiStatement(event, { authority });
    expect(stmt.authority).toEqual(authority);
  });

  it('omits authority when not configured', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'u1',
      timestamp: NOW,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.authority).toBeUndefined();
  });

  it('omits result when no scorable data', () => {
    const event: PanaceaEvent = {
      type: 'session_started',
      userId: 'u1',
      timestamp: NOW,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.result).toBeUndefined();
  });

  it('omits context extensions when none provided', () => {
    const event: PanaceaEvent = {
      type: 'session_started',
      userId: 'u1',
      timestamp: NOW,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.context?.extensions).toBeUndefined();
  });

  it('generates unique IDs for each statement', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'u1',
      timestamp: NOW,
    };

    const ids = new Set(
      Array.from({ length: 50 }, () => createXapiStatement(event).id),
    );
    expect(ids.size).toBe(50);
  });

  it('includes system tag extension when provided', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'u1',
      timestamp: NOW,
      systemTag: 'CARDIOVASCULAR',
    };

    const stmt = createXapiStatement(event);
    expect(stmt.context?.extensions?.[EXT.SYSTEM_TAG]).toBe('CARDIOVASCULAR');
  });

  it('handles duration < 1s edge case', () => {
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'u1',
      timestamp: NOW,
      durationMs: 500,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.result?.duration).toBe('PT500M');
  });

  it('handles duration with hours and minutes', () => {
    const event: PanaceaEvent = {
      type: 'session_completed',
      userId: 'u1',
      timestamp: NOW,
      durationMs: 7265000, // 2h 1m 5s
    };

    const stmt = createXapiStatement(event);
    expect(stmt.result?.duration).toBe('PT2H1M5S');
  });

  it('OSCE score below 70 is not successful', () => {
    const event: PanaceaEvent = {
      type: 'osce_completed',
      userId: 'u1',
      timestamp: NOW,
      osceScenarioId: 'osce-1',
      osceScore: 55,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.result?.success).toBe(false);
  });

  it('truncates question text to 500 chars in description', () => {
    const longText = 'A'.repeat(1000);
    const event: PanaceaEvent = {
      type: 'question_answered',
      userId: 'u1',
      timestamp: NOW,
      questionText: longText,
    };

    const stmt = createXapiStatement(event);
    expect(stmt.object.definition?.description?.['en-US']?.length).toBeLessThanOrEqual(500);
  });
});

// ============================================================================
// batchEmitStatements
// ============================================================================

describe('batchEmitStatements', () => {
  const events: PanaceaEvent[] = [
    { type: 'question_answered', userId: 'u1', timestamp: NOW, questionId: 'q1', isCorrect: true },
    { type: 'session_started', userId: 'u1', timestamp: NOW },
    { type: 'osce_completed', userId: 'u2', timestamp: NOW, osceScore: 85 },
  ];

  it('returns statements without LRS configured', async () => {
    const result = await batchEmitStatements(events);
    expect(result.statements).toHaveLength(3);
    expect(result.emitted).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.statements[0].verb).toEqual(VERBS.ANSWERED);
    expect(result.statements[1].verb).toEqual(VERBS.LAUNCHED);
    expect(result.statements[2].verb).toEqual(VERBS.INTERACTED);
  });

  it('sends to LRS endpoint when configured', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const result = await batchEmitStatements(events, {
      lrsEndpoint: 'https://lrs.example.com/statements',
      lrsAuth: 'Basic abc123',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://lrs.example.com/statements');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['X-Experience-API-Version']).toBe('1.0.3');
    expect(call[1].headers['Authorization']).toBe('Basic abc123');
    expect(result.emitted).toBe(3);
    expect(result.errors).toBe(0);

    vi.unstubAllGlobals();
  });

  it('batches requests when count exceeds batch size', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const manyEvents: PanaceaEvent[] = Array.from({ length: 50 }, (_, i) => ({
      type: 'question_answered' as const,
      userId: `u-${i}`,
      timestamp: NOW,
    }));

    const result = await batchEmitStatements(manyEvents, {
      lrsEndpoint: 'https://lrs.example.com/statements',
      lrsBatchSize: 10,
    });

    expect(mockFetch).toHaveBeenCalledTimes(5); // 50 / 10
    expect(result.emitted).toBe(50);
    expect(result.errors).toBe(0);

    vi.unstubAllGlobals();
  });

  it('handles LRS rejection errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Invalid statement'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await batchEmitStatements(events, {
      lrsEndpoint: 'https://lrs.example.com/statements',
    });

    expect(result.errors).toBe(3);
    expect(result.emitted).toBe(0);

    vi.unstubAllGlobals();
  });

  it('handles network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await batchEmitStatements(events, {
      lrsEndpoint: 'https://lrs.example.com/statements',
    });

    expect(result.errors).toBe(3);
    expect(result.emitted).toBe(0);

    vi.unstubAllGlobals();
  });
});

// ============================================================================
// xapiMiddleware
// ============================================================================

describe('xapiMiddleware', () => {
  it('captures session start', () => {
    const { middleware, drain } = xapiMiddleware();
    const request = new Request('https://studypanacea.com/api/sessions/start', { method: 'POST' });

    const event = middleware(request, 'user-1');
    expect(event).not.toBeNull();
    expect(event?.type).toBe('session_started');
    expect(event?.userId).toBe('user-1');

    const drained = drain();
    expect(drained).toHaveLength(1);
  });

  it('captures session end', () => {
    const { middleware, drain } = xapiMiddleware();
    const request = new Request('https://studypanacea.com/api/sessions/end', { method: 'POST' });

    const event = middleware(request, 'user-1');
    expect(event?.type).toBe('session_completed');

    drain(); // clear
  });

  it('captures question attempt with sessionId', () => {
    const { middleware, drain } = xapiMiddleware();
    const request = new Request('https://studypanacea.com/api/questions/attempt?sessionId=sess-1', {
      method: 'POST',
    });

    const event = middleware(request, 'user-1');
    expect(event?.type).toBe('question_answered');
    expect(event?.sessionId).toBe('sess-1');

    drain();
  });

  it('captures drill submit-review', () => {
    const { middleware, drain } = xapiMiddleware();
    const request = new Request('https://studypanacea.com/api/drills/submit-review', {
      method: 'POST',
    });

    const event = middleware(request, 'user-1');
    expect(event?.type).toBe('card_reviewed');

    drain();
  });

  it('returns null for unmatched routes', () => {
    const { middleware, drain } = xapiMiddleware();
    const request = new Request('https://studypanacea.com/api/questions/search', {
      method: 'GET',
    });

    const event = middleware(request, 'user-1');
    expect(event).toBeNull();

    const drained = drain();
    expect(drained).toHaveLength(0);
  });

  it('returns null when userId is missing', () => {
    const { middleware } = xapiMiddleware();
    const request = new Request('https://studypanacea.com/api/sessions/start', { method: 'POST' });

    const event = middleware(request);
    expect(event).toBeNull();
  });

  it('returns null for non-POST requests on matched paths', () => {
    const { middleware } = xapiMiddleware();
    const request = new Request('https://studypanacea.com/api/sessions/start', { method: 'GET' });

    const event = middleware(request, 'user-1');
    expect(event).toBeNull();
  });

  it('drain clears the buffer', () => {
    const { middleware, drain } = xapiMiddleware();
    const req = new Request('https://studypanacea.com/api/sessions/start', { method: 'POST' });

    middleware(req, 'u1');
    middleware(req, 'u2');

    const first = drain();
    expect(first).toHaveLength(2);

    const second = drain();
    expect(second).toHaveLength(0);
  });
});

// ============================================================================
// Verb mapping coverage
// ============================================================================

describe('verb mapping coverage', () => {
  const types: PanaceaEvent['type'][] = [
    'question_answered',
    'review_completed',
    'card_reviewed',
    'session_started',
    'session_completed',
    'osce_completed',
  ];

  const expectedVerbs = ['answered', 'completed', 'practiced', 'launched', 'terminated', 'interacted'];

  it.each(types.map((type, i) => [type, expectedVerbs[i]]))(
    'maps %s → %s',
    (type, verb) => {
      const event: PanaceaEvent = { type: type as PanaceaEvent['type'], userId: 'u1', timestamp: NOW };
      const stmt = createXapiStatement(event);
      expect(stmt.verb.display['en-US']).toBe(verb);
    },
  );
});
