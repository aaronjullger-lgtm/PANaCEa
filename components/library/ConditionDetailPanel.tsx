/**
 * ConditionDetailPanel - Full detail view for medical conditions
 *
 * Organizes 40+ fields into 6 logical sections:
 * 1. Clinical Presentation
 * 2. Diagnostic Workup
 * 3. Management
 * 4. Pathophysiology
 * 5. Prognosis & Complications
 * 6. Study Aids
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  TestTube,
  Pill,
  Brain,
  AlertTriangle,
  BookOpen,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { YieldBadge, SystemBadge } from '@/components/ui/badges';
import { normalizeMedicalContent, parseListField, parseTextField } from '@/lib/utils/normalization';
import { ContentFieldRenderer } from '@/components/ui/content-renderers';
import type { MedicalContentDisplay } from '@/types/medical-content';
import { TopicMasteryBreakdown } from '@/components/dashboard/TopicMasteryBreakdown';

interface ConditionDetailPanelProps {
  content: Partial<MedicalContentDisplay>;
  onClose: () => void;
}

interface Section {
  title: string;
  icon: typeof Stethoscope;
  fields: Array<{
    key: keyof MedicalContentDisplay;
    label: string;
    type: 'text' | 'list' | 'special';
  }>;
}

const SECTION_MAPPINGS: Section[] = [
  {
    title: 'Clinical Presentation',
    icon: Stethoscope,
    fields: [
      { key: 'symptoms', label: 'Symptoms', type: 'text' },
      { key: 'physicalExam', label: 'Physical Exam', type: 'text' },
      { key: 'classic_patient', label: 'Classic Patient', type: 'text' },
      { key: 'classic_triad', label: 'Classic Triad', type: 'special' },
    ],
  },
  {
    title: 'Diagnostic Workup',
    icon: TestTube,
    fields: [
      { key: 'diagnostics', label: 'Diagnostic Tests', type: 'text' },
      { key: 'gold_standard_dx', label: 'Gold Standard', type: 'text' },
      { key: 'best_initial_test', label: 'Best Initial Test', type: 'text' },
    ],
  },
  {
    title: 'Management',
    icon: Pill,
    fields: [
      { key: 'treatment', label: 'Treatment', type: 'text' },
      { key: 'first_line_rx', label: 'First-Line Treatment', type: 'text' },
      { key: 'rx_mechanism', label: 'Mechanism of Action', type: 'text' },
      { key: 'rx_side_effects', label: 'Side Effects', type: 'text' },
      { key: 'patient_education', label: 'Patient Education', type: 'text' },
    ],
  },
  {
    title: 'Pathophysiology',
    icon: Brain,
    fields: [
      { key: 'pathophysiology', label: 'Pathophysiology', type: 'text' },
      { key: 'etiology', label: 'Etiology', type: 'text' },
      { key: 'riskFactors', label: 'Risk Factors', type: 'text' },
      { key: 'epidemiology', label: 'Epidemiology', type: 'text' },
    ],
  },
  {
    title: 'Prognosis & Complications',
    icon: AlertTriangle,
    fields: [
      { key: 'complications', label: 'Complications', type: 'text' },
      { key: 'prognosis', label: 'Prognosis', type: 'text' },
      { key: 'prevention', label: 'Prevention', type: 'text' },
      { key: 'disposition', label: 'Disposition', type: 'text' },
    ],
  },
  {
    title: 'Study Aids',
    icon: BookOpen,
    fields: [
      { key: 'buzzwords', label: 'Buzzwords', type: 'special' },
      { key: 'clinical_pearls', label: 'Clinical Pearls', type: 'list' },
      { key: 'mnemonic', label: 'Mnemonics', type: 'text' },
      { key: 'differentialDiagnosis', label: 'Differential Diagnosis', type: 'text' },
    ],
  },
];

/**
 * DetailSection - Collapsible section with icon and fields
 */
const DetailSection: React.FC<{
  section: Section;
  data: Partial<MedicalContentDisplay>;
  defaultOpen?: boolean;
}> = ({ section, data, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const Icon = section.icon;

  // Check if section has any content
  const hasContent = section.fields.some((field) => {
    const value = data[field.key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return value != null;
  });

  if (!hasContent) return null;

  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden bg-[var(--color-bg-secondary)]/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-secondary)]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {section.title}
          </h3>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
        )}
      </button>

      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-[var(--color-border)]"
        >
          <div className="p-4 space-y-4">
            {section.fields.map((field) => {
              const value = data[field.key];
              if (!value) return null;

              // Special handling for buzzwords (pill badges)
              if (field.key === 'buzzwords') {
                const buzzwords = parseListField(value);
                if (buzzwords.length === 0) return null;
                return (
                  <div key={field.key}>
                    <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                      {field.label}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {buzzwords.map((word, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] text-sm font-medium"
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }

              // Special handling for classic triad
              if (field.key === 'classic_triad') {
                const triad = parseListField(value);
                if (triad.length === 0) return null;
                return (
                  <div
                    key={field.key}
                    className="bg-amber-950/20 border border-amber-800/30 rounded-xl p-4"
                  >
                    <h4 className="text-sm font-semibold text-amber-400 mb-2">{field.label}</h4>
                    <ul className="space-y-1">
                      {triad.map((item, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
                        >
                          <span className="text-amber-400">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }

              // List fields
              if (field.type === 'list') {
                const listItems = parseListField(value);
                if (listItems.length === 0) return null;
                return (
                  <div key={field.key}>
                    <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                      {field.label}
                    </h4>
                    <ContentFieldRenderer value={listItems} variant="clinical" />
                  </div>
                );
              }

              // Text fields
              if (field.type === 'text') {
                const text = parseTextField(value);
                if (!text) return null;
                return (
                  <div key={field.key}>
                    <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                      {field.label}
                    </h4>
                    <ContentFieldRenderer value={text} />
                  </div>
                );
              }

              return null;
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
};

/**
 * ConditionDetailPanel - Main component
 */
export const ConditionDetailPanel: React.FC<ConditionDetailPanelProps> = ({ content, onClose }) => {
  const normalized = useMemo(() => normalizeMedicalContent(content), [content]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
          <div className="flex items-start justify-between mb-3">
            <h2
              className="text-3xl font-bold text-[var(--color-text-primary)] tracking-wide"
              style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
            >
              {normalized.condition}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {normalized.system && <SystemBadge system={normalized.system} />}
            <YieldBadge yield={normalized.pance_yield} size="md" />
            {normalized.subcategory && (
              <span className="px-2 py-1 bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] rounded text-xs">
                {normalized.subcategory}
              </span>
            )}
          </div>

          {/* Overview */}
          {normalized.overview && (
            <div className="mt-4 p-4 bg-[var(--color-glass-bg)] backdrop-blur-lg border border-[var(--color-glass-border)] rounded-xl">
              <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                Overview
              </h3>
              <ContentFieldRenderer value={normalized.overview} />
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Topic Mastery Breakdown - Second Chance System */}
          {normalized.conditionId && (
            <TopicMasteryBreakdown
              conditionId={normalized.conditionId}
              conditionName={normalized.condition}
            />
          )}

          {SECTION_MAPPINGS.map((section, idx) => (
            <DetailSection
              key={section.title}
              section={section}
              data={normalized}
              defaultOpen={idx === 0} // First section open by default
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ConditionDetailPanel;
