/**
 * Anki Export Panel Component
 * 
 * Provides UI for exporting missed questions to Anki.
 * Features a "Sync Missed" button that exports only today's incorrect answers.
 */

import React, { useState } from 'react';
import { Download, FileDown, CheckCircle, XCircle } from 'lucide-react';
import { exportMissedTodayToAnki, type AnkiExportOptions } from '../../lib/services/ankiExportService';
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <FileDown className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Anki Export
        </h2>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Export questions you missed today to your Anki deck for spaced repetition.
        The file will be downloaded in a format that Anki can import directly.
      </p>

      {/* Export Options */}
      <div className="space-y-3 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Deck Name:
          </label>
          <input
            type="text"
            value={options.deckName}
            onChange={(e) => setOptions({ ...options, deckName: e.target.value })}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="PANaCEa_Missed_Questions"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Include Rationale
          </label>
          <input
            type="checkbox"
            checked={options.includeRationale}
            onChange={(e) => setOptions({ ...options, includeRationale: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Include Pearls
          </label>
          <input
            type="checkbox"
            checked={options.includePearls}
            onChange={(e) => setOptions({ ...options, includePearls: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tag with System
          </label>
          <input
            type="checkbox"
            checked={options.tagWithSystem}
            onChange={(e) => setOptions({ ...options, tagWithSystem: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Tag with Condition
          </label>
          <input
            type="checkbox"
            checked={options.tagWithCondition}
            onChange={(e) => setOptions({ ...options, tagWithCondition: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={handleSyncMissed}
        disabled={isExporting}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Download className="w-5 h-5" />
        {isExporting ? 'Exporting...' : 'Sync Missed Questions'}
      </button>

      {/* Export Result Message */}
      {exportResult && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            exportResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {exportResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                exportResult.success
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-red-800 dark:text-red-300'
              }`}
            >
              {exportResult.message}
            </p>
            {exportResult.success && (
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Import the downloaded file into Anki using File → Import
              </p>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          How to Import into Anki:
        </h3>
        <ol className="text-xs text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
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
