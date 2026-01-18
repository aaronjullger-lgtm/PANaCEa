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
      <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex items-center justify-center text-sm text-slate-500">
        No system data yet.
      </div>
    );
  }

  const data = systems.map((sys) => ({
    system: sys.system,
    accuracy: Math.round((sys.accuracy || 0) * 100),
  }));

  return (
    <div className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke="#e2e8f0" strokeOpacity={0.4} />
          <PolarAngleAxis dataKey="system" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
          <Radar
            name="Accuracy"
            dataKey="accuracy"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
