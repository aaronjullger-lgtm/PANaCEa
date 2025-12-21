/**
 * Trello Export Panel Component
 * 
 * Allows users to export their study plan to Trello as a Kanban board.
 */

import React, { useState, useMemo } from 'react';
import { Trello, Download, Info, ExternalLink, ClipboardList, Pin, Target, BookOpen, Zap, Circle, CheckCircle, Book } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  generateStudyBoard,
  downloadTrelloJSON,
  getTrelloBoardUrl,
  TRELLO_IMPORT_INSTRUCTIONS,
  type TrelloBoardExport,
} from '../../lib/services/trelloService';
import { generateStudyPlan } from '../../lib/services/calendarSyncService';

interface TrelloExportPanelProps {
  userExamDate?: Date;
}

export const TrelloExportPanel: React.FC<TrelloExportPanelProps> = ({
  userExamDate,
}) => {
  const { showToast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const [examDate, setExamDate] = useState<string>(
    userExamDate?.toISOString().split('T')[0] || ''
  );

  // Generate board structure
  const board = useMemo<TrelloBoardExport | null>(() => {
    if (!examDate) return null;

    const date = new Date(examDate);
    const plan = generateStudyPlan(date);
    return generateStudyBoard(date, plan);
  }, [examDate]);

  const handleDownloadJSON = () => {
    if (!board) {
      showToast({ type: 'warning', message: 'Please set an exam date to generate your study board.' });
      return;
    }

    downloadTrelloJSON(board);
  };

  const handleOpenTrello = () => {
    const url = getTrelloBoardUrl('PANCE Study Plan - PANaCEa');
    window.open(url, '_blank');
  };

  const boardStats = useMemo(() => {
    if (!board) return { lists: 0, cards: 0 };

    const cards = board.lists.reduce((sum, list) => sum + list.cards.length, 0);
    return {
      lists: board.lists.length,
      cards,
    };
  }, [board]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Trello className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Trello Board Export
        </h2>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
        Transform your study plan into a visual Kanban board in Trello. Track your progress
        as you move through each study phase.
      </p>

      {/* Exam Date Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Exam Date:
        </label>
        <input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      {/* Board Preview */}
      {board && (
        <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Board Preview:
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {boardStats.lists}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Lists</div>
            </div>
            <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {boardStats.cards}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Cards</div>
            </div>
          </div>

          {/* List preview */}
          <div className="space-y-2">
            {board.lists.slice(0, 3).map((list, idx) => (
              <div
                key={idx}
                className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {list.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {list.cards.length} cards
                  </span>
                </div>
              </div>
            ))}
            {board.lists.length > 3 && (
              <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                + {board.lists.length - 3} more lists
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 mb-4">
        <button
          onClick={handleDownloadJSON}
          disabled={!board}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Board JSON
        </button>

        <button
          onClick={handleOpenTrello}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-5 h-5" />
          Create Board in Trello
        </button>
      </div>

      {/* Instructions Toggle */}
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="w-full mb-4 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
      >
        <Info className="w-4 h-4" />
        {showInstructions ? 'Hide' : 'Show'} Setup Instructions
      </button>

      {/* Instructions */}
      {showInstructions && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-xs">
              {TRELLO_IMPORT_INSTRUCTIONS}
            </pre>
          </div>
        </div>
      )}

      {/* Feature Highlight */}
      <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
        <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Why Trello?
        </h3>
        <ul className="text-xs text-indigo-800 dark:text-indigo-400 space-y-1">
          <li>• Visual Kanban board for tracking progress</li>
          <li>• Drag-and-drop cards as you complete topics</li>
          <li>• Color-coded labels for different organ systems</li>
          <li>• Checklists for breaking down study sessions</li>
          <li>• Mobile app for studying on the go</li>
          <li>• Collaborate with study partners</li>
        </ul>
      </div>

      {/* Board Structure Info */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Pin className="w-4 h-4" /> Your Board Will Include:
        </h3>
        <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span><span className="font-semibold">Exam Overview:</span> Key dates and study plan summary</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <span><span className="font-semibold">To Do:</span> Upcoming study weeks</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            <span><span className="font-semibold">In Progress:</span> Current week&apos;s focus</span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span><span className="font-semibold">Weak Areas:</span> Topics needing more attention</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span><span className="font-semibold">Completed:</span> Finished modules</span>
          </div>
          <div className="flex items-center gap-2">
            <Book className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span><span className="font-semibold">Resources:</span> Study materials</span>
          </div>
        </div>
      </div>
    </div>
  );
};
