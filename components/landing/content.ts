import {
  Activity,
  BookOpen,
  Brain,
  ShieldCheck,
  Stethoscope,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';

export const NAV_LINKS = [
  { label: 'Platform', href: '#features' },
  { label: 'Outcomes', href: '#proof' },
  { label: 'Workflow', href: '#how-it-works' },
] as const;

export const HERO_SIGNALS = [
  { label: 'NCCPA blueprint sync', value: 'Re-ranked after every block' },
  { label: 'FSRS memory engine', value: 'Trains by forgetting risk' },
  { label: 'Clinical reasoning drills', value: 'Built for PA decision-making' },
] as const;

export const FEATURE_CARDS = [
  {
    icon: Brain,
    accent: '#c4b78a',
    eyebrow: 'Gold intelligence',
    title: 'Adaptive Blueprinting',
    description:
      'Blueprint weighting, forgetting risk, and system weakness are re-ranked after every block so the next session starts where the score still moves.',
    detail: 'Weakness prioritization updates inside the session.',
  },
  {
    icon: Stethoscope,
    accent: '#9a7f9a',
    eyebrow: 'Deep plum focus',
    title: 'Clinical Drill Engine',
    description:
      'Move from recall into judgment with targeted cases across pharm, imaging, EKG, first-line treatment, and differential narrowing.',
    detail: 'Switch modes without losing the adaptive thread.',
  },
  {
    icon: Activity,
    accent: '#728ba6',
    eyebrow: 'Steel-blue calibration',
    title: 'Performance Signal Layer',
    description:
      'Accuracy, pacing, confidence, and review timing stay visible in one calm surface so you can tell what is stabilizing and what still leaks points.',
    detail: 'Designed for fast, low-friction decisions during rotations.',
  },
  {
    icon: BookOpen,
    accent: '#7a8f6e',
    eyebrow: 'Sage clinical library',
    title: 'Integrated Learning Context',
    description:
      'Questions connect directly to high-yield condition summaries, pearls, and treatment anchors so every miss becomes usable clinical memory.',
    detail: 'Reference and practice stay in the same working lane.',
  },
  {
    icon: Zap,
    accent: '#a67f7f',
    eyebrow: 'Dusty-rose feedback',
    title: 'Tutor-Grade Explanations',
    description:
      'Structured rationales explain not only what is correct, but why competing answers are unsafe, premature, or incomplete in clinic terms.',
    detail: 'Confidence grows because the reasoning gets sharper.',
  },
  {
    icon: ShieldCheck,
    accent: '#b39b6c',
    eyebrow: 'Muted-amber trust',
    title: 'Exam-Day Readiness Guardrails',
    description:
      'Thresholds, pacing cues, and targeted resurfacing keep you training at the edge of competence without drifting into busywork.',
    detail: 'A dependable workflow built to hold up under pressure.',
  },
] as const;

export const FEATURE_PILLARS = [
  'The next block changes the moment your pattern changes.',
  'Clinical reference stays attached to the exact miss that surfaced it.',
  'The interface is designed for daily use during rotations, not just cram week.',
] as const;

export const TRUST_METRICS = [
  {
    value: 12000,
    label: 'PA learners in active adaptive plans',
    detail: 'Across foundational review, rotation drilling, and full-length simulation.',
    accent: '#c4b78a',
    format: (current: number) => `${Math.max(1, Math.round(current / 1000))}K+`,
  },
  {
    value: 2800000,
    label: 'adaptive question interactions modeled',
    detail: 'Each session sharpens timing, accuracy, and retrieval confidence.',
    accent: '#728ba6',
    format: (current: number) => `${(current / 1000000).toFixed(current >= 1000000 ? 1 : 1)}M`,
  },
  {
    value: 94,
    label: 'target readiness threshold before simulation',
    detail: 'A strong benchmark before high-stakes full-length practice.',
    accent: '#7a8f6e',
    format: (current: number) => `${Math.round(current)}%`,
  },
] as const;

export const TRUST_CALLOUTS = [
  'Visible readiness signals instead of vague confidence.',
  'Clinical explanations that sharpen judgment, not trivia recall.',
  'A workflow calm enough to trust before a high-stakes exam window.',
] as const;

export const OUTCOME_STRIP = [
  {
    title: 'Readiness stays visible',
    detail: 'Score lift projections update with every focused block.',
  },
  {
    title: 'Blueprint gaps stop hiding',
    detail: 'Weak systems surface before they turn into exam-day misses.',
  },
  {
    title: 'Confidence matches reality',
    detail: 'Timing and certainty drift are tracked alongside accuracy.',
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

export const CTA_ASSURANCES = [
  'Baseline in minutes',
  'Adaptive plan from day one',
  'Built around the NCCPA blueprint',
] as const;
