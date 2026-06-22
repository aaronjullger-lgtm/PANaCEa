import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Camera,
  ChartNoAxesCombined,
  ClipboardCheck,
  Eye,
  Layers3,
  LineChart,
  Microscope,
  Network,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TimerReset,
  Zap,
} from 'lucide-react';
import type { MetricVitalStatus } from '@/components/studypanacea/MetricVital';
import type { OrganSystemBadgeState } from '@/components/studypanacea/OrganSystemBadge';

export const NAV_LINKS = [
  { label: 'Readiness Scanner', href: '#hero' },
  { label: 'Diagnostic Path', href: '#diagnostic-story' },
  { label: 'Training Dock', href: '#training-modes' },
  { label: 'Image Lab', href: '#image-lab' },
  { label: 'Command Center', href: '#analytics-preview' },
] as const;

export type LandingVital = {
  label: string;
  value: string;
  change: string;
  status: MetricVitalStatus;
  accessibleText: string;
};

export const HERO_VITALS: LandingVital[] = [
  {
    label: 'PANCE readiness',
    value: '86%',
    change: '+7 after weak-area blocks',
    status: 'success',
    accessibleText: 'PANCE readiness is 86 percent, up 7 after weak-area blocks.',
  },
  {
    label: 'Review debt',
    value: '18',
    change: 'clear before simulation',
    status: 'warning',
    accessibleText: 'Review debt is 18 items to clear before simulation.',
  },
  {
    label: 'Image-read accuracy',
    value: '74%',
    change: 'cardio imaging lagging',
    status: 'info',
    accessibleText: 'Clinical image-read accuracy is 74 percent, with cardiology imaging lagging.',
  },
];

export type DiagnosticStep = {
  step: string;
  title: string;
  description: string;
  signal: string;
  icon: LucideIcon;
};

export type DiagnosticScrollStageId =
  | 'weak-systems'
  | 'targeted-questions'
  | 'clinical-images'
  | 'spaced-review'
  | 'readiness';

export type DiagnosticScrollStage = DiagnosticStep & {
  id: DiagnosticScrollStageId;
  organSystem: string;
  metricLabel: string;
  metricValue: string;
  status: MetricVitalStatus;
};

export const DIAGNOSTIC_SCROLL_STAGES: DiagnosticScrollStage[] = [
  {
    id: 'weak-systems',
    step: '01',
    title: 'Identify weak systems',
    description:
      'Practice history, pacing, missed distractors, and blueprint coverage collapse into one weak-area scan.',
    signal: 'Cardiology and pulmonology need focused remediation before another broad block',
    organSystem: 'Cardiology',
    metricLabel: 'Weak-area pressure',
    metricValue: '4 systems',
    status: 'danger',
    icon: Target,
  },
  {
    id: 'targeted-questions',
    step: '02',
    title: 'Practice targeted questions',
    description:
      'The next block is selected from high-yield misses, task gaps, and recall timing instead of random review.',
    signal: '24-question pulmonology block prescribed from recent miss patterns',
    organSystem: 'Pulmonology',
    metricLabel: 'Prescribed block',
    metricValue: '24 Qs',
    status: 'warning',
    icon: Brain,
  },
  {
    id: 'clinical-images',
    step: '03',
    title: 'Decode clinical images',
    description:
      'Image practice connects to the same weak systems, so ECGs, chest reads, and visual prompts reinforce the weak-area signal.',
    signal: 'Image lab flags a recurring chest search-pattern miss',
    organSystem: 'Clinical Images',
    metricLabel: 'Image accuracy',
    metricValue: '74%',
    status: 'info',
    icon: Camera,
  },
  {
    id: 'spaced-review',
    step: '04',
    title: 'Reinforce with spaced review',
    description:
      'Missed concepts enter a recall queue with due timing, priority, and stability so repeat errors are pulled forward.',
    signal: '18 high-yield misses due before the next timed simulation',
    organSystem: 'Review Queue',
    metricLabel: 'Recall debt',
    metricValue: '18 due',
    status: 'warning',
    icon: TimerReset,
  },
  {
    id: 'readiness',
    step: '05',
    title: 'Track PANCE readiness',
    description:
      'Readiness vitals stabilize as weak systems improve, review debt shrinks, and simulation performance becomes consistent.',
    signal: 'Readiness stabilizes only after weak systems and review debt improve',
    organSystem: 'Readiness Score',
    metricLabel: 'Projected buffer',
    metricValue: '+12%',
    status: 'success',
    icon: ChartNoAxesCombined,
  },
];

export const DIAGNOSTIC_STORY_STEPS: DiagnosticStep[] = DIAGNOSTIC_SCROLL_STAGES;

export type TrainingMode = {
  id: string;
  label: string;
  title: string;
  description: string;
  benefit: string;
  bestFor: string;
  systemMetric: string;
  metricLabel: string;
  metricValue: string;
  metricStatus: MetricVitalStatus;
  detail: string;
  protocol: string;
  previewPoints: readonly string[];
  tone: 'cyan' | 'blue' | 'violet' | 'pulse' | 'success' | 'warning';
  icon: LucideIcon;
};

export const TRAINING_MODES: TrainingMode[] = [
  {
    id: 'rapid-review',
    label: 'Rapid Review',
    title: 'Rapid Review',
    description:
      'High-yield misses surface in a fast recall loop before they decay into repeat errors.',
    benefit: 'Compress overdue concepts into a clinically ranked warm-up block.',
    bestFor: 'Short study windows before clinical shifts or lecture days.',
    systemMetric: 'Recall stability',
    metricLabel: 'Due now',
    metricValue: '18',
    metricStatus: 'warning',
    detail: '12 min pulse',
    protocol: 'Recall queue, high-yield misses, confidence check',
    previewPoints: [
      'Overdue concepts first',
      'Confidence tagged',
      'Routes misses into spaced review',
    ],
    tone: 'cyan',
    icon: Zap,
  },
  {
    id: 'timed-exam',
    label: 'Timed Exam',
    title: 'Timed Exam',
    description: 'Pacing, stamina, and blueprint coverage are measured in a controlled exam block.',
    benefit: 'Stress-test readiness with timing signals and post-block remediation.',
    bestFor: 'Weekly readiness checks and exam-window stamina building.',
    systemMetric: 'Pacing variance',
    metricLabel: 'Block length',
    metricValue: '60m',
    metricStatus: 'info',
    detail: 'Timed block',
    protocol: 'Board-style questions, timer, pacing alerts',
    previewPoints: [
      'Measures stamina drift',
      'Flags slow clinical tasks',
      'Feeds readiness timeline',
    ],
    tone: 'blue',
    icon: ShieldCheck,
  },
  {
    id: 'clinical-image-lab',
    label: 'Clinical Image Lab',
    title: 'Clinical Image Lab',
    description:
      'Synthetic radiograph-style, ECG, dermatology, and procedure panels train structured image-reading logic.',
    benefit: 'Turn image misses into annotated findings and targeted follow-up drills.',
    bestFor: 'Visual reasoning gaps across cardiology, pulmonology, dermatology, and procedures.',
    systemMetric: 'Image accuracy',
    metricLabel: 'Read set',
    metricValue: '12',
    metricStatus: 'info',
    detail: 'Image reads',
    protocol: 'Viewer frame, annotation pass, differential prompt',
    previewPoints: [
      'Finding markers stay visible',
      'Weak systems attach to images',
      'Structured read feedback',
    ],
    tone: 'violet',
    icon: Camera,
  },
  {
    id: 'weak-area-targeting',
    label: 'Weak Area Targeting',
    title: 'Weak Area Targeting',
    description: 'The system ranks weak organ systems and prescribes the next highest-value drill.',
    benefit: 'Stop broad review and attack the clinical pattern most likely to move readiness.',
    bestFor: 'Learners with uneven organ-system scores or repeated distractor patterns.',
    systemMetric: 'Weak-area pressure',
    metricLabel: 'Priority',
    metricValue: '4',
    metricStatus: 'danger',
    detail: 'Risk ranked',
    protocol: 'Organ-system heatmap, distractor grouping, next-action Rx',
    previewPoints: [
      'Ranks clinical risk',
      'Groups reasoning failures',
      'Prescribes one next block',
    ],
    tone: 'pulse',
    icon: Target,
  },
  {
    id: 'spaced-review',
    label: 'Spaced Review',
    title: 'Spaced Review',
    description: 'Recall timing determines when missed concepts return for reinforcement.',
    benefit: 'Use stability and review debt to prevent old misses from resurfacing late.',
    bestFor: 'Longitudinal retention across high-yield conditions and pharmacology.',
    systemMetric: 'Review debt',
    metricLabel: 'Queue',
    metricValue: '32',
    metricStatus: 'warning',
    detail: 'FSRS queue',
    protocol: 'Stability, difficulty, retrievability, due timing',
    previewPoints: [
      'Schedules decaying items',
      'Separates stable from risky',
      'Protects simulation days',
    ],
    tone: 'warning',
    icon: TimerReset,
  },
  {
    id: 'missed-questions',
    label: 'Missed Questions',
    title: 'Missed Questions',
    description:
      'Incorrect answers become a focused review surface with rationales and distractor repair.',
    benefit: 'Convert misses into clinical contrasts instead of rereading answer keys.',
    bestFor: 'Post-block remediation and repeated distractor errors.',
    systemMetric: 'Distractor recurrence',
    metricLabel: 'Misses',
    metricValue: '27',
    metricStatus: 'danger',
    detail: 'Rationale pass',
    protocol: 'Missed stem, distractor reason, corrective drill',
    previewPoints: [
      'Explains why answers fail',
      'Links related misses',
      'Routes into weak-area work',
    ],
    tone: 'pulse',
    icon: ClipboardCheck,
  },
  {
    id: 'organ-system-drill',
    label: 'Organ System Drill',
    title: 'Organ System Drill',
    description: 'Focused organ-system sessions build mastery without losing blueprint context.',
    benefit: 'Train one clinical system deeply while keeping task coverage visible.',
    bestFor: 'Cardiology, pulmonology, GI, endocrine, MSK, and infectious disease gaps.',
    systemMetric: 'System mastery',
    metricLabel: 'Cardio',
    metricValue: '68',
    metricStatus: 'danger',
    detail: 'System focus',
    protocol: 'System filter, task tags, mastery vitals',
    previewPoints: [
      'Keeps task labels visible',
      'Balances recall and reasoning',
      'Updates organ heatmap',
    ],
    tone: 'cyan',
    icon: Stethoscope,
  },
  {
    id: 'pharmacology-mode',
    label: 'Pharmacology Mode',
    title: 'Pharmacology Mode',
    description:
      'Medication questions emphasize mechanisms, contraindications, adverse effects, and first-line choices.',
    benefit: 'Train drug reasoning as a clinical decision surface, not isolated memorization.',
    bestFor: 'Antibiotics, anticoagulation, cardio meds, endocrine therapy, and safety warnings.',
    systemMetric: 'Pharm stability',
    metricLabel: 'Drug sets',
    metricValue: '9',
    metricStatus: 'info',
    detail: 'Drug logic',
    protocol: 'Mechanism, indication, adverse effect, contraindication',
    previewPoints: [
      'Highlights safety-critical facts',
      'Pairs drugs with exam conditions',
      'Separates look-alike choices',
    ],
    tone: 'violet',
    icon: Microscope,
  },
  {
    id: 'readiness-scan',
    label: 'Readiness Scan',
    title: 'Readiness Scan',
    description:
      'Exam readiness combines weak systems, recall stability, pacing, and image accuracy into one signal.',
    benefit: 'Know whether today should be practice, review, image work, or simulation.',
    bestFor: 'Daily planning and exam-window confidence checks.',
    systemMetric: 'Readiness buffer',
    metricLabel: 'Readiness',
    metricValue: '86%',
    metricStatus: 'success',
    detail: 'Daily scan',
    protocol: 'Vitals, timeline, weak-area pressure, next study prescription',
    previewPoints: [
      'Summarizes risk quickly',
      'Points to one next action',
      'Stabilizes before exam week',
    ],
    tone: 'success',
    icon: Activity,
  },
];

export type ImageFinding = {
  label: string;
  value: string;
  status: 'active' | 'watch' | 'stable';
};

export const IMAGE_FINDINGS: ImageFinding[] = [
  { label: 'Modality', value: 'Chest radiograph', status: 'active' },
  { label: 'Signal', value: 'Missed lower-lobe opacity', status: 'watch' },
  { label: 'Next drill', value: 'Pulm infection set', status: 'stable' },
];

export type ClinicalImageCaseStatus = 'new' | 'needs-review' | 'strong' | 'weak';

export type ClinicalImageType =
  | 'ECG'
  | 'Chest imaging'
  | 'Dermatology'
  | 'Fundoscopy'
  | 'Radiology-style mock';

export type ClinicalImageAnnotationTone =
  | 'cyan'
  | 'blue'
  | 'violet'
  | 'pulse'
  | 'success'
  | 'warning';

export type ClinicalImageAnnotation = {
  id: string;
  label: string;
  note: string;
  x: number;
  y: number;
  tone: ClinicalImageAnnotationTone;
};

export type ClinicalImageCase = {
  id: string;
  imageType: ClinicalImageType;
  title: string;
  status: ClinicalImageCaseStatus;
  difficulty: 'Foundational' | 'Moderate' | 'Advanced';
  learningObjective: string;
  question: string;
  explanation: string;
  confidence: number;
  accuracyTrend: string;
  metricLabel: string;
  metricValue: string;
  visualPattern: 'ecg' | 'chest' | 'derm' | 'fundoscopy' | 'radiology';
  icon: LucideIcon;
  annotations: ClinicalImageAnnotation[];
};

export const CLINICAL_IMAGE_CASES: ClinicalImageCase[] = [
  {
    id: 'ecg-rhythm-abstraction',
    imageType: 'ECG',
    title: 'Rhythm strip abstraction',
    status: 'needs-review',
    difficulty: 'Moderate',
    learningObjective:
      'Practice a structured rhythm-read sequence using rate, regularity, and interval clues.',
    question: 'Which signal should be inspected first before choosing an answer category?',
    explanation:
      'This mock panel teaches rhythm-reading order and confidence tagging. It is not a real ECG and does not represent a patient.',
    confidence: 68,
    accuracyTrend: 'Accuracy rising after interval-focused review',
    metricLabel: 'ECG accuracy',
    metricValue: '68%',
    visualPattern: 'ecg',
    icon: Activity,
    annotations: [
      {
        id: 'ecg-rate',
        label: 'Rate cue',
        note: 'Start with rate and regularity before moving to narrower answer choices.',
        x: 28,
        y: 44,
        tone: 'cyan',
      },
      {
        id: 'ecg-interval',
        label: 'Interval cue',
        note: 'The interval region is highlighted as a study checkpoint, not a diagnostic finding.',
        x: 59,
        y: 38,
        tone: 'warning',
      },
      {
        id: 'ecg-confidence',
        label: 'Confidence flag',
        note: 'Low-confidence reads route into rapid review after the case.',
        x: 76,
        y: 61,
        tone: 'pulse',
      },
    ],
  },
  {
    id: 'chest-search-pattern',
    imageType: 'Chest imaging',
    title: 'Chest search-pattern mock',
    status: 'weak',
    difficulty: 'Moderate',
    learningObjective:
      'Use a repeatable chest-image search pattern before reading the answer choices.',
    question: 'Which image zone should be checked next in the systematic review sequence?',
    explanation:
      'The abstract chest panel demonstrates search order and annotation review. Licensed radiology assets can replace it later.',
    confidence: 54,
    accuracyTrend: 'Weak-area pressure remains elevated',
    metricLabel: 'Image accuracy',
    metricValue: '54%',
    visualPattern: 'chest',
    icon: Camera,
    annotations: [
      {
        id: 'chest-apex',
        label: 'Upper-zone pass',
        note: 'A structured pass prevents jumping to conclusions from a single highlighted region.',
        x: 32,
        y: 28,
        tone: 'blue',
      },
      {
        id: 'chest-midline',
        label: 'Midline check',
        note: 'The central marker represents orientation and search discipline only.',
        x: 51,
        y: 48,
        tone: 'cyan',
      },
      {
        id: 'chest-base',
        label: 'Lower-zone pass',
        note: 'The learner is prompted to finish the search pattern before answering.',
        x: 70,
        y: 68,
        tone: 'pulse',
      },
    ],
  },
  {
    id: 'derm-morphology-grid',
    imageType: 'Dermatology',
    title: 'Morphology descriptor mock',
    status: 'new',
    difficulty: 'Foundational',
    learningObjective: 'Compare morphology descriptors without relying on patient photographs.',
    question: 'Which descriptor should be confirmed before selecting a disease category?',
    explanation:
      'The synthetic texture trains vocabulary and comparison logic. It intentionally avoids real skin or patient photography.',
    confidence: 72,
    accuracyTrend: 'New case family added to image lab',
    metricLabel: 'Descriptor score',
    metricValue: '72%',
    visualPattern: 'derm',
    icon: Microscope,
    annotations: [
      {
        id: 'derm-border',
        label: 'Border descriptor',
        note: 'Focus on language precision before committing to a category.',
        x: 35,
        y: 41,
        tone: 'violet',
      },
      {
        id: 'derm-pattern',
        label: 'Pattern descriptor',
        note: 'The mock texture supports morphology practice only.',
        x: 62,
        y: 52,
        tone: 'cyan',
      },
      {
        id: 'derm-review',
        label: 'Review flag',
        note: 'Uncertain descriptor choices can be routed into missed-question review.',
        x: 72,
        y: 27,
        tone: 'warning',
      },
    ],
  },
  {
    id: 'fundoscopy-landmark-map',
    imageType: 'Fundoscopy',
    title: 'Retinal landmark map',
    status: 'strong',
    difficulty: 'Advanced',
    learningObjective:
      'Identify landmark orientation and vocabulary in a synthetic fundoscopy-style diagram.',
    question: 'Which landmark anchors the orientation before reviewing the prompt?',
    explanation:
      'This abstract retinal map teaches landmark sequencing. It is a mock diagram and does not show a patient eye.',
    confidence: 86,
    accuracyTrend: 'Strong landmark orientation across recent attempts',
    metricLabel: 'Landmarks',
    metricValue: '86%',
    visualPattern: 'fundoscopy',
    icon: Eye,
    annotations: [
      {
        id: 'fundus-disc',
        label: 'Landmark anchor',
        note: 'Use the anchor point to orient the rest of the synthetic diagram.',
        x: 48,
        y: 45,
        tone: 'success',
      },
      {
        id: 'fundus-vessel',
        label: 'Branch cue',
        note: 'Branching lines are schematic anatomy cues, not patient vasculature.',
        x: 66,
        y: 31,
        tone: 'cyan',
      },
      {
        id: 'fundus-review',
        label: 'Confidence check',
        note: 'Strong reads can stay in maintenance unless confidence drops.',
        x: 32,
        y: 61,
        tone: 'blue',
      },
    ],
  },
  {
    id: 'radiology-plane-mock',
    imageType: 'Radiology-style mock',
    title: 'Cross-section orientation mock',
    status: 'needs-review',
    difficulty: 'Advanced',
    learningObjective:
      'Practice plane orientation, contrast windows, and landmark sequencing with a fake cross-section.',
    question: 'Which orientation cue should be used before interpreting the highlighted structure?',
    explanation:
      'The panel is a synthetic radiology-style abstraction for workflow training. It should be replaced only with licensed assets.',
    confidence: 63,
    accuracyTrend: 'Orientation misses recurring in advanced image sets',
    metricLabel: 'Orientation',
    metricValue: '63%',
    visualPattern: 'radiology',
    icon: Layers3,
    annotations: [
      {
        id: 'radio-plane',
        label: 'Plane marker',
        note: 'Confirm plane and orientation before moving to image interpretation.',
        x: 29,
        y: 32,
        tone: 'warning',
      },
      {
        id: 'radio-window',
        label: 'Window cue',
        note: 'Contrast controls are represented as a fake training overlay.',
        x: 54,
        y: 55,
        tone: 'violet',
      },
      {
        id: 'radio-landmark',
        label: 'Landmark cue',
        note: 'Landmark review is emphasized before selecting an answer.',
        x: 74,
        y: 38,
        tone: 'cyan',
      },
    ],
  },
];

export type AnalyticsMetric = LandingVital & {
  numericValue: number;
  formatter: (value: number) => string;
};

export type DashboardPreviewVital = AnalyticsMetric & {
  context: string;
  target: string;
};

export const DASHBOARD_PREVIEW_VITALS: DashboardPreviewVital[] = [
  {
    label: 'Readiness score',
    value: '86%',
    numericValue: 86,
    formatter: (value) => `${Math.round(value)}%`,
    change: '+7 after targeted blocks',
    status: 'success',
    accessibleText: 'Readiness score is 86 percent, up 7 points after targeted blocks.',
    context: 'Stable enough for mixed blocks; keep cardiopulmonary review active.',
    target: 'Target: 82%+ sustained',
  },
  {
    label: 'Readiness buffer',
    value: '12%',
    numericValue: 12,
    formatter: (value) => `${Math.round(value)}%`,
    change: 'above current target',
    status: 'success',
    accessibleText: 'Readiness buffer is 12 percent above the current target.',
    context: 'Projection combines accuracy, coverage, recall stability, and image work.',
    target: 'Target: 10% buffer',
  },
  {
    label: 'Weak-area pressure',
    value: '4',
    numericValue: 4,
    formatter: (value) => `${Math.round(value)}`,
    change: 'systems need attention',
    status: 'warning',
    accessibleText: 'Four organ systems need attention.',
    context: 'Cardiology and pulmonology are driving today’s prescription.',
    target: 'Target: 2 or fewer',
  },
  {
    label: 'Recall stability',
    value: '81%',
    numericValue: 81,
    formatter: (value) => `${Math.round(value)}%`,
    change: 'stable across 14 days',
    status: 'info',
    accessibleText: 'Recall stability is 81 percent across 14 days.',
    context: 'Overdue high-yield misses should be cleared before simulation.',
    target: 'Target: 85% mature',
  },
];

export const ANALYTICS_METRICS: AnalyticsMetric[] = [
  {
    label: 'Readiness buffer',
    value: '12%',
    numericValue: 12,
    formatter: (value) => `${Math.round(value)}%`,
    change: 'above current target',
    status: 'success',
    accessibleText: 'Readiness buffer is 12 percent above the current target.',
  },
  {
    label: 'Weak-area pressure',
    value: '4',
    numericValue: 4,
    formatter: (value) => `${Math.round(value)}`,
    change: 'systems need attention',
    status: 'warning',
    accessibleText: 'Four organ systems need attention.',
  },
  {
    label: 'Recall stability',
    value: '81%',
    numericValue: 81,
    formatter: (value) => `${Math.round(value)}%`,
    change: 'stable across 14 days',
    status: 'info',
    accessibleText: 'Recall stability is 81 percent across 14 days.',
  },
];

export type OrganSystem = {
  label: string;
  score: string;
  state: OrganSystemBadgeState;
};

export const ORGAN_SYSTEMS: OrganSystem[] = [
  { label: 'Cardiology', score: '68', state: 'weak' },
  { label: 'Pulmonology', score: '72', state: 'watch' },
  { label: 'GI/Nutrition', score: '84', state: 'active' },
  { label: 'MSK', score: '91', state: 'strong' },
  { label: 'Endocrine', score: '79', state: 'watch' },
  { label: 'Infectious Disease', score: '88', state: 'strong' },
];

export type DashboardOrganSystem = {
  label: string;
  score: number;
  state: OrganSystemBadgeState;
  context: string;
  nextAction: string;
  pressure: 'High' | 'Watch' | 'Stable';
};

export const DASHBOARD_ORGAN_SYSTEMS: DashboardOrganSystem[] = [
  {
    label: 'Cardiology',
    score: 68,
    state: 'weak',
    context: 'EKG rhythm and murmur stems remain the largest readiness drag.',
    nextAction: '12-question cardio image + rationale pass',
    pressure: 'High',
  },
  {
    label: 'Pulmonology',
    score: 72,
    state: 'watch',
    context: 'Lower-respiratory infection misses repeat across question and image sets.',
    nextAction: 'Chest imaging search-pattern drill',
    pressure: 'High',
  },
  {
    label: 'Endocrine',
    score: 79,
    state: 'watch',
    context: 'Therapy sequencing is improving but still below simulation threshold.',
    nextAction: 'Mixed endocrine management review',
    pressure: 'Watch',
  },
  {
    label: 'GI/Nutrition',
    score: 84,
    state: 'active',
    context: 'Bleeding triage and nutrition support are near target.',
    nextAction: 'Maintenance block after weak systems',
    pressure: 'Watch',
  },
  {
    label: 'Infectious Disease',
    score: 88,
    state: 'strong',
    context: 'Antibiotic coverage has stabilized across recent review windows.',
    nextAction: 'Keep in spaced review queue',
    pressure: 'Stable',
  },
  {
    label: 'MSK',
    score: 91,
    state: 'strong',
    context: 'Stable across timed blocks with low review debt.',
    nextAction: 'No extra drill today',
    pressure: 'Stable',
  },
];

export type DashboardPrescriptionStep = {
  label: string;
  detail: string;
  duration: string;
  status: MetricVitalStatus;
};

export type DashboardStudyPrescription = {
  priority: string;
  title: string;
  duration: string;
  rationale: string;
  expectedImpact: string;
  steps: DashboardPrescriptionStep[];
};

export const DASHBOARD_STUDY_PRESCRIPTION: DashboardStudyPrescription = {
  priority: 'Today 18:00',
  title: 'Cardiopulmonary readiness repair',
  duration: '42 min',
  rationale:
    'Cardiology and pulmonology misses overlap with image accuracy and pacing drift, so today’s plan starts there before simulation.',
  expectedImpact: '+3 readiness points if review debt is cleared',
  steps: [
    {
      label: 'Targeted questions',
      detail: '24 mixed cardio/pulm stems with distractor repair',
      duration: '24 min',
      status: 'warning',
    },
    {
      label: 'Image lab',
      detail: '6 synthetic ECG and chest search-pattern reads',
      duration: '10 min',
      status: 'info',
    },
    {
      label: 'Spaced review',
      detail: '18 due high-yield misses before the next timed block',
      duration: '8 min',
      status: 'success',
    },
  ],
};

export type DashboardReadinessPoint = {
  checkpoint: string;
  readiness: number;
  target: number;
  imageAccuracy: number;
  reviewDebt: number;
  context: string;
};

export const DASHBOARD_READINESS_TIMELINE: DashboardReadinessPoint[] = [
  {
    checkpoint: 'Baseline',
    readiness: 58,
    target: 70,
    imageAccuracy: 61,
    reviewDebt: 42,
    context: 'Initial diagnostic scan',
  },
  {
    checkpoint: 'Week 1',
    readiness: 64,
    target: 72,
    imageAccuracy: 65,
    reviewDebt: 35,
    context: 'Weak-area targeting begins',
  },
  {
    checkpoint: 'Week 2',
    readiness: 69,
    target: 74,
    imageAccuracy: 68,
    reviewDebt: 31,
    context: 'Image lab added',
  },
  {
    checkpoint: 'Week 3',
    readiness: 73,
    target: 76,
    imageAccuracy: 71,
    reviewDebt: 28,
    context: 'Spaced review stabilizes',
  },
  {
    checkpoint: 'Week 4',
    readiness: 79,
    target: 78,
    imageAccuracy: 74,
    reviewDebt: 21,
    context: 'Timed exam improves',
  },
  {
    checkpoint: 'Week 5',
    readiness: 83,
    target: 80,
    imageAccuracy: 78,
    reviewDebt: 18,
    context: 'Review debt controlled',
  },
  {
    checkpoint: 'Now',
    readiness: 86,
    target: 82,
    imageAccuracy: 80,
    reviewDebt: 18,
    context: 'Readiness stabilizing',
  },
];

export type DashboardImageAccuracyItem = {
  label: ClinicalImageType;
  accuracy: number;
  trend: string;
  status: ClinicalImageCaseStatus;
  context: string;
};

export const DASHBOARD_IMAGE_ACCURACY: DashboardImageAccuracyItem[] = [
  {
    label: 'ECG',
    accuracy: 68,
    trend: '+6 after interval review',
    status: 'needs-review',
    context: 'Rhythm sequencing still needs one more drill.',
  },
  {
    label: 'Chest imaging',
    accuracy: 54,
    trend: 'weak-area pressure high',
    status: 'weak',
    context: 'Search-pattern misses should be addressed today.',
  },
  {
    label: 'Dermatology',
    accuracy: 72,
    trend: 'new case family',
    status: 'new',
    context: 'Descriptor precision is being established.',
  },
  {
    label: 'Fundoscopy',
    accuracy: 86,
    trend: 'stable landmark reads',
    status: 'strong',
    context: 'Keep in maintenance unless confidence drops.',
  },
];

export type WorkflowStep = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: 'Begin with a readiness scan',
    description: 'Open to a clinically ranked plan instead of a generic question list.',
    icon: Activity,
  },
  {
    title: 'Train the weakest system',
    description: 'Work questions, images, and rationales tied to the same organ-system gap.',
    icon: Microscope,
  },
  {
    title: 'Stabilize before simulation',
    description: 'Resurface overdue misses and confirm the systems that are safe to leave alone.',
    icon: ChartNoAxesCombined,
  },
];

export const CTA_ASSURANCES = [
  'Readiness baseline in minutes',
  'NCCPA blueprint aligned',
  'Adaptive from the first block',
] as const;

export const HERO_SCAN_LABELS = [
  'Cardiology',
  'Pulmonology',
  'GI/Nutrition',
  'Pharmacology',
  'Clinical images',
] as const;

export type HeroDiagnosticLabel = {
  label: string;
  metric: string;
  position:
    | 'upper-left'
    | 'upper-right'
    | 'middle-left'
    | 'middle-right'
    | 'lower-left'
    | 'lower-right';
  tone: 'cyan' | 'blue' | 'violet' | 'pulse' | 'success' | 'warning';
};

export const HERO_DIAGNOSTIC_LABELS: HeroDiagnosticLabel[] = [
  { label: 'Cardiology', metric: '68 risk', position: 'middle-left', tone: 'pulse' },
  { label: 'Pulmonology', metric: '72 watch', position: 'upper-right', tone: 'warning' },
  { label: 'Pharmacology', metric: '81 stable', position: 'lower-left', tone: 'violet' },
  { label: 'Clinical Images', metric: '74 active', position: 'middle-right', tone: 'blue' },
  { label: 'Readiness Score', metric: '86%', position: 'upper-left', tone: 'success' },
  { label: 'Weak Areas', metric: '4 systems', position: 'lower-right', tone: 'cyan' },
];

export const HERO_TRUST_INDICATORS = [
  { label: 'Blueprint-aware practice', detail: 'organ systems + tasks' },
  { label: 'Image-read training', detail: 'synthetic viewer drills' },
  { label: 'Weak-area Rx', detail: 'one next block first' },
] as const;

export const PLACEHOLDER_CAPABILITIES = [
  { label: '3D scanner scene', icon: Layers3 },
  { label: 'Pinned diagnostic story', icon: Sparkles },
  { label: 'Clinical viewer controls', icon: Eye },
  { label: 'Readiness trend chart', icon: LineChart },
  { label: 'Study prescription dock', icon: Zap },
] as const;

export type PlatformDifferentiator = {
  id: string;
  claim: string;
  mechanism: string;
  icon: LucideIcon;
};

export const PLATFORM_DIFFERENTIATORS: PlatformDifferentiator[] = [
  {
    id: 'implicit-confidence',
    claim: "Confidence isn't self-reported. It's measured.",
    mechanism:
      'Confidence is derived from response latency, hesitation, and answer-switching, then calibrated to each learner’s ability level. There are no self-rated buttons.',
    icon: Brain,
  },
  {
    id: 'connected-concept-map',
    claim: 'Every question builds one connected concept map, not a card pile.',
    mechanism:
      'Each item maps to a clinical concept node, so mastery transfers across novel question phrasings instead of staying tied to one memorized card.',
    icon: Network,
  },
  {
    id: 'clinical-reasoning',
    claim: 'Built to train clinical reasoning, not recall.',
    mechanism:
      'Dual-process training and illness-script formation build pattern recognition on top of retrieval practice, instead of running memorization drills.',
    icon: Stethoscope,
  },
  {
    id: 'calculated-review-timing',
    claim: 'Review timing is calculated, not guessed.',
    mechanism:
      'FSRS v6 spaced repetition schedules each review near the point where modeled retrievability is about to drop, instead of running a fixed daily deck.',
    icon: TimerReset,
  },
  {
    id: 'overconfidence-detection',
    claim: 'Dangerous overconfidence gets caught before exam day.',
    mechanism:
      'A high-confidence-but-wrong response pattern is detected and routed into targeted re-teaching instead of passing through as a correct answer.',
    icon: AlertTriangle,
  },
  {
    id: 'blueprint-weighted-practice',
    claim: 'Practice time tracks the actual exam, not a guess at it.',
    mechanism:
      'Every organ system and task category is weighted to the 2025 NCCPA PANCE blueprint (Cardiovascular 11%, Diagnosis 18%, Clinical Intervention 16%, and more), so time spent maps to real exam yield.',
    icon: Target,
  },
];

export const PANCE_REASONING_STAT = {
  value: '34%',
  label: 'of the PANCE tests reasoning, not recall',
  detail:
    'Formulating the most likely diagnosis (18%) and clinical intervention (16%) are the two largest task categories on the 2025 NCCPA blueprint — both require synthesis, not memorization.',
} as const;
