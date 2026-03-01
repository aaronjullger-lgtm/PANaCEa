import React from 'react';
import { Loader2 } from 'lucide-react';
import { useClinicalProfile } from './hooks/useClinicalProfile';
import { OverviewCard } from './OverviewCard';
import { SystemRadarChart } from './SystemRadarChart';
import { TimingPatterns } from './TimingPatterns';
import { DiagnosisBiasCard } from './DiagnosisBiasCard';
import { StrengthsWeaknesses } from './StrengthsWeaknesses';
import { StudyPatternHeatmap } from './StudyPatternHeatmap';

const ClinicalProfileDashboard: React.FC = () => {
  const { data, isLoading, error, refetch } = useClinicalProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-data-neutral">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading clinical profile...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-4 flex items-center justify-between">
        <span>{error || 'Unable to load profile'}</span>
        <button
          onClick={refetch}
          className="px-3 py-1.5 text-sm font-medium bg-rose-600 text-white rounded-lg shadow hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-data-neutral">
            Personal Clinical Profile
          </p>
          <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Strengths, timing, and biases
          </h2>
        </div>
        <button
          onClick={refetch}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-data-neutral dark:border-data-neutral bg-white dark:bg-data-neutral hover:border-[var(--color-category-practice)] text-data-neutral dark:text-data-neutral"
        >
          Refresh
        </button>
      </div>

      <OverviewCard overall={data.overall} avgSessionLength={data.studyPatterns.avgSessionLength} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StrengthsWeaknesses strengths={data.strengths} weaknesses={data.weaknesses} />
        <TimingPatterns patterns={data.patterns} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SystemRadarChart systems={data.systemBreakdown} />
        </div>
        <DiagnosisBiasCard biases={data.diagnosisBias} />
      </div>

      <StudyPatternHeatmap peakHours={data.studyPatterns.peakHours} />
    </div>
  );
};

export default ClinicalProfileDashboard;
