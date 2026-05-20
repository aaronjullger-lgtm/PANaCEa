import React, { type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import {
  workspaceAccent,
  workspaceBadgeStyles,
  workspaceHeroAccent,
  workspacePageModeBackground,
  type WorkspacePageMode,
} from '@/lib/tokens';

export type { WorkspacePageMode };

export type WorkspaceSurfaceRole =
  | 'panel'
  | 'hero'
  | 'action'
  | 'reference'
  | 'alert'
  | 'empty'
  | 'subtle';

export type WorkspaceMetricVariant =
  | 'summary'
  | 'progress'
  | 'guidance'
  | 'alert'
  | 'reference';

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
  actionPosition?: 'side' | 'under-title';
}


const SUPPORTING_TEXT_COLOR =
  'color-mix(in srgb, var(--color-text-secondary) 86%, var(--color-text-muted))';
const MUTED_TEXT_COLOR =
  'color-mix(in srgb, var(--color-text-muted) 88%, var(--color-text-secondary))';

function resolveDensityClass(density: WorkspacePageMeta['density']) {
  switch (density) {
    case 'compact':
      return 'space-y-5';
    case 'wide':
      return 'space-y-8';
    default:
      return 'space-y-6';
  }
}

function resolveSurfaceStyles(role: WorkspaceSurfaceRole, accent: string): CSSProperties {
  const base = {
    '--workspace-accent': accent,
  } as CSSProperties;

  switch (role) {
    case 'hero':
      return {
        ...base,
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 86%, var(--workspace-accent) 8%), color-mix(in srgb, var(--color-bg-primary) 90%, var(--workspace-accent) 10%))',
        boxShadow:
          '0 22px 64px -42px rgba(0,0,0,0.82), inset 0 1px 0 color-mix(in srgb, var(--color-text-primary) 7%, transparent)',
      };
    case 'action':
      return {
        ...base,
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--workspace-accent) 10%, var(--color-bg-secondary)), color-mix(in srgb, var(--color-bg-primary) 92%, var(--workspace-accent) 8%))',
        boxShadow:
          '0 24px 70px -46px color-mix(in srgb, var(--workspace-accent) 48%, transparent)',
      };
    case 'reference':
      return {
        ...base,
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 88%, var(--workspace-accent) 5%), color-mix(in srgb, var(--color-bg-primary) 94%, var(--workspace-accent) 6%))',
      };
    case 'alert':
      return {
        ...base,
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 80%, var(--workspace-accent) 12%), color-mix(in srgb, var(--color-bg-primary) 90%, var(--workspace-accent) 10%))',
        boxShadow:
          '0 24px 70px -52px color-mix(in srgb, var(--workspace-accent) 56%, transparent)',
      };
    case 'empty':
      return {
        ...base,
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 80%, var(--workspace-accent) 7%), color-mix(in srgb, var(--color-bg-primary) 92%, var(--workspace-accent) 8%))',
      };
    case 'subtle':
      return {
        ...base,
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 88%, var(--workspace-accent) 4%), color-mix(in srgb, var(--color-bg-primary) 94%, var(--workspace-accent) 6%))',
      };
    default:
      return {
        ...base,
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--color-bg-secondary) 88%, var(--workspace-accent) 4%), color-mix(in srgb, var(--color-bg-primary) 94%, var(--workspace-accent) 6%))',
      };
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
      size={action.variant === 'primary' || defaultVariant === 'primary' ? 'md' : 'sm'}
      onClick={action.onClick}
      disabled={action.disabled}
      className="shadow-[0_18px_48px_-28px_rgba(15,23,42,0.72)]"
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      <span>{action.label}</span>
      {IconRight ? <IconRight className="h-4 w-4" aria-hidden="true" /> : null}
    </Button>
  );
}

function HeaderActionGroup({
  meta,
  className,
}: {
  meta: WorkspacePageMeta;
  className?: string;
}) {
  if (!meta.primaryAction && (meta.secondaryActions?.length ?? 0) === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2.5', className)}>
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
  );
}

export function WorkspacePage({
  children,
  className,
  density = 'default',
  mode = 'default',
}: React.PropsWithChildren<{
  className?: string;
  density?: WorkspacePageMeta['density'];
  mode?: WorkspacePageMode;
}>) {
  return (
    <div className={cn('relative isolate', resolveDensityClass(density), className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-xl"
      >
        <div
          className="absolute inset-0"
          style={{ background: workspacePageModeBackground[mode] }}
        />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-text-muted) 26%, transparent) 1px, transparent 0)',
            backgroundSize: mode === 'launch' ? '18px 18px' : '22px 22px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.95), rgba(0,0,0,0.28) 68%, transparent)',
          }}
        />
      </div>
      {children}
    </div>
  );
}

export function WorkspacePageHeader({
  meta,
  className,
}: {
  meta: WorkspacePageMeta;
  className?: string;
}) {
  const tone = workspaceBadgeStyles[meta.badgeTone ?? 'gold'];
  const chromeBorder = 'color-mix(in srgb, var(--color-text-primary) 10%, transparent)';
  const chromeFill =
    'color-mix(in srgb, var(--color-bg-secondary) 78%, var(--color-bg-primary) 22%)';
  const actionPosition = meta.actionPosition ?? 'side';

  return (
    <div
      className={cn(
        'flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between',
        className
      )}
    >
      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {meta.backLabel && meta.onBack ? (
            <button
              type="button"
              onClick={meta.onBack}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-300 hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
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
              className="inline-flex min-h-[34px] items-center rounded-lg border px-3.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em]"
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
              className="inline-flex min-h-[34px] items-center rounded-lg border px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)]"
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
          <h1 className="max-w-3xl text-3xl font-semibold text-[var(--color-text-primary)] sm:text-4xl lg:text-[2.65rem] lg:leading-[1.08]">
            {meta.title}
          </h1>
          {meta.subtitle ? (
            <p
              className="max-w-2xl text-base leading-7"
              style={{ color: SUPPORTING_TEXT_COLOR }}
            >
              {meta.subtitle}
            </p>
          ) : null}
        </div>
        {actionPosition === 'under-title' ? (
          <HeaderActionGroup meta={meta} className="pt-1" />
        ) : null}
      </div>

      {actionPosition !== 'under-title' ? (
        <HeaderActionGroup meta={meta} className="lg:max-w-[24rem] lg:justify-end" />
      ) : null}
    </div>
  );
}

export function WorkspaceHeroStrip({
  children,
  className,
  accent = 'var(--color-accent)',
  tone = 'default',
}: React.PropsWithChildren<{
  className?: string;
  accent?: string;
  tone?: 'default' | 'launch' | 'analytics' | 'reference' | 'toolkit' | 'challenge' | 'error';
}>) {
  const resolvedAccent = tone === 'default' ? accent : workspaceHeroAccent[tone];

  return (
    <WorkspaceSurface
      role="hero"
      accent={resolvedAccent}
      className={cn('rounded-lg p-6 sm:p-7', className)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.10),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(167,139,250,0.10),transparent_30%)]" />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: 'var(--noise-texture)' }}
      />
      <div className="relative z-10">{children}</div>
    </WorkspaceSurface>
  );
}

export function WorkspaceSurface({
  children,
  className,
  accent = 'var(--color-accent)',
  padded = true,
  role = 'panel',
}: React.PropsWithChildren<{
  className?: string;
  accent?: string;
  padded?: boolean;
  role?: WorkspaceSurfaceRole;
}>) {
  const styles = resolveSurfaceStyles(role, accent);
  const borderColor =
    role === 'alert'
      ? 'color-mix(in srgb, var(--workspace-accent) 36%, var(--color-text-primary))'
      : 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)';

  return (
    <section
      className={cn(
        'card-cinematic relative overflow-hidden rounded-lg border',
        padded ? 'p-5 sm:p-6' : '',
        className
      )}
      style={{
        ...styles,
        borderColor,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-85"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--workspace-accent) 72%, white), transparent)',
        }}
      />
      {role !== 'subtle' ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{ backgroundImage: 'var(--noise-texture)' }}
        />
      ) : null}
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
            <p
              className="max-w-3xl text-sm leading-7 sm:text-base"
              style={{ color: SUPPORTING_TEXT_COLOR }}
            >
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
  variant = 'summary',
  action,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  accent?: string;
  icon?: LucideIcon;
  variant?: WorkspaceMetricVariant;
  action?: React.ReactNode;
}) {
  const surfaceRole: WorkspaceSurfaceRole =
    variant === 'alert'
      ? 'alert'
      : variant === 'reference'
        ? 'reference'
        : variant === 'guidance'
          ? 'action'
          : 'panel';

  const valueClass =
    variant === 'guidance'
      ? 'text-[1.75rem] leading-[1.1]'
      : variant === 'alert'
        ? 'text-[2.35rem] leading-none'
        : 'text-3xl leading-none';

  const labelClass =
    variant === 'summary'
      ? 'text-[0.88rem] tracking-[-0.01em]'
      : 'text-[0.8rem] tracking-[-0.01em]';

  return (
    <WorkspaceSurface accent={accent} className="h-full" role={surfaceRole}>
      <div className="flex h-full items-start justify-between gap-4">
        <div className="flex h-full flex-1 flex-col gap-3">
          <div className="space-y-2">
            <p
              className={cn('font-medium', labelClass)}
              style={{ color: MUTED_TEXT_COLOR }}
            >
              {label}
            </p>
            <div className={cn('font-semibold tracking-[-0.045em] text-[var(--color-text-primary)]', valueClass)}>
              {value}
            </div>
            {detail ? (
              <p
                className="max-w-sm text-sm leading-6"
                style={{ color: SUPPORTING_TEXT_COLOR }}
              >
                {detail}
              </p>
            ) : null}
          </div>
          {action ? <div className="pt-1">{action}</div> : null}
        </div>
        {Icon ? (
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
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
    <WorkspaceSurface
      className={cn('flex flex-col gap-4 sm:gap-5', className)}
      accent={workspaceAccent.steel}
      role="action"
    >
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
  accent = workspaceAccent.plum,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <WorkspaceSurface
      className={cn('border-dashed text-center', className)}
      accent={accent}
      role="empty"
    >
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-6">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-text-primary) 10%, transparent)',
            background: `color-mix(in srgb, ${accent} 10%, var(--color-bg-secondary))`,
          }}
        >
          <Icon className="h-6 w-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text-primary)]">
            {title}
          </h3>
          <p
            className="text-sm leading-7"
            style={{ color: SUPPORTING_TEXT_COLOR }}
          >
            {description}
          </p>
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
