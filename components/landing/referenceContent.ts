import {
  Activity,
  Brain,
  ChartNoAxesCombined,
  ClipboardCheck,
  Clock3,
  Layers3,
  ScanLine,
  ShieldQuestion,
  Stethoscope,
  Target,
  TimerReset,
} from 'lucide-react';

// Demonstration data only. Never use these values as authenticated learner fallbacks.
export const STUDY_PREVIEW = {
  recallEstimate: 68,
  priority: 'Pulmonary embolism',
  focus: 'Risk factors & clinical presentation',
  plan: [
    {
      title: 'Focused review',
      topic: 'Pulmonary embolism',
      duration: '12 min',
      icon: ClipboardCheck,
    },
    {
      title: 'Clinical scenario',
      topic: 'Acute heart failure',
      duration: '18 min',
      icon: Stethoscope,
    },
    { title: 'Recall check', topic: 'Hyponatremia', duration: '8 min', icon: Brain },
  ],
  systems: [
    { name: 'Cardiovascular', value: 78 },
    { name: 'Respiratory', value: 64 },
    { name: 'Gastrointestinal', value: 71 },
    { name: 'Endocrine', value: 62 },
  ],
} as const;

export const STUDY_CHALLENGES = [
  { title: 'Too much to cover', detail: 'A growing list. No clear starting point.', icon: Layers3 },
  { title: 'Forgetting too soon', detail: 'Familiar today. Hard to recall tomorrow.', icon: Brain },
  {
    title: 'Guessing what’s next',
    detail: 'More planning than meaningful practice.',
    icon: Target,
  },
  { title: 'Uneven progress', detail: 'Strong in one system. Unsure in another.', icon: Activity },
  {
    title: 'Readiness uncertainty',
    detail: 'Wanting a clearer picture before exam day.',
    icon: ShieldQuestion,
  },
] as const;

export const LEARNING_STEPS = [
  {
    title: 'Practice a concept',
    description: 'Answer a clinical question that connects to an underlying concept.',
    icon: Brain,
  },
  {
    title: 'Let behavior speak',
    description: 'Accuracy, response timing, and answer changes inform a confidence estimate.',
    icon: Target,
  },
  {
    title: 'Model your memory',
    description: 'Your concept history helps estimate recall as time passes.',
    icon: ClipboardCheck,
  },
  {
    title: 'Schedule automatically',
    description: 'Review timing adjusts without asking you to rate the question.',
    icon: TimerReset,
  },
  {
    title: 'Retrieve it a new way',
    description: 'A different question tests the same concept in a fresh context.',
    icon: ChartNoAxesCombined,
  },
] as const;

export const PRACTICE_FEATURES = [
  {
    title: 'Your own baseline',
    description:
      'Response timing is interpreted in context, with personal baselines when enough history is available.',
    icon: Stethoscope,
    tag: 'A model that learns you',
  },
  {
    title: 'More than right or wrong',
    description:
      'Answer revisions and hesitation can add context to a correct answer, when those signals are available.',
    icon: ScanLine,
    tag: 'Behavior adds context',
  },
  {
    title: 'Less to manage',
    description:
      'Review timing follows your concept history. Keep your attention on learning, not rating cards.',
    icon: Clock3,
    tag: 'Automatic by design',
  },
] as const;
