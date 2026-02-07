/**
 * QuickReferenceDrawer - Mid-session reference lookup
 * 
 * Allows students to quickly look up drugs, lab values, or calculations
 * without leaving the quiz session. Opens as bottom sheet on mobile.
 */

import React, { useState } from 'react';
import { Search, Pill, Beaker, Calculator, BookOpen, X } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';

type ReferenceTab = 'drugs' | 'labs' | 'calculators' | 'guidelines';

interface QuickReferenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Mini drug search component
 */
const DrugSearchMini: React.FC = () => {
  const [query, setQuery] = useState('');

  return (
    <div className="p-4">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search drugs..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        />
      </div>
      
      {!query && (
        <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
          Type a drug name to search
        </div>
      )}

      {query && (
        <div className="text-sm text-[var(--color-text-muted)] text-center py-8">
          Results for "{query}" (feature in development)
        </div>
      )}
    </div>
  );
};

/**
 * Mini lab values component
 */
const LabValuesMini: React.FC = () => {
  const commonLabs = [
    { name: 'Sodium', range: '136-145 mEq/L' },
    { name: 'Potassium', range: '3.5-5.0 mEq/L' },
    { name: 'Creatinine', range: '0.6-1.2 mg/dL' },
    { name: 'Glucose', range: '70-100 mg/dL' },
    { name: 'WBC', range: '4.5-11.0 k/μL' },
    { name: 'Hemoglobin', range: 'M: 13.5-17.5, F: 12-16 g/dL' },
  ];

  return (
    <div className="p-4">
      <div className="space-y-2">
        {commonLabs.map((lab) => (
          <div
            key={lab.name}
            className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            <div className="font-semibold text-[var(--color-text-primary)] text-sm">
              {lab.name}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              Normal: {lab.range}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Mini calculators component
 */
const CalculatorsMini: React.FC = () => {
  const commonCalcs = [
    { name: 'Anion Gap', formula: 'Na - (Cl + HCO3)' },
    { name: 'Corrected Ca', formula: 'Ca + 0.8(4 - Albumin)' },
    { name: 'GFR (CKD-EPI)', formula: 'Based on Cr, age, sex' },
    { name: 'CURB-65', formula: 'Pneumonia severity' },
  ];

  return (
    <div className="p-4">
      <div className="space-y-2">
        {commonCalcs.map((calc) => (
          <button
            key={calc.name}
            className="w-full text-left p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-md transition-all group"
          >
            <div className="font-semibold text-[var(--color-text-primary)] text-sm group-hover:text-[var(--color-accent)] transition-colors">
              {calc.name}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              {calc.formula}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Main Quick Reference Drawer
 */
export const QuickReferenceDrawer: React.FC<QuickReferenceDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ReferenceTab>('drugs');

  const tabs = [
    { id: 'drugs' as const, label: 'Drugs', icon: Pill },
    { id: 'labs' as const, label: 'Labs', icon: Beaker },
    { id: 'calculators' as const, label: 'Calc', icon: Calculator },
    { id: 'guidelines' as const, label: 'Guide', icon: BookOpen },
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Reference"
      snapPoints={[0.6, 0.9]}
      enableSwipeDown
    >
      {/* Tabs */}
      <div className="sticky top-0 bg-[var(--color-bg-primary)] border-b border-[var(--color-border)] px-4 py-3 flex gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all
                ${isActive
                  ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)] shadow-sm'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {activeTab === 'drugs' && <DrugSearchMini />}
        {activeTab === 'labs' && <LabValuesMini />}
        {activeTab === 'calculators' && <CalculatorsMini />}
        {activeTab === 'guidelines' && (
          <div className="p-4 text-center text-[var(--color-text-muted)] py-12">
            Guidelines feature coming soon
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="sticky bottom-0 bg-[var(--color-accent)]/10 border-t border-[var(--color-accent)]/20 px-4 py-3">
        <p className="text-xs text-[var(--color-text-secondary)] text-center">
          Quick reference for active recall - look up, then try to answer from memory
        </p>
      </div>
    </BottomSheet>
  );
};

export default QuickReferenceDrawer;
