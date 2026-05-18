import React, { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CircleDot, ScanLine } from 'lucide-react';
import { MedicalGlassCard, MetricVital, SectionHeader } from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import { TRAINING_MODES, type TrainingMode } from './content';

const toneClasses: Record<
  TrainingMode['tone'],
  {
    tile: string;
    icon: string;
    badge: string;
    text: string;
    bar: string;
  }
> = {
  cyan: {
    tile: 'border-atlas-cyan/40',
    icon: 'border-atlas-cyan/40 bg-atlas-cyan/10 text-atlas-cyan',
    badge: 'border-atlas-cyan/35 bg-atlas-cyan/10 text-atlas-cyan',
    text: 'text-atlas-cyan',
    bar: 'from-atlas-cyan to-atlas-blue',
  },
  blue: {
    tile: 'border-atlas-blue/40',
    icon: 'border-atlas-blue/40 bg-atlas-blue/10 text-atlas-blue',
    badge: 'border-atlas-blue/35 bg-atlas-blue/10 text-atlas-blue',
    text: 'text-atlas-blue',
    bar: 'from-atlas-blue to-atlas-cyan',
  },
  violet: {
    tile: 'border-atlas-violet/40',
    icon: 'border-atlas-violet/40 bg-atlas-violet/10 text-atlas-violet',
    badge: 'border-atlas-violet/35 bg-atlas-violet/10 text-atlas-violet',
    text: 'text-atlas-violet',
    bar: 'from-atlas-violet to-atlas-blue',
  },
  pulse: {
    tile: 'border-atlas-pulse/45',
    icon: 'border-atlas-pulse/45 bg-atlas-pulse/10 text-atlas-pulse',
    badge: 'border-atlas-pulse/35 bg-atlas-pulse/10 text-atlas-pulse',
    text: 'text-atlas-pulse',
    bar: 'from-atlas-pulse to-atlas-violet',
  },
  success: {
    tile: 'border-atlas-success/45',
    icon: 'border-atlas-success/45 bg-atlas-success/10 text-atlas-success',
    badge: 'border-atlas-success/35 bg-atlas-success/10 text-atlas-success',
    text: 'text-atlas-success',
    bar: 'from-atlas-success to-atlas-cyan',
  },
  warning: {
    tile: 'border-atlas-warning/45',
    icon: 'border-atlas-warning/45 bg-atlas-warning/10 text-atlas-warning',
    badge: 'border-atlas-warning/35 bg-atlas-warning/10 text-atlas-warning',
    text: 'text-atlas-warning',
    bar: 'from-atlas-warning to-atlas-pulse',
  },
};

function getNextModeId(currentId: string, direction: 1 | -1) {
  const currentIndex = TRAINING_MODES.findIndex((mode) => mode.id === currentId);
  const nextIndex = (currentIndex + direction + TRAINING_MODES.length) % TRAINING_MODES.length;
  return TRAINING_MODES[nextIndex].id;
}

function ModeTile({
  mode,
  active,
  reducedMotion,
  onSelect,
  onMove,
}: {
  mode: TrainingMode;
  active: boolean;
  reducedMotion: boolean;
  onSelect: (modeId: string) => void;
  onMove: (modeId: string) => void;
}) {
  const Icon = mode.icon;
  const tone = toneClasses[mode.tone];
  const descriptionId = `training-mode-${mode.id}-description`;

  return (
    <motion.button
      layout={!reducedMotion}
      type="button"
      role="tab"
      id={`training-mode-${mode.id}`}
      aria-selected={active}
      aria-controls="training-mode-preview"
      aria-describedby={descriptionId}
      aria-label={`${mode.label}: ${mode.benefit} Best for ${mode.bestFor}.`}
      onClick={() => onSelect(mode.id)}
      onFocus={() => onSelect(mode.id)}
      onMouseEnter={() => onSelect(mode.id)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault();
          onMove(getNextModeId(mode.id, 1));
        }

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault();
          onMove(getNextModeId(mode.id, -1));
        }
      }}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.22 }}
      className={cn(
        'atlas-focus-ring atlas-reduced-motion-safe atlas-glass-card group relative min-h-[12.5rem] min-w-[17rem] snap-start overflow-hidden rounded-2xl p-4 text-left',
        'transition-[border-color,box-shadow,background-color,transform] duration-200 md:min-w-0',
        active
          ? cn('atlas-border-glow atlas-scanner-line md:col-span-2', tone.tile)
          : 'border-atlas-border'
      )}
    >
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <motion.span
            animate={reducedMotion ? undefined : active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 0.7 }}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-2xl border',
              tone.icon
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </motion.span>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 font-mono text-[0.68rem] font-semibold',
              tone.badge
            )}
          >
            {mode.detail}
          </span>
        </div>

        <div className="mt-5">
          <p className={cn('text-xs font-semibold uppercase tracking-[0.12em]', tone.text)}>
            {mode.label}
          </p>
          <h3 className="mt-2 font-poppins text-xl font-semibold text-atlas-white">{mode.title}</h3>
          <p id={descriptionId} className="mt-3 text-sm leading-6 text-atlas-muted">
            {mode.benefit}
          </p>
        </div>

        <AnimatePresence initial={false}>
          {active ? (
            <motion.div
              key="active-preview"
              initial={reducedMotion ? false : { opacity: 0, height: 0, y: 8 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, height: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="mt-4 overflow-hidden"
            >
              <div className="rounded-xl border border-atlas-border bg-atlas-background-soft p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-atlas-subtle">
                  Best for
                </p>
                <p className="mt-1 text-xs leading-5 text-atlas-white">{mode.bestFor}</p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <span className="mt-auto flex items-center gap-2 pt-4 text-xs font-semibold text-atlas-subtle opacity-80 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <CircleDot className="size-3.5" aria-hidden="true" />
          {mode.systemMetric} to {mode.detail}
        </span>
      </div>
    </motion.button>
  );
}

function ModeSignalGraph({ mode, reducedMotion }: { mode: TrainingMode; reducedMotion: boolean }) {
  const tone = toneClasses[mode.tone];
  const levels = useMemo(() => {
    const base = mode.id.length % 7;
    return [42 + base * 3, 56 + base * 2, 68 + base, 74, 82, 88];
  }, [mode.id]);

  return (
    <div className="relative min-h-[15rem] overflow-hidden rounded-3xl border border-atlas-border bg-atlas-background-soft p-4">
      <div className="absolute inset-0 atlas-medical-grid opacity-25" aria-hidden="true" />
      <div className="relative z-10 grid h-full gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1 text-xs font-semibold text-atlas-muted">
            <ScanLine className={cn('size-3.5', tone.text)} aria-hidden="true" />
            diagnostic output
          </span>
          <span className={cn('font-mono text-xs font-semibold', tone.text)}>
            {mode.systemMetric}
          </span>
        </div>

        <div className="flex h-28 items-end gap-2">
          {levels.map((level, index) => (
            <motion.span
              key={`${mode.id}-${level}-${index}`}
              initial={reducedMotion ? false : { height: '24%' }}
              animate={{ height: `${level}%` }}
              transition={{ duration: 0.32, delay: index * 0.04 }}
              className={cn('min-w-0 flex-1 rounded-t-lg bg-gradient-to-t', tone.bar)}
              aria-hidden="true"
            />
          ))}
        </div>

        <div className="grid gap-2">
          {mode.previewPoints.map((point) => (
            <div key={point} className="flex items-center gap-2 text-sm text-atlas-muted">
              <span
                className={cn('size-1.5 shrink-0 rounded-full bg-current', tone.text)}
                aria-hidden="true"
              />
              <span>{point}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModePreview({ mode, reducedMotion }: { mode: TrainingMode; reducedMotion: boolean }) {
  const Icon = mode.icon;
  const tone = toneClasses[mode.tone];

  return (
    <MedicalGlassCard
      active
      scannerAccent
      id="training-mode-preview"
      role="tabpanel"
      aria-labelledby={`training-mode-${mode.id}`}
      className="order-2 overflow-hidden p-0 lg:sticky lg:top-24 lg:order-1"
    >
      <div className="relative p-5 sm:min-h-[34rem] sm:p-6 lg:min-h-[36rem]">
        <div className="absolute inset-0 atlas-medical-grid opacity-20" aria-hidden="true" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode.id}
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.24 }}
            className="relative z-10 grid gap-5"
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex size-14 shrink-0 items-center justify-center rounded-3xl border',
                  tone.icon
                )}
              >
                <Icon className="size-6" aria-hidden="true" />
              </div>
              <div>
                <p className={cn('text-xs font-semibold uppercase tracking-[0.14em]', tone.text)}>
                  Active PANCE training instrument
                </p>
                <h3 className="mt-2 font-poppins text-3xl font-semibold text-atlas-white">
                  {mode.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-atlas-muted">{mode.description}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MetricVital
                compact
                label={mode.metricLabel}
                value={mode.metricValue}
                change={mode.systemMetric}
                status={mode.metricStatus}
                accessibleText={`${mode.metricLabel}: ${mode.metricValue}. Linked signal: ${mode.systemMetric}.`}
              />
              <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
                  Best for
                </p>
                <p className="mt-2 text-sm leading-6 text-atlas-white">{mode.bestFor}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
                Protocol
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-atlas-white">
                {mode.protocol}
              </p>
            </div>

            <ModeSignalGraph mode={mode} reducedMotion={reducedMotion} />

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-atlas-border bg-atlas-background-soft p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
                  Why it matters
                </p>
                <p className="mt-2 text-sm leading-6 text-atlas-white">{mode.benefit}</p>
              </div>
              <ArrowRight
                className={cn('hidden size-5 shrink-0 sm:block', tone.text)}
                aria-hidden="true"
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </MedicalGlassCard>
  );
}

export function TrainingModesDock() {
  const [activeModeId, setActiveModeId] = useState(TRAINING_MODES[0].id);
  const reducedMotion = Boolean(useReducedMotion());
  const activeMode = TRAINING_MODES.find((mode) => mode.id === activeModeId) ?? TRAINING_MODES[0];

  const focusMode = (modeId: string) => {
    setActiveModeId(modeId);
    window.requestAnimationFrame(() => {
      document.getElementById(`training-mode-${modeId}`)?.focus();
    });
  };

  return (
    <section
      id="training-modes"
      aria-labelledby="training-modes-title"
      className="relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Training instrument dock"
          title="Pick the study mode that targets the current weak signal."
          description="This is not a feature grid. Each mode has a clinical job: repair misses, train images, clear review debt, or test exam readiness."
          align="center"
          className="mx-auto"
          titleId="training-modes-title"
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <ModePreview mode={activeMode} reducedMotion={reducedMotion} />

          <LayoutGroup>
            <div
              role="tablist"
              className="order-1 -mx-4 flex min-w-0 max-w-[100vw] snap-x gap-3 overflow-x-auto overscroll-x-contain px-4 pb-4 md:mx-0 md:grid md:max-w-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:order-2"
              aria-label="StudyPanacea training modes"
            >
              {TRAINING_MODES.map((mode) => (
                <ModeTile
                  key={mode.id}
                  mode={mode}
                  active={mode.id === activeMode.id}
                  reducedMotion={reducedMotion}
                  onSelect={setActiveModeId}
                  onMove={focusMode}
                />
              ))}
            </div>
          </LayoutGroup>
        </div>
      </div>
    </section>
  );
}
