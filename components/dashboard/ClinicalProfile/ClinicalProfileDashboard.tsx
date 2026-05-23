import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  RefreshCw,
  Target,
  Timer,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from '@/components/loading';
import {
  WorkspaceHeroStrip,
  WorkspaceMetricCard,
  WorkspacePage,
  WorkspacePageHeader,
  WorkspaceReveal,
  WorkspaceSection,
  WorkspaceSplit,
  WorkspaceSurface,
} from '@/components/workspace';
import { useClinicalProfile, type ClinicalProfileData } from './hooks/useClinicalProfile';
import { OverviewCard } from './OverviewCard';
import { SystemRadarChart } from './SystemRadarChart';
import { TimingPatterns } from './TimingPatterns';
import { DiagnosisBiasCard } from './DiagnosisBiasCard';
import { StrengthsWeaknesses } from './StrengthsWeaknesses';
import { StudyPatternHeatmap } from './StudyPatternHeatmap';
import { clinicalConsoleDemoData } from '@/components/clinical-console/studyDemoData';
import { ROUTES } from '@/config/routes';
import { workspaceAccent } from '@/lib/tokens';

const ClinicalProfileDashboard: React.FC = () => {
  const { data, isLoading, error, refetch } = useClinicalProfile();
  const navigate = useNavigate();
  const displayData: ClinicalProfileData =
    data ?? clinicalConsoleDemoData.clinicalProfilePreview;
  const isPreview = !data;

  const accuracyPct = useMemo(
    () => Math.round(((displayData.overall.accuracy ?? 0) || 0) * 100),
    [displayData.overall.accuracy]
  );
  const avgTimeSec = useMemo(
    () => (displayData.overall.avgTimeMs ? Math.round(displayData.overall.avgTimeMs / 1000) : null),
    [displayData.overall.avgTimeMs]
  );
  const systemsTracked = displayData.systemBreakdown.length;
  const strengthsCount = displayData.strengths.length;
  const weaknessesCount = displayData.weaknesses.length;
  const totalQuestions = displayData.overall.totalQuestions;

  if (isLoading) {
    return (
      <WorkspacePage density="wide">
        <WorkspaceReveal>
          <WorkspacePageHeader
            meta={{
              badge: 'Clinical Profile',
              badgeTone: 'plum',
              title: 'Building your clinical profile.',
              subtitle:
                'Prioritizing missed patterns, timing signals, and diagnostic tendencies from your study history.',
              backLabel: 'Back to Study',
              onBack: () => navigate(ROUTES.STUDY),
            }}
          />
        </WorkspaceReveal>
        <WorkspaceReveal delay={0.05}>
          <WorkspaceSurface accent={workspaceAccent.plum}>
            <div
              className="flex min-h-[16rem] items-center justify-center gap-3 text-[var(--color-text-secondary)]"
              role="status"
              aria-live="polite"
            >
              <InlineSpinner size="lg" />
              <span>Prioritizing missed patterns...</span>
            </div>
          </WorkspaceSurface>
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
            title: isPreview
              ? 'Clinical reasoning profile preview.'
              : 'Understand how you tend to think under pressure.',
            subtitle: isPreview
              ? 'Live clinical profile data is unavailable in this session, so guest mode shows the same diagnostic lenses with representative study signals.'
              : 'This profile turns your answer history into a clearer read on strengths, speed, timing, and the diagnostic tendencies that deserve attention.',
            status: isPreview
              ? 'Guest-safe profile preview'
              : `${totalQuestions} question${totalQuestions === 1 ? '' : 's'} analyzed`,
            backLabel: 'Back to Study',
            onBack: () => navigate(ROUTES.STUDY),
            primaryAction: {
              label: isPreview ? 'Retry live profile' : 'Refresh profile',
              onClick: refetch,
              icon: RefreshCw,
            },
            secondaryActions: isPreview
              ? [
                  {
                    label: 'Open Practice',
                    onClick: () => navigate(ROUTES.PRACTICE),
                  },
                ]
              : undefined,
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
            accent={workspaceAccent.steel}
            icon={Timer}
          />
          <WorkspaceMetricCard
            label="Systems tracked"
            value={systemsTracked}
            detail="Systems with enough data to contribute to your profile."
            accent={workspaceAccent.plum}
            icon={Activity}
          />
          <WorkspaceMetricCard
            label="Strength balance"
            value={`${strengthsCount}/${weaknessesCount}`}
            detail="Named strengths compared with currently flagged weak areas."
            accent={workspaceAccent.sage}
            icon={TrendingUp}
          />
        </div>
      </WorkspaceReveal>

      {isPreview ? (
        <WorkspaceReveal delay={0.06}>
          <WorkspaceSurface accent={workspaceAccent.plum} role="reference">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <div className="workspace-icon-tile flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[var(--color-text-primary)]">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Live profile status
                  </p>
                  <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
                    {error || 'No authenticated clinical profile payload was returned for this session.'}
                  </p>
                  <p className="max-w-3xl text-xs leading-6 text-[var(--color-text-muted)]">
                    The preview keeps route layout, chart density, and next-action hierarchy testable
                    without bypassing Clerk or writing mock progress into the account.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={refetch}
                >
                  Retry
                </Button>
              </div>
            </div>
          </WorkspaceSurface>
        </WorkspaceReveal>
      ) : null}

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

            <WorkspaceSurface accent={workspaceAccent.plum} className="p-0">
              <div className="p-5">
                <OverviewCard
                  overall={displayData.overall}
                  avgSessionLength={displayData.studyPatterns.avgSessionLength}
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
            <StrengthsWeaknesses strengths={displayData.strengths} weaknesses={displayData.weaknesses} />
            <TimingPatterns patterns={displayData.patterns} />
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
              <SystemRadarChart systems={displayData.systemBreakdown} />
            </div>
            <DiagnosisBiasCard biases={displayData.diagnosisBias} />
          </div>
        </WorkspaceSection>
      </WorkspaceReveal>

      <WorkspaceReveal delay={0.2}>
        <WorkspaceSection
          title="Study rhythm"
          subtitle="See when your study energy tends to show up so you can align harder work with better hours."
        >
          <StudyPatternHeatmap peakHours={displayData.studyPatterns.peakHours} />
        </WorkspaceSection>
      </WorkspaceReveal>
    </WorkspacePage>
  );
};

export default ClinicalProfileDashboard;
