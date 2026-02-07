/**
 * Data Visualization Components - Usage Examples
 *
 * This file demonstrates how to use the new visualization components:
 * - RadialProgress: Circular progress indicators for percentages
 * - TrendSparkline: Small line charts showing performance trends
 * - ActivityHeatmap: GitHub-style contribution calendar (already existed, enhanced)
 *
 * All components are designed to be lightweight, accessible, and visually appealing.
 */

import React from 'react';
import RadialProgress, { RadialProgressCompact, MultiRadialProgress } from '../ui/RadialProgress';
import TrendSparkline, { TrendSparklineCompact } from '../ui/TrendSparkline';
import ActivityHeatmap from '../analytics/ActivityHeatmap';
import type { PerformanceRecord } from '@/types';

// ============================================================================
// Example 1: RadialProgress - Basic Usage
// ============================================================================

export const AccuracyCard = () => {
  const accuracy = 78; // 0-100

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">
        Current Accuracy
      </h3>

      <RadialProgress
        value={accuracy}
        size={120}
        strokeWidth={10}
        showValue={true}
        label="Overall Performance"
      />
    </div>
  );
};

// ============================================================================
// Example 2: RadialProgress - Custom Colors
// ============================================================================

export const CustomColorAccuracy = () => {
  return (
    <div className="flex gap-6">
      {/* Auto color based on value */}
      <RadialProgress value={85} label="Excellent" />

      {/* Custom color */}
      <RadialProgress value={65} color="#f59e0b" label="Good" />

      {/* Danger zone */}
      <RadialProgress value={45} color="#ef4444" label="Needs Work" />
    </div>
  );
};

// ============================================================================
// Example 3: RadialProgress - Compact Variant
// ============================================================================

export const CompactAccuracyBadge = () => {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="text-sm text-[var(--color-text-secondary)]">Quick Stats:</span>
      <RadialProgressCompact value={82} />
    </div>
  );
};

// ============================================================================
// Example 4: RadialProgress - Multiple Comparison
// ============================================================================

export const SystemComparisonCard = () => {
  const systems = [
    { value: 85, label: 'Cardio', color: '#ef4444' },
    { value: 72, label: 'Neuro', color: '#3b82f6' },
    { value: 90, label: 'Renal', color: '#10b981' },
  ];

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">System Performance</h3>
      <MultiRadialProgress items={systems} size={100} />
    </div>
  );
};

// ============================================================================
// Example 5: TrendSparkline - Recent Form
// ============================================================================

export const RecentFormCard = ({ sessionAccuracies }: { sessionAccuracies: number[] }) => {
  // Example: Last 10 sessions: [75, 80, 78, 85, 88, 82, 90, 87, 92, 95]

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">Recent Form</h3>

      <TrendSparkline
        data={sessionAccuracies}
        width={200}
        height={60}
        colorScheme="auto"
        showTrend={true}
        showValue={true}
        label="Last 10 Sessions"
      />
    </div>
  );
};

// ============================================================================
// Example 6: TrendSparkline - Inline Display
// ============================================================================

export const InlinePerformanceTrend = () => {
  const recentScores = [70, 75, 72, 80, 85, 83, 88, 90];

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--color-bg-secondary)] rounded-lg">
      <div>
        <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Performance Trend</h4>
        <p className="text-xs text-[var(--color-text-muted)]">Last 8 sessions</p>
      </div>

      <TrendSparkline
        data={recentScores}
        width={150}
        height={50}
        colorScheme="success"
        showTrend={true}
        showValue={true}
      />
    </div>
  );
};

// ============================================================================
// Example 7: TrendSparkline - Color Schemes
// ============================================================================

export const ColorSchemeExamples = () => {
  const data = [60, 65, 70, 75, 80];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <TrendSparkline data={data} colorScheme="success" label="Improving" />
      <TrendSparkline data={data.reverse()} colorScheme="warning" label="Declining" />
      <TrendSparkline data={data} colorScheme="danger" label="Critical" />
      <TrendSparkline data={data} colorScheme="neutral" label="Neutral" />
    </div>
  );
};

// ============================================================================
// Example 8: TrendSparkline - Compact Variant
// ============================================================================

export const CompactTrendBadge = () => {
  const recentScores = [75, 78, 80, 82, 85];

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
      <span className="text-xs font-medium text-green-700 dark:text-green-400">Trending Up</span>
      <TrendSparklineCompact data={recentScores} colorScheme="success" />
    </div>
  );
};

// ============================================================================
// Example 9: ActivityHeatmap - Study Calendar
// ============================================================================

export const StudyActivityCalendar = ({
  performanceData,
}: {
  performanceData: PerformanceRecord[];
}) => {
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Study Activity</h3>
        <p className="text-xs text-[var(--color-text-muted)]">Last 13 weeks</p>
      </div>

      <ActivityHeatmap performanceData={performanceData} weeks={13} />

      <p className="text-xs text-[var(--color-text-muted)] mt-4">
        Click any day to view detailed statistics
      </p>
    </div>
  );
};

// ============================================================================
// Example 10: Combined Dashboard Card
// ============================================================================

export const ComprehensiveDashboardCard = ({
  accuracy,
  recentSessionAccuracies,
  performanceData,
}: {
  accuracy: number;
  recentSessionAccuracies: number[];
  performanceData: PerformanceRecord[];
}) => {
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl p-6 shadow-lg">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-6">Performance Overview</h2>

      {/* Top Row: Radial Progress + Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Accuracy Circle */}
        <div className="flex flex-col items-center justify-center p-4 bg-[var(--color-bg-secondary)] rounded-xl">
          <RadialProgress
            value={accuracy}
            size={140}
            strokeWidth={12}
            showValue={true}
            label="Overall Accuracy"
          />
        </div>

        {/* Recent Form Sparkline */}
        <div className="flex flex-col justify-center p-4 bg-[var(--color-bg-secondary)] rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-text-secondary)]  mb-3">
            Recent Sessions
          </h3>
          <TrendSparkline
            data={recentSessionAccuracies}
            width={250}
            height={70}
            colorScheme="auto"
            showTrend={true}
            showValue={true}
          />
        </div>
      </div>

      {/* Bottom: Activity Heatmap */}
      <div className="border-t border-[var(--color-border)] pt-6">
        <ActivityHeatmap performanceData={performanceData} weeks={8} />
      </div>
    </div>
  );
};

// ============================================================================
// Example 11: Statistics Tab Implementation (Actual Use Case)
// ============================================================================

export const StatisticsTab = ({
  overallAccuracy,
  recentTrend,
  currentStreak,
  recentSessionAccuracies,
}: {
  overallAccuracy: number;
  recentTrend: number;
  currentStreak: number;
  recentSessionAccuracies: number[];
}) => {
  return (
    <div className="space-y-6">
      {/* Priority Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent Form with Sparkline */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-text-secondary)] ">
              Recent Form
            </span>
            <span
              className={`text-xl font-bold ${recentTrend >= 0 ? 'text-green-500' : 'text-orange-500'}`}
            >
              {recentTrend >= 0 ? '+' : ''}
              {recentTrend}%
            </span>
          </div>
          {recentSessionAccuracies.length > 0 && (
            <TrendSparkline
              data={recentSessionAccuracies}
              width={200}
              height={50}
              colorScheme="auto"
              showTrend={false}
              showValue={false}
            />
          )}
        </div>

        {/* Current Streak */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4 text-center">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]  block mb-2">
            Active Streak
          </span>
          <div className="text-4xl font-bold text-orange-500">{currentStreak}</div>
          <span className="text-xs text-[var(--color-text-muted)]">questions in a row</span>
        </div>

        {/* Overall Accuracy with Radial */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 flex items-center justify-center">
          <RadialProgress
            value={overallAccuracy}
            size={100}
            strokeWidth={8}
            showValue={true}
            label="Overall Accuracy"
          />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Example 12: Mobile-Optimized Compact View
// ============================================================================

export const MobileStatsCard = ({
  accuracy,
  trend,
  recentScores,
}: {
  accuracy: number;
  trend: number;
  recentScores: number[];
}) => {
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 shadow">
      {/* Compact Layout */}
      <div className="flex items-center justify-between mb-3">
        <RadialProgressCompact value={accuracy} />

        <div className="flex-1 ml-4">
          <TrendSparkline
            data={recentScores}
            width={120}
            height={40}
            colorScheme="auto"
            showValue={false}
            showTrend={true}
          />
        </div>
      </div>

      {/* Trend Badge */}
      <div className="text-center text-xs">
        <span className={`font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}% vs last week
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// Tips for Usage
// ============================================================================

/**
 * BEST PRACTICES:
 *
 * 1. RadialProgress:
 *    - Use for percentages (0-100)
 *    - Size 100-140px for main displays, 60px for compact
 *    - Auto color works great for accuracy (green/amber/red)
 *    - Animate on mount for visual impact
 *
 * 2. TrendSparkline:
 *    - Best with 5-20 data points
 *    - Width 120-250px, height 40-70px
 *    - Use 'auto' colorScheme for accuracy data
 *    - showTrend={true} adds directional indicator
 *
 * 3. ActivityHeatmap:
 *    - 8-13 weeks is optimal display
 *    - Automatically handles click interactions
 *    - Respects theme (light/dark mode)
 *    - Mobile responsive out of the box
 *
 * 4. Performance:
 *    - All components use Framer Motion for animations
 *    - SVG-based (lightweight, scalable)
 *    - No external chart libraries needed
 *    - useMemo() for expensive calculations
 *
 * 5. Accessibility:
 *    - Semantic HTML where possible
 *    - Color + text indicators (not color alone)
 *    - Keyboard navigable (heatmap)
 *    - Screen reader friendly labels
 */

export default {
  AccuracyCard,
  RecentFormCard,
  StudyActivityCalendar,
  ComprehensiveDashboardCard,
  StatisticsTab,
  MobileStatsCard,
};
