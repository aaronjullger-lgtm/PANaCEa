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
    <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-[0_0_0_1px_var(--color-border),0_1px_2px_0_rgba(0,0,0,0.03)] p-6">
      <div className="flex items-center gap-3 mb-4">
        <Calendar className="w-6 h-6 text-[var(--color-accent)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Life Scheduler</h2>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Set your exam date and we'll create a personalized study plan with daily blocks that sync
        directly to your Google Calendar, Outlook, or Apple Calendar.
      </p>

      {/* Exam Date Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          When is your PANCE/PANRE exam?
        </label>
        <input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
        />

        {weeksUntilExam && (
          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Clock className="w-4 h-4" />
            <span>{weeksUntilExam} weeks until exam</span>
          </div>
        )}
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGeneratePlan}
        disabled={isGenerating || !examDate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-text-inverse)] font-semibold rounded-xl transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2"
      >
        <Download className="w-5 h-5" />
        {isGenerating ? 'Generating...' : 'Generate Study Plan'}
      </button>

      {/* Generation Result */}
      {generationResult && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            generationResult.success
              ? 'bg-[var(--color-data-pass)]/10 border border-[var(--color-data-pass)]/30'
              : 'bg-[var(--color-data-fail)]/10 border border-[var(--color-data-fail)]/30'
          }`}
        >
          {generationResult.success ? (
            <CheckCircle className="w-5 h-5 text-[var(--color-data-pass)] flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-[var(--color-data-fail)] flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`text-sm font-medium ${
                generationResult.success
                  ? 'text-[var(--color-data-pass)]'
                  : 'text-[var(--color-data-fail)]'
              }`}
            >
              {generationResult.message}
            </p>
            {generationResult.success && (
              <p className="text-xs text-[var(--color-data-pass)] mt-1">
                Import the downloaded .ics file into your calendar app
              </p>
            )}
          </div>
        </div>
      )}

      {/* Study Plan Preview */}
      {generationResult?.success && generationResult.plan && (
        <div className="mt-6 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Your Study Plan Overview:
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {generationResult.plan.map((week) => (
              <div
                key={week.weekNumber}
                className="p-3 bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border)]"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {week.weekLabel}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    - {week.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {week.topics.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-[var(--color-accent-light)] rounded-lg border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          How to Import:
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Google Calendar:
            </p>
            <ol className="text-xs text-[var(--color-text-secondary)] space-y-0.5 list-decimal list-inside pl-2">
              <li>Open Google Calendar</li>
              <li>Click the + next to "Other calendars"</li>
              <li>Select "Import"</li>
              <li>Choose the downloaded .ics file</li>
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Outlook / Apple Calendar:
            </p>
            <ol className="text-xs text-[var(--color-text-secondary)] space-y-0.5 list-decimal list-inside pl-2">
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
