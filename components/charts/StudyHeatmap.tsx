/**
 * StudyHeatmap — GitHub-style contribution heatmap for daily study activity.
 *
 * Uses @nivo/calendar to render a year-view calendar where each day's color
 * intensity reflects the number of questions answered or sessions completed.
 *
 * Lazy-loaded via React.lazy() to keep the initial bundle lean (~15-20 KB).
 *
 * @example
 *   const LazyHeatmap = React.lazy(() => import('@/components/charts/StudyHeatmap'));
 *   <Suspense fallback={<HeatmapSkeleton />}>
 *     <LazyHeatmap data={dailyActivity} />
 *   </Suspense>
 */

import React, { useMemo } from 'react';
import { ResponsiveCalendar } from '@nivo/calendar';
import { color } from '@/lib/tokens';

export interface StudyHeatmapDatum {
  /** ISO date string, e.g. '2026-01-15' */
  day: string;
  /** Activity count (questions answered, sessions, etc.) */
  value: number;
}

interface StudyHeatmapProps {
  data: StudyHeatmapDatum[];
  /** Optional: override the year range. Defaults to current year. */
  from?: string;
  to?: string;
  /** Height in pixels (default 180) */
  height?: number;
  className?: string;
}

/**
 * Detect dark mode by checking for `.dark` class on <html>.
 * Matches PANaCEa's `darkMode: 'class'` Tailwind config.
 */
function useIsDark(): boolean {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const el = document.documentElement;
    const check = () => setDark(el.classList.contains('dark'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const mixColor = (foreground: string, foregroundAmount: number, background: string) =>
  `color-mix(in srgb, ${foreground} ${foregroundAmount}%, ${background})`;

export default function StudyHeatmap({
  data,
  from,
  to,
  height = 180,
  className,
}: StudyHeatmapProps) {
  const isDark = useIsDark();
  const currentYear = new Date().getFullYear();
  const fromDate = from ?? `${currentYear}-01-01`;
  const toDate = to ?? `${currentYear}-12-31`;

  // PANaCEa color scale: surface → clinical-info light → action-blue saturated
  const colors = useMemo(
    () =>
      isDark
        ? [
            color.atlas.surfaceElevated,
            mixColor(color.atlas.blue, 34, color.atlas.surface),
            mixColor(color.atlas.cyan, 58, color.atlas.surface),
            color.atlas.warningAmber,
          ]
        : [
            mixColor(color.accent.default, 14, color.bg.surface),
            mixColor(color.accent.default, 34, color.bg.surface),
            color.accent.default,
            color.accent.secondary,
          ],
    [isDark]
  );

  const emptyColor = isDark ? color.atlas.backgroundSoft : color.bg.secondary;
  const textColor = color.text.secondary;

  return (
    <div className={className} style={{ height }}>
      <ResponsiveCalendar
        data={data}
        from={fromDate}
        to={toDate}
        emptyColor={emptyColor}
        colors={colors}
        margin={{ top: 20, right: 20, bottom: 0, left: 20 }}
        yearSpacing={40}
        monthBorderColor="transparent"
        dayBorderWidth={2}
        dayBorderColor={isDark ? color.atlas.surfaceElevated : color.bg.surface}
        theme={{
          text: { fill: textColor, fontSize: 11 },
          tooltip: {
            container: {
              background: color.bg.elevated,
              color: color.text.primary,
              fontSize: 12,
              borderRadius: '8px',
              boxShadow: 'var(--atlas-shadow-glass, 0 8px 24px var(--color-shadow-soft))',
            },
          },
        }}
      />
    </div>
  );
}
