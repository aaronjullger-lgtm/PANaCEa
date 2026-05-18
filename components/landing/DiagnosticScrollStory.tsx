import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import { Activity, CheckCircle2, Radio, ScanLine } from 'lucide-react';
import {
  MedicalGlassCard,
  MetricVital,
  OrganSystemBadge,
  ScannerFrame,
  SectionHeader,
} from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import {
  DIAGNOSTIC_SCROLL_STAGES,
  type DiagnosticScrollStage,
  type DiagnosticScrollStageId,
} from './content';

const HEATMAP_SYSTEMS = [
  { label: 'Cardiology', score: 68, state: 'weak' },
  { label: 'Pulmonology', score: 72, state: 'watch' },
  { label: 'Endocrine', score: 79, state: 'watch' },
  { label: 'GI/Nutrition', score: 84, state: 'active' },
  { label: 'Infectious Disease', score: 88, state: 'strong' },
  { label: 'MSK', score: 91, state: 'strong' },
] as const;

const QUESTION_OPTIONS = [
  { label: 'A', text: 'Repeat broad mixed block', active: false },
  { label: 'B', text: 'Target pulmonary infection set', active: true },
  { label: 'C', text: 'Resume exam simulation', active: false },
] as const;

const IMAGE_ANNOTATIONS = [
  { label: 'Finding marker', position: 'left-[24%] top-[31%]', tone: 'pulse' },
  { label: 'Compare zone', position: 'right-[22%] bottom-[28%]', tone: 'cyan' },
  { label: 'Review anchor', position: 'left-[48%] bottom-[18%]', tone: 'violet' },
] as const;

const REVIEW_QUEUE = [
  { label: 'Cardio murmurs', due: 'Today', stability: 'Low', status: 'warning' },
  { label: 'Pulm infections', due: 'Tonight', stability: 'Watch', status: 'warning' },
  { label: 'Antibiotic coverage', due: 'Tomorrow', stability: 'Rising', status: 'info' },
  { label: 'GI bleeding triage', due: '3 days', stability: 'Stable', status: 'success' },
] as const;

const READINESS_TREND = [52, 58, 63, 67, 71, 76, 80, 83, 86] as const;

const statusTextClass: Record<DiagnosticScrollStage['status'], string> = {
  neutral: 'text-atlas-muted',
  info: 'text-atlas-cyan',
  success: 'text-atlas-success',
  warning: 'text-atlas-warning',
  danger: 'text-atlas-pulse',
};

function getActiveIndex(progress: number) {
  const nextIndex = Math.floor(progress * DIAGNOSTIC_SCROLL_STAGES.length);
  return Math.min(DIAGNOSTIC_SCROLL_STAGES.length - 1, Math.max(0, nextIndex));
}

function StageRail({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="relative">
      <span className="absolute bottom-3 left-3 top-3 w-px bg-atlas-border" aria-hidden="true" />
      <ol className="grid gap-4 pl-8" aria-label="Diagnostic scroll stages">
        {DIAGNOSTIC_SCROLL_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <li key={stage.id} className="relative">
              <span
                key={`${stage.id}-marker`}
                className={cn(
                  'absolute -left-[1.62rem] top-3 flex size-5 items-center justify-center rounded-full border bg-atlas-background-soft',
                  isActive &&
                    'border-atlas-cyan text-atlas-cyan shadow-[0_0_24px_-10px_var(--atlas-accent-cyan)]',
                  isComplete && 'border-atlas-success text-atlas-success',
                  !isActive && !isComplete && 'border-atlas-border text-atlas-muted'
                )}
                aria-hidden="true"
              >
                {isComplete ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </span>
              <div
                key={`${stage.id}-summary`}
                className={cn(
                  'rounded-2xl border px-4 py-3 transition-colors duration-200',
                  isActive
                    ? 'border-atlas-border-glow bg-atlas-cyan/10 text-atlas-white'
                    : 'border-atlas-border bg-atlas-glass text-atlas-muted'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    key={`${stage.id}-icon`}
                    className={cn(
                      'size-4 shrink-0',
                      isActive ? 'text-atlas-cyan' : 'text-atlas-subtle'
                    )}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-mono text-xs font-semibold tabular-nums">{stage.step}</p>
                    <p className="mt-1 text-sm font-semibold">{stage.title}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageNarrative({ stage }: { stage: DiagnosticScrollStage }) {
  const Icon = stage.icon;

  return (
    <MedicalGlassCard active scannerAccent className="p-5 sm:p-6">
      <div>
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-atlas-border-glow bg-atlas-cyan/10 text-atlas-cyan">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tabular-nums text-atlas-cyan">
              Stage {stage.step}
            </p>
            <h3 className="mt-2 font-poppins text-2xl font-semibold text-atlas-white">
              {stage.title}
            </h3>
          </div>
        </div>

        <p className="mt-5 text-base leading-7 text-atlas-muted">{stage.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <OrganSystemBadge
            label={stage.organSystem}
            score={stage.metricValue}
            state={
              stage.status === 'success' ? 'strong' : stage.status === 'danger' ? 'weak' : 'active'
            }
          />
          <span className="inline-flex rounded-full border border-atlas-border bg-atlas-glass px-3 py-1.5 text-xs font-semibold text-atlas-blue">
            {stage.signal}
          </span>
        </div>
      </div>
    </MedicalGlassCard>
  );
}

function HeatmapVisual({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {HEATMAP_SYSTEMS.map((system, index) => (
          <motion.div
            key={system.label}
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.04 }}
            className={cn(
              'rounded-2xl border bg-atlas-glass p-4',
              system.state === 'weak' && 'border-atlas-pulse/50',
              system.state === 'watch' && 'border-atlas-warning/40',
              system.state === 'strong' && 'border-atlas-success/40',
              system.state === 'active' && 'border-atlas-cyan/40'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-atlas-white">{system.label}</span>
              <span
                className={cn(
                  'font-mono text-sm font-semibold tabular-nums',
                  system.state === 'weak' && 'text-atlas-pulse',
                  system.state === 'watch' && 'text-atlas-warning',
                  system.state === 'strong' && 'text-atlas-success',
                  system.state === 'active' && 'text-atlas-cyan'
                )}
              >
                {system.score}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-atlas-background-soft">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  system.state === 'weak' && 'bg-atlas-pulse',
                  system.state === 'watch' && 'bg-atlas-warning',
                  system.state === 'strong' && 'bg-atlas-success',
                  system.state === 'active' && 'bg-atlas-cyan'
                )}
                initial={reducedMotion ? false : { width: '18%' }}
                animate={{ width: `${system.score}%` }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="rounded-2xl border border-atlas-border bg-atlas-background-soft p-4">
        <div className="flex items-center gap-3 text-sm font-semibold text-atlas-white">
          <ScanLine className="size-4 text-atlas-cyan" aria-hidden="true" />
          Weak-pattern signal: repeated misses cluster around cardiopulmonary reasoning.
        </div>
      </div>
    </div>
  );
}

function QuestionVisual({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_14rem]">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.34 }}
        className="rounded-2xl border border-atlas-border-glow bg-atlas-glass p-5 shadow-atlas-glass"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-atlas-border bg-atlas-background-soft px-3 py-1 font-mono text-xs text-atlas-muted">
            Targeted block
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
            Pulmonology
          </span>
        </div>
        <p className="mt-5 text-sm leading-6 text-atlas-white">
          A student repeatedly misses lower-respiratory infections with overlapping radiographic
          clues. Which study block most directly addresses the risk pattern?
        </p>
        <div className="mt-5 grid gap-3">
          {QUESTION_OPTIONS.map((option) => (
            <div
              key={option.label}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-3 text-sm',
                option.active
                  ? 'border-atlas-cyan bg-atlas-cyan/10 text-atlas-white'
                  : 'border-atlas-border bg-atlas-background-soft text-atlas-muted'
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-current font-mono text-xs">
                {option.label}
              </span>
              <span>{option.text}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid gap-3">
        <MetricVital
          compact
          label="Question mode"
          value="24"
          change="high-yield"
          status="warning"
          accessibleText="Targeted question mode is twenty four high yield questions."
        />
        <MetricVital
          compact
          label="Distractor pattern"
          value="3x"
          change="same error"
          status="danger"
          accessibleText="The same distractor pattern has appeared three times."
        />
      </div>
    </div>
  );
}

function ImageVisual({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="relative min-h-[23rem] overflow-hidden rounded-2xl border border-atlas-border bg-atlas-background-soft">
      <div className="absolute inset-0 atlas-medical-grid opacity-30" aria-hidden="true" />
      <div
        className="absolute inset-8 rounded-[2rem] border border-atlas-blue/30"
        aria-hidden="true"
      />
      <div className="absolute inset-x-10 top-1/2 h-px bg-atlas-cyan/40" aria-hidden="true" />
      <div className="absolute inset-y-10 left-1/2 w-px bg-atlas-cyan/25" aria-hidden="true" />
      <motion.div
        className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-atlas-cyan/0 via-atlas-cyan/20 to-atlas-cyan/0"
        initial={reducedMotion ? false : { y: '-40%' }}
        animate={reducedMotion ? false : { y: '320%' }}
        transition={{ duration: 1.45 }}
        aria-hidden="true"
      />

      {IMAGE_ANNOTATIONS.map((annotation, index) => (
        <motion.div
          key={annotation.label}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.26, delay: 0.34 + index * 0.12 }}
          className={cn(
            'absolute size-16 rounded-full border bg-atlas-glass shadow-atlas-glass',
            annotation.position,
            annotation.tone === 'pulse' && 'border-atlas-pulse text-atlas-pulse',
            annotation.tone === 'cyan' && 'border-atlas-cyan text-atlas-cyan',
            annotation.tone === 'violet' && 'border-atlas-violet text-atlas-violet'
          )}
          aria-hidden="true"
        >
          <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
        </motion.div>
      ))}

      <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-atlas-border bg-atlas-background/80 p-4 backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
          Clinical image read
        </p>
        <p className="mt-2 text-sm font-semibold text-atlas-white">
          Scanner annotation connects image misses to the same weak organ system.
        </p>
      </div>
    </div>
  );
}

function ReviewQueueVisual({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="grid gap-3">
      {REVIEW_QUEUE.map((item, index) => (
        <motion.div
          key={item.label}
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26, delay: index * 0.08 }}
          className="grid gap-3 rounded-2xl border border-atlas-border bg-atlas-glass p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
        >
          <div>
            <p className="font-semibold text-atlas-white">{item.label}</p>
            <p className="mt-1 text-xs text-atlas-muted">Spaced retrieval queue</p>
          </div>
          <span className="rounded-full border border-atlas-border bg-atlas-background-soft px-3 py-1 font-mono text-xs text-atlas-muted">
            {item.due}
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              item.status === 'warning' && 'bg-atlas-warning/10 text-atlas-warning',
              item.status === 'info' && 'bg-atlas-cyan/10 text-atlas-cyan',
              item.status === 'success' && 'bg-atlas-success/10 text-atlas-success'
            )}
          >
            {item.stability}
          </span>
        </motion.div>
      ))}
      <div className="rounded-2xl border border-atlas-cyan/30 bg-atlas-cyan/10 p-4 text-sm font-semibold text-atlas-white">
        Review debt narrows before the next simulation block.
      </div>
    </div>
  );
}

function ReadinessVisual({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-atlas-success/40 bg-atlas-success/10 p-6">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-success">
              Readiness stabilized
            </p>
            <p className="mt-3 font-mono text-6xl font-semibold tabular-nums text-atlas-white">
              86%
            </p>
          </div>
          <div className="grid gap-2 text-right">
            <span className="font-mono text-sm text-atlas-success">+12% readiness buffer</span>
            <span className="text-xs text-atlas-muted">
              Projected from current mock readiness signals
            </span>
          </div>
        </div>
      </div>
      <div className="flex h-40 items-end gap-2 rounded-2xl border border-atlas-border bg-atlas-background-soft p-4">
        {READINESS_TREND.map((point, index) => (
          <motion.div
            key={`${point}-${index}`}
            className="min-w-0 flex-1 rounded-t-lg bg-gradient-to-t from-atlas-blue to-atlas-cyan"
            initial={reducedMotion ? false : { height: '24%' }}
            animate={{ height: `${point}%` }}
            transition={{ duration: 0.38, delay: index * 0.04 }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricVital
          compact
          label="Weak systems"
          value="1"
          change="down from 4"
          status="success"
          accessibleText="One weak system remains, down from four."
        />
        <MetricVital
          compact
          label="Recall stability"
          value="81%"
          change="14-day trend"
          status="info"
          accessibleText="Recall stability is 81 percent across the last 14 days."
        />
        <MetricVital
          compact
          label="Review debt"
          value="6"
          change="managed"
          status="success"
          accessibleText="Review debt is managed at 6 due items."
        />
      </div>
    </div>
  );
}

function StageVisual({
  stage,
  reducedMotion,
}: {
  stage: DiagnosticScrollStage;
  reducedMotion: boolean;
}) {
  const visualMap: Record<DiagnosticScrollStageId, React.ReactNode> = {
    'weak-systems': <HeatmapVisual reducedMotion={reducedMotion} />,
    'targeted-questions': <QuestionVisual reducedMotion={reducedMotion} />,
    'clinical-images': <ImageVisual reducedMotion={reducedMotion} />,
    'spaced-review': <ReviewQueueVisual reducedMotion={reducedMotion} />,
    readiness: <ReadinessVisual reducedMotion={reducedMotion} />,
  };

  return <>{visualMap[stage.id]}</>;
}

function DiagnosticViewer({
  stage,
  activeIndex,
  reducedMotion,
}: {
  stage: DiagnosticScrollStage;
  activeIndex: number;
  reducedMotion: boolean;
}) {
  return (
    <ScannerFrame
      label={`Diagnostic viewer: ${stage.organSystem}`}
      footer={stage.signal}
      className="min-h-[36rem]"
      aria-label={`Diagnostic story visual for ${stage.title}`}
    >
      <div className="relative min-h-[34rem] overflow-hidden p-4 sm:p-5">
        <div className="absolute inset-0 atlas-medical-grid opacity-20" aria-hidden="true" />
        <div className="relative z-10 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_13rem]">
            <div className="rounded-2xl border border-atlas-border bg-atlas-glass p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-atlas-border bg-atlas-background-soft text-atlas-cyan">
                  <Radio className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
                    Active organ-system label
                  </p>
                  <p className="mt-1 font-poppins text-lg font-semibold text-atlas-white">
                    {stage.organSystem}
                  </p>
                </div>
              </div>
            </div>
            <MetricVital
              compact
              label={stage.metricLabel}
              value={stage.metricValue}
              change={`Stage ${activeIndex + 1} of ${DIAGNOSTIC_SCROLL_STAGES.length}`}
              status={stage.status}
              accessibleText={`${stage.metricLabel}: ${stage.metricValue}. ${stage.title}.`}
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={stage.id}
              initial={reducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.28 }}
              className="relative"
            >
              <StageVisual stage={stage} reducedMotion={reducedMotion} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </ScannerFrame>
  );
}

function DesktopScrollStory() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = Boolean(useReducedMotion());
  const scrollYProgress = useMotionValue(0);
  const activeStage = DIAGNOSTIC_SCROLL_STAGES[activeIndex];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    let frameId = 0;

    const updateProgress = () => {
      frameId = 0;
      const rect = track.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const targetStart = window.scrollY + rect.top;
      const targetEnd = targetStart + rect.height;
      const startScroll = targetStart - viewportHeight * 0.18;
      const endScroll = targetEnd - viewportHeight * 0.82;
      const range = endScroll - startScroll;
      const progress =
        range > 0 ? Math.min(1, Math.max(0, (window.scrollY - startScroll) / range)) : 0;

      scrollYProgress.set(progress);
    };

    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [scrollYProgress]);

  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    setActiveIndex((current) => {
      const nextIndex = getActiveIndex(latest);
      return current === nextIndex ? current : nextIndex;
    });
  });

  return (
    <div ref={trackRef} className="relative hidden h-[520vh] lg:block">
      <div className="sticky top-24 grid min-h-[calc(100vh-7rem)] grid-cols-[0.74fr_1.26fr] gap-8 py-8">
        <div className="grid content-center gap-5">
          <div
            className="relative overflow-hidden rounded-full border border-atlas-border bg-atlas-glass p-1"
            aria-hidden="true"
          >
            <motion.div
              className="h-2 origin-left rounded-full bg-gradient-to-r from-atlas-cyan via-atlas-blue to-atlas-violet"
              style={{ scaleX: scrollYProgress }}
              aria-hidden="true"
            />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeStage.id}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.24 }}
            >
              <StageNarrative stage={activeStage} />
            </motion.div>
          </AnimatePresence>
          <StageRail activeIndex={activeIndex} />
        </div>

        <div className="relative">
          <div className="absolute -inset-6 atlas-radial-glow opacity-70" aria-hidden="true" />
          <DiagnosticViewer
            stage={activeStage}
            activeIndex={activeIndex}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
    </div>
  );
}

function StaticStageCard({
  stage,
  index,
  reducedMotion,
}: {
  stage: DiagnosticScrollStage;
  index: number;
  reducedMotion: boolean;
}) {
  const Icon = stage.icon;

  return (
    <MedicalGlassCard scannerAccent={index === 0} className="p-4 sm:p-5">
      <div>
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-atlas-border bg-atlas-cyan/10 text-atlas-cyan">
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tabular-nums text-atlas-cyan">
              Stage {stage.step}
            </p>
            <h3 className="mt-1 font-poppins text-xl font-semibold text-atlas-white">
              {stage.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-atlas-muted">{stage.description}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <OrganSystemBadge
            label={stage.organSystem}
            score={stage.metricValue}
            state={
              stage.status === 'success' ? 'strong' : stage.status === 'danger' ? 'weak' : 'active'
            }
          />
          <span className={cn('text-xs font-semibold', statusTextClass[stage.status])}>
            {stage.signal}
          </span>
        </div>
        <div className="mt-5">
          <StageVisual stage={stage} reducedMotion={reducedMotion} />
        </div>
      </div>
    </MedicalGlassCard>
  );
}

function StackedStory({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className={cn('grid gap-5', reducedMotion ? 'lg:grid-cols-2' : 'lg:hidden')}>
      {DIAGNOSTIC_SCROLL_STAGES.map((stage, index) => (
        <StaticStageCard key={stage.id} stage={stage} index={index} reducedMotion={reducedMotion} />
      ))}
    </div>
  );
}

function StorySignalPanel() {
  const signals = [
    {
      label: 'Input Signals',
      value: 'Misses + Pace + Images',
      detail: 'The story starts with the same raw evidence a learner creates while studying.',
    },
    {
      label: 'Clinical Diagnosis',
      value: 'Weak System Cluster',
      detail: 'StudyPanacea groups repeated errors by organ system, task type, and review timing.',
    },
    {
      label: 'Output',
      value: 'Today’s Study Rx',
      detail: 'The endpoint is a specific block, review queue, or image-read drill, not a vanity score.',
    },
  ];

  return (
    <div className="rounded-3xl border border-atlas-border bg-atlas-glass p-4" aria-label="Diagnostic story signal flow">
      <div className="grid gap-3 sm:grid-cols-3">
        {signals.map((signal) => (
          <div
            key={signal.label}
            className="rounded-2xl border border-atlas-border bg-atlas-background-soft p-4"
          >
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
              {signal.label}
            </p>
            <p className="mt-2 font-mono text-sm font-semibold text-atlas-white">
              {signal.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-atlas-muted">{signal.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DiagnosticScrollStory() {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section
      id="diagnostic-story"
      aria-labelledby="diagnostic-story-title"
      className="relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <SectionHeader
            eyebrow="Diagnostic learning path"
            title="Watch weak-area evidence become a study prescription."
            description="The scroll sequence shows the actual product logic: identify the risky system, select the right training mode, reinforce recall, and recheck readiness."
            titleAs="h2"
            titleId="diagnostic-story-title"
          />
          <StorySignalPanel />
        </div>

        <div className="mt-10">
          {reducedMotion ? (
            <StackedStory reducedMotion={reducedMotion} />
          ) : (
            <>
              <DesktopScrollStory />
              <StackedStory reducedMotion={reducedMotion} />
            </>
          )}
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-atlas-border bg-atlas-glass px-4 py-3 text-sm text-atlas-muted">
          <Activity className="size-4 shrink-0 text-atlas-cyan" aria-hidden="true" />
          <span>
            The output is always a study prescription: which system to train, which mode to use, and
            when to reassess.
          </span>
        </div>
      </div>
    </section>
  );
}
