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
        ? ['#1e293b', '#2a2520', '#6b5d3e', '#c4b78a']  // dark: slate-800 → gold ramp (cinematic)
        : ['#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8'],  // light: blue-100 → blue-700
    [isDark],
  );

  const emptyColor = isDark ? '#0a0e1a' : '#f1f5f9';
  const textColor = isDark ? '#94a3b8' : '#64748b';

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
        dayBorderColor={isDark ? '#1e293b' : '#ffffff'}
        theme={{
          text: { fill: textColor, fontSize: 11 },
          tooltip: {
            container: {
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f1f5f9' : '#0f172a',
              fontSize: 12,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        }}
      />
    </div>
  );
}
