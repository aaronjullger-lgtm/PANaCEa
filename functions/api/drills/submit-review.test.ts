import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Capture the handler passed to authenticatedEndpoint ────────────────────
// vi.hoisted runs before vi.mock factories, so _capture is initialized in time.
const _capture = vi.hoisted(() => ({
  handler: null as ((context: any) => Promise<any>) | null,
}));

// ── Mock all external dependencies ─────────────────────────────────────────
vi.mock('../_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));

vi.mock('../_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: any, handler: any) => {
    _capture.handler = handler;
    return handler;
  }),
  withCors: vi.fn(() => vi.fn()),
}));

vi.mock('../_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    addContext: vi.fn(),
  })),
}));

vi.mock('../_shared/requestLogger', () => ({
  attachLogMeta: vi.fn(),
  getRequestId: vi.fn(() => 'test-request-id'),
}));

vi.mock('../_shared/structuredLogger', () => ({
  createSpan: vi.fn(() => ({
    end: vi.fn(() => ({ durationMs: 42 })),
  })),
}));

vi.mock('../../../lib/services/drillReviewService', () => ({
  submitDrillReview: vi.fn(),
}));

vi.mock('../../../lib/observability/pipelineTracer', () => ({
  createPipelineTracer: vi.fn(() => ({
    step: vi.fn(),
    addContext: vi.fn(),
    getSummary: vi.fn(() => ({
      decisions: [],
      spans: [],
      warnings: [],
      totalDurationMs: 42,
    })),
  })),
}));

vi.mock('../../../lib/fsrs/eorScheduler', () => ({
  getEorRotationEnd: vi.fn(() => null),
}));

vi.mock('../ai/learning/profile-crud', () => ({
  scheduleConceptReview: vi.fn(),
}));

vi.mock('../../../lib/ensureDueVariant', () => ({
  ensureDueVariant: vi.fn(() => Promise.resolve()),
}));

vi.mock('./_shared/reviewQuestionResolver', () => ({
  resolveReviewQuestion: vi.fn(),
}));

vi.mock('../../../lib/services/drillAnalyticsService', () => ({
  getRelativeDrillPerformance: vi.fn(),
}));

vi.mock('../../../lib/api/schemas/drills', () => ({
  DrillSubmitReviewRequestSchema: { parse: (x: any) => x },
}));

// ── Import mocked functions ────────────────────────────────────────────────
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { submitDrillReview } from '../../../lib/services/drillReviewService';
import { scheduleConceptReview } from '../ai/learning/profile-crud';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
import { resolveReviewQuestion } from './_shared/reviewQuestionResolver';
import { getRelativeDrillPerformance } from '../../../lib/services/drillAnalyticsService';

// Force the module to load so capturedHandler gets assigned
import './submit-review';

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user-internal-123',
  yearInProgram: 2,
  currentRotation: 'FM',
  eorTestDate: null,
  rotationEndDate: null,
};

const MOCK_QUESTION = {
  id: 'question-abc',
  conditionId: 'cond-xyz',
  system: 'Cardiovascular',
  difficulty: 'medium',
  questionType: 'mcq',
  questionData: {},
};

const MOCK_VALIDATED = {
  questionId: 'question-abc',
  selectedAnswer: 'A',
  timeSpentMs: 15000,
  timeToFirstClick: 3000,
  answerSwitches: 0,
  totalDwellTime: 14000,
  timezone: 'America/New_York',
  wakeTimeHHMM: '07:00',
  telemetry: null,
  sessionType: 'drill' as const,
};

function makePrisma(userResult: any = MOCK_USER) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(userResult),
    },
    question: {
      findUnique: vi.fn().mockResolvedValue({ conditionFamily: 'Cardiac Arrhythmias' }),
    },
  };
}

function makeContext(overrides: Partial<{
  env: Record<string, any>;
  validated: Record<string, any>;
}> = {}) {
  return {
    env: { DATABASE_URL: 'postgresql://test', GEMINI_API_KEY: 'test-key', ...overrides.env },
    auth: { userId: 'clerk-user-1' },
    validated: { ...MOCK_VALIDATED, ...overrides.validated },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/drills/submit-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default happy-path mocks
    const prisma = makePrisma();
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);
    (resolveReviewQuestion as Mock).mockResolvedValue({ question: MOCK_QUESTION });
    (submitDrillReview as Mock).mockResolvedValue({
      isCorrect: true,
      fsrsSchedule: {
        intervalDays: 3,
        nextDueDate: '2026-04-10T00:00:00Z',
        stability: 4.5,
        difficulty: 0.3,
      },
    });
    (scheduleConceptReview as Mock).mockResolvedValue(undefined);
    (getRelativeDrillPerformance as Mock).mockResolvedValue({ percentile: 75 });
  });

  // ── 1. DATABASE_URL not configured ────────────────────────────────────
  it('returns 500 when DATABASE_URL is not configured', async () => {
    const result = await _capture.handler!(makeContext({ env: { DATABASE_URL: '' } }));

    expect(result).toMatchObject({ status: 500, error: 'Database not configured' });
    expect(createEdgePrismaClient).not.toHaveBeenCalled();
  });

  // ── 2. User not found ────────────────────────────────────────────────
  it('returns 404 when user not found', async () => {
    const prisma = makePrisma(null);
    (createEdgePrismaClient as Mock).mockReturnValue(prisma);

    const result = await _capture.handler!(makeContext());

    expect(result).toMatchObject({ status: 404, error: 'User not found' });
  });

  // ── 3. Question not found ────────────────────────────────────────────
  it('returns 404 when question not found', async () => {
    (resolveReviewQuestion as Mock).mockResolvedValue({ question: null });

    const result = await _capture.handler!(makeContext());

    expect(result).toMatchObject({ status: 404, error: 'Question not found' });
  });

  // ── 4. Calls submitDrillReview with correct parameters ───────────────
  it('calls submitDrillReview with correct parameters', async () => {
    await _capture.handler!(makeContext());

    expect(submitDrillReview).toHaveBeenCalledTimes(1);
    const [prismaArg, userId, reviewData, question, _logger, eorRotationEnd, urgencyMult, tracer] =
      (submitDrillReview as Mock).mock.calls[0];

    expect(prismaArg).toBeDefined();
    expect(userId).toBe(MOCK_USER.id);
    expect(reviewData.questionId).toBe('question-abc');
    expect(reviewData.selectedAnswer).toBe('A');
    expect(reviewData.sessionType).toBe('drill');
    expect(question).toEqual(MOCK_QUESTION);
    expect(eorRotationEnd).toBeNull(); // mocked getEorRotationEnd returns null
    expect(urgencyMult).toBeUndefined();
    expect(tracer).toBeDefined();
  });

  // ── 5. Returns FSRS schedule data when available ─────────────────────
  it('returns nextReview with FSRS schedule data', async () => {
    const result = await _capture.handler!(makeContext());

    expect(result.data.nextReview).toEqual({
      intervalDays: 3,
      nextDueDate: '2026-04-10T00:00:00Z',
      stability: 4.5,
      difficulty: 0.3,
    });
  });

  // ── 6. Returns null nextReview when no FSRS schedule ─────────────────
  it('returns null nextReview when no FSRS schedule', async () => {
    (submitDrillReview as Mock).mockResolvedValue({
      isCorrect: true,
      fsrsSchedule: null,
    });

    const result = await _capture.handler!(makeContext());

    expect(result.data.nextReview).toBeNull();
  });

  // ── 7. Calls scheduleConceptReview for correct answers ───────────────
  it('calls scheduleConceptReview for correct answers', async () => {
    (submitDrillReview as Mock).mockResolvedValue({ isCorrect: true, fsrsSchedule: null });

    await _capture.handler!(makeContext());

    expect(scheduleConceptReview).toHaveBeenCalledTimes(1);
    expect(scheduleConceptReview).toHaveBeenCalledWith(
      expect.anything(), // prisma
      MOCK_USER.id,
      `${MOCK_QUESTION.system}|${MOCK_QUESTION.conditionId}`,
      true
    );
  });

  // ── 8. Calls ensureDueVariant only for incorrect answers ─────────────
  it('calls ensureDueVariant only for incorrect answers', async () => {
    (submitDrillReview as Mock).mockResolvedValue({ isCorrect: false, fsrsSchedule: null });

    await _capture.handler!(makeContext());

    expect(ensureDueVariant).toHaveBeenCalledTimes(1);
    expect((ensureDueVariant as Mock).mock.calls[0][1]).toMatchObject({
      id: MOCK_QUESTION.id,
      conditionId: MOCK_QUESTION.conditionId,
    });
  });

  it('does NOT call ensureDueVariant for correct answers', async () => {
    (submitDrillReview as Mock).mockResolvedValue({ isCorrect: true, fsrsSchedule: null });

    await _capture.handler!(makeContext());

    expect(ensureDueVariant).not.toHaveBeenCalled();
  });

  // ── 9. Returns 504 for timeout errors ────────────────────────────────
  it('returns 504 for timeout errors with retryable=true', async () => {
    (submitDrillReview as Mock).mockRejectedValue(new Error('Connection timed out'));

    const result = await _capture.handler!(makeContext());

    expect(result.status).toBe(504);
    expect(result.code).toBe('SUBMISSION_TIMEOUT');
    expect(result.retryable).toBe(true);
  });

  // ── 10. Returns 500 for database errors ──────────────────────────────
  it('returns 500 for database errors with retryable=true', async () => {
    (submitDrillReview as Mock).mockRejectedValue(new Error('prisma connection pool exhausted'));

    const result = await _capture.handler!(makeContext());

    expect(result.status).toBe(500);
    expect(result.code).toBe('DATABASE_ERROR');
    expect(result.retryable).toBe(true);
  });

  // ── 11. Returns 500 for unknown errors ───────────────────────────────
  it('returns 500 for unknown errors with retryable=false', async () => {
    (submitDrillReview as Mock).mockRejectedValue(new Error('something unexpected'));

    const result = await _capture.handler!(makeContext());

    expect(result.status).toBe(500);
    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.retryable).toBe(false);
  });

  // ── 12. Always calls safePrismaDisconnect ────────────────────────────
  it('calls safePrismaDisconnect on success', async () => {
    await _capture.handler!(makeContext());

    expect(safePrismaDisconnect).toHaveBeenCalledTimes(1);
  });

  it('calls safePrismaDisconnect on error', async () => {
    (submitDrillReview as Mock).mockRejectedValue(new Error('boom'));

    await _capture.handler!(makeContext());

    expect(safePrismaDisconnect).toHaveBeenCalledTimes(1);
  });

  it('does NOT call safePrismaDisconnect when prisma was never created (no DATABASE_URL)', async () => {
    await _capture.handler!(makeContext({ env: { DATABASE_URL: '' } }));

    expect(safePrismaDisconnect).not.toHaveBeenCalled();
  });

  // ── 13. Handles scheduleConceptReview failure gracefully ─────────────
  it('handles scheduleConceptReview failure gracefully (non-fatal)', async () => {
    (submitDrillReview as Mock).mockResolvedValue({ isCorrect: true, fsrsSchedule: null });
    (scheduleConceptReview as Mock).mockRejectedValue(new Error('SRS service down'));

    const result = await _capture.handler!(makeContext());

    // Should still return success — scheduleConceptReview is non-fatal
    expect(result.data).toBeDefined();
    expect(result.data.isRapidGuess).toBe(false);
  });

  // ── Drill feedback ──────────────────────────────────────────────────
  it('includes drillFeedback for drill sessions', async () => {
    (getRelativeDrillPerformance as Mock).mockResolvedValue({ percentile: 80 });

    const result = await _capture.handler!(makeContext());

    expect(result.data.drillFeedback).toEqual({ percentile: 80 });
    expect(getRelativeDrillPerformance).toHaveBeenCalledTimes(1);
  });

  it('returns null drillFeedback when getRelativeDrillPerformance throws', async () => {
    (getRelativeDrillPerformance as Mock).mockRejectedValue(new Error('analytics down'));

    const result = await _capture.handler!(makeContext());

    expect(result.data.drillFeedback).toBeNull();
  });

  // ── isRapidGuess from telemetry ──────────────────────────────────────
  it('returns isRapidGuess=true when telemetry indicates rapid guess', async () => {
    const result = await _capture.handler!(
      makeContext({
        validated: { telemetry: { rapid_guess: true, session_id: 'sess-1' } },
      })
    );

    expect(result.data.isRapidGuess).toBe(true);
  });

  it('returns isRapidGuess=false by default', async () => {
    const result = await _capture.handler!(makeContext());

    expect(result.data.isRapidGuess).toBe(false);
  });
});
