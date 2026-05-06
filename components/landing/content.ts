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
  { label: 'Example next move', value: 'Ranked by verified study signals' },
  { label: 'Recall timing', value: 'Reviews surface when useful' },
  { label: 'Blueprint gaps', value: 'Mapped to PANCE weight' },
] as const;

export const FEATURE_CARDS = [
  {
    icon: Brain,
    accent: 'var(--landing-gold)',
    eyebrow: 'Blueprint targeting',
    title: 'One Study Move At A Time',
    description:
      'Blueprint weighting, forgetting risk, and system weakness are ranked into one clear recommendation before each session starts.',
    detail: 'The dashboard opens with a single next action.',
  },
  {
    icon: Stethoscope,
    accent: 'var(--landing-plum)',
    eyebrow: 'Clinical pattern repair',
    title: 'Differentials, Not Trivia',
    description:
      'Move from recall into judgment with targeted cases across pharm, imaging, EKG, first-line treatment, and differential narrowing.',
    detail: 'Practice stays tied to the clinical mistake that surfaced it.',
  },
  {
    icon: Activity,
    accent: 'var(--landing-steel)',
    eyebrow: 'Quiet signals',
    title: 'Progress Without Metric Clutter',
    description:
      'Accuracy, pacing, missed patterns, and review timing are reduced to compact signals that support the next move.',
    detail: 'Designed for fast decisions during rotations.',
  },
  {
    icon: BookOpen,
    accent: 'var(--landing-sage)',
    eyebrow: 'Sage clinical library',
    title: 'Integrated Learning Context',
    description:
      'Questions connect directly to high-yield condition summaries, pearls, and treatment anchors so every miss becomes usable clinical memory.',
    detail: 'Reference and practice stay in the same working lane.',
  },
  {
    icon: Zap,
    accent: 'var(--landing-rose)',
    eyebrow: 'Reasoned feedback',
    title: 'Tutor-Grade Explanations',
    description:
      'Structured rationales explain not only what is correct, but why competing answers are unsafe, premature, or incomplete in clinic terms.',
    detail: 'Reasoning gets sharper because each miss becomes a clinical contrast.',
  },
  {
    icon: ShieldCheck,
    accent: 'var(--landing-amber)',
    eyebrow: 'Muted-amber trust',
    title: 'Exam-Day Readiness Guardrails',
    description:
      'Thresholds, pacing cues, and targeted resurfacing keep you training at the edge of competence without drifting into busywork.',
    detail: 'A dependable workflow built to hold up under pressure.',
  },
] as const;

export const FEATURE_PILLARS = [
  'The first screen tells the student what to do next.',
  'Every recommendation explains why it is the highest-value move.',
  'Deeper analytics stay available without competing with task initiation.',
] as const;

/**
 * Landing metrics reframed around platform capability rather than an
 * unverified user count. Three goals:
 *   1. Every value must be defensible — either it's a design constant
 *      baked into the platform, a blueprint fact, or a bounded claim.
 *   2. Avoid social-proof numbers ("12K learners") until an audited count
 *      can be cited.
 *   3. Keep the animated reveal pattern so the section still feels alive.
 */
export const TRUST_METRICS = [
  {
    value: 13,
    label: 'NCCPA blueprint task domains covered',
    detail: 'Every high-yield PANCE task area mapped to adaptive drills and review.',
    accent: 'var(--landing-gold)',
    format: (current: number) => `${Math.round(current)}`,
  },
  {
    value: 21,
    label: 'FSRS v6 parameters driving every review',
    detail: 'Stability, difficulty, and retrievability recalculated per question per session.',
    accent: 'var(--landing-steel)',
    format: (current: number) => `${Math.round(current)}`,
  },
  {
    value: 94,
    label: 'target readiness threshold before simulation',
    detail: 'A strong benchmark before high-stakes full-length practice.',
    accent: 'var(--landing-sage)',
    format: (current: number) => `${Math.round(current)}%`,
  },
] as const;

export const TRUST_CALLOUTS = [
  'Visible readiness signals instead of vague self-ratings.',
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
    title: 'Behavior drives the plan',
    detail: 'Timing, misses, and recall decay steer the next recommended block.',
  },
] as const;

export const TESTIMONIALS = [
  {
    quote:
      'It feels less like a question bank and more like a clinical training system that actually remembers what I am forgetting.',
    name: 'Ariana M.',
    role: 'PA-S2, emergency medicine rotation',
    accent: 'var(--landing-gold)',
  },
  {
    quote:
      'My weak systems stopped hiding once the plan started showing one target at a time. The study surface finally felt intentional.',
    name: 'Jordan R.',
    role: 'PA-S3, cardiology track',
    accent: 'var(--landing-steel)',
  },
  {
    quote:
      'The explanations are clinical, not generic. I started trusting my answer process instead of just memorizing keys.',
    name: 'Samira L.',
    role: 'PA-S2, internal medicine rotation',
    accent: 'var(--landing-plum)',
  },
] as const;

export const PROCESS_STEPS = [
  {
    step: '01',
    icon: Target,
    title: 'Set the Baseline',
    description:
      'PANaCEa maps your current readiness by system, pacing profile, and recall strength so the first session is already targeted.',
  },
  {
    step: '02',
    icon: Brain,
    title: 'Repair the Right Pattern',
    description:
      'You work inside adaptive drills that raise the exact concepts, distractors, and clinical patterns most likely to move your score.',
  },
  {
    step: '03',
    icon: TrendingUp,
    title: 'Track Readiness',
    description:
      'Before exam week, PANaCEa surfaces the risk areas still worth fixing and keeps lower-value analytics out of the way.',
  },
] as const;

export const PROCESS_SIGNALS = [
  'Rotation timing',
  'Answer speed',
  'Recall decay',
  'Blueprint coverage',
  'High-risk distractors',
] as const;

export const CTA_ASSURANCES = [
  'Baseline in minutes',
  'Adaptive plan from day one',
  'Built around the NCCPA blueprint',
] as const;
