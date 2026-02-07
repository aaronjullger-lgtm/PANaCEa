import React from 'react';
import {
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import type { ClinicalProfileData } from './hooks/useClinicalProfile';

interface Props {
  systems: ClinicalProfileData['systemBreakdown'];
}

export const SystemRadarChart: React.FC<Props> = ({ systems }) => {
  if (!systems.length) {
    return (
      <div className="h-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex items-center justify-center text-sm text-[var(--color-text-muted)]">
        No system data yet.
      </div>
    );
  }

  const data = systems.map((sys) => ({
    system: sys.system,
    accuracy: Math.round((sys.accuracy || 0) * 100),
  }));

  return (
    <div
      className="h-64 min-h-[200px] w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
      style={{ transform: 'translateZ(0)' }}
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="var(--chart-grid-stroke)" strokeOpacity={0.4} />
          <PolarAngleAxis dataKey="system" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
          <Radar
            name="Accuracy"
            dataKey="accuracy"
            stroke="var(--color-accent)"
            fill="var(--color-accent)"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
