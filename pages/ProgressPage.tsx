import React, { useState, Suspense, useMemo } from 'react';
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
import { useUserStats } from '@/hooks/useUserStats';
import { useUser } from '@clerk/clerk-react';
import { getAllSRSItems } from '@/lib/services/srsService';

export const ProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { performanceData } = useUserStats();
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

  // Generate 14-day scheduler blocks from SRS items
  const schedulerBlocks: ScheduleBlock[] = useMemo(() => {
    if (!user?.id) return [];
    
    const srsItems = getAllSRSItems(user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Group SRS items by due date for the next 14 days
    const blocksByDate = new Map<string, number>();
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      blocksByDate.set(dateStr, 0);
    }
    
    srsItems.forEach((item) => {
      const dueDate = new Date(item.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      
      // Only include items due within the next 14 days
      if (blocksByDate.has(dueDateStr)) {
        const current = blocksByDate.get(dueDateStr) || 0;
        blocksByDate.set(dueDateStr, current + 1);
      }
    });
    
    // Convert to ScheduleBlock array
    const blocks: ScheduleBlock[] = [];
    blocksByDate.forEach((count, date) => {
      if (count > 0) {
        const isToday = date === today.toISOString().slice(0, 10);
        blocks.push({
          id: `srs-${date}`,
          label: isToday ? 'Review due today' : `Review due`,
          date,
          count,
          type: 'review',
        });
      }
    });
    
    return blocks;
  }, [user?.id]);

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

      {/* Above the fold: Stats + Scheduler - Combined Suspense for better UX */}
      <Suspense
        fallback={
          <div className="space-y-8">
            <SkeletonLoader />
            <SkeletonLoader />
          </div>
        }
      >
        {/* Research-Backed User-Friendly Stats */}
        <section className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--color-accent)]" />
              Your Learning Analytics
            </h3>
            <HighContrastDataToggle compact className="shrink-0" />
          </div>
          <UserFriendlyStatsDisplay />
        </section>

        {/* Spaced Repetition Schedule */}
        <section className="mb-8">
          <SmartSchedulerGantt blocks={schedulerBlocks} daysToShow={14} />
        </section>
      </Suspense>

      {/* Below the fold: Profiles + Analytics - Combined Suspense */}
      <Suspense
        fallback={
          <div className="space-y-8">
            <SkeletonLoader />
            <SkeletonLoader />
          </div>
        }
      >
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
            <AdvancedLearningProfileDashboard />
          ) : (
            <LearningProfileDashboard />
          )}
        </section>

        {/* Performance Analytics - Database-backed stats and nav to detailed views */}
        <section className="mb-8">
          {/* Database-backed analytics */}
          <DatabaseAnalyticsDashboard />

          {/* Session-based analytics */}
          {performanceData.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Session Performance</h4>
              <AnalyticsDashboard performanceData={performanceData} />
            </div>
          )}
        </section>
      </Suspense>

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
