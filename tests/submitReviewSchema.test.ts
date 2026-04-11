/**
 * submit-review Zod Schema Validation Tests
 *
 * Tests the DrillSubmitReviewSchema validation boundary to ensure:
 * - Valid requests pass
 * - Missing required fields are rejected
 * - Out-of-range values are rejected
 * - Strict telemetry schema rejects unknown fields
 * - Edge cases (numeric selectedAnswer, max timeSpentMs) are handled
 */

import { describe, it, expect, vi } from 'vitest';

// Mock edge-only dependencies that can't resolve in vitest/jsdom
vi.mock('../functions/api/_shared/prisma-edge', () => ({
  createEdgePrismaClient: vi.fn(),
  safePrismaDisconnect: vi.fn(),
}));
vi.mock('../functions/api/_shared/middleware', () => ({
  authenticatedEndpoint: vi.fn((_schema: unknown, handler: unknown) => handler),
  withCors: vi.fn(() => async (_context: unknown, next: unknown) => next?.()),
}));
vi.mock('../functions/api/_shared/secureLogger', () => ({
  createEndpointLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));
vi.mock('../functions/api/_shared/requestLogger', () => ({
  attachLogMeta: vi.fn(),
  getRequestId: vi.fn(() => 'test-req-id'),
}));
vi.mock('../functions/api/_shared/structuredLogger', () => ({
  createSpan: vi.fn((_name: unknown, fn: () => unknown) => fn()),
}));
vi.mock('../lib/services/drillReviewService', () => ({
  submitDrillReview: vi.fn(),
}));
vi.mock('../lib/observability/pipelineTracer', () => ({
  createPipelineTracer: vi.fn(() => ({ addStep: vi.fn(), finish: vi.fn() })),
}));
vi.mock('../lib/fsrs/eorScheduler', () => ({
  getEorRotationEnd: vi.fn(),
}));
vi.mock('../functions/api/intelligence/profile', () => ({
  scheduleConceptReview: vi.fn(),
}));
vi.mock('../lib/ensureDueVariant', () => ({
  ensureDueVariant: vi.fn(),
}));
vi.mock('../functions/api/drills/_shared/reviewQuestionResolver', () => ({
  resolveReviewQuestion: vi.fn(),
}));

import { DrillSubmitReviewSchema } from '../functions/api/drills/submit-review';

// ── Valid Payloads ────────────────────────────────────────────

const VALID_MINIMAL = {
  questionId: 'q-001',
  selectedAnswer: 'Answer A',
  timeSpentMs: 15000,
};

const VALID_FULL_TELEMETRY = {
  questionId: 'q-002',
  selectedAnswer: 'Answer B',
  timeSpentMs: 25000,
  timeToFirstClick: 5000,
  answerSwitches: 1,
  totalDwellTime: 25000,
  timezone: 'America/New_York',
  wakeTimeHHMM: '07:00',
  sessionType: 'drill',
  telemetry: {
    duration_ms: 25000,
    time_to_first_interaction_ms: 5000,
    rapid_guess: false,
    question_type: 'vignette' as const,
    mvrt_threshold_ms: 3000,
    question_displayed_at: '2026-04-06T12:00:00.000Z',
    answer_submitted_at: '2026-04-06T12:00:25.000Z',
    answer_changes: 1,
    hint_viewed: false,
    hint_view_duration_ms: null,
    hover_oscillations: 2,
    vignette_regressions: 0,
    selection_drift_ms: 500,
    tremor_score: 0.1,
    cursor_entropy: 1.2,
    elimination_velocity: 0.5,
  },
};

// ── Tests ─────────────────────────────────────────────────────

describe('DrillSubmitReviewSchema: Valid Requests', () => {
  it('accepts minimal valid payload', () => {
    const result = DrillSubmitReviewSchema.safeParse(VALID_MINIMAL);
    expect(result.success).toBe(true);
  });

  it('accepts full payload with all telemetry fields', () => {
    const result = DrillSubmitReviewSchema.safeParse(VALID_FULL_TELEMETRY);
    expect(result.success).toBe(true);
  });

  it('accepts numeric selectedAnswer', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      selectedAnswer: 2,
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid sessionType values', () => {
    for (const sessionType of ['main', 'drill', 'cram', 'rapid_recall']) {
      const result = DrillSubmitReviewSchema.safeParse({
        ...VALID_MINIMAL,
        sessionType,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts timeSpentMs at max boundary (3600000 = 1 hour)', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      timeSpentMs: 3600000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts telemetry with optional interactions array', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_FULL_TELEMETRY,
      telemetry: {
        ...VALID_FULL_TELEMETRY.telemetry,
        interactions: [
          { type: 'click', timestamp_ms: 1000, target: 'option-a' },
          { type: 'hover', timestamp_ms: 1500 },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts telemetry with device_info', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_FULL_TELEMETRY,
      telemetry: {
        ...VALID_FULL_TELEMETRY.telemetry,
        device_info: {
          viewport_width: 1920,
          viewport_height: 1080,
          device_pixel_ratio: 2,
          is_touch_device: false,
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('DrillSubmitReviewSchema: Required Field Validation', () => {
  it('rejects missing questionId', () => {
    const { questionId, ...rest } = VALID_MINIMAL;
    const result = DrillSubmitReviewSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty questionId', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      questionId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing selectedAnswer', () => {
    const { selectedAnswer, ...rest } = VALID_MINIMAL;
    const result = DrillSubmitReviewSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing timeSpentMs', () => {
    const { timeSpentMs, ...rest } = VALID_MINIMAL;
    const result = DrillSubmitReviewSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe('DrillSubmitReviewSchema: Range & Type Validation', () => {
  it('rejects negative timeSpentMs', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      timeSpentMs: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects timeSpentMs exceeding 1 hour', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      timeSpentMs: 3600001,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer timeSpentMs', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      timeSpentMs: 15000.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative answerSwitches', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      answerSwitches: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid sessionType', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      sessionType: 'review',
    });
    expect(result.success).toBe(false);
  });

  it('rejects boolean selectedAnswer', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_MINIMAL,
      selectedAnswer: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('DrillSubmitReviewSchema: Telemetry Strict Mode', () => {
  it('rejects unknown fields in telemetry (strict schema)', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_FULL_TELEMETRY,
      telemetry: {
        ...VALID_FULL_TELEMETRY.telemetry,
        unknown_field: 'should fail',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid question_type enum value', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_FULL_TELEMETRY,
      telemetry: {
        ...VALID_FULL_TELEMETRY.telemetry,
        question_type: 'essay',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects tremor_score above 1.0', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_FULL_TELEMETRY,
      telemetry: {
        ...VALID_FULL_TELEMETRY.telemetry,
        tremor_score: 1.5,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative cursor_entropy', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_FULL_TELEMETRY,
      telemetry: {
        ...VALID_FULL_TELEMETRY.telemetry,
        cursor_entropy: -0.5,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid interaction type', () => {
    const result = DrillSubmitReviewSchema.safeParse({
      ...VALID_FULL_TELEMETRY,
      telemetry: {
        ...VALID_FULL_TELEMETRY.telemetry,
        interactions: [{ type: 'drag', timestamp_ms: 100 }],
      },
    });
    expect(result.success).toBe(false);
  });
});
