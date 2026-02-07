/**
 * Clinical Guidelines Reference
 * Quick reference for common guidelines and scoring systems
 */

import React, { useState } from 'react';
import { CalculatorHeader } from '../shared';
import type { CalculatorProps } from '../types';
import { Search, BookOpen, ExternalLink } from 'lucide-react';

interface Guideline {
  name: string;
  category: string;
  indication: string;
  keyPoints: string[];
  reference?: string;
}

const COMMON_GUIDELINES: Guideline[] = [
  {
    name: 'CURB-65',
    category: 'Pulmonary',
    indication: 'Pneumonia severity assessment',
    keyPoints: [
      'Confusion (new onset)',
      'Uremia (BUN >20 mg/dL)',
      'Respiratory rate ≥30',
      'Blood pressure (SBP <90 or DBP ≤60)',
      'Age ≥65 years',
      'Score 0-1: Outpatient, 2: Consider admission, ≥3: ICU consideration'
    ]
  },
  {
    name: 'CHADS₂-VASc',
    category: 'Cardiovascular',
    indication: 'Atrial fibrillation stroke risk',
    keyPoints: [
      'CHF (1 point)',
      'Hypertension (1 point)',
      'Age ≥75 (2 points)',
      'Diabetes (1 point)',
      'Stroke/TIA (2 points)',
      'Vascular disease (1 point)',
      'Age 65-74 (1 point)',
      'Sex (female, 1 point)',
      'Score ≥2: Consider anticoagulation'
    ]
  },
  {
    name: 'Ottawa Ankle Rules',
    category: 'Orthopedics',
    indication: 'Ankle injury - need for X-ray',
    keyPoints: [
      'X-ray only if: bone tenderness at posterior edge/tip of lateral or medial malleolus',
      'OR inability to bear weight (4 steps) immediately and in ED',
      'Sensitivity 98-99%, reduces unnecessary X-rays by 30-40%'
    ]
  },
  {
    name: 'PECARN Head Injury',
    category: 'Pediatrics',
    indication: 'Pediatric head CT decision',
    keyPoints: [
      '<2 years: Altered mental status, palpable skull fracture, scalp hematoma, LOC >5s, severe mechanism',
      '≥2 years: Altered mental status, basilar skull fracture signs, LOC, severe mechanism, severe headache',
      'Low risk (<0.02% ciTBI) if no criteria met'
    ]
  },
  {
    name: 'SIRS Criteria',
    category: 'Critical Care',
    indication: 'Systemic inflammatory response',
    keyPoints: [
      'Temp >38°C or <36°C',
      'HR >90 bpm',
      'RR >20 or PaCO₂ <32 mmHg',
      'WBC >12k or <4k or >10% bands',
      '≥2 criteria = SIRS; + infection = sepsis'
    ]
  },
  {
    name: 'Ranson Criteria',
    category: 'Gastroenterology',
    indication: 'Pancreatitis severity',
    keyPoints: [
      'On admission: Age >55, WBC >16k, glucose >200, LDH >350, AST >250',
      'At 48h: Hct drop >10%, BUN rise >5, Ca <8, PaO₂ <60, base deficit >4, fluid >6L',
      'Score 0-2: 2% mortality, 3-4: 15%, 5-6: 40%, >6: 100%'
    ]
  }
];

export const ClinicalGuidelinesPlaceholder: React.FC<CalculatorProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGuidelines = COMMON_GUIDELINES.filter(
    g => g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         g.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
         g.indication.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <CalculatorHeader
        title="Clinical Guidelines"
        subtitle="Quick reference for common practice guidelines and scoring systems"
        onBack={onBack}
      />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search guidelines..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Guidelines List */}
      <div className="space-y-4">
        {filteredGuidelines.map((guideline) => (
          <div
            key={guideline.name}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 hover:border-[var(--color-accent)]/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                  {guideline.name}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{guideline.indication}</p>
              </div>
              <span className="px-3 py-1 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-full text-xs font-medium">
                {guideline.category}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {guideline.keyPoints.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-[var(--color-accent)] mt-1">•</span>
                  <p className="text-sm text-[var(--color-text-secondary)]">{point}</p>
                </div>
              ))}
            </div>

            {guideline.reference && (
              <a
                href={guideline.reference}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View Full Guideline
              </a>
            )}
          </div>
        ))}
      </div>

      {filteredGuidelines.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
          <p className="text-[var(--color-text-muted)]">No guidelines found matching "{searchTerm}"</p>
        </div>
      )}
    </div>
  );
};
