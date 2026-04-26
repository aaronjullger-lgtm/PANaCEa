// components/modes/osce/CoverageHeatmap.tsx
// Sprint OSCE-01 Sprint 5: Intent coverage visualization

import React from 'react';

export interface IntentCoverageData {
  explored: string[];
  essentialIntents?: string[];
}

interface CoverageHeatmapProps {
  data: IntentCoverageData;
  className?: string;
}

const INTENT_LABELS: Record<string, string> = {
  DEMOGRAPHICS: 'Demographics',
  CHIEF_COMPLAINT: 'Chief Complaint',
  ONSET: 'Onset',
  CAUSE: 'Cause',
  LOCATION: 'Location',
  CHARACTER: 'Character',
  DURATION: 'Duration',
  MODIFIERS: 'Modifiers',
  ASSOCIATED: 'Associated',
  PROGRESSION: 'Progression',
  TREATMENT: 'Treatment',
  TESTS: 'Tests',
  GENERAL: 'Screening',
  ELIMINATION: 'Elimination',
  CHANGES: 'Changes',
  HEALTH: 'Health',
  CHRONIC: 'Chronic',
  INFECTIOUS: 'Infectious',
  SURGICAL: 'Surgical',
  TRANSFUSIONS: 'Transfusions',
  ALLERGIES: 'Allergies',
  IMMUNIZATION: 'Immunization',
  TRAVEL: 'Travel',
  HABITS: 'Habits',
  OCCUPATION: 'Occupation',
  SEXUAL: 'Sexual',
  OBSTETRIC: 'Obstetric',
  FAMILY: 'Family',
  MENSTRUAL: 'Menstrual',
  COMMUNICATION: 'Communication',
  OTHER: 'Other',
};

export const CoverageHeatmap: React.FC<CoverageHeatmapProps> = ({ data, className = '' }) => {
  const historyIntents = ['DEMOGRAPHICS', 'CHIEF_COMPLAINT', 'ONSET', 'CAUSE', 'LOCATION', 'CHARACTER', 'DURATION', 'MODIFIERS'];
  const symptomIntents = ['ASSOCIATED', 'PROGRESSION', 'TREATMENT', 'TESTS', 'CHANGES'];
  const systemIntents = ['GENERAL', 'ELIMINATION', 'HEALTH', 'CHRONIC', 'INFECTIOUS', 'SURGICAL', 'TRANSFUSIONS'];
  const riskIntents = ['ALLERGIES', 'IMMUNIZATION', 'TRAVEL', 'HABITS', 'OCCUPATION', 'SEXUAL', 'OBSTETRIC', 'FAMILY', 'MENSTRUAL', 'COMMUNICATION'];

  const allIntents = Object.keys(INTENT_LABELS) as Array<string>;

  return (
    <div className={className + ' space-y-4'}>
      <h3 className='text-sm font-semibold text-[var(--color-text-muted)] mb-2'>Intent Coverage</h3>
      <p className='text-xs text-[var(--color-text-muted)] mb-4'>{data.explored.length} / {allIntents.length} intents explored</p>

      <div className='mb-3'>
        <h4 className='text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1'>History Taking</h4>
        <div className='grid grid-cols-4 sm:grid-cols-8 gap-1'>
          {historyIntents.map(intent => <IntentBadge key={intent} intent={intent} explored={data.explored.includes(intent)} essential={data.essentialIntents?.includes(intent)} />)}
        </div>
      </div>

      <div className='mb-3'>
        <h4 className='text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1'>Symptoms</h4>
        <div className='grid grid-cols-4 sm:grid-cols-8 gap-1'>
          {symptomIntents.map(intent => <IntentBadge key={intent} intent={intent} explored={data.explored.includes(intent)} essential={data.essentialIntents?.includes(intent)} />)}
        </div>
      </div>

      <div className='mb-3'>
        <h4 className='text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1'>Systems Review</h4>
        <div className='grid grid-cols-4 sm:grid-cols-8 gap-1'>
          {systemIntents.map(intent => <IntentBadge key={intent} intent={intent} explored={data.explored.includes(intent)} essential={data.essentialIntents?.includes(intent)} />)}
        </div>
      </div>

      <div className='mb-3'>
        <h4 className='text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1'>Risk Factors</h4>
        <div className='grid grid-cols-4 sm:grid-cols-8 gap-1'>
          {riskIntents.map(intent => <IntentBadge key={intent} intent={intent} explored={data.explored.includes(intent)} essential={data.essentialIntents?.includes(intent)} />)}
        </div>
      </div>
    </div>
  );
};

interface IntentBadgeProps {
  intent: string;
  explored: boolean;
  essential?: boolean;
}

const IntentBadge: React.FC<IntentBadgeProps> = ({ intent, explored, essential }) => {
  const label = INTENT_LABELS[intent] || intent;

  let colorClass = 'bg-gray-100 text-gray-400';
  if (explored) {
    colorClass = 'bg-[var(--color-action-primary)]/20 text-[var(--color-action-primary)]';
    if (essential) {
      colorClass = 'bg-[var(--color-action-primary)] text-white';
    }
  }

  return (
    <div title={label} className={colorClass + ' px-2 py-1 rounded text-xs font-medium transition-colors'}>
      <span className='max-w-[3rem] block truncate'>{label}</span>
    </div>
  );
};
