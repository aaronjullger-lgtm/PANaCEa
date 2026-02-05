/**
 * Todoist Export Panel Component
 *
 * Allows users to export their study plan and missed questions to Todoist.
 */

import React, { useState, useMemo } from 'react';
import { CheckSquare, Download, Info, Sparkles } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  generateStudyTasks,
  generateMissedQuestionTasks,
  downloadTodoistCSV,
  TODOIST_IMPORT_INSTRUCTIONS,
  type TodoistTask,
} from '../../lib/services/todoistService';
import { generateStudyPlan } from '../../lib/services/calendarSyncService';
import { TO_REVIEW_ONLY } from '@/config/labels';
import type { Question } from '../../types';

interface TodoistExportPanelProps {
  missedQuestions: Question[];
  userExamDate?: Date;
}

type ExportMode = 'study-plan' | 'missed-questions' | 'both';

export const TodoistExportPanel: React.FC<TodoistExportPanelProps> = ({
  missedQuestions,
  userExamDate,
}) => {
  const { showToast } = useToast();
  const [exportMode, setExportMode] = useState<ExportMode>('study-plan');
  const [showInstructions, setShowInstructions] = useState(false);
  const [examDate, setExamDate] = useState<string>(userExamDate?.toISOString().split('T')[0] || '');

  // Generate tasks based on export mode
  const tasks = useMemo<TodoistTask[]>(() => {
    const allTasks: TodoistTask[] = [];

    if ((exportMode === 'study-plan' || exportMode === 'both') && examDate) {
      const date = new Date(examDate);
      const plan = generateStudyPlan(date);
      const studyExport = generateStudyTasks(date, plan);
      allTasks.push(...studyExport.tasks);
    }

    if (
      (exportMode === 'missed-questions' || exportMode === 'both') &&
      missedQuestions.length > 0
    ) {
      const missedTasks = generateMissedQuestionTasks(missedQuestions);
      allTasks.push(...missedTasks);
    }

    return allTasks;
  }, [exportMode, examDate, missedQuestions]);

  const handleDownloadCSV = () => {
    if (tasks.length === 0) {
      showToast({
        type: 'warning',
        message: 'No tasks to export. Please set an exam date or complete some questions.',
      });
      return;
    }

    downloadTodoistCSV(tasks, 'panacea-todoist-export.csv');
  };

  const taskStats = useMemo(() => {
    const byPriority = { p1: 0, p2: 0, p3: 0, p4: 0 };
    for (const task of tasks) {
      const p = task.priority || 1;
      byPriority[`p${p}` as keyof typeof byPriority]++;
    }
    return byPriority;
  }, [tasks]);

  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-sm p-6 border border-[var(--color-border)]">
      <div className="flex items-center gap-3 mb-4">
        <CheckSquare className="w-6 h-6 text-[var(--color-accent)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Todoist Export</h2>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Export your study plan and question reviews to Todoist. Stay organized with your favorite
        task management app.
      </p>

      {/* Export Mode Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
          What to Export:
        </label>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setExportMode('study-plan')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              exportMode === 'study-plan'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]'
            }`}
          >
            <div className="font-semibold">Study Plan Only</div>
            <div className="text-xs opacity-80">Weekly study schedule based on your exam date</div>
          </button>
          <button
            onClick={() => setExportMode('missed-questions')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              exportMode === 'missed-questions'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]'
            }`}
          >
            <div className="font-semibold">{TO_REVIEW_ONLY}</div>
            <div className="text-xs opacity-80">
              Review tasks to reinforce ({missedQuestions.length} questions)
            </div>
          </button>
          <button
            onClick={() => setExportMode('both')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              exportMode === 'both'
                ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-primary)]'
            }`}
          >
            <div className="font-semibold">Complete Package</div>
            <div className="text-xs opacity-80">Both study plan and to-review tasks</div>
          </button>
        </div>
      </div>

      {/* Exam Date Input (if study plan is selected) */}
      {(exportMode === 'study-plan' || exportMode === 'both') && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Exam Date:
          </label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:border-transparent"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      )}

      {/* Task Preview */}
      {tasks.length > 0 && (
        <div className="mb-6 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Export Preview:
          </h3>
          <div className="grid grid-cols-4 gap-4 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-data-fail)]">
                {taskStats.p4}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">P4 (Critical)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-data-provisional)]">
                {taskStats.p3}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">P3 (High)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-accent)]">
                {taskStats.p2}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">P2 (Medium)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-muted)]">
                {taskStats.p1}
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">P1 (Normal)</div>
            </div>
          </div>
          <div className="text-center text-sm text-[var(--color-text-muted)]">
            Total: <span className="font-semibold">{tasks.length}</span> tasks
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleDownloadCSV}
        disabled={tasks.length === 0}
        className="w-full mb-4 px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <Download className="w-5 h-5" />
        Download Todoist CSV ({tasks.length} tasks)
      </button>

      {/* Instructions Toggle */}
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="w-full mb-4 px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors flex items-center justify-center gap-2"
      >
        <Info className="w-4 h-4" />
        {showInstructions ? 'Hide' : 'Show'} Import Instructions
      </button>

      {/* Instructions */}
      {showInstructions && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-xs text-[var(--color-text-secondary)]">{TODOIST_IMPORT_INSTRUCTIONS}</pre>
          </div>
        </div>
      )}

      {/* Feature Highlight */}
      <div className="mt-6 p-4 bg-[var(--color-accent-light)] rounded-lg border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Why Todoist?
        </h3>
        <ul className="text-xs text-[var(--color-text-secondary)] space-y-1">
          <li>• Smart scheduling with priority levels</li>
          <li>• Cross-platform sync (mobile, desktop, web)</li>
          <li>• Natural language date parsing</li>
          <li>• Productivity tracking and karma points</li>
          <li>• Integration with Google Calendar, Slack, and more</li>
        </ul>
      </div>
    </div>
  );
};
