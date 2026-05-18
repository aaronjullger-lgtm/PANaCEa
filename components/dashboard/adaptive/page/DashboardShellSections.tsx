import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  FileQuestion,
  Image as ImageIcon,
  LayoutDashboard,
  ListChecks,
  Microscope,
  PanelRightOpen,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  Target,
  TimerReset,
  type LucideIcon,
} from 'lucide-react';
import { MedicalGlassCard } from '@/components/studypanacea';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import type { DashboardContext } from '../model/DashboardContext';
import type { DashboardViewModel } from '../model/DashboardViewModel';
import { DashboardSlot } from './DashboardSlot';
import { fallbackClinicalLabCases } from './commandCenterMockData';

type DashboardNavItem = {
  id: string;
  label: string;
  href?: string;
  action?: 'settings';
  icon: LucideIcon;
};

const dashboardNavItems: DashboardNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: ROUTES.STUDY, icon: LayoutDashboard },
  { id: 'practice', label: 'Practice', href: ROUTES.PRACTICE, icon: Stethoscope },
  { id: 'clinical-images', label: 'Clinical Images', href: ROUTES.CLINICAL_EYE, icon: Microscope },
  { id: 'weak-areas', label: 'Weak Areas', href: '/gap-analysis', icon: Target },
  { id: 'study-plan', label: 'Study Plan', href: ROUTES.STUDY_PATH, icon: CalendarDays },
  { id: 'review', label: 'Review', href: `${ROUTES.STUDY}?mode=review`, icon: RotateCcw },
  { id: 'analytics', label: 'Analytics', href: ROUTES.PROGRESS, icon: BarChart3 },
  { id: 'settings', label: 'Settings', action: 'settings', icon: Settings },
];

function DashboardWidgetSkeleton({
  titleId,
  title,
  description,
  minHeightClass = 'min-h-[24rem]',
}: {
  titleId: string;
  title: string;
  description: string;
  minHeightClass?: string;
}) {
  return (
    <section aria-labelledby={titleId} aria-busy="true" className="space-y-3">
      <div>
        <h2 id={titleId} className="text-lg font-semibold text-atlas-white">
          {title}
        </h2>
        <p className="text-sm text-atlas-muted">{description}</p>
      </div>
      <MedicalGlassCard className="p-4 sm:p-5">
        <div
          className={cn(
            'rounded-2xl border border-atlas-border bg-atlas-glass',
            'relative overflow-hidden',
            minHeightClass,
          )}
        >
          <div className="absolute inset-0 atlas-medical-grid opacity-15" aria-hidden="true" />
          <div className="absolute inset-x-6 top-8 h-3 rounded-full bg-atlas-border" />
          <div className="absolute inset-x-6 top-20 h-28 rounded-2xl border border-atlas-border bg-atlas-background-soft" />
          <div className="absolute inset-x-6 bottom-8 h-2 rounded-full bg-atlas-border" />
        </div>
      </MedicalGlassCard>
    </section>
  );
}

export function DeferredDashboardWidget({
  titleId,
  title,
  description,
  minHeightClass,
  children,
}: {
  titleId: string;
  title: string;
  description: string;
  minHeightClass?: string;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) {
      return undefined;
    }

    const node = rootRef.current;
    if (!node || typeof window === 'undefined') {
      setShouldRender(true);
      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      const timeout = globalThis.setTimeout(() => setShouldRender(true), 800);
      return () => globalThis.clearTimeout(timeout);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: '560px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={rootRef}>
      {shouldRender ? (
        <Suspense
          fallback={
            <DashboardWidgetSkeleton
              titleId={titleId}
              title={title}
              description={description}
              minHeightClass={minHeightClass}
            />
          }
        >
          {children}
        </Suspense>
      ) : (
        <DashboardWidgetSkeleton
          titleId={titleId}
          title={title}
          description={description}
          minHeightClass={minHeightClass}
        />
      )}
    </div>
  );
}

export function formatLabel(raw: string | null | undefined): string {
  if (!raw) return 'Mixed clinical pattern';
  return raw
    .replace(/__/g, ' / ')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function openCommandPalette() {
  globalThis.window?.dispatchEvent(new Event('panacea:open-command-palette'));
}

function DashboardNavLink({
  href,
  className,
  children,
  'aria-current': ariaCurrent,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  'aria-current'?: React.AriaAttributes['aria-current'];
}) {
  const inRouter = useInRouterContext();

  if (inRouter) {
    return (
      <Link to={href} className={className} aria-current={ariaCurrent}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  );
}

function percentLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Calibrating';
  return `${Math.round(value)}%`;
}

function getWeakestSystem(context: DashboardContext) {
  return [...context.matrix]
    .sort((left, right) => left.mastery - right.mastery || right.urgency - left.urgency)
    .at(0);
}

function readProfileText(
  profile: DashboardContext['raw']['profile'],
  key: string,
): string | null {
  if (!profile) return null;
  const value = (profile as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getProfileDisplayName(profile: DashboardContext['raw']['profile']): string {
  const name =
    readProfileText(profile, 'firstName') ??
    readProfileText(profile, 'fullName') ??
    readProfileText(profile, 'displayName') ??
    readProfileText(profile, 'name') ??
    readProfileText(profile, 'email');

  if (!name) return 'Student';
  return name.includes('@') ? name.split('@')[0] || 'Student' : name;
}

export function DashboardSidebar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return (
    <aside className="hidden xl:block">
      <MedicalGlassCard className="sticky top-24 p-3">
        <div className="px-2 pb-3 pt-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-atlas-cyan">
            Command Center
          </p>
          <p className="mt-1 text-xs text-atlas-muted">Clinical prep navigation</p>
        </div>
        <nav aria-label="Dashboard sections">
          <ul className="space-y-1">
            {dashboardNavItems.map((item) => {
              const Icon = item.icon;
              const classes = cn(
                'atlas-focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                item.id === 'dashboard'
                  ? 'border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] text-atlas-cyan'
                  : 'text-atlas-muted hover:bg-atlas-glass hover:text-atlas-white',
              );

              if (item.action === 'settings') {
                return (
                  <li key={item.id}>
                    <button type="button" className={classes} onClick={onOpenSettings}>
                      <Icon className="h-4 w-4" aria-hidden />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              }

              return (
                <li key={item.id}>
                  <DashboardNavLink
                    href={item.href ?? ROUTES.STUDY}
                    className={classes}
                    aria-current={item.id === 'dashboard' ? 'page' : undefined}
                  >
                    {item.id === 'dashboard' ? <span className="sr-only">Current page: </span> : null}
                    <Icon className="h-4 w-4" aria-hidden />
                    <span>{item.label}</span>
                  </DashboardNavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </MedicalGlassCard>
    </aside>
  );
}

export function MobileDashboardNav({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return (
    <nav className="xl:hidden" aria-label="Dashboard sections">
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          const classes = cn(
            'atlas-focus-ring inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold',
            item.id === 'dashboard'
              ? 'border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] text-atlas-cyan'
              : 'border-atlas-border bg-atlas-glass text-atlas-muted',
          );

          if (item.action === 'settings') {
            return (
              <button key={item.id} type="button" className={classes} onClick={onOpenSettings}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            );
          }

          return (
            <DashboardNavLink
              key={item.id}
              href={item.href ?? ROUTES.STUDY}
              className={classes}
              aria-current={item.id === 'dashboard' ? 'page' : undefined}
            >
              {item.id === 'dashboard' ? <span className="sr-only">Current page: </span> : null}
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </DashboardNavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function DashboardTopBar({
  context,
  onOpenTutor,
}: {
  context: DashboardContext;
  onOpenTutor: () => void;
}) {
  const overview = context.raw.dashboardAnalytics?.overview;
  const readinessValue = context.readiness.available
    ? `${context.readiness.points.at(-1) ?? 0}%`
    : context.goal.statusLabel;
  const profileName = getProfileDisplayName(context.raw.profile);
  const profileInitial = profileName.charAt(0).toUpperCase();

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]" aria-labelledby="dashboard-title">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-atlas-cyan">
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Diagnostic Atlas OS
        </div>
        <h1 id="dashboard-title" className="mt-3 text-3xl font-semibold tracking-[-0.01em] text-atlas-white sm:text-4xl">
          PANCE readiness command center
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-atlas-muted sm:text-base">
          StudyPanacea turns your practice history, weak systems, reviews, and clinical image training into a focused study prescription.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <button
          type="button"
          onClick={openCommandPalette}
          className="atlas-focus-ring inline-flex min-h-11 w-full items-center gap-2 rounded-xl border border-atlas-border bg-atlas-glass px-3 text-left text-sm text-atlas-muted transition-colors hover:border-atlas-border-glow hover:text-atlas-white sm:w-auto sm:min-w-[15rem]"
          aria-label="Search or open command palette"
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Search modes, systems, reviews...</span>
          <span className="rounded-md border border-atlas-border px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.08em] text-atlas-subtle">
            Cmd K
          </span>
        </button>
        <div
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-atlas-border bg-atlas-glass px-3 text-xs text-atlas-muted"
          role="group"
          aria-label={`Readiness indicator: ${readinessValue}`}
        >
          <Sparkles className="h-4 w-4 text-atlas-cyan" aria-hidden />
          <span className="font-mono text-atlas-white">{readinessValue}</span>
        </div>
        <div
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-atlas-border bg-atlas-glass px-3 text-xs text-atlas-muted"
          role="group"
          aria-label={`Study streak: ${overview?.currentStreak ?? 0} days`}
        >
          <TimerReset className="h-4 w-4 text-atlas-success" aria-hidden />
          <span className="font-mono text-atlas-white">{overview?.currentStreak ?? 0}d</span>
        </div>
        <button
          type="button"
          onClick={onOpenTutor}
          className="atlas-focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] px-3 text-sm font-semibold text-atlas-cyan transition-colors hover:bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_15%,transparent)]"
        >
          <BrainCircuit className="h-4 w-4" aria-hidden />
          AI Tutor
        </button>
        <div
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-atlas-border bg-atlas-glass px-2.5 text-sm text-atlas-muted"
          role="group"
          aria-label={`Profile: ${profileName}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_12%,transparent)] text-xs font-semibold text-atlas-cyan">
            {profileInitial}
          </span>
          <span className="hidden max-w-[7rem] truncate md:inline">{profileName}</span>
        </div>
      </div>
    </section>
  );
}

function CommandBriefItem({
  icon: Icon,
  label,
  value,
  detail,
  href,
  actionLabel,
  emphasis = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  href: string;
  actionLabel: string;
  emphasis?: boolean;
}) {
  return (
    <a
      href={href}
      aria-label={`${label}: ${value}. ${detail} ${actionLabel}.`}
      className={cn(
        'atlas-focus-ring group rounded-2xl border p-3 transition-colors hover:border-atlas-border-glow hover:bg-[color-mix(in_srgb,var(--atlas-bg-soft)_78%,transparent)] motion-reduce:transition-none',
        emphasis
          ? 'border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,var(--atlas-bg-soft))] md:col-span-2 2xl:col-span-1'
          : 'border-atlas-border bg-[color-mix(in_srgb,var(--atlas-bg-soft)_66%,transparent)]',
      )}
    >
      <span className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-atlas-border bg-atlas-glass text-atlas-cyan group-hover:border-atlas-border-glow">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-atlas-subtle">
            {label}
          </span>
          <span className="mt-1 block truncate font-mono text-lg font-semibold tabular-nums text-atlas-white">
            {value}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-atlas-muted">
            {detail}
          </span>
          <span className="mt-3 inline-flex text-xs font-semibold text-atlas-cyan">
            {actionLabel}
          </span>
        </span>
      </span>
    </a>
  );
}

export function DashboardCommandBrief({ context }: { context: DashboardContext }) {
  const weakestSystem = getWeakestSystem(context);
  const readinessValue = context.readiness.available
    ? percentLabel(context.readiness.points.at(-1))
    : context.goal.statusLabel;
  const recentMisses = context.raw.performanceData.filter((record) => !record.isCorrect).length;
  const flaggedAttempts = context.raw.performanceData.filter(
    (record) => record.finalAnswerWasChanged || record.errorTag === 'guessing',
  ).length;
  const imageReviewCount = fallbackClinicalLabCases.filter(
    (caseItem) => caseItem.status === 'needs_review' || caseItem.status === 'weak',
  ).length;
  const todayDetail = `${context.today.durationMinutes} min / ${context.today.questionCount} questions / ${context.today.reviewCount} reviews`;
  const weakDetail = weakestSystem
    ? `${percentLabel(weakestSystem.mastery * 100)} mastery, urgency ${percentLabel(weakestSystem.urgency * 100)}. ${weakestSystem.attribution}`
    : 'Complete a short mixed block to establish organ-system priority.';
  const reviewDetail =
    recentMisses > 0 || flaggedAttempts > 0
      ? `${recentMisses} missed and ${flaggedAttempts} flagged signals in recent performance.`
      : 'Review rows use due cards, weak conditions, or mock signals until more attempts exist.';

  return (
    <section aria-labelledby="command-brief-title">
      <MedicalGlassCard className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-atlas-cyan">
              Command brief
            </p>
            <h2 id="command-brief-title" className="mt-1 text-xl font-semibold text-atlas-white">
              Readiness, weak areas, and today's next move
            </h2>
          </div>
          <span className="rounded-full border border-atlas-border bg-atlas-glass px-3 py-1 text-xs text-atlas-muted">
            {context.dataState.empty ? 'Calibrating from limited data' : context.goal.syncedLabel}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
          <CommandBriefItem
            icon={ListChecks}
            label="Study today"
            value={context.today.title}
            detail={todayDetail}
            href="#today-prescription-title"
            actionLabel="Start prescription"
            emphasis
          />
          <CommandBriefItem
            icon={Activity}
            label="Readiness"
            value={readinessValue}
            detail={context.readiness.summary || 'Readiness projection calibrates as practice history grows.'}
            href="#readiness-vitals-title"
            actionLabel="Inspect vitals"
          />
          <CommandBriefItem
            icon={Target}
            label="Weakest system"
            value={weakestSystem?.label ?? formatLabel(context.raw.growthAreas[0])}
            detail={weakDetail}
            href="#organ-heatmap-title"
            actionLabel="Open heatmap"
          />
          <CommandBriefItem
            icon={FileQuestion}
            label="Missed pattern"
            value={`${recentMisses} missed`}
            detail={reviewDetail}
            href="#question-review-title"
            actionLabel="Review rows"
          />
          <CommandBriefItem
            icon={ImageIcon}
            label="Image work"
            value={`${imageReviewCount} signals`}
            detail="Synthetic image-lab cases surface visual patterns without real patient images."
            href="#clinical-image-lab-title"
            actionLabel="Open image lab"
          />
        </div>
      </MedicalGlassCard>
    </section>
  );
}

export function RightInsightRail({
  slots,
  context,
  onOpenTutor,
}: {
  slots: DashboardViewModel['slots'];
  context: DashboardContext;
  onOpenTutor: () => void;
}) {
  return (
    <aside className="hidden space-y-4 xl:block">
      <div className="sticky top-24 space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-atlas-cyan">Insight rail</h2>
          <p className="mt-1 text-xs text-atlas-muted">Signals beside the main study prescription.</p>
        </div>
        <DashboardSlot widgets={slots.primary_evidence} />
        {!slots.primary_evidence?.length ? (
          <MedicalGlassCard>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-atlas-cyan">Evidence stack</p>
            <ul className="mt-3 space-y-3 text-sm text-atlas-muted">
              {context.insights.slice(0, 3).map((insight) => (
                <li key={insight.id} className="rounded-xl border border-atlas-border bg-atlas-background-soft p-3">
                  <p className="font-semibold text-atlas-white">{insight.title}</p>
                  <p className="mt-1 text-xs leading-5">{insight.explanation}</p>
                </li>
              ))}
            </ul>
          </MedicalGlassCard>
        ) : null}
        <MedicalGlassCard scannerAccent>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-atlas-border-glow bg-[color-mix(in_srgb,var(--atlas-accent-cyan)_10%,transparent)] text-atlas-cyan">
              <BrainCircuit className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold text-atlas-white">AI Tutor Drawer</h3>
              <p className="text-xs text-atlas-muted">Ask for a clinical reasoning breakdown without leaving the dashboard.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenTutor}
            className="atlas-focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-atlas-border bg-atlas-background-soft px-3 py-2 text-sm font-semibold text-atlas-cyan"
          >
            Open tutor
            <PanelRightOpen className="h-4 w-4" aria-hidden />
          </button>
        </MedicalGlassCard>
      </div>
    </aside>
  );
}

export function AdaptiveSignalStack({ slots }: { slots: DashboardViewModel['slots'] }) {
  const hasSignals =
    Boolean(slots.secondary_left?.length) ||
    Boolean(slots.secondary_right?.length) ||
    Boolean(slots.below_fold_primary?.length) ||
    Boolean(slots.below_fold_secondary?.length);

  if (!hasSignals) return null;

  return (
    <section aria-labelledby="adaptive-signals-title" className="space-y-3">
      <div>
        <h2 id="adaptive-signals-title" className="text-lg font-semibold text-atlas-white">
          Adaptive Signal Stack
        </h2>
        <p className="text-sm text-atlas-muted">Existing adaptive widgets remain available below the primary command-center views.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardSlot widgets={slots.secondary_left} />
        <DashboardSlot widgets={slots.secondary_right} />
      </div>
      <DashboardSlot widgets={slots.below_fold_primary} />
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardSlot widgets={slots.below_fold_secondary} className="contents" />
      </div>
    </section>
  );
}
