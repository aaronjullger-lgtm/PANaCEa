import React, { useMemo } from 'react';
import {
  Activity,
  Brain,
  RefreshCw,
  Target,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/loading';
import {
  WorkspaceEmptyState,
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { useClinicalProfile } from './hooks/useClinicalProfile';
import { OverviewCard } from './OverviewCard';
import { SystemRadarChart } from './SystemRadarChart';
import { TimingPatterns } from './TimingPatterns';
import { DiagnosisBiasCard } from './DiagnosisBiasCard';
import { StrengthsWeaknesses } from './StrengthsWeaknesses';
import { StudyPatternHeatmap } from './StudyPatternHeatmap';

const ClinicalProfileDashboard: React.FC = () => {
  const { data, isLoading, error, refetch } = useClinicalProfile();

  const accuracyPct = useMemo(
    () => Math.round(((data?.overall.accuracy ?? 0) || 0) * 100),
    [data?.overall.accuracy]
  );
  const avgTimeSec = useMemo(
    () => (data?.overall.avgTimeMs ? Math.round(data.overall.avgTimeMs / 1000) : null),
    [data?.overall.avgTimeMs]
  );
  const systemsTracked = data?.systemBreakdown.length ?? 0;
  const strengthsCount = data?.strengths.length ?? 0;
  const weaknessesCount = data?.weaknesses.length ?? 0;
  const totalQuestions = data?.overall.totalQuestions ?? 0;

  if (isLoading) {
    return (
      <WorkspacePage density="wide">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Clinical Profile',
              badgeTone: 'plum',
              title: 'Loading your clinical profile.',
              subtitle:
                'We’re assembling your strengths, speed patterns, and diagnostic tendencies from your study history.',
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceSurface accent="#9a7f9a">
            <div
              className="flex min-h-[16rem] items-center justify-center gap-3 text-[var(--color-text-secondary)]"
              role="status"
              aria-live="polite"
            >
              <InlineSpinner size="lg" />
              <span>Loading clinical profile...</span>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  if (error || !data) {
    return (
      <WorkspacePage density="wide">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Clinical Profile',
              badgeTone: 'plum',
              title: 'Clinical profile unavailable.',
              subtitle:
                'We could not load the analysis needed to describe your current strengths, timing patterns, and diagnostic bias.',
              primaryAction: {
                label: 'Retry',
                onClick: refetch,
              },
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceEmptyState
            icon={Brain}
            title="Unable to load profile"
            description={error || 'Unable to load profile'}
            action={
              <Button type="button" size="sm" onClick={refetch}>
                Retry
              </Button>
            }
          />
        </WorkspaceReveal>
      </WorkspacePage>
    );
  }

  return (
    <WorkspacePage density="wide">
      <WorkspaceReveal>
        <WorkspacePageHeader
          meta={{
            badge: 'Clinical Profile',
            badgeTone: 'plum',
            title: 'Understand how you tend to think under pressure.',
            subtitle:
              'This profile turns your answer history into a clearer read on strengths, speed, timing, and the diagnostic tendencies that deserve attention.',
            status: `${totalQuestions} question${totalQuestions === 1 ? '' : 's'} analyzed`,
            primaryAction: {
              label: 'Refresh profile',
              onClick: refetch,
              icon: RefreshCw,
            },
          }}
        />
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.04}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard
            label="Accuracy"
            value={`${accuracyPct}%`}
            detail="Current overall correctness across the profile dataset."
            icon={Target}
          />
          <WorkspaceMetricCard
            label="Avg time / question"
            value={avgTimeSec ? `${avgTimeSec}s` : '—'}
            detail="Median-like pacing signal from recorded question attempts."
            accent="#728ba6"
            icon={Timer}
          />
          <WorkspaceMetricCard
            label="Systems tracked"
            value={systemsTracked}
            detail="Systems with enough data to contribute to your profile."
            accent="#9a7f9a"
            icon={Activity}
          />
          <WorkspaceMetricCard
            label="Strength balance"
            value={`${strengthsCount}/${weaknessesCount}`}
            detail="Named strengths compared with currently flagged weak areas."
            accent="#7a8f6e"
            icon={TrendingUp}
          />
        </div>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.08}>
        <WorkspaceHeroStrip>
          <WorkspaceSplit className="items-start">
            <div className="space-y-4">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-secondary)]">
                Profile lens
              </p>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text-primary)]">
                Use this page to spot how you miss, not just what you miss.
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] sm:text-base">
                The clinical profile helps separate raw knowledge gaps from timing drift, overthinking,
                rushed systems, and recurring diagnostic habits. That makes it more useful for
                behavior change than another summary chart alone.
              </p>
            </div>

            <WorkspaceSurface accent="#9a7f9a" className="p-0">
              <div className="p-5">
                <OverviewCard
                  overall={data.overall}
                  avgSessionLength={data.studyPatterns.avgSessionLength}
                />
              </div>
            </WorkspaceSurface>
          </WorkspaceSplit>
        </WorkspaceHeroStrip>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.12}>
        <WorkspaceSection
          title="Strengths and timing"
          subtitle="Pair where you perform well with how your pacing changes by system."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StrengthsWeaknesses strengths={data.strengths} weaknesses={data.weaknesses} />
            <TimingPatterns patterns={data.patterns} />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.16}>
        <WorkspaceSection
          title="System balance"
          subtitle="A visual snapshot of how evenly your accuracy holds across the systems you’ve studied."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SystemRadarChart systems={data.systemBreakdown} />
            </div>
            <DiagnosisBiasCard biases={data.diagnosisBias} />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSection
          title="Study rhythm"
          subtitle="See when your study energy tends to show up so you can align harder work with better hours."
        >
          <StudyPatternHeatmap peakHours={data.studyPatterns.peakHours} />
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default ClinicalProfileDashboard;
