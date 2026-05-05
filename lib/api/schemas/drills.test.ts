import { describe, expect, it } from 'vitest';
import { DrillSubmitReviewRequestSchema } from './drills';

describe('DrillSubmitReviewRequestSchema', () => {
  it('accepts explicit question source identity and guided-session telemetry', () => {
    const parsed = DrillSubmitReviewRequestSchema.parse({
      questionId: 'pg-1',
      canonicalQuestionId: null,
      sourceQuestionId: 'pg-1',
      questionSource: 'pre_generated',
      medicalContentId: 'mc-1',
      selectedAnswer: 'Albuterol',
      timeSpentMs: 42000,
      telemetry: {
        duration_ms: 42000,
        time_to_first_interaction_ms: 2500,
        rapid_guess: false,
        question_type: 'vignette',
        mvrt_threshold_ms: 3000,
        question_displayed_at: '2026-05-02T20:00:00.000Z',
        answer_submitted_at: '2026-05-02T20:00:42.000Z',
        answer_changes: 1,
        hint_viewed: false,
        hint_view_duration_ms: null,
        session_id: 'study-session-1',
        study_plan_task_id: 'task-1',
        study_plan_date: '2026-05-02',
        study_plan_source: 'study-plan',
        urgency_multiplier: 1.6,
        question_number: 3,
        input_method: 'mouse',
        option_interactions: [
          {
            option_id: 'A',
            selected_at_ms: 3000,
            deselected_at_ms: null,
            dwell_ms: null,
          },
        ],
        unique_options_considered: 1,
        study_mode: 'guided',
        guided_scaffold: {
          level: 'developing',
          hints_viewed: 1,
          reflection_length: 24,
        },
      },
      sessionType: 'targeted',
      idempotencyKey: 'review-12345678',
    });

    expect(parsed.questionSource).toBe('pre_generated');
    expect(parsed.telemetry?.question_number).toBe(3);
    expect(parsed.telemetry?.study_plan_task_id).toBe('task-1');
    expect(parsed.telemetry?.study_plan_date).toBe('2026-05-02');
    expect(parsed.telemetry?.urgency_multiplier).toBe(1.6);
    expect(parsed.telemetry?.guided_scaffold?.hints_viewed).toBe(1);
  });
});
