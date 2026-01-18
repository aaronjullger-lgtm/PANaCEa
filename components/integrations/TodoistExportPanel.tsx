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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <CheckSquare className="w-6 h-6 text-red-600 dark:text-red-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Todoist Export</h2>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Export your study plan and question reviews to Todoist. Stay organized with your favorite
        task management app.
      </p>

      {/* Export Mode Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          What to Export:
        </label>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setExportMode('study-plan')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              exportMode === 'study-plan'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <div className="font-semibold">Study Plan Only</div>
            <div className="text-xs opacity-80">Weekly study schedule based on your exam date</div>
          </button>
          <button
            onClick={() => setExportMode('missed-questions')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              exportMode === 'missed-questions'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <div className="font-semibold">Missed Questions Only</div>
            <div className="text-xs opacity-80">
              Review tasks for questions you got wrong ({missedQuestions.length} questions)
            </div>
          </button>
          <button
            onClick={() => setExportMode('both')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              exportMode === 'both'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <div className="font-semibold">Complete Package</div>
            <div className="text-xs opacity-80">Both study plan and missed question reviews</div>
          </button>
        </div>
      </div>

      {/* Exam Date Input (if study plan is selected) */}
      {(exportMode === 'study-plan' || exportMode === 'both') && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Exam Date:
          </label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      )}

      {/* Task Preview */}
      {tasks.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Export Preview:
          </h3>
          <div className="grid grid-cols-4 gap-4 mb-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {taskStats.p4}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">P4 (Critical)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {taskStats.p3}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">P3 (High)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {taskStats.p2}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">P2 (Medium)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                {taskStats.p1}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">P1 (Normal)</div>
            </div>
          </div>
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            Total: <span className="font-semibold">{tasks.length}</span> tasks
          </div>
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleDownloadCSV}
        disabled={tasks.length === 0}
        className="w-full mb-4 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        <Download className="w-5 h-5" />
        Download Todoist CSV ({tasks.length} tasks)
      </button>

      {/* Instructions Toggle */}
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="w-full mb-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
      >
        <Info className="w-4 h-4" />
        {showInstructions ? 'Hide' : 'Show'} Import Instructions
      </button>

      {/* Instructions */}
      {showInstructions && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-xs">{TODOIST_IMPORT_INSTRUCTIONS}</pre>
          </div>
        </div>
      )}

      {/* Feature Highlight */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Why Todoist?
        </h3>
        <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
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
