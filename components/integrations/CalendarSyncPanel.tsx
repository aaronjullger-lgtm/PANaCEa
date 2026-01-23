/**
 * Calendar Sync Panel Component
 *
 * Allows users to input their exam date and generate a personalized study plan
 * that can be synced to Google Calendar, Outlook, or Apple Calendar.
 */

import React, { useState } from 'react';
import { Calendar, Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  generateAndDownloadStudyPlan,
  type StudyPlan,
} from '../../lib/services/calendarSyncService';

interface CalendarSyncPanelProps {
  userExamDate?: Date;
  onExamDateSaved?: (date: Date) => void;
}

export const CalendarSyncPanel: React.FC<CalendarSyncPanelProps> = ({
  userExamDate,
  onExamDateSaved,
}) => {
  const [examDate, setExamDate] = useState<string>(
    userExamDate ? (userExamDate.toISOString().split('T')[0] ?? '') : ''
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<{
    success: boolean;
    message: string;
    plan?: StudyPlan[];
  } | null>(null);

  const handleGeneratePlan = () => {
    if (!examDate) {
      setGenerationResult({
        success: false,
        message: 'Please select an exam date',
      });
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);

    try {
      const selectedDate = new Date(examDate);
      selectedDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

      const result = generateAndDownloadStudyPlan(selectedDate);

      if (result.success) {
        setGenerationResult({
          success: true,
          message: `Study plan generated! ${result.eventCount} events added to calendar file.`,
          plan: result.plan,
        });

        // Notify parent component about the exam date
        if (onExamDateSaved) {
          onExamDateSaved(selectedDate);
        }
      } else {
        setGenerationResult({
          success: false,
          message: result.error || 'Failed to generate study plan',
        });
      }
    } catch (error) {
      setGenerationResult({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getWeeksUntilExam = (): number | null => {
    if (!examDate) return null;
    const today = new Date();
    const selected = new Date(examDate);
    const weeks = Math.ceil((selected.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weeks > 0 ? weeks : null;
  };

  const weeksUntilExam = getWeeksUntilExam();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Life Scheduler</h2>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Set your exam date and we'll create a personalized study plan with daily blocks that sync
        directly to your Google Calendar, Outlook, or Apple Calendar.
      </p>

      {/* Exam Date Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          When is your PANCE/PANRE exam?
        </label>
        <input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        />

        {weeksUntilExam && (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{weeksUntilExam} weeks until exam</span>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGeneratePlan}
        disabled={isGenerating || !examDate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
      >
        <Download className="w-5 h-5" />
        {isGenerating ? 'Generating...' : 'Generate Study Plan'}
      </button>

      {/* Generation Result */}
      {generationResult && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            generationResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {generationResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                generationResult.success
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-red-800 dark:text-red-300'
              }`}
            >
              {generationResult.message}
            </p>
            {generationResult.success && (
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Import the downloaded .ics file into your calendar app
              </p>
            )}
          </div>
        </div>
      )}

      {/* Study Plan Preview */}
      {generationResult?.success && generationResult.plan && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Your Study Plan Overview:
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {generationResult.plan.map((week) => (
              <div
                key={week.weekNumber}
                className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {week.weekLabel}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">{week.topics.join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-2">
          How to Import:
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-purple-800 dark:text-purple-400 mb-1">
              Google Calendar:
            </p>
            <ol className="text-xs text-purple-700 dark:text-purple-400 space-y-0.5 list-decimal list-inside pl-2">
              <li>Open Google Calendar</li>
              <li>Click the + next to "Other calendars"</li>
              <li>Select "Import"</li>
              <li>Choose the downloaded .ics file</li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-purple-800 dark:text-purple-400 mb-1">
              Outlook / Apple Calendar:
            </p>
            <ol className="text-xs text-purple-700 dark:text-purple-400 space-y-0.5 list-decimal list-inside pl-2">
              <li>Double-click the downloaded .ics file</li>
              <li>It will automatically open in your default calendar app</li>
              <li>Confirm the import</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
