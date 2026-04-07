/**
 * Anki Export Panel Component
 *
 * Provides UI for exporting missed questions to Anki.
 * Features a "Sync Missed" button that exports only today's incorrect answers.
 */

import React, { useState } from 'react';
import { Download, FileDown, CheckCircle, XCircle } from 'lucide-react';
import {
  exportMissedTodayToAnki,
  type AnkiExportOptions,
} from '../../lib/services/ankiExportService';
import { EXPORT_TO_REVIEW } from '@/config/labels';
import type { Question, PerformanceRecord } from '../../types';

interface AnkiExportPanelProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
}

export const AnkiExportPanel: React.FC<AnkiExportPanelProps> = ({
  performanceData,
  missedQuestions,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [options, setOptions] = useState<AnkiExportOptions>({
    deckName: 'PANaCEa_Missed_Questions',
    includeRationale: true,
    includePearls: true,
    tagWithSystem: true,
    tagWithCondition: true,
  });

  const handleSyncMissed = () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const result = exportMissedTodayToAnki(performanceData, missedQuestions, options);

      if (result.success) {
        setExportResult({
          success: true,
          message: `Successfully exported ${result.count} question${result.count !== 1 ? 's' : ''} to Anki!`,
        });
      } else {
        setExportResult({
          success: false,
          message: result.error || 'Export failed',
        });
      }
    } catch (error) {
      setExportResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <FileDown className="w-6 h-6 text-[var(--color-accent)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Anki Export</h2>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Export questions you missed today to your Anki deck for spaced repetition. The file will be
        downloaded in a format that Anki can import directly.
      </p>

      {/* Export Options */}
      <div className="space-y-3 mb-6 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Deck Name:
          </label>
          <input
            type="text"
            value={options.deckName}
            onChange={(e) => setOptions({ ...options, deckName: e.target.value })}
            className="px-3 py-1 text-sm border border-[var(--color-border)] rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            placeholder="PANaCEa_Missed_Questions"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Include Rationale
          </label>
          <input
            type="checkbox"
            checked={options.includeRationale}
            onChange={(e) => setOptions({ ...options, includeRationale: e.target.checked })}
            className="w-4 h-4 text-[var(--color-accent)] border-[var(--color-border)] rounded focus:ring-[var(--color-focus-ring)]"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Include Pearls
          </label>
          <input
            type="checkbox"
            checked={options.includePearls}
            onChange={(e) => setOptions({ ...options, includePearls: e.target.checked })}
            className="w-4 h-4 text-[var(--color-accent)] border-[var(--color-border)] rounded focus:ring-[var(--color-focus-ring)]"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Tag with System
          </label>
          <input
            type="checkbox"
            checked={options.tagWithSystem}
            onChange={(e) => setOptions({ ...options, tagWithSystem: e.target.checked })}
            className="w-4 h-4 text-[var(--color-accent)] border-[var(--color-border)] rounded focus:ring-[var(--color-focus-ring)]"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Tag with Condition
          </label>
          <input
            type="checkbox"
            checked={options.tagWithCondition}
            onChange={(e) => setOptions({ ...options, tagWithCondition: e.target.checked })}
            className="w-4 h-4 text-[var(--color-accent)] border-[var(--color-border)] rounded focus:ring-[var(--color-focus-ring)]"
          />
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleSyncMissed}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-text-inverse)] font-semibold rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2"
      >
        <Download className="w-5 h-5" />
        {isExporting ? 'Exporting...' : EXPORT_TO_REVIEW}
      </button>

      {/* Export Result Message */}
      {exportResult && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            exportResult.success
              ? 'bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30'
              : 'bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30'
          }`}
        >
          {exportResult.success ? (
            <CheckCircle className="w-5 h-5 text-[var(--color-data-pass)] flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                exportResult.success
                  ? 'text-[var(--color-data-pass)]'
                  : 'text-[var(--color-data-fail)]'
              }`}
            >
              {exportResult.message}
            </p>
            {exportResult.success && (
              <p className="text-xs text-[var(--color-data-pass)] mt-1">
                Import the downloaded file into Anki using File → Import
              </p>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-[var(--color-accent-light)] rounded-lg border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          How to Import into Anki:
        </h3>
        <ol className="text-xs text-[var(--color-text-secondary)] space-y-1 list-decimal list-inside">
          <li>Open Anki on your computer</li>
          <li>Go to File → Import</li>
          <li>Select the downloaded .txt file</li>
          <li>Anki will automatically detect the format and import your cards</li>
          <li>Start studying with spaced repetition!</li>
        </ol>
      </div>
    </div>
  );
};
