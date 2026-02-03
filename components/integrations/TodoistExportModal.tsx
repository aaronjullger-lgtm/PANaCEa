import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  generateStudyTasks,
  generateMissedQuestionTasks,
  downloadTodoistCSV,
  exportTasksToTodoist,
  isTodoistConnected,
  getTodoistOAuthUrl,
  disconnectTodoist,
  TODOIST_IMPORT_INSTRUCTIONS,
  type TodoistTask,
  type StudyTaskExport,
  type TodoistOAuthConfig,
} from '@/lib/services/todoistService';

interface TodoistExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  examDate?: Date;
  weeklyPlan?: any[];
  missedQuestions?: any[];
}

interface ExportOptions {
  includeStudyPlan: boolean;
  includeMissedQuestions: boolean;
  exportMethod: 'csv' | 'oauth';
}

const TODOIST_CONFIG: TodoistOAuthConfig = {
  clientId: import.meta.env.VITE_TODOIST_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_TODOIST_CLIENT_SECRET || '',
  redirectUri: `${window.location.origin}/todoist-callback`,
};

export default function TodoistExportModal({
  isOpen,
  onClose,
  examDate,
  weeklyPlan = [],
  missedQuestions = [],
}: TodoistExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    includeStudyPlan: true,
    includeMissedQuestions: true,
    exportMethod: 'csv',
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedTasks, setGeneratedTasks] = useState<TodoistTask[]>([]);

  useEffect(() => {
    if (isOpen) {
      checkConnection();
      generatePreview();
    }
  }, [isOpen, options]);

  const checkConnection = async () => {
    try {
      const connected = await isTodoistConnected();
      setIsConnected(connected);
    } catch (error) {
      console.error('Failed to check Todoist connection:', error);
      setIsConnected(false);
    }
  };

  const generatePreview = () => {
    const tasks: TodoistTask[] = [];

    if (options.includeStudyPlan && examDate && weeklyPlan.length > 0) {
      const studyExport = generateStudyTasks(examDate, weeklyPlan);
      tasks.push(...studyExport.tasks);
    }

    if (options.includeMissedQuestions && missedQuestions.length > 0) {
      const missedTasks = generateMissedQuestionTasks(missedQuestions);
      tasks.push(...missedTasks);
    }

    setGeneratedTasks(tasks);
  };

  const handleOAuthConnect = () => {
    if (!TODOIST_CONFIG.clientId) {
      setErrorMessage('Todoist integration is not configured. Please contact support.');
      return;
    }

    const oauthUrl = getTodoistOAuthUrl(TODOIST_CONFIG);
    window.location.href = oauthUrl;
  };

  const handleDisconnect = async () => {
    try {
      await disconnectTodoist();
      setIsConnected(false);
      setExportStatus('idle');
    } catch (error) {
      console.error('Failed to disconnect from Todoist:', error);
    }
  };

  const handleExport = async () => {
    if (generatedTasks.length === 0) {
      setErrorMessage('No tasks to export. Please select at least one export option.');
      return;
    }

    setIsLoading(true);
    setExportStatus('idle');
    setErrorMessage('');

    try {
      if (options.exportMethod === 'csv') {
        downloadTodoistCSV(generatedTasks, 'panacea-study-plan.csv');
        setExportStatus('success');
      } else if (options.exportMethod === 'oauth') {
        if (!isConnected) {
          throw new Error('Please connect to Todoist first');
        }
        await exportTasksToTodoist(generatedTasks);
        setExportStatus('success');
      }
    } catch (error) {
      console.error('Export failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Export failed');
      setExportStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-primary)] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Export to Todoist
          </h2>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Options */}
          <div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
              What to Export
            </h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.includeStudyPlan}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, includeStudyPlan: e.target.checked }))
                  }
                  className="rounded border-[var(--color-border)] text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-[var(--color-text-secondary)]">
                  Study Plan ({weeklyPlan.length} weeks)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.includeMissedQuestions}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, includeMissedQuestions: e.target.checked }))
                  }
                  className="rounded border-[var(--color-border)] text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-[var(--color-text-secondary)]">
                  To Review ({missedQuestions.length} questions)
                </span>
              </label>
            </div>
          </div>

          {/* Export Method */}
          <div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
              Export Method
            </h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="exportMethod"
                  value="csv"
                  checked={options.exportMethod === 'csv'}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, exportMethod: e.target.value as 'csv' }))
                  }
                  className="border-[var(--color-border)] text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-[var(--color-text-secondary)]">
                  Download CSV (Manual Import)
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="exportMethod"
                  value="oauth"
                  checked={options.exportMethod === 'oauth'}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, exportMethod: e.target.value as 'oauth' }))
                  }
                  className="border-[var(--color-border)] text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-[var(--color-text-secondary)]">
                  Direct Export (OAuth)
                </span>
              </label>
            </div>
          </div>

          {/* OAuth Connection Status */}
          {options.exportMethod === 'oauth' && (
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {isConnected ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      <span className="text-green-700 dark:text-green-300">
                        Connected to Todoist
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-orange-500 mr-2" />
                      <span className="text-orange-700 dark:text-orange-300">
                        Not connected to Todoist
                      </span>
                    </>
                  )}
                </div>

                {isConnected ? (
                  <button
                    onClick={handleDisconnect}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={handleOAuthConnect}
                    className="flex items-center text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Connect
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Task Preview */}
          <div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
              Preview ({generatedTasks.length} tasks)
            </h3>
            <div className="bg-[var(--color-bg-secondary)] rounded-lg p-4 max-h-40 overflow-y-auto">
              {generatedTasks.length > 0 ? (
                <div className="space-y-2">
                  {generatedTasks.slice(0, 5).map((task, index) => (
                    <div key={index} className="text-sm">
                      <div className="font-medium text-[var(--color-text-primary)]">
                        {task.content}
                      </div>
                      {task.due_date && (
                        <div className="text-[var(--color-text-muted)]">Due: {task.due_date}</div>
                      )}
                    </div>
                  ))}
                  {generatedTasks.length > 5 && (
                    <div className="text-sm text-[var(--color-text-muted)]">
                      ... and {generatedTasks.length - 5} more tasks
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[var(--color-text-muted)] text-sm">
                  No tasks to export. Please select at least one export option.
                </div>
              )}
            </div>
          </div>

          {/* Status Messages */}
          {exportStatus === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-700 dark:text-green-300">
                  {options.exportMethod === 'csv'
                    ? 'CSV file downloaded successfully!'
                    : 'Tasks exported to Todoist successfully!'}
                </span>
              </div>
            </div>
          )}

          {exportStatus === 'error' && errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700 dark:text-red-300">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Instructions for CSV */}
          {options.exportMethod === 'csv' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                Import Instructions
              </h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 whitespace-pre-line">
                {TODOIST_IMPORT_INSTRUCTIONS}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Cancel
          </button>

          <button
            onClick={handleExport}
            disabled={
              isLoading ||
              generatedTasks.length === 0 ||
              (options.exportMethod === 'oauth' && !isConnected)
            }
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {options.exportMethod === 'csv' ? 'Download CSV' : 'Export to Todoist'}
          </button>
        </div>
      </div>
    </div>
  );
}
