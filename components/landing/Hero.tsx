import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronRight, Cpu } from 'lucide-react';
import {
  MedicalGlassCard,
  MetricVital,
  PremiumCTAButton,
  ScannerFrame,
} from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import { HERO_TRUST_INDICATORS, HERO_VITALS } from './content';
import { ClinicalLearningEngine } from './ClinicalLearningEngine';

export interface HeroProps {
  onStartStudying: () => void;
}

function entranceProps(prefersReducedMotion: boolean, delay = 0) {
  if (prefersReducedMotion) {
    return {};
  }

  return {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay },
  };
}

function HeroEnginePanel({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <motion.div {...entranceProps(reducedMotion, 0.14)} className="relative">
      <div
        className="absolute -inset-4 rounded-[2.25rem] bg-atlas-cyan/10 blur-3xl"
        aria-hidden="true"
      />
      <ScannerFrame
        label="Clinical Learning Engine"
        footer="Behavior signals → clinical reasoning → blueprint risk → one prescribed action → measurable readiness."
        className="relative z-10"
      >
        <div className="relative min-h-[27rem] bg-atlas-background-soft sm:min-h-[34rem] lg:min-h-[37rem]">
          <ClinicalLearningEngine />
        </div>
      </ScannerFrame>
    </motion.div>
  );
}

export function Hero({ onStartStudying }: HeroProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());

  return (
    <section
      id="hero"
      aria-labelledby="landing-hero-title"
      className="relative scroll-mt-24 overflow-hidden px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8 lg:pb-24 lg:pt-20"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-atlas-cyan/25" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-20 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-atlas-cyan/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(30rem,1.08fr)] lg:items-center">
        <motion.div {...entranceProps(prefersReducedMotion)} className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan shadow-atlas-glass">
            <Cpu className="size-3.5" aria-hidden="true" />
            The Clinical Learning Engine
          </div>

          <h1
            id="landing-hero-title"
            className="mt-6 max-w-4xl font-poppins text-4xl font-semibold leading-[1.02] tracking-normal text-atlas-white sm:text-5xl lg:text-6xl"
          >
            Know what to study next — not just what to study.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-atlas-muted sm:text-lg">
            PANaCEa is an adaptive clinical-study system for PA learners. It reads how you actually
            perform — accuracy, timing, confusion, and retention — maps it to the exam blueprint, and
            resolves the full picture into one precise Study Prescription.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <PremiumCTAButton
              onClick={onStartStudying}
              scannerAccent
              className="w-full sm:w-auto"
              iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Get my next action
            </PremiumCTAButton>
            <a
              href="#study-prescription"
              className={cn(
                'atlas-focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-atlas-border',
                'bg-atlas-glass px-5 py-3 text-sm font-semibold text-atlas-white shadow-atlas-glass',
                'transition-[border-color,background-color,color,transform] hover:border-atlas-border-glow hover:bg-atlas-elevated sm:w-auto',
                'motion-reduce:transition-colors',
              )}
            >
              <span className="inline-flex items-center gap-2">
                See a Study Prescription
                <ChevronRight className="size-4" aria-hidden="true" />
              </span>
            </a>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {HERO_TRUST_INDICATORS.map((indicator) => (
              <MedicalGlassCard key={indicator.label} className="rounded-2xl p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
                  {indicator.label}
                </p>
                <p className="mt-1 text-sm font-medium text-atlas-muted">{indicator.detail}</p>
              </MedicalGlassCard>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {HERO_VITALS.map((vital) => (
              <MetricVital
                key={vital.label}
                label={vital.label}
                value={vital.value}
                change={vital.change}
                status={vital.status}
                compact
                accessibleText={vital.accessibleText}
              />
            ))}
          </div>
        </motion.div>

        <HeroEnginePanel reducedMotion={prefersReducedMotion} />
      </div>
    </section>
  );
}
