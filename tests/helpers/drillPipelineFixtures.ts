/**
 * Shared test fixtures for drill submission pipeline integration tests.
 *
 * Provides factory functions for creating realistic test data
 * (questions, telemetry, Prisma mocks) so integration tests can
 * focus on real service behavior instead of boilerplate.
 */

import { vi } from 'vitest';

// ── Question Data Fixtures ──────────────────────────────────────

/** Standard MCQ with correctAnswer string */
export function makeVignetteQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-vignette-001',
    conditionId: 'cond-pneumonia',
    medicalContentId: 'mc-pulm-001',
    system: 'Pulmonary',
    questionType: 'mcq',
    difficulty: 'medium',
    questionData: {
      stem: 'A 55-year-old male presents with fever, productive cough with rusty sputum, and right lower lobe consolidation on chest X-ray. Which organism is the most likely cause?',
      options: [
        { value: 'Streptococcus pneumoniae', text: 'Streptococcus pneumoniae' },
        { value: 'Mycoplasma pneumoniae', text: 'Mycoplasma pneumoniae' },
        { value: 'Klebsiella pneumoniae', text: 'Klebsiella pneumoniae' },
        { value: 'Legionella pneumophila', text: 'Legionella pneumophila' },
      ],
      correctAnswer: 'Streptococcus pneumoniae',
      ...overrides,
    },
  };
}

/** Question using correctIndex instead of correctAnswer */
export function makeIndexedQuestion() {
  return {
    id: 'q-indexed-001',
    conditionId: 'cond-dm2',
    medicalContentId: 'mc-endo-001',
    system: 'Endocrine',
    questionType: 'mcq',
    difficulty: 'easy',
    questionData: {
      stem: 'Which medication is first-line for type 2 diabetes?',
      options: ['Metformin', 'Glipizide', 'Insulin glargine', 'Pioglitazone'],
      correctIndex: 0,
    },
  };
}

/** Question with choices array instead of options */
export function makeChoicesQuestion() {
  return {
    id: 'q-choices-001',
    conditionId: 'cond-htn',
    medicalContentId: 'mc-cv-001',
    system: 'Cardiovascular',
    questionType: 'mcq',
    difficulty: 'medium',
    questionData: {
      question: 'Which class of antihypertensive is preferred in a patient with diabetic nephropathy?',
      choices: [
        { label: 'ACE inhibitor' },
        { label: 'Beta blocker' },
        { label: 'Calcium channel blocker' },
        { label: 'Thiazide diuretic' },
      ],
      correctAnswer: 'ACE inhibitor',
    },
  };
}

/** Question using answer field (legacy format) */
export function makeLegacyQuestion() {
  return {
    id: 'q-legacy-001',
    conditionId: 'cond-appendicitis',
    medicalContentId: 'mc-gi-001',
    system: 'Gastrointestinal',
    questionType: 'mcq',
    difficulty: 'easy',
    questionData: {
      text: 'McBurney point tenderness is classically associated with which condition?',
      options: ['Appendicitis', 'Cholecystitis', 'Diverticulitis', 'Pancreatitis'],
      answer: 'Appendicitis',
    },
  };
}

/** Question using correct_option field */
export function makeCorrectOptionQuestion() {
  return {
    id: 'q-correct-opt-001',
    conditionId: 'cond-acs',
    medicalContentId: 'mc-cv-002',
    system: 'Cardiovascular',
    questionType: 'mcq',
    difficulty: 'hard',
    questionData: {
      stem: 'A patient presents with ST elevation in leads II, III, and aVF. Which coronary artery is most likely occluded?',
      options: [
        { value: 'Right coronary artery' },
        { value: 'Left anterior descending' },
        { value: 'Left circumflex' },
        { value: 'Left main coronary artery' },
      ],
      correct_option: 'Right coronary artery',
    },
  };
}

/** Question with no condition ID (should skip FSRS) */
export function makeNoConditionQuestion() {
  return {
    id: 'q-no-cond-001',
    conditionId: null,
    medicalContentId: null,
    system: null,
    questionType: 'mcq',
    difficulty: 'medium',
    questionData: {
      stem: 'Which vitamin deficiency causes scurvy?',
      options: ['Vitamin C', 'Vitamin D', 'Vitamin B12', 'Vitamin K'],
      correctAnswer: 'Vitamin C',
    },
  };
}

// ── Telemetry Fixtures ──────────────────────────────────────────

/** Fast, confident correct answer (should yield high grade) */
export function makeFastCorrectTelemetry() {
  return {
    duration_ms: 8000,
    time_to_first_interaction_ms: 5000,
    rapid_guess: false,
    question_type: 'vignette' as const,
    mvrt_threshold_ms: 3000,
    question_displayed_at: new Date(Date.now() - 8000).toISOString(),
    answer_submitted_at: new Date().toISOString(),
    answer_changes: 0,
    hint_viewed: false,
    hint_view_duration_ms: null,
  };
}

/** Slow, hesitant correct answer (should yield lower grade) */
export function makeSlowHesitantTelemetry() {
  return {
    duration_ms: 45000,
    time_to_first_interaction_ms: 25000,
    rapid_guess: false,
    question_type: 'vignette' as const,
    mvrt_threshold_ms: 3000,
    question_displayed_at: new Date(Date.now() - 45000).toISOString(),
    answer_submitted_at: new Date().toISOString(),
    answer_changes: 3,
    hint_viewed: true,
    hint_view_duration_ms: 5000,
    hover_oscillations: 4,
    selection_drift_ms: 3000,
    cursor_entropy: 2.5,
  };
}

/** Rapid guess telemetry (below MVRT) */
export function makeRapidGuessTelemetry() {
  return {
    duration_ms: 800,
    time_to_first_interaction_ms: 500,
    rapid_guess: true,
    question_type: 'vignette' as const,
    mvrt_threshold_ms: 3000,
    question_displayed_at: new Date(Date.now() - 800).toISOString(),
    answer_submitted_at: new Date().toISOString(),
    answer_changes: 0,
    hint_viewed: false,
    hint_view_duration_ms: null,
  };
}

/** Incorrect answer with reasonable timing */
export function makeIncorrectTelemetry() {
  return {
    duration_ms: 20000,
    time_to_first_interaction_ms: 12000,
    rapid_guess: false,
    question_type: 'vignette' as const,
    mvrt_threshold_ms: 3000,
    question_displayed_at: new Date(Date.now() - 20000).toISOString(),
    answer_submitted_at: new Date().toISOString(),
    answer_changes: 1,
    hint_viewed: false,
    hint_view_duration_ms: null,
  };
}

// ── Prisma Mock Factory ─────────────────────────────────────────

/**
 * Creates a minimal Prisma mock that stubs DB calls used by submitDrillReview.
 * Returns both the mock and tracking spies for assertion.
 */
export function createPrismaMock() {
  const questionAttemptCreate = vi.fn().mockResolvedValue({ id: 'attempt-001' });
  const questionAttemptFindFirst = vi.fn().mockResolvedValue(null);
  const reviewLogCreate = vi.fn().mockResolvedValue({ id: 'review-001' });
  const reviewLogFindMany = vi.fn().mockResolvedValue([]);
  const userProgressFindUnique = vi.fn().mockResolvedValue(null);
  const userProgressUpdate = vi.fn().mockResolvedValue({});
  const confusionPairUpsert = vi.fn().mockResolvedValue({});
  const confusionPairFindFirst = vi.fn().mockResolvedValue(null);
  const confusionPairFindMany = vi.fn().mockResolvedValue([]);
  const preGeneratedQuestionUpdate = vi.fn().mockResolvedValue({});
  const cardUpsert = vi.fn().mockResolvedValue({});
  const userTopicProgressUpsert = vi.fn().mockResolvedValue({});
  const userQuestionSeenFindUnique = vi.fn().mockResolvedValue(null);
  const userQuestionSeenUpsert = vi.fn().mockResolvedValue({});
  const questionUpdate = vi.fn().mockResolvedValue({});

  const reviewLogCount = vi.fn().mockResolvedValue(0);

  const prisma: any = {
    questionAttempt: { create: questionAttemptCreate, findFirst: questionAttemptFindFirst },
    reviewLog: { create: reviewLogCreate, findMany: reviewLogFindMany, count: reviewLogCount },
    userProgress: { findUnique: userProgressFindUnique, update: userProgressUpdate },
    medicalContent: { findFirst: vi.fn().mockResolvedValue(null) },
    confusionPair: { upsert: confusionPairUpsert, findFirst: confusionPairFindFirst, findMany: confusionPairFindMany },
    preGeneratedQuestion: { update: preGeneratedQuestionUpdate },
    card: { upsert: cardUpsert },
    userTopicProgress: { upsert: userTopicProgressUpsert },
    userQuestionSeen: { findUnique: userQuestionSeenFindUnique, upsert: userQuestionSeenUpsert },
    question: { update: questionUpdate },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    $executeRaw: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn((fn: Function) => fn(prisma)),
    $disconnect: vi.fn(),
  };

  return {
    prisma,
    spies: {
      questionAttemptCreate,
      questionAttemptFindFirst,
      reviewLogCreate,
      reviewLogFindMany,
      userProgressFindUnique,
      preGeneratedQuestionUpdate,
      cardUpsert,
      userQuestionSeenUpsert,
      questionUpdate,
    },
  };
}
