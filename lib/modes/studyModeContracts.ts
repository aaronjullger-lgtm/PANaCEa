import {
  TRAINING_MODES,
  type TrainingModeConfig,
  type TrainingModeId,
} from '@/config/training-modes';

export type StudyModeProductionStatus =
  | 'fully_functional'
  | 'frontend_backend_disconnected'
  | 'backend_frontend_missing'
  | 'partially_mocked'
  | 'broken_route'
  | 'duplicate_obsolete'
  | 'unsafe_for_production';

export type StudyModeAuthRequirement = 'required' | 'optional' | 'none';

export type StudyModeReviewScheduling =
  | 'fsrs_real_review'
  | 'attempt_only'
  | 'mode_local'
  | 'osce_isolated'
  | 'none';

export type StudyModeId =
  | TrainingModeId
  | 'practice_questions'
  | 'review_mode'
  | 'weakness_adaptive_mode'
  | 'study_plan_scheduler'
  | 'condition_topic_study'
  | 'search_content_lookup'
  | 'pharmacology_drug_lookup'
  | 'analytics_progress_dashboard'
  | 'ai_tutor_explanation_mode';

export interface StudyModeApiCall {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  purpose: string;
  requestShape: string;
  responseShape: string;
  required: boolean;
  persistsData?: boolean;
}

export interface StudyModeProgressBehavior {
  mechanism: string;
  writes: string[];
  refreshSafeState: string;
}

export interface StudyModeCompletionBehavior {
  trigger: string;
  result: string;
  persistedState: string[];
}

export interface StudyModeStateBehavior {
  title: string;
  description: string;
  action?: string;
}

export interface StudyModeContract {
  modeId: StudyModeId;
  displayName: string;
  description: string;
  route: string;
  requiredAuth: StudyModeAuthRequirement;
  requiredUserState: string[];
  startingApiCall: StudyModeApiCall | null;
  answerInteractionApiCall: StudyModeApiCall | null;
  progressUpdateBehavior: StudyModeProgressBehavior;
  analyticsEvents: string[];
  reviewSchedulingBehavior: {
    type: StudyModeReviewScheduling;
    endpoint: string | null;
    details: string;
  };
  completionBehavior: StudyModeCompletionBehavior;
  emptyStateBehavior: StudyModeStateBehavior;
  errorStateBehavior: StudyModeStateBehavior;
  loadingStateBehavior: StudyModeStateBehavior;
  productionStatus: StudyModeProductionStatus;
  blockingIssues: string[];
  corePriority?: number;
  source: 'training_mode' | 'core_workflow' | 'audit_only';
}

type ContractOverride = Partial<
  Omit<StudyModeContract, 'modeId' | 'displayName' | 'description' | 'route' | 'source'>
>;

const userState = {
  signedIn: 'Clerk session is present and token can be fetched.',
  syncedUser: 'Clerk user has a matching internal User row.',
  questionPool: 'Question pool has enough eligible items for the requested mode.',
  mediaPool: 'MediaAsset/MedicalContentMedia has eligible approved assets.',
  progress: 'UserProgress/ReviewLog/QuestionAttempt can be read for this user.',
  content: 'Condition/MedicalContent/search index has seeded production data.',
};

function api(
  method: StudyModeApiCall['method'],
  path: string,
  purpose: string,
  requestShape: string,
  responseShape: string,
  required = true,
  persistsData = false
): StudyModeApiCall {
  return { method, path, purpose, requestShape, responseShape, required, persistsData };
}

const noStartingApi: StudyModeApiCall | null = null;

const submitReviewApi = api(
  'POST',
  '/api/drills/submit-review',
  'Persist answer, telemetry, QuestionAttempt, ReviewLog, UserProgress/FSRS when eligible.',
  'DrillSubmitReviewRequest',
  'SubmitDrillReviewResult envelope with correctness and nextReview.',
  true,
  true
);

const attemptOnlyApi = api(
  'POST',
  '/api/questions/attempt',
  'Persist question attempt and seen state without owning FSRS writes.',
  'QuestionAttemptRequest',
  'Attempt result envelope.',
  true,
  true
);

const modeStartApis: Partial<Record<TrainingModeId, StudyModeApiCall | null>> = {
  core_adaptive: api(
    'POST',
    '/api/study/session/generate',
    'Generate an authenticated adaptive question session.',
    '{ mode, size, sessionLane, blueprint? }',
    '{ sessionId, questions[] }'
  ),
  photo_drill: api('GET', '/api/drills/media', 'Load approved clinical media cases.', 'query filters', 'media drill cases'),
  ecg_drill: api('GET', '/api/drills/media', 'Load approved ECG media cases.', 'query type=ecg', 'media drill cases'),
  derm_drill: api('GET', '/api/drills/media', 'Load approved dermatology media cases.', 'query type=derm', 'media drill cases'),
  imaging_drill: api('GET', '/api/drills/media', 'Load approved imaging media cases.', 'query type=imaging', 'media drill cases'),
  rapid_recall: api('GET', '/api/questions', 'Load rapid recall question batch.', 'query category/focus', 'Question[]'),
  ddx_compare: api('GET', '/api/ddx/compare', 'Load differential comparison payload.', 'query condition/system', 'comparison data'),
  contrastive_drill: api('POST', '/api/drills/contrastive/start', 'Start contrastive drill set.', 'system/condition filters', 'contrastive set'),
  guideline_drill: api('GET', '/api/guidelines', 'Load guideline drill content.', 'query filters', 'guideline items'),
  mini_lab: api('GET', '/api/drills/lab-cases', 'Load lab interpretation cases.', 'query filters', 'lab cases'),
  first_line_treatment: api('GET', '/api/first-line', 'Load first-line treatment questions.', 'query category', 'treatment items'),
  pharmacology: api('GET', '/api/questions/pharmacology-drill', 'Load pharmacology drill questions.', 'query filters', 'Question[]'),
  condition_drill: api('GET', '/api/questions/condition-drill', 'Load condition-specific questions.', 'conditionId/system query', 'Question[]'),
  system_drill: api('GET', '/api/questions/system-drill', 'Load system-specific questions.', 'system query', 'Question[]'),
  subcategory_drill: api('GET', '/api/questions', 'Load subcategory question batch.', 'subcategory query', 'Question[]'),
  fluid_electrolyte: api('GET', '/api/drills/fluids', 'Load fluid/electrolyte scenarios.', 'query filters', 'fluid cases'),
  antibiotic_mode: api('GET', '/api/drills/antibiotics', 'Load bug-drug drill cases.', 'query filters', 'antibiotic cases'),
  patient_encounter: api('POST', '/api/osce/session', 'Create or resume virtual patient encounter.', 'case/session request', 'OSCE session'),
  panre_la: api('POST', '/api/study/session/generate', 'Generate PANRE-LA-style question session.', 'mode/size request', 'session questions'),
  code_blue_speed: api('GET', '/api/drills/code-blue', 'Load timed code-blue scenarios.', 'query filters', 'scenario cases'),
  grand_rounds: api('GET', '/api/grand-rounds/today', 'Load daily Grand Rounds challenge.', 'none', 'daily challenge'),
  ventilator_hero: api('GET', '/api/questions', 'Load ventilator management questions.', 'category=ventilator', 'Question[]'),
  diagnostic_puzzle: api('GET', '/api/diagnostic-puzzle/daily', 'Load daily diagnostic puzzle.', 'none', 'puzzle state'),
  physiology_drill: api('GET', '/api/questions', 'Load physiology questions.', 'category=physiology', 'Question[]'),
  anatomy_review: api('GET', '/api/anatomy/models', 'Load anatomy review models/content.', 'query filters', 'anatomy content'),
  medical_wordle: api('GET', '/api/games/wordle/daily', 'Load daily medical word puzzle.', 'none', 'wordle state'),
  cram_mode: api('GET', '/api/conditions/high-yield', 'Load high-yield cram conditions/questions.', 'none', 'conditions/questions'),
  pance_simulator: api('POST', '/api/study/session/generate', 'Generate timed exam-like question block.', 'mode/size request', 'session questions'),
  full_sit_down_test: api('POST', '/api/study/session/generate', 'Generate 300-question full exam session.', 'mode/size request', 'session questions'),
  commuter_mode: api('POST', '/api/podcast/generate', 'Generate audio/commuter study content.', 'topic/session request', 'audio/script payload'),
  elaboration_drill: api('POST', '/api/drills/elaboration/generate', 'Generate elaboration prompt.', 'system/topic request', 'elaboration prompt'),
  icd_coding_drill: null,
  teach_back_drill: api('GET', '/api/drills/teachback/generate', 'Load teach-back topic.', 'query system?', 'teach-back topic'),
};

const modeAnswerApis: Partial<Record<TrainingModeId, StudyModeApiCall | null>> = {
  diagnostic_puzzle: api('POST', '/api/diagnostic-puzzle/submit', 'Persist puzzle guess/result.', 'guess payload', 'puzzle result', true, true),
  medical_wordle: api('POST', '/api/games/wordle/guess', 'Persist wordle guess/result.', 'guess payload', 'wordle result', true, true),
  grand_rounds: api('POST', '/api/grand-rounds/submit', 'Persist Grand Rounds answer.', 'challenge answer', 'score/result', true, true),
  patient_encounter: api('POST', '/api/osce/complete', 'Complete and persist OSCE result.', 'session completion payload', 'OSCE result', true, true),
  elaboration_drill: api('POST', '/api/drills/elaboration/grade', 'Grade elaboration response.', 'free-text answer', 'grading result', true, true),
  teach_back_drill: api('POST', '/api/drills/teachback/grade', 'Grade teach-back response.', 'free-text answer', 'grading result', true, true),
  icd_coding_drill: null,
};

const modeStatus: Partial<Record<TrainingModeId, StudyModeProductionStatus>> = {
  core_adaptive: 'fully_functional',
  photo_drill: 'fully_functional',
  ecg_drill: 'fully_functional',
  derm_drill: 'fully_functional',
  imaging_drill: 'fully_functional',
  rapid_recall: 'fully_functional',
  condition_drill: 'fully_functional',
  system_drill: 'fully_functional',
  subcategory_drill: 'fully_functional',
  pharmacology: 'fully_functional',
  first_line_treatment: 'fully_functional',
  mini_lab: 'fully_functional',
  physiology_drill: 'fully_functional',
  anatomy_review: 'fully_functional',
  fluid_electrolyte: 'fully_functional',
  antibiotic_mode: 'fully_functional',
  ventilator_hero: 'fully_functional',
  grand_rounds: 'fully_functional',
  diagnostic_puzzle: 'fully_functional',
  medical_wordle: 'fully_functional',
  cram_mode: 'fully_functional',
  elaboration_drill: 'fully_functional',
  teach_back_drill: 'fully_functional',
  reasoning_tutor: 'partially_mocked',
  ddx_compare: 'unsafe_for_production',
  contrastive_drill: 'fully_functional',
  guideline_drill: 'partially_mocked',
  patient_encounter: 'unsafe_for_production',
  panre_la: 'fully_functional',
  pance_simulator: 'fully_functional',
  full_sit_down_test: 'fully_functional',
  code_blue_speed: 'fully_functional',
  commuter_mode: 'partially_mocked',
  icd_coding_drill: 'frontend_backend_disconnected',
};

const modeIssues: Partial<Record<TrainingModeId, string[]>> = {
  reasoning_tutor: ['Some tutoring flows still use mock/service fallback paths; keep AI failure states explicit.'],
  ddx_compare: ['DDX endpoints currently have Prisma relation include/type drift in full typecheck.'],
  guideline_drill: ['Guideline services still contain mock guideline data in places.'],
  patient_encounter: ['OSCE intent/patient/evaluate endpoints are deterministic mocks and Durable Object deploy is not validated.'],
  commuter_mode: ['Voice worker/session env contract is inconsistent; audio generation should be treated as partial.'],
  icd_coding_drill: ['Frontend mode exists but no dedicated production backend endpoint was found.'],
};

const defaultProgressBehavior: StudyModeProgressBehavior = {
  mechanism: 'Answer submission writes a QuestionAttempt and, for real review flows, ReviewLog/UserProgress through the shared review pipeline.',
  writes: ['QuestionAttempt', 'ReviewLog', 'UserProgress', 'UserQuestionSeen'],
  refreshSafeState: 'Session identity and persisted attempts live in the database; local component state may be rebuilt from route/API state.',
};

const attemptOnlyProgressBehavior: StudyModeProgressBehavior = {
  mechanism: 'Mode-specific submission persists game/session result but does not write FSRS review state.',
  writes: ['QuestionAttempt or mode-specific result table'],
  refreshSafeState: 'Mode state is fetched from the starting API or daily challenge endpoint after refresh.',
};

function defaultEmptyState(displayName: string): StudyModeStateBehavior {
  return {
    title: `No ${displayName} content available`,
    description: 'Show a clear empty state and offer a safe return to the study hub or a broader question pool.',
    action: 'Return to study hub or retry with broader filters.',
  };
}

function defaultErrorState(displayName: string): StudyModeStateBehavior {
  return {
    title: `${displayName} could not load`,
    description: 'Show retry and exit actions. Do not silently substitute mock questions in production.',
    action: 'Retry the starting API call or return to study hub.',
  };
}

function defaultLoadingState(displayName: string): StudyModeStateBehavior {
  return {
    title: `Loading ${displayName}`,
    description: 'Use the existing route suspense/loading state while the starting API or lazy component loads.',
  };
}

function reviewSchedulingFor(mode: TrainingModeConfig): StudyModeContract['reviewSchedulingBehavior'] {
  if (mode.id === 'cram_mode' || mode.id === 'rapid_recall') {
    return {
      type: 'attempt_only',
      endpoint: '/api/drills/submit-review',
      details: 'Attempts are recorded, but cram/rapid recall flows should not advance FSRS scheduling.',
    };
  }
  if (mode.id === 'patient_encounter') {
    return {
      type: 'osce_isolated',
      endpoint: '/api/osce/complete',
      details: 'OSCE analytics are isolated from FSRS ReviewLog scheduling.',
    };
  }
  if (mode.id === 'diagnostic_puzzle' || mode.id === 'medical_wordle' || mode.id === 'grand_rounds') {
    return {
      type: 'mode_local',
      endpoint: modeAnswerApis[mode.id]?.path ?? null,
      details: 'Mode result is persisted to game/challenge tables; FSRS scheduling is not the primary writer.',
    };
  }
  if (mode.id === 'icd_coding_drill') {
    return {
      type: 'none',
      endpoint: null,
      details: 'No production review scheduling contract exists yet.',
    };
  }
  return {
    type: 'fsrs_real_review',
    endpoint: '/api/drills/submit-review',
    details: 'Real MAIN/DRILL review submissions update FSRS after MVRT and telemetry checks.',
  };
}

function buildTrainingContract(mode: TrainingModeConfig): StudyModeContract {
  const start = modeStartApis[mode.id] ?? noStartingApi;
  const answer = modeAnswerApis[mode.id] ?? submitReviewApi;
  const scheduling = reviewSchedulingFor(mode);
  const status = modeStatus[mode.id] ?? 'unsafe_for_production';

  return {
    modeId: mode.id,
    displayName: mode.label,
    description: mode.description,
    route: mode.route,
    requiredAuth: 'required',
    requiredUserState: [
      userState.signedIn,
      userState.syncedUser,
      mode.category === 'visual_diagnostics' ? userState.mediaPool : userState.questionPool,
    ],
    startingApiCall: start,
    answerInteractionApiCall: mode.id === 'icd_coding_drill' ? null : answer,
    progressUpdateBehavior:
      scheduling.type === 'fsrs_real_review' ? defaultProgressBehavior : attemptOnlyProgressBehavior,
    analyticsEvents: [
      `mode.${mode.id}.started`,
      `mode.${mode.id}.interaction_submitted`,
      `mode.${mode.id}.completed`,
      `mode.${mode.id}.errored`,
    ],
    reviewSchedulingBehavior: scheduling,
    completionBehavior: {
      trigger: 'User exhausts the current queue, submits the final answer, or exits the mode.',
      result: 'Persist final attempt/session state and route back to the study hub or summary surface.',
      persistedState: ['QuestionAttempt', 'ReviewLog/UserProgress when FSRS-eligible', 'mode-specific result rows when applicable'],
    },
    emptyStateBehavior: defaultEmptyState(mode.label),
    errorStateBehavior: defaultErrorState(mode.label),
    loadingStateBehavior: defaultLoadingState(mode.label),
    productionStatus: status,
    blockingIssues: modeIssues[mode.id] ?? [],
    source: 'training_mode',
  };
}

const coreWorkflowContracts: StudyModeContract[] = [
  {
    modeId: 'practice_questions',
    displayName: 'Practice Questions',
    description: 'Board-style practice question sessions using the shared session and review pipeline.',
    route: '/practice',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.questionPool],
    startingApiCall: api('POST', '/api/study/session/generate', 'Create practice question session.', 'session request', 'session questions'),
    answerInteractionApiCall: submitReviewApi,
    progressUpdateBehavior: defaultProgressBehavior,
    analyticsEvents: ['practice.started', 'practice.answer_submitted', 'practice.completed', 'practice.errored'],
    reviewSchedulingBehavior: {
      type: 'fsrs_real_review',
      endpoint: '/api/drills/submit-review',
      details: 'Practice answers enter the canonical review pipeline.',
    },
    completionBehavior: {
      trigger: 'Question queue completes or user ends session.',
      result: 'Show session summary and keep attempts/progress in database.',
      persistedState: ['StudySession', 'QuestionAttempt', 'ReviewLog', 'UserProgress'],
    },
    emptyStateBehavior: defaultEmptyState('Practice Questions'),
    errorStateBehavior: defaultErrorState('Practice Questions'),
    loadingStateBehavior: defaultLoadingState('Practice Questions'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 1,
    source: 'core_workflow',
  },
  {
    modeId: 'review_mode',
    displayName: 'Review Mode',
    description: 'Due-card review and second-chance review backed by SRS endpoints.',
    route: '/study/main-session',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.progress],
    startingApiCall: api('GET', '/api/srs/due', 'Load due review queue.', 'query filters', 'due queue'),
    answerInteractionApiCall: api('POST', '/api/srs/submit', 'Submit due review result.', 'SRS submit payload', 'updated schedule', true, true),
    progressUpdateBehavior: defaultProgressBehavior,
    analyticsEvents: ['review.started', 'review.answer_submitted', 'review.completed', 'review.errored'],
    reviewSchedulingBehavior: {
      type: 'fsrs_real_review',
      endpoint: '/api/srs/submit',
      details: 'Due reviews update FSRS schedule with existing scheduler guardrails.',
    },
    completionBehavior: {
      trigger: 'Due queue is empty or user ends review.',
      result: 'Persist review results and refresh due count.',
      persistedState: ['ReviewLog', 'UserProgress', 'Card'],
    },
    emptyStateBehavior: defaultEmptyState('Review Mode'),
    errorStateBehavior: defaultErrorState('Review Mode'),
    loadingStateBehavior: defaultLoadingState('Review Mode'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 2,
    source: 'core_workflow',
  },
  {
    modeId: 'weakness_adaptive_mode',
    displayName: 'Weakness/Adaptive Mode',
    description: 'Adaptive session targeting weak systems and blueprint gaps.',
    route: '/core-adaptive',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.progress, userState.questionPool],
    startingApiCall: api('POST', '/api/study/session/generate', 'Generate adaptive/weakness session.', 'adaptive session request', 'session questions'),
    answerInteractionApiCall: submitReviewApi,
    progressUpdateBehavior: defaultProgressBehavior,
    analyticsEvents: ['adaptive.started', 'adaptive.answer_submitted', 'adaptive.completed', 'adaptive.errored'],
    reviewSchedulingBehavior: {
      type: 'fsrs_real_review',
      endpoint: '/api/drills/submit-review',
      details: 'Adaptive answers write progress and scheduling through the shared review pipeline.',
    },
    completionBehavior: {
      trigger: 'Adaptive queue completes.',
      result: 'Persist progress and show updated weak-area recommendations.',
      persistedState: ['StudySession', 'QuestionAttempt', 'ReviewLog', 'UserProgress'],
    },
    emptyStateBehavior: defaultEmptyState('Weakness/Adaptive Mode'),
    errorStateBehavior: defaultErrorState('Weakness/Adaptive Mode'),
    loadingStateBehavior: defaultLoadingState('Weakness/Adaptive Mode'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 3,
    source: 'core_workflow',
  },
  {
    modeId: 'study_plan_scheduler',
    displayName: 'Study Plan/Scheduler',
    description: 'Daily plan and study-path continuation workflow.',
    route: '/study/path',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.progress],
    startingApiCall: api('GET', '/api/users/me/daily-plan', 'Load today plan.', 'none', 'daily plan'),
    answerInteractionApiCall: api('POST', '/api/study-path/accept', 'Accept/regenerate study path action.', 'plan action', 'updated plan', false, true),
    progressUpdateBehavior: {
      mechanism: 'Plan actions update study-plan records; downstream study sessions update attempts and FSRS.',
      writes: ['DailyStudyPlan', 'StudyRecommendation', 'UserGoal'],
      refreshSafeState: 'Plan is server-backed and can be reloaded from /api/users/me/daily-plan.',
    },
    analyticsEvents: ['study_plan.loaded', 'study_plan.accepted', 'study_plan.regenerated', 'study_plan.errored'],
    reviewSchedulingBehavior: { type: 'none', endpoint: null, details: 'Scheduler recommends work; review endpoints own FSRS writes.' },
    completionBehavior: {
      trigger: 'User accepts a plan item or launches a recommended session.',
      result: 'Persist plan state and route into the recommended mode.',
      persistedState: ['DailyStudyPlan', 'StudyRecommendation'],
    },
    emptyStateBehavior: defaultEmptyState('Study Plan/Scheduler'),
    errorStateBehavior: defaultErrorState('Study Plan/Scheduler'),
    loadingStateBehavior: defaultLoadingState('Study Plan/Scheduler'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 4,
    source: 'core_workflow',
  },
  {
    modeId: 'condition_topic_study',
    displayName: 'Condition/Topic Study',
    description: 'Condition lookup plus condition-specific question practice.',
    route: '/medical-database',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.content],
    startingApiCall: api('GET', '/api/conditions/search', 'Find condition/topic content.', 'query', 'conditions'),
    answerInteractionApiCall: api('GET', '/api/questions/condition-drill', 'Load condition-specific drill questions.', 'conditionId query', 'Question[]'),
    progressUpdateBehavior: defaultProgressBehavior,
    analyticsEvents: ['condition.search', 'condition.opened', 'condition.drill_started', 'condition.errored'],
    reviewSchedulingBehavior: {
      type: 'fsrs_real_review',
      endpoint: '/api/drills/submit-review',
      details: 'Condition drills schedule reviews via the shared review pipeline.',
    },
    completionBehavior: {
      trigger: 'User finishes condition drill or leaves content page.',
      result: 'Persist any drill attempts and leave content route reloadable.',
      persistedState: ['QuestionAttempt', 'ReviewLog', 'UserProgress'],
    },
    emptyStateBehavior: defaultEmptyState('Condition/Topic Study'),
    errorStateBehavior: defaultErrorState('Condition/Topic Study'),
    loadingStateBehavior: defaultLoadingState('Condition/Topic Study'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 5,
    source: 'core_workflow',
  },
  {
    modeId: 'search_content_lookup',
    displayName: 'Search/Content Lookup',
    description: 'Medical library, content search, semantic search, and reference lookup.',
    route: '/study/reference',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.content],
    startingApiCall: api('GET', '/api/library/search', 'Search reference/content library.', 'query', 'search results'),
    answerInteractionApiCall: api('POST', '/api/library/answer', 'Ask contextual content question.', 'question/context', 'answer with sources', false),
    progressUpdateBehavior: {
      mechanism: 'Lookup does not create review state unless user launches a drill from content.',
      writes: ['None by default'],
      refreshSafeState: 'Search query and selected content are route/component state; source content is backend-backed.',
    },
    analyticsEvents: ['content.search', 'content.result_opened', 'content.answer_requested', 'content.errored'],
    reviewSchedulingBehavior: { type: 'none', endpoint: null, details: 'Lookup is not a review writer.' },
    completionBehavior: {
      trigger: 'User opens content, asks an answer, or launches a related drill.',
      result: 'No review completion unless a drill is launched.',
      persistedState: ['None by default'],
    },
    emptyStateBehavior: defaultEmptyState('Search/Content Lookup'),
    errorStateBehavior: defaultErrorState('Search/Content Lookup'),
    loadingStateBehavior: defaultLoadingState('Search/Content Lookup'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 6,
    source: 'core_workflow',
  },
  {
    modeId: 'pharmacology_drug_lookup',
    displayName: 'Pharmacology/Drug Lookup',
    description: 'Drug library lookup plus pharmacology drill path.',
    route: '/modes/pharmacology',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.content],
    startingApiCall: api('GET', '/api/drugs/search', 'Search drug library.', 'query', 'drug results'),
    answerInteractionApiCall: api('GET', '/api/questions/pharmacology-drill', 'Load pharmacology questions.', 'query filters', 'Question[]'),
    progressUpdateBehavior: defaultProgressBehavior,
    analyticsEvents: ['pharm.search', 'pharm.drug_opened', 'pharm.answer_submitted', 'pharm.errored'],
    reviewSchedulingBehavior: {
      type: 'fsrs_real_review',
      endpoint: '/api/drills/submit-review',
      details: 'Pharmacology quiz answers use shared review scheduling.',
    },
    completionBehavior: {
      trigger: 'User finishes drug lookup or pharmacology quiz.',
      result: 'Persist quiz attempts when used.',
      persistedState: ['QuestionAttempt', 'ReviewLog', 'UserProgress'],
    },
    emptyStateBehavior: defaultEmptyState('Pharmacology/Drug Lookup'),
    errorStateBehavior: defaultErrorState('Pharmacology/Drug Lookup'),
    loadingStateBehavior: defaultLoadingState('Pharmacology/Drug Lookup'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 7,
    source: 'core_workflow',
  },
  {
    modeId: 'analytics_progress_dashboard',
    displayName: 'Analytics/Progress Dashboard',
    description: 'Progress, analytics, readiness, and SRS dashboard workflow.',
    route: '/progress',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser, userState.progress],
    startingApiCall: api('GET', '/api/user/stats', 'Load user progress summary.', 'none', 'stats dashboard'),
    answerInteractionApiCall: null,
    progressUpdateBehavior: {
      mechanism: 'Dashboard is read-only; progress is written by study/review modes.',
      writes: ['None'],
      refreshSafeState: 'All essential dashboard state is reloadable from analytics/user endpoints.',
    },
    analyticsEvents: ['progress.loaded', 'progress.filter_changed', 'progress.exported', 'progress.errored'],
    reviewSchedulingBehavior: { type: 'none', endpoint: null, details: 'Read-only analytics surface.' },
    completionBehavior: {
      trigger: 'User leaves dashboard or launches a recommended mode.',
      result: 'No completion write.',
      persistedState: ['None'],
    },
    emptyStateBehavior: defaultEmptyState('Analytics/Progress Dashboard'),
    errorStateBehavior: defaultErrorState('Analytics/Progress Dashboard'),
    loadingStateBehavior: defaultLoadingState('Analytics/Progress Dashboard'),
    productionStatus: 'fully_functional',
    blockingIssues: [],
    corePriority: 8,
    source: 'core_workflow',
  },
  {
    modeId: 'ai_tutor_explanation_mode',
    displayName: 'AI Tutor/Explanation Mode',
    description: 'Tutor chat and explanation generation workflow.',
    route: '/modes/reasoning-tutor',
    requiredAuth: 'required',
    requiredUserState: [userState.signedIn, userState.syncedUser],
    startingApiCall: api('POST', '/api/ai/tutor/chat', 'Start or continue tutor chat.', 'chat message/context', 'assistant response'),
    answerInteractionApiCall: api('POST', '/api/questions/explain-rag', 'Generate evidence-backed explanation.', 'question/context', 'explanation', false),
    progressUpdateBehavior: {
      mechanism: 'Tutor interactions are not canonical review writes unless paired with a question answer.',
      writes: ['AI/session logs where configured'],
      refreshSafeState: 'Essential study progress is unaffected by chat refresh; chat persistence depends on AI session endpoint.',
    },
    analyticsEvents: ['tutor.started', 'tutor.message_sent', 'tutor.explanation_requested', 'tutor.errored'],
    reviewSchedulingBehavior: { type: 'none', endpoint: null, details: 'Tutor chat itself does not update FSRS.' },
    completionBehavior: {
      trigger: 'User ends chat or launches linked study session.',
      result: 'No review completion unless linked study session is launched.',
      persistedState: ['AI session logs where configured'],
    },
    emptyStateBehavior: defaultEmptyState('AI Tutor/Explanation Mode'),
    errorStateBehavior: defaultErrorState('AI Tutor/Explanation Mode'),
    loadingStateBehavior: defaultLoadingState('AI Tutor/Explanation Mode'),
    productionStatus: 'partially_mocked',
    blockingIssues: ['Some tutor paths still use fallback/mock service behavior.'],
    corePriority: 9,
    source: 'core_workflow',
  },
];

export const TRAINING_MODE_CONTRACTS: StudyModeContract[] = TRAINING_MODES.map(buildTrainingContract);

export const OBSOLETE_MODE_AUDIT: StudyModeContract[] = [
  {
    ...buildTrainingContract({
      id: 'polypharmacy_puzzle',
      label: 'Polypharmacy Puzzle',
      description: 'Removed mode placeholder without a production backend.',
      category: 'specialty_drills',
      iconName: 'Pill',
      theme: 'orange',
      route: '/modes/polypharmacy-puzzle',
    }),
    productionStatus: 'duplicate_obsolete',
    answerInteractionApiCall: null,
    blockingIssues: ['Removed from TRAINING_MODES but still appears in view constants/router placeholder.'],
    source: 'audit_only',
  },
  {
    ...buildTrainingContract({
      id: 'radiology_scroll',
      label: 'Radiology Scroll',
      description: 'Future mode listed in TrainingModeId but not registered.',
      category: 'visual_diagnostics',
      iconName: 'Scan',
      theme: 'slate',
      route: '/modes/radiology-scroll',
    }),
    productionStatus: 'backend_frontend_missing',
    startingApiCall: api('GET', '/api/reference/imaging', 'Potential imaging content source.', 'query filters', 'imaging reference data', false),
    answerInteractionApiCall: null,
    blockingIssues: ['Type exists but no active TRAINING_MODES entry or frontend route branch.'],
    source: 'audit_only',
  },
];

export const STUDY_MODE_CONTRACTS: StudyModeContract[] = [
  ...coreWorkflowContracts,
  ...TRAINING_MODE_CONTRACTS,
  ...OBSOLETE_MODE_AUDIT,
];

export const CORE_PRODUCTION_MODE_IDS = coreWorkflowContracts
  .slice()
  .sort((a, b) => (a.corePriority ?? 999) - (b.corePriority ?? 999))
  .map((mode) => mode.modeId);

const contractById = new Map<StudyModeId, StudyModeContract>(
  STUDY_MODE_CONTRACTS.map((contract) => [contract.modeId, contract])
);

export function getStudyModeContract(modeId: StudyModeId | string): StudyModeContract | undefined {
  return contractById.get(modeId as StudyModeId);
}

export function requireStudyModeContract(modeId: StudyModeId | string): StudyModeContract {
  const contract = getStudyModeContract(modeId);
  if (!contract) {
    throw new Error(`Study mode contract not found: ${modeId}`);
  }
  return contract;
}

export function getTrainingModeContracts(): StudyModeContract[] {
  return TRAINING_MODE_CONTRACTS;
}

export function getCoreProductionModeContracts(): StudyModeContract[] {
  return coreWorkflowContracts.slice().sort((a, b) => (a.corePriority ?? 999) - (b.corePriority ?? 999));
}

export function getContractsByProductionStatus(
  status: StudyModeProductionStatus
): StudyModeContract[] {
  return STUDY_MODE_CONTRACTS.filter((contract) => contract.productionStatus === status);
}

export function validateStudyModeContracts(
  contracts: StudyModeContract[] = STUDY_MODE_CONTRACTS
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const contract of contracts) {
    if (seen.has(contract.modeId)) errors.push(`Duplicate modeId: ${contract.modeId}`);
    seen.add(contract.modeId);

    if (!contract.displayName.trim()) errors.push(`${contract.modeId}: displayName is required`);
    if (!contract.description.trim()) errors.push(`${contract.modeId}: description is required`);
    if (!contract.route.startsWith('/')) errors.push(`${contract.modeId}: route must start with /`);
    if (contract.requiredAuth === 'required' && contract.requiredUserState.length === 0) {
      errors.push(`${contract.modeId}: required auth modes must define requiredUserState`);
    }
    if (!contract.loadingStateBehavior.title) errors.push(`${contract.modeId}: loading state title is required`);
    if (!contract.emptyStateBehavior.title) errors.push(`${contract.modeId}: empty state title is required`);
    if (!contract.errorStateBehavior.title) errors.push(`${contract.modeId}: error state title is required`);
    if (contract.productionStatus === 'fully_functional') {
      if (!contract.startingApiCall) errors.push(`${contract.modeId}: fully functional mode needs a starting API contract`);
      if (
        contract.reviewSchedulingBehavior.type === 'fsrs_real_review' &&
        !contract.answerInteractionApiCall
      ) {
        errors.push(`${contract.modeId}: FSRS mode needs an answer/interaction API contract`);
      }
    }
  }

  return errors;
}

