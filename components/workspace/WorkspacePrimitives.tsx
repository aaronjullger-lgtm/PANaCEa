import React, { type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

export interface WorkspacePageAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  variant?: ButtonVariant;
  disabled?: boolean;
}

export interface WorkspacePageMeta {
  badge?: string;
  badgeTone?: 'gold' | 'steel' | 'plum' | 'sage' | 'rose' | 'amber';
  title: string;
  subtitle?: string;
  status?: string;
  backLabel?: string;
  onBack?: () => void;
  primaryAction?: WorkspacePageAction;
  secondaryActions?: WorkspacePageAction[];
  density?: 'compact' | 'default' | 'wide';
}

const BADGE_STYLES: Record<
  NonNullable<WorkspacePageMeta['badgeTone']>,
  { bg: string; text: string; border: string }
> = {
  gold: {
    bg: 'rgba(196, 183, 138, 0.12)',
    text: '#d8cca8',
    border: 'rgba(196, 183, 138, 0.28)',
  },
  steel: {
    bg: 'rgba(114, 139, 166, 0.12)',
    text: '#a8bfd8',
    border: 'rgba(114, 139, 166, 0.26)',
  },
  plum: {
    bg: 'rgba(154, 127, 154, 0.12)',
    text: '#c8a9c8',
    border: 'rgba(154, 127, 154, 0.26)',
  },
  sage: {
    bg: 'rgba(122, 143, 110, 0.12)',
    text: '#bfd0b2',
    border: 'rgba(122, 143, 110, 0.26)',
  },
  rose: {
    bg: 'rgba(166, 127, 127, 0.12)',
    text: '#d8b0b0',
    border: 'rgba(166, 127, 127, 0.26)',
  },
  amber: {
    bg: 'rgba(179, 155, 108, 0.12)',
    text: '#d8c28e',
    border: 'rgba(179, 155, 108, 0.26)',
  },
};

function resolveDensityClass(density: WorkspacePageMeta['density']) {
  switch (density) {
    case 'compact':
      return 'space-y-6';
    case 'wide':
      return 'space-y-10';
    default:
      return 'space-y-8';
  }
}

function actionButton(action: WorkspacePageAction, key: string, defaultVariant: ButtonVariant) {
  const Icon = action.icon;
  const IconRight = action.iconRight;
  return (
    <Button
      key={key}
      type="button"
      variant={action.variant ?? defaultVariant}
      size="sm"
      onClick={action.onClick}
      disabled={action.disabled}
      className="shadow-[0_10px_30px_-18px_rgba(15,23,42,0.55)]"
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      <span>{action.label}</span>
      {IconRight ? <IconRight className="h-4 w-4" aria-hidden="true" /> : null}
    </Button>
  );
}

export function WorkspacePage({
  children,
  className,
  density = 'default',
}: React.PropsWithChildren<{
  className?: string;
  density?: WorkspacePageMeta['density'];
}>) {
  return (
    <div className={cn('relative isolate', resolveDensityClass(density), className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(196,183,138,0.16),transparent_24%),radial-gradient(circle_at_86%_10%,rgba(114,139,166,0.18),transparent_28%),radial-gradient(circle_at_70%_100%,rgba(154,127,154,0.16),transparent_30%)]" />
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-text-muted) 28%, transparent) 1px, transparent 0)',
            backgroundSize: '20px 20px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.2) 65%, transparent)',
          }}
        />
      </div>
      {children}
    </div>
  );
}

export function WorkspacePageHeader({ meta, className }: { meta: WorkspacePageMeta; className?: string }) {
  const tone = BADGE_STYLES[meta.badgeTone ?? 'gold'];
  const chromeBorder = 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)';
  const chromeFill =
    'color-mix(in srgb, var(--color-bg-secondary) 74%, var(--color-bg-primary) 26%)';

  return (
    <div className={cn('flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {meta.backLabel && meta.onBack ? (
            <button
              type="button"
              onClick={meta.onBack}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-300 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              style={{
                borderColor: chromeBorder,
                background: chromeFill,
              }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {meta.backLabel}
            </button>
          ) : null}
          {meta.badge ? (
            <span
              className="inline-flex min-h-[34px] items-center rounded-full border px-3.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: tone.bg,
                color: tone.text,
                borderColor: tone.border,
              }}
            >
              {meta.badge}
            </span>
          ) : null}
          {meta.status ? (
            <span
              className="inline-flex min-h-[34px] items-center rounded-full border px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]"
              style={{
                borderColor: chromeBorder,
                background: chromeFill,
              }}
            >
              {meta.status}
            </span>
          ) : null}
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-[-0.045em] text-[var(--color-text-primary)] sm:text-5xl">
            {meta.title}
          </h1>
          {meta.subtitle ? (
            <p className="max-w-2xl text-base leading-8 text-[var(--color-text-secondary)] sm:text-lg">
              {meta.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {(meta.primaryAction || (meta.secondaryActions?.length ?? 0) > 0) ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {meta.secondaryActions?.map((action, index) =>
            actionButton(action, `secondary-${index}`, 'outline')
          )}
          {meta.primaryAction
            ? actionButton(
                {
                  ...meta.primaryAction,
                  iconRight: meta.primaryAction.iconRight ?? ArrowRight,
                },
                'primary',
                'primary'
              )
            : null}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceHeroStrip({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        'card-cinematic relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8',
        className
      )}
      style={{
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 80%, var(--color-accent) 6%), color-mix(in srgb, var(--color-bg-primary) 88%, var(--color-accent-secondary) 12%))',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(196,183,138,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(114,139,166,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.22]" style={{ backgroundImage: 'var(--noise-texture)' }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function WorkspaceSurface({
  children,
  className,
  accent = 'var(--color-accent)',
  padded = true,
}: React.PropsWithChildren<{
  className?: string;
  accent?: string;
  padded?: boolean;
}>) {
  return (
    <section
      className={cn(
        'card-cinematic relative overflow-hidden rounded-[1.5rem]',
        padded ? 'p-5 sm:p-6' : '',
        className
      )}
      style={
        {
          '--workspace-accent': accent,
          background:
            'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 82%, var(--workspace-accent) 6%), color-mix(in srgb, var(--color-bg-primary) 92%, var(--workspace-accent) 8%))',
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--workspace-accent) 68%, white), transparent)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{ backgroundImage: 'var(--noise-texture)' }}
      />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

export function WorkspaceSection({
  title,
  subtitle,
  action,
  children,
  className,
}: React.PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}>) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-2xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function WorkspaceMetricCard({
  label,
  value,
  detail,
  accent = 'var(--color-accent)',
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  accent?: string;
  icon?: LucideIcon;
}) {
  return (
    <WorkspaceSurface accent={accent} className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {label}
          </p>
          <div className="text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
            {value}
          </div>
          {detail ? (
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{detail}</p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, var(--color-bg-secondary))`,
              borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
            }}
          >
            <Icon className="h-5 w-5" style={{ color: accent }} aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </WorkspaceSurface>
  );
}

export function WorkspaceFilterBar({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <WorkspaceSurface className={cn('flex flex-col gap-4 sm:gap-5', className)} accent="#728ba6">
      {children}
    </WorkspaceSurface>
  );
}

export function WorkspaceEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <WorkspaceSurface className={cn('border-dashed text-center', className)} accent="#9a7f9a">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)',
            background:
              'color-mix(in srgb, var(--color-bg-secondary) 78%, var(--color-accent-secondary) 8%)',
          }}
        >
          <Icon className="h-6 w-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
        </div>
        {action}
      </div>
    </WorkspaceSurface>
  );
}

export function WorkspaceSplit({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn('grid gap-6 xl:grid-cols-[1.15fr_0.85fr]', className)}>{children}</div>;
}

export function WorkspaceReveal({
  children,
  className,
  delay = 0,
}: React.PropsWithChildren<{ className?: string; delay?: number }>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }
      }
    >
      {children}
    </motion.div>
  );
}
