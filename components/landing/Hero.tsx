import React, { Suspense, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ChevronRight, Crosshair, ShieldCheck } from 'lucide-react';
import {
  MedicalGlassCard,
  MetricVital,
  PremiumCTAButton,
  ScannerFrame,
} from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import { HERO_TRUST_INDICATORS, HERO_VITALS } from './content';
import { FloatingDiagnosticLabels } from './FloatingDiagnosticLabels';

const LazyHeroCanvas = React.lazy(async () => {
  const module = await import('./HeroCanvas');
  return { default: module.HeroCanvas };
});

export interface HeroProps {
  onStartStudying: () => void;
}

function useCanRenderHeroCanvas() {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const scheduleDeferredCanvas = (callback: () => void) => {
      const idleWindow = window as Window & {
        requestIdleCallback?: (handler: () => void, options?: { timeout?: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      };

      if (idleWindow.requestIdleCallback) {
        const idleId = idleWindow.requestIdleCallback(callback, { timeout: 1200 });
        return () => idleWindow.cancelIdleCallback?.(idleId);
      }

      const timeoutId = window.setTimeout(callback, 700);
      return () => window.clearTimeout(timeoutId);
    };

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const navigatorHints = navigator as Navigator & {
      connection?: { saveData?: boolean };
      deviceMemory?: number;
    };
    let cancelPendingCanvas: (() => void) | undefined;

    const update = () => {
      const hasEnoughMemory =
        typeof navigatorHints.deviceMemory !== 'number' || navigatorHints.deviceMemory >= 4;
      const hasEnoughCores =
        typeof navigator.hardwareConcurrency !== 'number' || navigator.hardwareConcurrency >= 4;
      const prefersDataSavings = Boolean(navigatorHints.connection?.saveData);
      const eligible = mediaQuery.matches && hasEnoughMemory && hasEnoughCores && !prefersDataSavings;

      cancelPendingCanvas?.();

      if (!eligible) {
        setCanRender(false);
        return;
      }

      cancelPendingCanvas = scheduleDeferredCanvas(() => setCanRender(true));
    };

    update();
    mediaQuery.addEventListener('change', update);

    return () => {
      cancelPendingCanvas?.();
      mediaQuery.removeEventListener('change', update);
    };
  }, []);

  return canRender;
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

function HeroCanvasFallback({ ambientVideo = false }: { ambientVideo?: boolean }) {
  return (
    <div className="relative h-full min-h-[25rem] overflow-hidden sm:min-h-[31rem]">
      {ambientVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          src="/assets/hero-scanner-ambient.mp4"
          poster="/assets/hero-scanner-bg.webp"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : null}
      <div className="absolute inset-0 atlas-medical-grid opacity-30" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-atlas-cyan/30 bg-atlas-cyan/5 shadow-[0_0_90px_-48px_var(--atlas-accent-cyan)]" />
      <div className="absolute left-1/2 top-[49%] h-52 w-32 -translate-x-1/2 -translate-y-1/2 rounded-[45%] border border-atlas-cyan/40 bg-atlas-glass" />
      <div className="absolute left-[42%] top-[45%] h-36 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-atlas-blue/40 bg-atlas-blue/10" />
      <div className="absolute left-[58%] top-[45%] h-36 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-atlas-cyan/40 bg-atlas-cyan/10" />
      <div className="absolute left-1/2 top-[55%] size-20 -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-[44%] border border-atlas-pulse/45 bg-atlas-pulse/10 shadow-[0_0_34px_-14px_var(--atlas-accent-pulse-pink)]" />
      <div className="absolute left-1/2 top-[49%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-atlas-blue/25" />
      <div className="absolute left-1/2 top-[49%] h-56 w-96 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-atlas-violet/25" />
      <div className="absolute inset-x-6 top-1/2 h-px bg-atlas-cyan/40" />
      <div className="absolute inset-y-8 left-1/2 w-px bg-atlas-cyan/20" />
    </div>
  );
}

function ScannerStatusRail() {
  return (
    <div className="absolute bottom-4 left-4 right-4 z-30 grid gap-3 rounded-2xl border border-atlas-border bg-atlas-background/78 p-4 shadow-atlas-glass backdrop-blur-xl md:left-auto md:max-w-xs">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-muted">
          Study prescription
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-atlas-success/35 bg-atlas-success/10 px-2.5 py-1 font-mono text-xs text-atlas-success">
          <ShieldCheck key="stable-icon" className="size-3" aria-hidden="true" />
          stable
        </span>
      </div>
      <h3 className="font-poppins text-lg font-semibold leading-tight text-atlas-white">
        Cardio and pulmonary image reads before simulation
      </h3>
      <p className="text-sm leading-6 text-atlas-muted">
        Clear chest-image search order, rhythm checkpoints, and therapy distractors before another timed block.
      </p>
      <div
        className="h-2 overflow-hidden rounded-full bg-atlas-glass"
        aria-label="Study prescription completion is 68 percent"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={68}
        role="progressbar"
      >
        <div className="h-full w-[68%] rounded-full bg-atlas-cyan" />
      </div>
    </div>
  );
}

function HeroScannerPanel({ reducedMotion }: { reducedMotion: boolean }) {
  const canRenderCanvas = useCanRenderHeroCanvas();
  const renderCanvas = canRenderCanvas && !reducedMotion;
  const showAmbientVideo = !renderCanvas && !reducedMotion;

  return (
    <motion.div {...entranceProps(reducedMotion, 0.14)} className="relative">
      <div>
        <div
          className="absolute -inset-4 rounded-[2.25rem] bg-atlas-cyan/10 blur-3xl"
          aria-hidden="true"
        />
        <ScannerFrame
          label="PANCE readiness scanner"
          footer="Translucent anatomy scan, organ-system signals, and readiness prescription."
          className="relative z-10"
        >
          <div className="relative min-h-[27rem] overflow-hidden bg-atlas-background-soft sm:min-h-[34rem] lg:min-h-[37rem]">
            <img
              src="/assets/hero-scanner-bg.webp"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover opacity-60"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 atlas-medical-grid opacity-20" aria-hidden="true" />

            <div className="absolute inset-x-4 top-4 z-30 hidden flex-wrap gap-2 sm:flex lg:hidden">
              <FloatingDiagnosticLabels compact />
            </div>

            <div className="absolute inset-0 z-10" aria-hidden="true">
              {renderCanvas ? (
                <Suspense fallback={<HeroCanvasFallback />}>
                  <LazyHeroCanvas reducedMotion={reducedMotion} />
                </Suspense>
              ) : (
                <HeroCanvasFallback ambientVideo={showAmbientVideo} />
              )}
            </div>

            <FloatingDiagnosticLabels />
            <ScannerStatusRail />
          </div>
        </ScannerFrame>
      </div>
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
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan shadow-atlas-glass">
              <Crosshair className="size-3.5" aria-hidden="true" />
              PANCE readiness scanner
            </div>

            <h1
              id="landing-hero-title"
              className="mt-6 max-w-4xl font-poppins text-4xl font-semibold leading-[1.02] tracking-normal text-atlas-white sm:text-5xl lg:text-6xl"
            >
              Master the PANCE one clinical case at a time.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-atlas-muted sm:text-lg">
              StudyPanacea reads your PANCE practice, clinical image work, weak systems, and review
              debt, then prescribes the next study block with command-center precision.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PremiumCTAButton
                onClick={onStartStudying}
                scannerAccent
                className="w-full sm:w-auto"
                iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                Start readiness scan
              </PremiumCTAButton>
              <a
                href="#analytics-preview"
                className={cn(
                  'atlas-focus-ring inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-atlas-border',
                  'bg-atlas-glass px-5 py-3 text-sm font-semibold text-atlas-white shadow-atlas-glass',
                  'transition-[border-color,background-color,color,transform] hover:border-atlas-border-glow hover:bg-atlas-elevated sm:w-auto',
                  'motion-reduce:transition-colors'
                )}
              >
                <span className="inline-flex items-center gap-2">
                  Inspect readiness dashboard
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              </a>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {HERO_TRUST_INDICATORS.map((indicator) => (
                <MedicalGlassCard key={indicator.label} className="rounded-2xl p-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
                      {indicator.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-atlas-muted">{indicator.detail}</p>
                  </div>
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
          </div>
        </motion.div>

        <HeroScannerPanel reducedMotion={prefersReducedMotion} />
      </div>
    </section>
  );
}
