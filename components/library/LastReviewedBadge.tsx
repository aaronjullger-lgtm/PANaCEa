/**
 * LastReviewedBadge
 *
 * Renders a small freshness indicator on clinical content so PA students can
 * tell at a glance how recently a page was reviewed. Fresh content (<= 90d)
 * renders a neutral "Updated <age>" label; aging/stale/unknown content renders
 * a warning-styled badge that cannot be missed.
 *
 * Freshness thresholds and the classification helper live in
 * `lib/constants/content-freshness.ts` so they can be reused by cron health
 * checks without UI coupling.
 *
 * @see lib/constants/content-freshness.ts
 */

import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, HelpCircle } from 'lucide-react';
import {
  getFreshnessState,
  formatAge,
  type FreshnessState,
} from '@/lib/constants/content-freshness';

export interface LastReviewedBadgeProps {
  /** Last review/update timestamp. Accepts Date, ISO string, or null. */
  lastReviewedAt: Date | string | null | undefined;
  /** Optional override label for "Updated". Default: "Updated". */
  label?: string;
  /** Optional now-injection for storybook/tests. */
  now?: Date;
  className?: string;
}

const STATE_CONFIG: Record<
  FreshnessState,
  {
    color: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    label: (age: string) => string;
    ariaLive: 'polite' | 'off';
  }
> = {
  fresh: {
    color: 'var(--color-data-pass, #15803d)',
    icon: CheckCircle2,
    label: (age) => `Updated ${age}`,
    ariaLive: 'off',
  },
  aging: {
    color: 'var(--color-accent, #2563eb)',
    icon: Clock,
    label: (age) => `Reviewed ${age} ago — due for refresh`,
    ariaLive: 'polite',
  },
  stale: {
    color: 'var(--color-warning, #b45309)',
    icon: AlertTriangle,
    label: (age) => `Reviewed ${age} ago — verify against a current source`,
    ariaLive: 'polite',
  },
  unknown: {
    color: 'var(--color-warning, #b45309)',
    icon: HelpCircle,
    label: () => 'Never reviewed — verify against a current source',
    ariaLive: 'polite',
  },
};

export const LastReviewedBadge: React.FC<LastReviewedBadgeProps> = ({
  lastReviewedAt,
  label,
  now,
  className = '',
}) => {
  const assessment = getFreshnessState(lastReviewedAt, now);
  const config = STATE_CONFIG[assessment.state];
  const Icon = config.icon;
  const age = formatAge(assessment.ageInDays);
  const rawText = config.label(age);
  const finalText = label && assessment.state === 'fresh' ? `${label} ${age}` : rawText;

  const isFresh = assessment.state === 'fresh';

  return (
    <span
      role="status"
      aria-live={config.ariaLive}
      data-testid="last-reviewed-badge"
      data-state={assessment.state}
      title={
        assessment.referenceDate
          ? `Last reviewed: ${assessment.referenceDate.toLocaleDateString()}`
          : 'Review status unknown'
      }
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        isFresh ? 'opacity-80' : '',
        className,
      ].join(' ')}
      style={{
        color: config.color,
        borderColor: `color-mix(in srgb, ${config.color} 40%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${config.color} 10%, transparent)`,
      }}
    >
      <Icon className="w-3 h-3" aria-hidden />
      <span>{finalText}</span>
    </span>
  );
};

export default LastReviewedBadge;
