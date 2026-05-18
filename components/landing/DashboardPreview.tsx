import React from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  ArrowRight,
  Camera,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  ScanLine,
  Target,
  TimerReset,
} from 'lucide-react';
import {
  AnimatedNumber,
  MedicalGlassCard,
  MetricVital,
  OrganSystemBadge,
  PremiumCTAButton,
  SectionHeader,
} from '@/components/studypanacea';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_IMAGE_ACCURACY,
  DASHBOARD_ORGAN_SYSTEMS,
  DASHBOARD_PREVIEW_VITALS,
  DASHBOARD_READINESS_TIMELINE,
  DASHBOARD_STUDY_PRESCRIPTION,
  type DashboardImageAccuracyItem,
  type DashboardOrganSystem,
  type DashboardPrescriptionStep,
} from './content';

const pressureClasses: Record<DashboardOrganSystem['pressure'], string> = {
  High: 'border-atlas-pulse/45 bg-atlas-pulse/10 text-atlas-pulse',
  Watch: 'border-atlas-warning/45 bg-atlas-warning/10 text-atlas-warning',
  Stable: 'border-atlas-success/45 bg-atlas-success/10 text-atlas-success',
};

const imageStatusClasses: Record<DashboardImageAccuracyItem['status'], string> = {
  new: 'text-atlas-blue',
  'needs-review': 'text-atlas-warning',
  strong: 'text-atlas-success',
  weak: 'text-atlas-pulse',
};

const prescriptionStatusClasses: Record<DashboardPrescriptionStep['status'], string> = {
  neutral: 'border-atlas-border bg-atlas-glass text-atlas-muted',
  info: 'border-atlas-cyan/40 bg-atlas-cyan/10 text-atlas-cyan',
  success: 'border-atlas-success/40 bg-atlas-success/10 text-atlas-success',
  warning: 'border-atlas-warning/45 bg-atlas-warning/10 text-atlas-warning',
  danger: 'border-atlas-pulse/45 bg-atlas-pulse/10 text-atlas-pulse',
};

function DashboardPanel({
  title,
  eyebrow,
  icon,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-3xl border border-atlas-border bg-atlas-background-soft p-4 sm:p-5',
        className
      )}
    >
      <div key="panel-heading" className="flex items-start justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-atlas-muted">
              {eyebrow}
            </p>
          ) : null}
          <h3 className="mt-1 font-poppins text-lg font-semibold text-atlas-white">{title}</h3>
        </div>
        {icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-atlas-border bg-atlas-glass text-atlas-cyan">
            {icon}
          </span>
        ) : null}
      </div>
      <div key="panel-content" className="mt-4">
        {children}
      </div>
    </div>
  );
}

function ReadinessVitals() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Readiness vitals">
      {DASHBOARD_PREVIEW_VITALS.map((vital) => (
        <div key={vital.label} className="grid min-h-[13rem] gap-3">
          <MetricVital
            label={vital.label}
            value={
              <AnimatedNumber
                value={vital.numericValue}
                formatter={vital.formatter}
                ariaLabel={vital.value}
              />
            }
            change={vital.change}
            status={vital.status}
            accessibleText={vital.accessibleText}
            className="h-full"
          />
          <div className="rounded-2xl border border-atlas-border bg-atlas-glass px-4 py-3">
            <p className="text-xs font-semibold text-atlas-white">{vital.target}</p>
            <p className="mt-2 text-xs leading-5 text-atlas-muted">{vital.context}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrganSystemHeatmap({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <DashboardPanel
      title="Organ System Heatmap"
      eyebrow="Weak-area scan"
      icon={<Target className="size-4" aria-hidden="true" />}
      className="h-full"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {DASHBOARD_ORGAN_SYSTEMS.map((system, index) => (
          <motion.div
            key={system.label}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.24, delay: index * 0.03 }}
            whileHover={reducedMotion ? undefined : { y: -2 }}
            className={cn(
              'rounded-2xl border bg-atlas-glass p-3 transition-colors',
              system.state === 'weak' && 'border-atlas-pulse/45',
              system.state === 'watch' && 'border-atlas-warning/40',
              system.state === 'active' && 'border-atlas-cyan/35',
              system.state === 'strong' && 'border-atlas-success/35'
            )}
          >
            <div key={`${system.label}-top`} className="flex items-start justify-between gap-2">
              <OrganSystemBadge label={system.label} score={system.score} state={system.state} />
              <span
                className={cn(
                  'rounded-full border px-2 py-1 font-mono text-[0.65rem] font-semibold',
                  pressureClasses[system.pressure]
                )}
              >
                {system.pressure}
              </span>
            </div>
            <div
              key={`${system.label}-bar`}
              className="mt-3 h-2 overflow-hidden rounded-full bg-atlas-background"
            >
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  system.state === 'weak' && 'bg-atlas-pulse',
                  system.state === 'watch' && 'bg-atlas-warning',
                  system.state === 'active' && 'bg-atlas-cyan',
                  system.state === 'strong' && 'bg-atlas-success'
                )}
                initial={reducedMotion ? false : { width: '18%' }}
                whileInView={{ width: `${system.score}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.42, delay: index * 0.04 }}
              />
            </div>
            <p key={`${system.label}-context`} className="mt-3 text-xs leading-5 text-atlas-muted">
              {system.context}
            </p>
            <p
              key={`${system.label}-action`}
              className="mt-2 text-xs font-semibold text-atlas-white"
            >
              {system.nextAction}
            </p>
          </motion.div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function StudyPrescription() {
  return (
    <DashboardPanel
      title="Today's Study Prescription"
      eyebrow={DASHBOARD_STUDY_PRESCRIPTION.priority}
      icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
    >
      <div className="rounded-2xl border border-atlas-border-glow bg-atlas-cyan/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-poppins text-xl font-semibold text-atlas-white">
            {DASHBOARD_STUDY_PRESCRIPTION.title}
          </p>
          <span className="rounded-full border border-atlas-cyan/40 bg-atlas-background-soft px-3 py-1 font-mono text-xs font-semibold text-atlas-cyan">
            {DASHBOARD_STUDY_PRESCRIPTION.duration}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-atlas-muted">
          {DASHBOARD_STUDY_PRESCRIPTION.rationale}
        </p>
        <p className="mt-3 text-sm font-semibold text-atlas-success">
          {DASHBOARD_STUDY_PRESCRIPTION.expectedImpact}
        </p>
      </div>

      <ol className="mt-4 grid gap-3" aria-label="Study prescription sequence">
        {DASHBOARD_STUDY_PRESCRIPTION.steps.map((step, index) => (
          <li
            key={step.label}
            className="rounded-2xl border border-atlas-border bg-atlas-glass p-3"
          >
            <div key={`${step.label}-row`} className="flex items-start gap-3">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-semibold',
                  prescriptionStatusClasses[step.status]
                )}
              >
                0{index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-atlas-white">{step.label}</p>
                  <span className="font-mono text-xs text-atlas-muted">{step.duration}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-atlas-muted">{step.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </DashboardPanel>
  );
}

function DashboardPreviewTimelineSummaryTable() {
  const latest = DASHBOARD_READINESS_TIMELINE.at(-1);

  return (
    <div className="sr-only">
      <p id="dashboard-preview-timeline-summary" className="sr-only">
        Dashboard preview timeline summary: latest readiness is {latest?.readiness ?? 0} percent,
        target is {latest?.target ?? 0} percent, and clinical image accuracy is{' '}
        {latest?.imageAccuracy ?? 0} percent.
      </p>
      <table>
        <caption>Dashboard preview readiness timeline values</caption>
        <thead>
          <tr>
            <th scope="col">Checkpoint</th>
            <th scope="col">Readiness</th>
            <th scope="col">Target</th>
            <th scope="col">Clinical image accuracy</th>
          </tr>
        </thead>
        <tbody>
          {DASHBOARD_READINESS_TIMELINE.map((point) => (
            <tr key={point.checkpoint}>
              <th scope="row">{point.checkpoint}</th>
              <td>{point.readiness} percent</td>
              <td>{point.target} percent</td>
              <td>{point.imageAccuracy} percent</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadinessTimeline({ reducedMotion }: { reducedMotion: boolean }) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chartInView = useInView(chartRef, { once: true, margin: '200px' });
  const [chartReady, setChartReady] = React.useState(false);

  React.useEffect(() => {
    if (!chartInView) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => setChartReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [chartInView]);

  return (
    <DashboardPanel
      title="PANCE Readiness Timeline"
      eyebrow="Projection monitor"
      icon={<Activity className="size-4" aria-hidden="true" />}
    >
      <div
        ref={chartRef}
        key="readiness-chart"
        className="h-64 min-w-0 w-full"
        role="figure"
        aria-label="PANCE readiness timeline showing readiness, target, and image accuracy across study checkpoints."
        aria-describedby="dashboard-preview-timeline-summary"
      >
        <DashboardPreviewTimelineSummaryTable />
        {chartReady ? (
          <ResponsiveContainer
            key="readiness-responsive-container"
            width="100%"
            height="100%"
            minWidth={280}
            minHeight={220}
          >
            <ComposedChart
              key="readiness-composed-chart"
              data={DASHBOARD_READINESS_TIMELINE}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <defs key="readiness-defs">
                <linearGradient
                  key="readiness-gradient"
                  id="readinessPreviewGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    key="readiness-gradient-start"
                    offset="0%"
                    stopColor="var(--atlas-accent-cyan)"
                    stopOpacity={0.34}
                  />
                  <stop
                    key="readiness-gradient-end"
                    offset="100%"
                    stopColor="var(--atlas-accent-cyan)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                key="readiness-grid"
                stroke="var(--atlas-border)"
                strokeDasharray="3 6"
                vertical={false}
              />
              <XAxis
                key="readiness-x-axis"
                dataKey="checkpoint"
                tick={{ fill: 'var(--atlas-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--atlas-border)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                key="readiness-y-axis"
                domain={[50, 92]}
                tick={{ fill: 'var(--atlas-text-muted)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--atlas-border)' }}
                tickFormatter={(value: number) => `${value}%`}
              />
              <Tooltip
                key="readiness-tooltip"
                contentStyle={{
                  backgroundColor: 'var(--atlas-bg-soft)',
                  border: '1px solid var(--atlas-border)',
                  borderRadius: '1rem',
                  boxShadow: 'var(--atlas-shadow-glass)',
                  color: 'var(--atlas-clinical-white)',
                }}
                labelStyle={{ color: 'var(--atlas-clinical-white)', fontWeight: 700 }}
                itemStyle={{ color: 'var(--atlas-text-muted)' }}
                formatter={(value, name) => {
                  const numericValue = Array.isArray(value) ? Number(value[0]) : Number(value);
                  const labelMap: Record<string, string> = {
                    readiness: 'Readiness',
                    target: 'Target',
                    imageAccuracy: 'Image accuracy',
                  };
                  return [`${Math.round(numericValue)}%`, labelMap[String(name)] ?? String(name)];
                }}
              />
              <Area
                key="readiness-area"
                type="monotone"
                dataKey="readiness"
                name="Readiness"
                stroke="var(--atlas-accent-cyan)"
                strokeWidth={3}
                fill="url(#readinessPreviewGradient)"
                dot={{ r: 3, strokeWidth: 2, fill: 'var(--atlas-bg-soft)' }}
                activeDot={{ r: 5 }}
                isAnimationActive={!reducedMotion}
              />
              <Line
                key="readiness-target-line"
                type="monotone"
                dataKey="target"
                name="Target"
                stroke="var(--atlas-accent-violet)"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
                isAnimationActive={!reducedMotion}
              />
              <Line
                key="readiness-image-line"
                type="monotone"
                dataKey="imageAccuracy"
                name="Image accuracy"
                stroke="var(--atlas-accent-blue)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!reducedMotion}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-end gap-2 rounded-2xl border border-atlas-border bg-atlas-background-soft p-4">
            {DASHBOARD_READINESS_TIMELINE.map((point) => (
              <span
                key={point.checkpoint}
                className="min-w-0 flex-1 rounded-t-lg bg-gradient-to-t from-atlas-blue to-atlas-cyan opacity-70"
                style={{ height: `${point.readiness}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
      <div
        key="readiness-legend"
        className="mt-4 grid gap-2 text-xs text-atlas-muted sm:grid-cols-3"
      >
        <span key="readiness-legend-score" className="inline-flex items-center gap-2">
          <CircleDot
            key="readiness-legend-score-dot"
            className="size-3 text-atlas-cyan"
            aria-hidden="true"
          />
          Readiness: 86%
        </span>
        <span key="readiness-legend-target" className="inline-flex items-center gap-2">
          <CircleDot
            key="readiness-legend-target-dot"
            className="size-3 text-atlas-violet"
            aria-hidden="true"
          />
          Target: 82%
        </span>
        <span key="readiness-legend-image" className="inline-flex items-center gap-2">
          <CircleDot
            key="readiness-legend-image-dot"
            className="size-3 text-atlas-blue"
            aria-hidden="true"
          />
          Image accuracy: 80%
        </span>
      </div>
      <p key="readiness-context" className="mt-3 text-xs leading-5 text-atlas-muted">
        Current projection is above target, but review debt remains at 18 due items.
      </p>
    </DashboardPanel>
  );
}

function ClinicalImageAccuracyPanel({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <DashboardPanel
      title="Clinical Image Accuracy"
      eyebrow="Image lab mini-panel"
      icon={<Camera className="size-4" aria-hidden="true" />}
    >
      <div className="grid gap-3">
        {DASHBOARD_IMAGE_ACCURACY.map((item, index) => (
          <div
            key={item.label}
            className="rounded-2xl border border-atlas-border bg-atlas-glass p-3"
          >
            <div key={`${item.label}-row`} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-atlas-white">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-atlas-muted">{item.context}</p>
              </div>
              <span
                className={cn(
                  'font-mono text-sm font-semibold tabular-nums',
                  imageStatusClasses[item.status]
                )}
              >
                {item.accuracy}%
              </span>
            </div>
            <div
              key={`${item.label}-bar`}
              className="mt-3 h-2 overflow-hidden rounded-full bg-atlas-background"
            >
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  item.status === 'weak' && 'bg-atlas-pulse',
                  item.status === 'needs-review' && 'bg-atlas-warning',
                  item.status === 'new' && 'bg-atlas-blue',
                  item.status === 'strong' && 'bg-atlas-success'
                )}
                initial={reducedMotion ? false : { width: '20%' }}
                whileInView={{ width: `${item.accuracy}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.38, delay: index * 0.04 }}
              />
            </div>
            <p key={`${item.label}-trend`} className="mt-2 text-xs font-semibold text-atlas-muted">
              {item.trend}
            </p>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

export function DashboardPreview({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <section
      id="analytics-preview"
      aria-labelledby="analytics-preview-title"
      className="relative scroll-mt-24 px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <SectionHeader
            eyebrow="Readiness command preview"
            title="See exactly what today’s PANCE block should be."
            description="Readiness vitals, organ-system pressure, image accuracy, and the study prescription stay connected so no metric floats around without a next action."
            titleId="analytics-preview-title"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-2 text-xs font-semibold text-atlas-muted">
              <ScanLine className="size-3.5 text-atlas-cyan" aria-hidden="true" />
              Sample learner state, synthetic data
            </span>
            <PremiumCTAButton
              onClick={onOpenDashboard}
              scannerAccent
              iconRight={<ArrowRight className="size-4" aria-hidden="true" />}
            >
              Open your readiness dashboard
            </PremiumCTAButton>
          </div>
        </div>

        <MedicalGlassCard scannerAccent className="mt-10 overflow-hidden p-0">
          <div className="relative p-4 sm:p-5 lg:p-6">
            <div className="absolute inset-0 atlas-medical-grid opacity-15" aria-hidden="true" />
            <div className="relative z-10 grid gap-5">
              <div className="flex flex-col gap-4 rounded-3xl border border-atlas-border bg-atlas-background/70 p-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">
                    StudyPanacea readiness command center
                  </p>
                  <h3 className="mt-2 font-poppins text-2xl font-semibold text-atlas-white">
                    Diagnostic Atlas OS study surface
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-atlas-muted">
                    Exam-window planning, weak-area targeting, review debt, and image-read remediation in one
                    study surface.
                  </p>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-3 lg:min-w-[26rem]">
                  {[
                    {
                      label: 'Sync',
                      value: 'stable',
                      icon: CheckCircle2,
                      tone: 'text-atlas-success',
                    },
                    {
                      label: 'Review debt',
                      value: '18 due',
                      icon: TimerReset,
                      tone: 'text-atlas-warning',
                    },
                    {
                      label: 'Next action',
                      value: 'cardio/pulm',
                      icon: Activity,
                      tone: 'text-atlas-cyan',
                    },
                  ].map((status) => {
                    const Icon = status.icon;

                    return (
                      <div
                        key={status.label}
                        className="rounded-2xl border border-atlas-border bg-atlas-glass px-3 py-2"
                      >
                        <div key={`${status.label}-inner`} className="flex items-center gap-2">
                          <Icon className={cn('size-4', status.tone)} aria-hidden="true" />
                          <div>
                            <p className="font-mono uppercase tracking-[0.08em] text-atlas-subtle">
                              {status.label}
                            </p>
                            <p className="mt-0.5 font-semibold text-atlas-white">{status.value}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ReadinessVitals />

              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="grid gap-5">
                  <StudyPrescription />
                  <ClinicalImageAccuracyPanel reducedMotion={reducedMotion} />
                </div>
                <div className="grid gap-5">
                  <ReadinessTimeline reducedMotion={reducedMotion} />
                  <OrganSystemHeatmap reducedMotion={reducedMotion} />
                </div>
              </div>
            </div>
          </div>
        </MedicalGlassCard>
      </div>
    </section>
  );
}
