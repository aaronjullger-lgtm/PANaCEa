/**
 * SOAP Comparison View
 *
 * Displays side-by-side comparison of student's SOAP note with AI-generated
 * gold standard. Highlights missing, incomplete, and incorrect elements.
 */

import React, { useState } from 'react';
import { FileText, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { SOAPComparison } from '@/types/smart-scribe-system';

interface SOAPComparisonViewProps {
  comparison: SOAPComparison;
  className?: string;
}

export function SOAPComparisonView({ comparison, className = '' }: SOAPComparisonViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const getSeverityColor = (severity: 'critical' | 'important' | 'minor') => {
    switch (severity) {
      case 'critical':
        return 'text-rose-500';
      case 'important':
        return 'text-data-provisional';
      case 'minor':
        return 'text-data-neutral';
    }
  };

  const getStatusIcon = (status: 'present' | 'missing' | 'incomplete' | 'incorrect') => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-data-pass" />;
      case 'missing':
        return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'incomplete':
        return <AlertCircle className="w-4 h-4 text-data-provisional" />;
      case 'incorrect':
        return <XCircle className="w-4 h-4 text-rose-500" />;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Scores */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-6 h-6 text-[var(--color-accent)]" />
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            SOAP Note Comparison
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {comparison.scores.overall}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Overall</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {comparison.scores.completeness}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Completeness</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {comparison.scores.accuracy}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-text-primary)]">
              {comparison.scores.organization}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Organization</div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Student's Note */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center">
              📝
            </span>
            Your Note
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {formatSOAPNote(comparison.studentNote)}
          </div>
        </div>

        {/* Gold Standard */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-data-pass/20 flex items-center justify-center">
              ✨
            </span>
            Gold Standard
          </h3>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {formatSOAPNote(comparison.goldStandardNote)}
          </div>
        </div>
      </div>

      {/* Element-by-Element Breakdown */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <button
          onClick={() => toggleSection('elements')}
          className="w-full flex items-center justify-between mb-4"
        >
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Element-by-Element Breakdown
          </h3>
          {expandedSections.has('elements') ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-muted)]" />
          )}
        </button>

        {expandedSections.has('elements') && (
          <div className="space-y-3">
            {comparison.elementComparison.map((element, i) => (
              <div
                key={i}
                className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)]"
              >
                <div className="flex items-start gap-3">
                  {getStatusIcon(element.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {element.elementType.replace('_', ' ')}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          element.severity === 'critical'
                            ? 'bg-rose-500/20 text-rose-500'
                            : element.severity === 'important'
                              ? 'bg-data-provisional/20 text-data-provisional'
                              : 'bg-data-neutral/20 text-data-neutral'
                        }`}
                      >
                        {element.severity}
                      </span>
                    </div>
                    <div className={`text-sm ${getSeverityColor(element.severity)}`}>
                      {element.feedback}
                    </div>
                    {element.studentContent && element.status !== 'present' && (
                      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                        You wrote: "{element.studentContent}"
                      </div>
                    )}
                    {element.status === 'missing' && (
                      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                        Expected: "{element.goldStandardContent}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strengths */}
      {comparison.strengths.length > 0 && (
        <div className="rounded-xl border border-data-pass/30 bg-data-pass/5 p-6">
          <h3 className="text-lg font-semibold text-data-pass mb-3">✓ Strengths</h3>
          <ul className="space-y-2">
            {comparison.strengths.map((strength, i) => (
              <li
                key={i}
                className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
              >
                <CheckCircle className="w-4 h-4 text-data-pass flex-shrink-0 mt-0.5" />
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas for Improvement */}
      {comparison.areasForImprovement.length > 0 && (
        <div className="rounded-xl border border-data-provisional/30 bg-data-provisional/5 p-6">
          <h3 className="text-lg font-semibold text-data-provisional mb-3">⚠ Areas for Improvement</h3>
          <ul className="space-y-2">
            {comparison.areasForImprovement.map((area, i) => (
              <li
                key={i}
                className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-data-provisional flex-shrink-0 mt-0.5" />
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Teaching Points */}
      {comparison.teachingPoints.length > 0 && (
        <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-6">
          <h3 className="text-lg font-semibold text-[var(--color-accent)] mb-3">
            💡 Teaching Points
          </h3>
          <ul className="space-y-2">
            {comparison.teachingPoints.map((point, i) => (
              <li key={i} className="text-sm text-[var(--color-text-secondary)]">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Helper function to format SOAP note
function formatSOAPNote(note: any): React.JSX.Element {
  return (
    <div className="space-y-4 text-sm">
      {/* Subjective */}
      <div>
        <div className="font-bold text-[var(--color-text-primary)] mb-1">Subjective</div>
        <div className="text-[var(--color-text-secondary)] pl-4">
          {note.subjective?.chiefComplaint?.content || 'Not documented'}
        </div>
      </div>

      {/* Objective */}
      <div>
        <div className="font-bold text-[var(--color-text-primary)] mb-1">Objective</div>
        <div className="text-[var(--color-text-secondary)] pl-4">
          {note.objective?.vitalSigns?.content || 'Not documented'}
        </div>
      </div>

      {/* Assessment */}
      <div>
        <div className="font-bold text-[var(--color-text-primary)] mb-1">Assessment</div>
        <div className="text-[var(--color-text-secondary)] pl-4">
          {note.assessment?.primaryDiagnosis?.content || 'Not documented'}
        </div>
      </div>

      {/* Plan */}
      <div>
        <div className="font-bold text-[var(--color-text-primary)] mb-1">Plan</div>
        <div className="text-[var(--color-text-secondary)] pl-4">
          {note.plan?.treatment?.content || 'Not documented'}
        </div>
      </div>
    </div>
  );
}
