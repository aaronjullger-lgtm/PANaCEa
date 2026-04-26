/**
 * ClinicalInterface primitives
 *
 * Calm, low-distraction building blocks for PANaCEa study surfaces. These are
 * intentionally quieter than the legacy glass/card utilities: thin borders,
 * tokenized surfaces, modest elevation, and progressive disclosure by default.
 */

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { EmptyState, type EmptyStateProps } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

type ClinicalTone = 'neutral' | 'positive' | 'attention' | 'risk' | 'danger';
type SurfaceVariant = 'plain' | 'elevated' | 'muted' | 'accent';
type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

const toneClass: Record<ClinicalTone, string> = {
  neutral: 'text-[var(--color-text-secondary)]',
  positive: 'text-[var(--color-success)]',
  attention: 'text-[var(--color-accent)]',
  risk: 'text-[var(--color-risk)]',
  danger: 'text-[var(--color-danger)]',
};

const toneSurfaceClass: Record<ClinicalTone, string> = {
  neutral: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
  positive: 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/25',
  attention: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/25',
  risk: 'bg-[var(--color-risk)]/10 text-[var(--color-risk)] border-[var(--color-risk)]/25',
  danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/25',
};

const surfaceVariantClass: Record<SurfaceVariant, string> = {
  plain: 'border-[var(--color-border)] bg-[var(--color-surface)]',
  elevated:
    'border-[var(--color-border)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-surface)]',
  muted: 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]',
  accent:
    'border-[var(--color-accent)]/25 bg-[var(--color-bg-tertiary)] shadow-[var(--shadow-surface)]',
};

const surfacePaddingClass: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export interface ClinicalSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  interactive?: boolean;
}

export const ClinicalSurface = React.forwardRef<HTMLDivElement, ClinicalSurfaceProps>(
  ({ variant = 'plain', padding = 'md', interactive = false, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border transition-colors',
        surfaceVariantClass[variant],
        surfacePaddingClass[padding],
        interactive &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]',
        className,
      )}
      tabIndex={interactive ? 0 : props.tabIndex}
      {...props}
    />
  ),
);
ClinicalSurface.displayName = 'ClinicalSurface';

export interface ClinicalBadgeProps extends Omit<BadgeProps, 'variant'> {
  tone?: ClinicalTone;
}

export const ClinicalBadge = React.forwardRef<HTMLSpanElement, ClinicalBadgeProps>(
  ({ tone = 'neutral', className, ...props }, ref) => {
    const variant: BadgeProps['variant'] =
      tone === 'positive'
        ? 'success'
        : tone === 'risk' || tone === 'attention'
          ? 'risk'
          : tone === 'danger'
            ? 'danger'
            : 'secondary';

    return <Badge ref={ref} variant={variant} className={className} {...props} />;
  },
);
ClinicalBadge.displayName = 'ClinicalBadge';

export interface CompactSignalProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: ClinicalTone;
  icon?: LucideIcon;
}

export const CompactSignal = React.forwardRef<HTMLDivElement, CompactSignalProps>(
  ({ label, value, detail, tone = 'neutral', icon: Icon = Circle, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'min-w-0 rounded-lg border bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-surface)]',
        'border-[var(--color-border)]',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
            toneSurfaceClass[tone],
          )}
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            {label}
          </div>
          <div className={cn('truncate text-sm font-semibold', toneClass[tone])}>{value}</div>
        </div>
      </div>
      {detail && <div className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{detail}</div>}
    </div>
  ),
);
CompactSignal.displayName = 'CompactSignal';

export interface DisclosureRowProps
  extends Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  tone?: ClinicalTone;
  children: React.ReactNode;
}

export const DisclosureRow = React.forwardRef<HTMLDetailsElement, DisclosureRowProps>(
  ({ title, description, meta, icon: Icon = ChevronRight, tone = 'neutral', className, children, ...props }, ref) => (
    <details
      ref={ref}
      className={cn(
        'group rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]',
        'open:bg-[var(--color-surface-elevated)]',
        className,
      )}
      {...props}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3 px-3 py-2 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]">
        <Icon
          className={cn('h-4 w-4 shrink-0 transition-transform group-open:rotate-90', toneClass[tone])}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</span>
          {description && (
            <span className="block truncate text-xs leading-5 text-[var(--color-text-muted)]">{description}</span>
          )}
        </span>
        {meta && <span className="shrink-0 text-xs font-medium text-[var(--color-text-muted)]">{meta}</span>}
      </summary>
      <div className="border-t border-[var(--color-border)] px-3 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
        {children}
      </div>
    </details>
  ),
);
DisclosureRow.displayName = 'DisclosureRow';

export interface PlanStepProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  step: number | string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  minutes?: number;
  status?: 'next' | 'queued' | 'done';
  icon?: LucideIcon;
}

export const PlanStep = React.forwardRef<HTMLDivElement, PlanStepProps>(
  ({ step, title, detail, minutes, status = 'queued', icon, className, ...props }, ref) => {
    const Icon = icon ?? (status === 'done' ? CheckCircle2 : status === 'next' ? Clock3 : Circle);
    const tone: ClinicalTone = status === 'done' ? 'positive' : status === 'next' ? 'attention' : 'neutral';

    return (
      <div ref={ref} className={cn('flex gap-3', className)} {...props}>
        <div className="flex flex-col items-center">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold',
              toneSurfaceClass[tone],
            )}
            aria-label={`Step ${step}`}
          >
            {typeof step === 'number' ? step : <Icon className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="mt-2 h-full min-h-4 w-px bg-[var(--color-border)]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 pb-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{title}</div>
            {typeof minutes === 'number' && (
              <div className="shrink-0 text-xs font-medium text-[var(--color-text-muted)]">{minutes} min</div>
            )}
          </div>
          {detail && <div className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{detail}</div>}
        </div>
      </div>
    );
  },
);
PlanStep.displayName = 'PlanStep';

export interface ClinicalEmptyStateProps extends Omit<EmptyStateProps, 'layout' | 'animate'> {
  layout?: EmptyStateProps['layout'];
}

export function ClinicalEmptyState({ layout = 'surface', compact = true, ...props }: ClinicalEmptyStateProps) {
  return <EmptyState layout={layout} compact={compact} animate={false} {...props} />;
}

export interface ClinicalLoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  lines?: number;
}

export function ClinicalLoadingState({
  label = 'Loading',
  lines = 3,
  className,
  ...props
}: ClinicalLoadingStateProps) {
  return (
    <ClinicalSurface className={cn('space-y-3', className)} aria-live="polite" {...props}>
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-3 rounded-full bg-[var(--color-bg-tertiary)]',
              index === lines - 1 ? 'w-2/3' : 'w-full',
            )}
          />
        ))}
      </div>
    </ClinicalSurface>
  );
}

export interface ClinicalAlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: Exclude<ClinicalTone, 'positive'>;
  action?: Pick<ButtonProps, 'children' | 'onClick' | 'variant' | 'iconRight'>;
}

export function ClinicalAlert({
  title,
  description,
  tone = 'attention',
  action,
  className,
  ...props
}: ClinicalAlertProps) {
  const Icon = tone === 'danger' || tone === 'risk' ? AlertTriangle : Circle;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-3',
        toneSurfaceClass[tone],
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {description && <div className="mt-1 text-xs leading-5 opacity-90">{description}</div>}
      </div>
      {action && (
        <Button size="sm" variant={action.variant ?? 'outline'} onClick={action.onClick} iconRight={action.iconRight}>
          {action.children}
        </Button>
      )}
    </div>
  );
}
