/**
 * ConditionMaster - hierarchical detail panel for MedicalContent
 * Maps 40+ fields into four primary sections per requirements.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { X, Info, Stethoscope, ClipboardList, Activity } from 'lucide-react';
import { YieldBadge, SystemBadge } from '@/components/ui/badges';
import { parseListField, parseTextField, normalizeMedicalContent } from '@/lib/utils/normalization';
import { ContentFieldRenderer } from '@/components/ui/content-renderers';
import type { MedicalContentDisplay } from '@/types/medical-content';

interface ConditionMasterProps {
  content: Partial<MedicalContentDisplay>;
  onClose?: () => void;
}

type AnyRecord = Record<string, unknown>;

const getValue = (data: AnyRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (key in data) {
      const value = data[key];
      if (value !== undefined && value !== null) return value;
    }
  }
  return undefined;
};

const Section: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-secondary)]/30">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
      <Icon className="w-4 h-4 text-[var(--color-accent)]" />
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wide">{title}</h3>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

const TextField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const text = parseTextField(value);
  if (!text) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">{label}</h4>
      <ContentFieldRenderer value={text} />
    </div>
  );
};

const MarkdownField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const text = parseTextField(value);
  if (!text) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">{label}</h4>
      <ReactMarkdown className="condition-markdown">{text}</ReactMarkdown>
    </div>
  );
};

const ListField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const items = parseListField(value);
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-1">{label}</h4>
      <ContentFieldRenderer value={items} variant="clinical" />
    </div>
  );
};

const PillListField: React.FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const items = parseListField(value);
  if (!items.length) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">{label}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span
            key={idx}
            className="px-2.5 py-1 rounded-lg bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] text-sm font-medium"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
};

export const ConditionMaster: React.FC<ConditionMasterProps> = ({ content, onClose }) => {
  const normalized = useMemo(() => normalizeMedicalContent(content), [content]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.97, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.97, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  className="text-3xl font-bold text-[var(--color-text-primary)] tracking-wide"
                  style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
                >
                  {normalized.condition}
                </h2>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {normalized.system && <SystemBadge system={normalized.system} />}
                  <YieldBadge yield={normalized.pance_yield} size="md" />
                  {normalized.subcategory && (
                    <span className="px-2 py-1 bg-[var(--muted)] text-[var(--muted-foreground)] border border-[var(--border)] rounded text-xs">
                      {normalized.subcategory}
                    </span>
                  )}
                </div>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-[var(--color-text-muted)]" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Section 1: Essentials */}
            <Section title="Essentials" icon={Info}>
              <TextField label="Classic Patient" value={normalized.classic_patient} />
              <TextField label="Epidemiology" value={normalized.epidemiology} />
              <TextField label="Etiology" value={normalized.etiology} />
              <TextField label="Risk Factors" value={getValue(normalized, ['riskFactors', 'risk_factors'])} />
              <TextField label="Demographics" value={getValue(normalized, ['age_demographic', 'ageDemographic'])} />
            </Section>

            {/* Section 2: The Why */}
            <Section title="Pathophysiology" icon={Activity}>
              <MarkdownField label="Pathophysiology" value={normalized.pathophysiology} />
              <ListField label="Related Systems" value={normalized.relatedSystems} />
            </Section>

            {/* Section 3: Clinical Presentation */}
            <Section title="Clinical Presentation" icon={Stethoscope}>
              <TextField label="Symptoms" value={normalized.symptoms} />
              <TextField label="Physical Exam" value={getValue(normalized, ['physicalExam', 'physical_exam', 'signs'])} />
              <ListField label="Classic Triad" value={normalized.classic_triad} />
              <PillListField label="Buzzwords" value={normalized.buzzwords} />
            </Section>

            {/* Section 4: Workup & Treatment */}
            <Section title="Workup & Treatment" icon={ClipboardList}>
              <TextField label="Best Initial Test" value={getValue(normalized, ['best_initial_test'])} />
              <TextField label="Labs" value={getValue(normalized, ['labs', 'diagnostics'])} />
              <TextField label="Imaging" value={getValue(normalized, ['imaging'])} />
              <TextField label="Gold Standard" value={getValue(normalized, ['gold_standard', 'gold_standard_dx'])} />
              <TextField label="Diagnosis" value={getValue(normalized, ['diagnosis', 'differentialDiagnosis'])} />
              <MarkdownField label="Treatment" value={normalized.treatment} />
              <TextField label="Complications" value={normalized.complications} />
            </Section>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConditionMaster;
