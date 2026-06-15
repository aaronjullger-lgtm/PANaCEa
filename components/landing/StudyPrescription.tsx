import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Clock, Crosshair, Sparkles, Target, TrendingUp } from 'lucide-react';
import { MedicalGlassCard, PremiumCTAButton, SectionHeader } from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import { DASHBOARD_STUDY_PRESCRIPTION } from './content';

/**
 * Product Proof — "One Next Best Action".
 *
 * The page's central proof: PANaCEa reduces decision fatigue by resolving the
 * full picture into a single prescribed action. The prescription dominates; the
 * supporting analytics (why this / how long / what it fixes / expected effect)
 * explain it rather than competing with it. Gold is used here, sparingly, as the
 * "selected action" signal established by the Clinical Learning Engine.
 */

export interface StudyPrescriptionProps {
  onStart: () => void;
}

const RX = DASHBOARD_STUDY_PRESCRIPTION;

const RATIONALE_POINTS = [
  {
    icon: Target,
    label: 'Why this',
    value: RX.rationale,
  },
  {
    icon: Clock,
    label: 'How long',
    value: `${RX.duration} across three linked steps — fits one focused study window.`,
  },
  {
    icon: TrendingUp,
    label: 'Expected effect',
    value: RX.expectedImpact,
  },
] as const;

export function StudyPrescription({ onStart }: StudyPrescriptionProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());

  const reveal = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-80px' },
        transition: { duration: 0.5 },
      };

  return (
    <section
      id="study-prescription"
      aria-labelledby="study-prescription-title"
      className="relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="One next best action"
          title="Stop choosing what to study. Open to a decision already made."
          description="From everything PANaCEa knows about you — weak systems, review debt, blueprint risk, and exam timeline — it resolves one prescribed action and explains the reasoning behind it."
          titleId="study-prescription-title"
        />

        <motion.div {...reveal} className="mt-10">
          <MedicalGlassCard
            scannerAccent
            className="overflow-hidden p-0"
            // gold left rule: the "selected action" symbol
            style={{ borderLeft: '2px solid var(--atlas-accent-gold)' }}
          >
            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              {/* The prescribed action — dominant */}
              <div className="border-b border-atlas-border p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--atlas-accent-gold)_45%,transparent)] bg-[color-mix(in_srgb,var(--atlas-accent-gold)_12%,transparent)] px-3 py-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--atlas-accent-gold)]">
                    <Crosshair className="size-3" aria-hidden="true" />
                    Prescribed now
                  </span>
                  <span className="font-mono text-xs text-atlas-muted">{RX.priority}</span>
                </div>

                <h3 className="mt-5 font-poppins text-2xl font-semibold leading-tight text-atlas-white sm:text-3xl">
                  {RX.title}
                </h3>
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-atlas-muted">
                  <Clock className="size-4 text-atlas-cyan" aria-hidden="true" />
                  Estimated {RX.duration}
                </p>

                <ol className="mt-6 grid gap-3">
                  {RX.steps.map((step, index) => (
                    <li
                      key={step.label}
                      className="flex items-start gap-3 rounded-2xl border border-atlas-border bg-atlas-glass p-4"
                    >
                      <span
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-atlas-border bg-atlas-background-soft font-mono text-xs text-atlas-cyan"
                        aria-hidden="true"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-poppins text-sm font-semibold text-atlas-white">
                            {step.label}
                          </span>
                          <span className="font-mono text-[0.68rem] text-atlas-subtle">
                            {step.duration}
                          </span>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-atlas-muted">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <PremiumCTAButton
                  onClick={onStart}
                  scannerAccent
                  className="mt-7 w-full sm:w-auto"
                  iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
                >
                  Start this block
                </PremiumCTAButton>
              </div>

              {/* The reasoning — supporting */}
              <div className="bg-atlas-background/45 p-6 sm:p-8">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Why the engine chose this
                </p>

                <div className="mt-5 grid gap-4">
                  {RATIONALE_POINTS.map((point) => {
                    const Icon = point.icon;
                    return (
                      <div key={point.label} className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-atlas-border bg-atlas-glass text-atlas-cyan">
                          <Icon className="size-4" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-atlas-subtle">
                            {point.label}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-atlas-muted">{point.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p
                  className={cn(
                    'mt-6 rounded-2xl border border-atlas-border bg-atlas-glass p-4',
                    'text-xs leading-5 text-atlas-muted',
                  )}
                >
                  Recommendations are evidence-informed and adapt as you respond. PANaCEa supports
                  exam readiness — it does not certify competence or replace formal training.
                </p>
              </div>
            </div>
          </MedicalGlassCard>
        </motion.div>
      </div>
    </section>
  );
}
