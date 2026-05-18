export type ClinicalLabCase = {
  id: string;
  type: string;
  system: string;
  status: 'new' | 'needs_review' | 'strong' | 'weak';
  difficulty: string;
  accuracy: number | null;
  learningObjective: string;
  accuracyTrend: string;
  markerLabel: string;
  annotationNote: string;
  source: 'mock';
};

export type QuestionReviewRow = {
  id: string;
  topic: string;
  system: string;
  difficulty: 'PANCE-level' | 'Easy' | 'Moderate' | 'Hard';
  result: 'missed' | 'correct' | 'flagged' | 'needs_review';
  confidenceLabel: string;
  confidenceValue: number | null;
  timeSpentSeconds: number | null;
  nextAction: 'Review explanation' | 'Retry' | 'Add to spaced review' | 'Drill similar';
  reason: string;
  flags: Array<'missed' | 'flagged' | 'needs_review' | 'confidence_mismatch'>;
  source: 'analytics' | 'review-queue' | 'mock';
};

export type ReadinessVitalStatus = 'stable' | 'watch' | 'risk' | 'calibrating' | 'strong';

export type ReadinessVitalMetricId =
  | 'pance-readiness'
  | 'accuracy'
  | 'retention'
  | 'pace'
  | 'clinical-image-accuracy'
  | 'confidence-mismatch';

export type ReadinessVitalMetric = {
  id: ReadinessVitalMetricId;
  label: string;
  value: string;
  status: ReadinessVitalStatus;
  context: string;
  accessibleDescription: string;
  progress?: number;
  sparkline?: number[];
  source: 'analytics' | 'plan' | 'derived' | 'mock';
};

export type StudyPrescriptionPriority = 'critical' | 'high' | 'medium' | 'low';

export type StudyPrescriptionTask = {
  id: string;
  title: string;
  system: string;
  estimatedMinutes: number;
  priority: StudyPrescriptionPriority;
  reason: string;
  actionLabel: string;
  action: 'start' | 'review' | 'practice' | 'plan';
  source: 'today-plan' | 'mock';
};

export type OrganSystemHeatmapStatus = 'active' | 'weak' | 'watch' | 'strong' | 'calibrating';

export type OrganSystemHeatmapItem = {
  id: string;
  label: string;
  score: number;
  urgency: number;
  blueprintWeight: number;
  trend: 'up' | 'flat' | 'down';
  status: OrganSystemHeatmapStatus;
  evidenceLabel: string;
  context: string;
  source: 'analytics' | 'blueprint' | 'mock';
};

export type ReadinessTimelinePoint = {
  id: string;
  label: string;
  readiness: number;
  accuracy?: number | null;
  retention?: number | null;
  target?: number | null;
  note?: string;
  source: 'analytics' | 'projection' | 'mock';
};

export type ReadinessTimelineInterpretation = {
  headline: string;
  detail: string;
  source: 'analytics' | 'mock';
};

export const fallbackReadinessVitals: ReadinessVitalMetric[] = [
  {
    id: 'pance-readiness',
    label: 'PANCE readiness',
    value: '72%',
    status: 'watch',
    context: 'Illustrative forecast band until live readiness confidence is available.',
    accessibleDescription: 'Mock PANCE readiness is 72 percent, shown as a watch status.',
    progress: 72,
    sparkline: [58, 61, 62, 65, 67, 69, 72],
    source: 'mock',
  },
  {
    id: 'accuracy',
    label: 'Accuracy',
    value: '68%',
    status: 'watch',
    context: 'Mock 7-day question accuracy; replace with dashboard analytics when present.',
    accessibleDescription: 'Mock seven day accuracy is 68 percent, shown as a watch status.',
    progress: 68,
    sparkline: [62, 64, 63, 66, 67, 68],
    source: 'mock',
  },
  {
    id: 'retention',
    label: 'Retention',
    value: '84%',
    status: 'stable',
    context: 'Mock FSRS retention sample for the command-center layout.',
    accessibleDescription: 'Mock spaced review retention is 84 percent, shown as stable.',
    progress: 84,
    sparkline: [78, 81, 80, 83, 84],
    source: 'mock',
  },
  {
    id: 'pace',
    label: 'Pace',
    value: 'On track',
    status: 'stable',
    context: 'Illustrative pace against a near-term study plan.',
    accessibleDescription: 'Mock study pace is on track.',
    progress: 76,
    sparkline: [54, 58, 63, 68, 72, 76],
    source: 'mock',
  },
  {
    id: 'clinical-image-accuracy',
    label: 'Image accuracy',
    value: '64%',
    status: 'watch',
    context: 'Mock clinical image lab metric until licensed image telemetry is connected.',
    accessibleDescription: 'Mock clinical image accuracy is 64 percent, shown as watch.',
    progress: 64,
    sparkline: [52, 55, 57, 59, 61, 64],
    source: 'mock',
  },
  {
    id: 'confidence-mismatch',
    label: 'Confidence mismatch',
    value: '14 pts',
    status: 'watch',
    context: 'Illustrative gap between confidence and correctness; no real confidence claim yet.',
    accessibleDescription: 'Mock confidence mismatch is 14 points, shown as watch.',
    progress: 58,
    sparkline: [22, 20, 18, 17, 14],
    source: 'mock',
  },
];

export const fallbackStudyPrescriptionTasks: StudyPrescriptionTask[] = [
  {
    id: 'mock-pulm-repair',
    title: 'Pulmonology repair block',
    system: 'Pulmonology',
    estimatedMinutes: 28,
    priority: 'high',
    reason: 'Mock weak-area signal: recent respiratory misses cluster around embolism vs pneumonia differentiation.',
    actionLabel: 'Start block',
    action: 'start',
    source: 'mock',
  },
  {
    id: 'mock-review-debt',
    title: 'Due review protection',
    system: 'Spaced Review',
    estimatedMinutes: 14,
    priority: 'high',
    reason: 'Mock retention signal: protect due cards before adding more new questions.',
    actionLabel: 'Review due cards',
    action: 'review',
    source: 'mock',
  },
  {
    id: 'mock-image-lab',
    title: 'ECG image reasoning pass',
    system: 'Clinical Images',
    estimatedMinutes: 12,
    priority: 'medium',
    reason: 'Mock image lab signal: practice structured visual reads without using real patient images.',
    actionLabel: 'Open lab',
    action: 'practice',
    source: 'mock',
  },
];

export const fallbackOrganSystemHeatmap: OrganSystemHeatmapItem[] = [
  {
    id: 'cardiovascular',
    label: 'Cardiovascular',
    score: 68,
    urgency: 78,
    blueprintWeight: 11,
    trend: 'down',
    status: 'weak',
    evidenceLabel: 'High blueprint weight',
    context: 'Mock weak-area signal for rhythm, murmur, and heart failure distractors.',
    source: 'mock',
  },
  {
    id: 'pulmonary',
    label: 'Pulmonary',
    score: 72,
    urgency: 71,
    blueprintWeight: 9,
    trend: 'flat',
    status: 'watch',
    evidenceLabel: 'Today target',
    context: 'Mock signal: respiratory image and vignette decisions need targeted reps.',
    source: 'mock',
  },
  {
    id: 'gastrointestinal',
    label: 'Gastrointestinal',
    score: 76,
    urgency: 54,
    blueprintWeight: 9,
    trend: 'up',
    status: 'watch',
    evidenceLabel: 'Improving',
    context: 'Mock signal: GI accuracy is stabilizing but still below the target band.',
    source: 'mock',
  },
  {
    id: 'musculoskeletal',
    label: 'Musculoskeletal',
    score: 81,
    urgency: 38,
    blueprintWeight: 9,
    trend: 'up',
    status: 'strong',
    evidenceLabel: 'Stable',
    context: 'Mock signal: orthopedic pattern recognition is currently above target.',
    source: 'mock',
  },
  {
    id: 'heent',
    label: 'HEENT',
    score: 70,
    urgency: 48,
    blueprintWeight: 8,
    trend: 'flat',
    status: 'watch',
    evidenceLabel: 'Moderate evidence',
    context: 'Mock signal: ear, eye, and throat presentations need periodic review.',
    source: 'mock',
  },
  {
    id: 'reproductive',
    label: 'Reproductive',
    score: 74,
    urgency: 51,
    blueprintWeight: 8,
    trend: 'flat',
    status: 'watch',
    evidenceLabel: 'Moderate evidence',
    context: 'Mock signal: OB/GYN decisions are close to the current readiness band.',
    source: 'mock',
  },
  {
    id: 'neurologic',
    label: 'Neurologic',
    score: 66,
    urgency: 69,
    blueprintWeight: 7,
    trend: 'down',
    status: 'weak',
    evidenceLabel: 'Monitor',
    context: 'Mock signal: headache, seizure, and stroke distractors are on the watch list.',
    source: 'mock',
  },
  {
    id: 'psychiatry-behavioral',
    label: 'Psychiatry/Behavioral',
    score: 79,
    urgency: 36,
    blueprintWeight: 7,
    trend: 'flat',
    status: 'strong',
    evidenceLabel: 'Stable',
    context: 'Mock signal: behavioral health questions are above the intervention threshold.',
    source: 'mock',
  },
  {
    id: 'endocrine',
    label: 'Endocrine',
    score: 63,
    urgency: 67,
    blueprintWeight: 6,
    trend: 'flat',
    status: 'weak',
    evidenceLabel: 'Watch',
    context: 'Mock signal: diabetes and thyroid items need a focused repair pass.',
    source: 'mock',
  },
  {
    id: 'dermatologic',
    label: 'Dermatologic',
    score: 71,
    urgency: 44,
    blueprintWeight: 5,
    trend: 'up',
    status: 'watch',
    evidenceLabel: 'Image-adjacent',
    context: 'Mock signal: morphology and distribution reads benefit from image-lab practice.',
    source: 'mock',
  },
  {
    id: 'genitourinary',
    label: 'Genitourinary',
    score: 77,
    urgency: 39,
    blueprintWeight: 5,
    trend: 'flat',
    status: 'watch',
    evidenceLabel: 'Stable',
    context: 'Mock signal: GU performance is steady with routine maintenance.',
    source: 'mock',
  },
  {
    id: 'hematologic',
    label: 'Hematologic',
    score: 69,
    urgency: 52,
    blueprintWeight: 4,
    trend: 'flat',
    status: 'watch',
    evidenceLabel: 'Moderate evidence',
    context: 'Mock signal: anemia and coagulation pathways need spaced reinforcement.',
    source: 'mock',
  },
  {
    id: 'infectious-disease',
    label: 'Infectious Disease',
    score: 73,
    urgency: 46,
    blueprintWeight: 4,
    trend: 'up',
    status: 'watch',
    evidenceLabel: 'Improving',
    context: 'Mock signal: antibiotic selection is improving but still worth periodic review.',
    source: 'mock',
  },
  {
    id: 'renal',
    label: 'Renal',
    score: 65,
    urgency: 61,
    blueprintWeight: 4,
    trend: 'down',
    status: 'weak',
    evidenceLabel: 'Monitor',
    context: 'Mock signal: AKI, electrolytes, and acid-base questions need a compact drill.',
    source: 'mock',
  },
  {
    id: 'emergency-medicine',
    label: 'Emergency Medicine',
    score: 80,
    urgency: 33,
    blueprintWeight: 2,
    trend: 'flat',
    status: 'strong',
    evidenceLabel: 'Lower weight',
    context: 'Mock signal: emergency medicine is currently stable within the baseline band.',
    source: 'mock',
  },
];

export const fallbackReadinessTimeline: ReadinessTimelinePoint[] = [
  {
    id: 'week-1',
    label: 'Wk 1',
    readiness: 58,
    accuracy: 61,
    retention: 76,
    target: 78,
    note: 'Baseline scan',
    source: 'mock',
  },
  {
    id: 'week-2',
    label: 'Wk 2',
    readiness: 61,
    accuracy: 63,
    retention: 78,
    target: 78,
    note: 'Review queue stabilized',
    source: 'mock',
  },
  {
    id: 'week-3',
    label: 'Wk 3',
    readiness: 64,
    accuracy: 65,
    retention: 77,
    target: 78,
    note: 'Pulmonary drill added',
    source: 'mock',
  },
  {
    id: 'week-4',
    label: 'Wk 4',
    readiness: 66,
    accuracy: 67,
    retention: 79,
    target: 78,
    note: 'Image lab started',
    source: 'mock',
  },
  {
    id: 'week-5',
    label: 'Wk 5',
    readiness: 69,
    accuracy: 68,
    retention: 81,
    target: 78,
    note: 'Weak systems narrowed',
    source: 'mock',
  },
  {
    id: 'week-6',
    label: 'Wk 6',
    readiness: 72,
    accuracy: 70,
    retention: 80,
    target: 78,
    note: 'Pharmacology retention lag',
    source: 'mock',
  },
];

export const fallbackReadinessTimelineInterpretation: ReadinessTimelineInterpretation = {
  headline: 'Readiness is improving, but Pharmacology retention is lagging.',
  detail: 'Mock interpretation: keep the readiness climb steady while protecting medication recall with spaced review.',
  source: 'mock',
};

export const fallbackClinicalLabCases: ClinicalLabCase[] = [
  {
    id: 'ecg-axis-shift',
    type: 'ECG',
    system: 'Cardiology',
    status: 'needs_review',
    difficulty: 'Moderate',
    accuracy: 62,
    learningObjective: 'Recognize rate, rhythm, axis, and high-yield PANCE distractors.',
    accuracyTrend: '62% last 10 image items',
    markerLabel: 'Lead pattern annotation',
    annotationNote: 'Mock marker highlights a rhythm-pattern checkpoint, not a patient tracing.',
    source: 'mock',
  },
  {
    id: 'chest-opacity',
    type: 'Chest imaging',
    system: 'Pulmonology',
    status: 'weak',
    difficulty: 'Hard',
    accuracy: 58,
    learningObjective: 'Separate consolidation, effusion, and pneumothorax cues from vignette noise.',
    accuracyTrend: 'Needs 2 more targeted reps',
    markerLabel: 'Opacity zone',
    annotationNote: 'Synthetic opacity zone used for image-reading workflow practice.',
    source: 'mock',
  },
  {
    id: 'derm-border',
    type: 'Dermatology',
    system: 'Dermatology',
    status: 'new',
    difficulty: 'Moderate',
    accuracy: null,
    learningObjective: 'Use morphology, distribution, and timing before jumping to the answer choice.',
    accuracyTrend: 'New image category',
    markerLabel: 'Morphology pin',
    annotationNote: 'Abstract morphology pattern; licensed dermatology assets can replace it later.',
    source: 'mock',
  },
  {
    id: 'fundoscopy-ratio',
    type: 'Fundoscopy',
    system: 'Neurologic',
    status: 'strong',
    difficulty: 'Moderate',
    accuracy: 84,
    learningObjective: 'Practice a structured retinal-view checklist before interpreting vignette clues.',
    accuracyTrend: '84% last 8 mock image items',
    markerLabel: 'Disc boundary marker',
    annotationNote: 'Synthetic retinal geometry shows annotation workflow only.',
    source: 'mock',
  },
  {
    id: 'abdomen-cross-section',
    type: 'Radiology-style mock',
    system: 'Gastrointestinal',
    status: 'needs_review',
    difficulty: 'Hard',
    accuracy: 60,
    learningObjective: 'Identify how anatomy location, timing, and exam clues narrow answer choices.',
    accuracyTrend: '60% last 5 mock image items',
    markerLabel: 'Region-of-interest marker',
    annotationNote: 'Abstract cross-section panel; no real patient image or diagnostic claim.',
    source: 'mock',
  },
];

export const fallbackQuestionReviewRows: QuestionReviewRow[] = [
  {
    id: 'mock-review-cardiology',
    topic: 'Murmur timing and maneuver selection',
    system: 'Cardiology',
    difficulty: 'Hard',
    result: 'missed',
    confidenceLabel: 'High',
    confidenceValue: 88,
    timeSpentSeconds: 42,
    nextAction: 'Review explanation',
    reason: 'Mock confidence mismatch: high confidence with an incorrect answer.',
    flags: ['missed', 'needs_review', 'confidence_mismatch'],
    source: 'mock',
  },
  {
    id: 'mock-review-pharm',
    topic: 'Antibiotic adverse effect distractors',
    system: 'Pharmacology',
    difficulty: 'Moderate',
    result: 'needs_review',
    confidenceLabel: 'Medium',
    confidenceValue: 61,
    timeSpentSeconds: 55,
    nextAction: 'Add to spaced review',
    reason: 'Mock review signal: medication adverse-effect distractors are due for reinforcement.',
    flags: ['needs_review'],
    source: 'mock',
  },
  {
    id: 'mock-review-pulm',
    topic: 'Obstructive vs restrictive spirometry',
    system: 'Pulmonology',
    difficulty: 'Moderate',
    result: 'flagged',
    confidenceLabel: 'Low',
    confidenceValue: 34,
    timeSpentSeconds: 71,
    nextAction: 'Drill similar',
    reason: 'Mock flagged item: long decision time and low confidence make a similar drill useful.',
    flags: ['flagged', 'needs_review'],
    source: 'mock',
  },
  {
    id: 'mock-review-renal',
    topic: 'Acid-base compensation pattern',
    system: 'Renal',
    difficulty: 'Hard',
    result: 'missed',
    confidenceLabel: 'Medium',
    confidenceValue: 57,
    timeSpentSeconds: 89,
    nextAction: 'Retry',
    reason: 'Mock miss: retry after reviewing the compensation sequence.',
    flags: ['missed', 'needs_review'],
    source: 'mock',
  },
  {
    id: 'mock-review-derm',
    topic: 'Morphology clue selection',
    system: 'Dermatology',
    difficulty: 'PANCE-level',
    result: 'correct',
    confidenceLabel: 'Low',
    confidenceValue: 39,
    timeSpentSeconds: 38,
    nextAction: 'Add to spaced review',
    reason: 'Mock low-confidence correct response: protect the retrieval before it decays.',
    flags: ['needs_review'],
    source: 'mock',
  },
];
