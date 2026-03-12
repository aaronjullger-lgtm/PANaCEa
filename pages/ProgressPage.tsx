import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Target, User, Layers } from 'lucide-react';
import { BackLink } from '@/components/navigation/BackLink';
import { ROUTES } from '@/config/routes';
import { HighContrastDataToggle } from '@/components/ui/HighContrastDataToggle';
import { SkeletonLoader } from '@/components/loading';
import {
  UserFriendlyStatsDisplay,
  LearningProfileDashboard,
  AdvancedLearningProfileDashboard,
  DatabaseAnalyticsDashboard,
  AnalyticsDashboard,
} from '@/config/lazyComponents';
import { SmartSchedulerGantt, type ScheduleBlock } from '@/components/analytics/SmartSchedulerGantt';
import type { PerformanceRecord } from '@/types';

interface ProgressPageProps {
  performanceData?: PerformanceRecord[];
  dueCount?: number;
}

export const ProgressPage: React.FC<ProgressPageProps> = ({
  performanceData = [],
  dueCount = 0,
}) => {
  const navigate = useNavigate();
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

  const schedulerBlocks: ScheduleBlock[] = React.useMemo(() => {
    if (dueCount <= 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    return [
      {
        id: 'today-due',
        label: 'Review due',
        date: today,
        count: dueCount,
      },
    ];
  }, [dueCount]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6 space-y-3">
        <BackLink to={ROUTES.STUDY} />
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Progress & Analytics
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Track your learning journey and identify areas for improvement
          </p>
        </div>
      </div>

      {/* Research-Backed User-Friendly Stats */}
      <section className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
            Your Learning Analytics
          </h3>
          <HighContrastDataToggle compact className="shrink-0" />
        </div>
        <Suspense fallback={<SkeletonLoader />}>
          <UserFriendlyStatsDisplay />
        </Suspense>
      </section>

      {/* Spaced Repetition Schedule */}
      {schedulerBlocks.length > 0 && (
        <section className="mb-8">
          <SmartSchedulerGantt blocks={schedulerBlocks} daysToShow={14} />
        </section>
      )}

      {/* Learning Profile */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--color-text-muted)]" />
            Detailed Learning Profile
          </h3>
          <button
            onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              showAdvancedAnalytics
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
            }`}
          >
            {showAdvancedAnalytics ? '✦ Advanced View' : 'Switch to Advanced'}
          </button>
        </div>
        {showAdvancedAnalytics ? (
          <Suspense fallback={<SkeletonLoader />}>
            <AdvancedLearningProfileDashboard />
          </Suspense>
        ) : (
          <Suspense fallback={<SkeletonLoader />}>
            <LearningProfileDashboard />
          </Suspense>
        )}
      </section>

      {/* Performance Analytics - Database-backed stats and nav to detailed views */}
      <section className="mb-8">
        {/* Database-backed analytics */}
        <Suspense fallback={<SkeletonLoader />}>
          <DatabaseAnalyticsDashboard />
        </Suspense>

        {/* Session-based analytics */}
        {performanceData.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Session Performance</h4>
            <Suspense fallback={<SkeletonLoader />}>
              <AnalyticsDashboard performanceData={performanceData} />
            </Suspense>
          </div>
        )}

        {/* Navigation to detailed views */}
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <button
            onClick={() => navigate('/gap-analysis')}
            className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                <Layers className="w-6 h-6 text-[var(--color-text-secondary)]" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[var(--color-text-primary)]">Competency Heatmap</h4>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Visual mastery grid across organ systems
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/gap-analysis')}
            className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                <Target className="w-6 h-6 text-[var(--color-text-secondary)]" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[var(--color-text-primary)]">Gap Analysis</h4>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Identify high-yield focus areas
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/clinical-profile')}
            className="w-full text-left p-5 bg-[var(--color-bg-primary)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg transition-all group md:col-span-2"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                <BarChart3 className="w-6 h-6 text-[var(--color-text-secondary)]" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-[var(--color-text-primary)]">Clinical Profile</h4>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Strengths, timing patterns, and diagnosis bias
                </p>
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};

export default ProgressPage;
