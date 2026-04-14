import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Brain,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';

export const LANDING_PROOF_NOTE =
  'Placeholder proof content. Replace with verified production metrics and reviewed testimonials before launch.';

export const NAV_LINKS = [
  { label: 'Platform', href: '#features' },
  { label: 'Outcomes', href: '#proof' },
  { label: 'Workflow', href: '#how-it-works' },
] as const;

export const HERO_SIGNALS = [
  { label: 'NCCPA blueprint sync', value: 'Adaptive every session' },
  { label: 'FSRS memory engine', value: 'Schedules by retention curve' },
  { label: 'Clinical reasoning drills', value: 'Built for PA students' },
] as const;

export const FEATURE_CARDS = [
  {
    icon: Brain,
    accent: '#c4b78a',
    eyebrow: 'Gold intelligence',
    title: 'Adaptive Blueprinting',
    description:
      'Every session rebalances toward your weak systems, recall decay, and the real NCCPA weighting you still need to close.',
    detail: 'Blueprint coverage updates as you answer, not after the fact.',
  },
  {
    icon: Stethoscope,
    accent: '#9a7f9a',
    eyebrow: 'Deep plum focus',
    title: 'Clinical Drill Engine',
    description:
      'Move from raw recall to diagnostic reasoning with targeted cases across pharm, imaging, EKG, first-line treatment, and differential work.',
    detail: 'Switch modes without losing the adaptive thread.',
  },
  {
    icon: Activity,
    accent: '#728ba6',
    eyebrow: 'Steel-blue calibration',
    title: 'Performance Signal Layer',
    description:
      'Accuracy, pacing, confidence, and review timing stay visible in one premium view so you always know what is rising and what is slipping.',
    detail: 'Designed for calm, fast decisions during busy rotations.',
  },
  {
    icon: BookOpen,
    accent: '#7a8f6e',
    eyebrow: 'Sage clinical library',
    title: 'Integrated Learning Context',
    description:
      'Questions connect directly to high-yield condition summaries, pearls, and treatment anchors so every miss becomes usable clinical memory.',
    detail: 'Reference and practice stay in the same workflow.',
  },
  {
    icon: Zap,
    accent: '#a67f7f',
    eyebrow: 'Dusty-rose feedback',
    title: 'Tutor-Grade Explanations',
    description:
      'Structured rationales explain not only what is correct, but why competing answers are unsafe, premature, or incomplete.',
    detail: 'Confidence grows because your reasoning gets sharper.',
  },
  {
    icon: ShieldCheck,
    accent: '#b39b6c',
    eyebrow: 'Muted-amber trust',
    title: 'Exam-Day Readiness Guardrails',
    description:
      'Thresholds, pacing cues, and targeted resurfacing keep you training at the edge of competence without drifting into busywork.',
    detail: 'A premium workflow built to feel dependable under pressure.',
  },
] as const;

export const TRUST_METRICS = [
  {
    value: 12000,
    label: 'PA learners in active prep loops',
    detail: 'Across foundational review, rotation drilling, and sit-down simulation.',
    accent: '#c4b78a',
    format: (current: number) => `${Math.max(1, Math.round(current / 1000))}K+`,
  },
  {
    value: 2800000,
    label: 'adaptive questions modeled',
    detail: 'Each session sharpens timing, accuracy, and retrieval confidence.',
    accent: '#728ba6',
    format: (current: number) => `${(current / 1000000).toFixed(current >= 1000000 ? 1 : 1)}M`,
  },
  {
    value: 94,
    label: 'green-zone readiness target',
    detail: 'A strong benchmark before high-stakes full-length practice.',
    accent: '#7a8f6e',
    format: (current: number) => `${Math.round(current)}%`,
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      'It feels less like a question bank and more like a clinical training system that actually remembers what I am forgetting.',
    name: 'Ariana M.',
    role: 'PA-S2, emergency medicine rotation',
    accent: '#c4b78a',
  },
  {
    quote:
      'My weak systems stopped hiding once the calibration layer kicked in. The dashboard made my study time finally feel intentional.',
    name: 'Jordan R.',
    role: 'PA-S3, cardiology track',
    accent: '#728ba6',
  },
  {
    quote:
      'The explanations are clinical, not generic. I started trusting my answer process instead of just memorizing keys.',
    name: 'Samira L.',
    role: 'PA-S2, internal medicine rotation',
    accent: '#9a7f9a',
  },
] as const;

export const PROCESS_STEPS = [
  {
    step: '01',
    icon: Target,
    title: 'Diagnose the Baseline',
    description:
      'PANaCEa maps your current readiness by system, pacing profile, and recall strength so the first session is already targeted.',
  },
  {
    step: '02',
    icon: Brain,
    title: 'Train the Right Friction',
    description:
      'You work inside adaptive drills that raise the exact concepts, distractors, and clinical patterns most likely to move your score.',
  },
  {
    step: '03',
    icon: TrendingUp,
    title: 'Confirm Exam Calm',
    description:
      'Before exam week, your dashboard surfaces whether you are truly stable or just recently lucky, and tells you what still needs attention.',
  },
] as const;

export const PROCESS_SIGNALS = [
  'Rotation timing',
  'Answer speed',
  'Recall decay',
  'Blueprint coverage',
  'Confidence drift',
  'High-risk distractors',
] as const;

export const HERO_BADGES = [
  { icon: BadgeCheck, label: 'Blueprint synced' },
  { icon: Sparkles, label: 'Review window recalculated' },
  { icon: BarChart3, label: LANDING_PROOF_NOTE },
] as const;
