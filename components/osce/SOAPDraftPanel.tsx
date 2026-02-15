/**
 * SOAP Draft Panel
 *
 * Displays real-time SOAP note being generated in background during OSCE.
 * Updates every 2-5 seconds as the AI extracts elements from the conversation.
 */

import React from 'react';
import { FileText, Loader2 } from 'lucide-react';
import type { SOAPNote } from '@/types/smart-scribe-system';

interface SOAPDraftPanelProps {
  draftNote: SOAPNote | null;
  isGenerating: boolean;
  className?: string;
}

export function SOAPDraftPanel({ draftNote, isGenerating, className = '' }: SOAPDraftPanelProps) {
  if (!draftNote) {
    return (
      <div
        className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 ${className}`}
      >
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Draft SOAP Note
          </h3>
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />}
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          Note will appear as you interview the patient...
        </p>
      </div>
    );
  }

  const formatSOAPContent = () => {
    const sections = [];

    // Subjective
    if (draftNote.subjective.chiefComplaint.content) {
      sections.push({
        title: 'Subjective',
        content: formatSubjective(draftNote),
      });
    }

    // Objective
    if (draftNote.objective.vitalSigns.content) {
      sections.push({
        title: 'Objective',
        content: formatObjective(draftNote),
      });
    }

    // Assessment
    if (draftNote.assessment.primaryDiagnosis.content) {
      sections.push({
        title: 'Assessment',
        content: formatAssessment(draftNote),
      });
    }

    // Plan
    if (draftNote.plan.diagnosticWorkup?.content || draftNote.plan.treatment?.content) {
      sections.push({
        title: 'Plan',
        content: formatPlan(draftNote),
      });
    }

    return sections;
  };

  const sections = formatSOAPContent();
  const completeness = draftNote.metadata.completenessScore;

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Draft SOAP Note
          </h3>
          {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />}
        </div>
        <div className="text-xs text-[var(--color-text-muted)]">{completeness}% complete</div>
      </div>

      <div className="space-y-3 text-sm">
        {sections.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">Generating...</p>
        ) : (
          sections.map((section, i) => (
            <div key={i} className="border-l-2 border-[var(--color-accent)] pl-3">
              <div className="font-semibold text-[var(--color-text-primary)] mb-1">
                {section.title}
              </div>
              <div className="text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                {section.content}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        Auto-updating in real-time • AI-generated gold standard
      </div>
    </div>
  );
}

// Helper functions to format SOAP sections
function formatSubjective(note: SOAPNote): string {
  const hpi = note.subjective.hpi;
  const parts = [];

  if (note.subjective.chiefComplaint.content) {
    parts.push(note.subjective.chiefComplaint.content);
  }

  const hpiElements = [];
  if (hpi.onset?.content) hpiElements.push(`Onset: ${hpi.onset.content}`);
  if (hpi.duration?.content) hpiElements.push(`Duration: ${hpi.duration.content}`);
  if (hpi.character?.content) hpiElements.push(`Character: ${hpi.character.content}`);
  if (hpi.severity?.content) hpiElements.push(`Severity: ${hpi.severity.content}`);

  if (hpiElements.length > 0) {
    parts.push(hpiElements.join('. ') + '.');
  }

  return parts.join('\n\n');
}

function formatObjective(note: SOAPNote): string {
  const parts = [];

  if (note.objective.vitalSigns.content) {
    parts.push(`Vital Signs: ${note.objective.vitalSigns.content}`);
  }

  if (note.objective.generalAppearance?.content) {
    parts.push(`General: ${note.objective.generalAppearance.content}`);
  }

  return parts.join('\n');
}

function formatAssessment(note: SOAPNote): string {
  const parts = [];

  if (note.assessment.primaryDiagnosis.content) {
    parts.push(note.assessment.primaryDiagnosis.content);
  }

  if (note.assessment.differentialDiagnoses.length > 0) {
    const ddx = note.assessment.differentialDiagnoses
      .map((d) => d.content)
      .filter(Boolean)
      .join(', ');
    if (ddx) {
      parts.push(`DDx: ${ddx}`);
    }
  }

  return parts.join('\n');
}

function formatPlan(note: SOAPNote): string {
  const parts = [];

  if (note.plan.diagnosticWorkup?.content) {
    parts.push(`Workup: ${note.plan.diagnosticWorkup.content}`);
  }

  if (note.plan.treatment?.content) {
    parts.push(`Treatment: ${note.plan.treatment.content}`);
  }

  return parts.join('\n');
}
