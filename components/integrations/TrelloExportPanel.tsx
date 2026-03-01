/**
 * Trello Export Panel Component
 *
 * Allows users to export their study plan to Trello as a Kanban board.
 */

import React, { useState, useMemo } from 'react';
import {
  Trello,
  Download,
  Info,
  ExternalLink,
  ClipboardList,
  Pin,
  Target,
  BookOpen,
  Zap,
  Circle,
  CheckCircle,
  Book,
} from 'lucide-react';
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

export const TrelloExportPanel: React.FC<TrelloExportPanelProps> = ({ userExamDate }) => {
  const { showToast } = useToast();
  const [showInstructions, setShowInstructions] = useState(false);
  const [examDate, setExamDate] = useState<string>(userExamDate?.toISOString().split('T')[0] || '');

  // Generate board structure
  const board = useMemo<TrelloBoardExport | null>(() => {
    if (!examDate) return null;

    const date = new Date(examDate);
    const plan = generateStudyPlan(date);
    return generateStudyBoard(date, plan);
  }, [examDate]);

  const handleDownloadJSON = () => {
    if (!board) {
      showToast({
        type: 'warning',
        message: 'Please set an exam date to generate your study board.',
      });
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
    <div className="bg-[var(--color-bg-secondary)] rounded-xl shadow-sm p-6 border border-[var(--color-border)]">
      <div className="flex items-center gap-3 mb-4">
        <Trello className="w-6 h-6 text-[var(--color-accent)]" />
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Trello Board Export</h2>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Transform your study plan into a visual Kanban board in Trello. Track your progress as you
        move through each study phase.
      </p>

      {/* Exam Date Input */}
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

      {/* Board Preview */}
      {board && (
        <div className="mb-6 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Board Preview:
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-3xl font-bold text-[var(--color-accent)]">
                {boardStats.lists}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Lists</div>
            </div>
            <div className="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <div className="text-3xl font-bold text-[var(--color-accent-secondary)]">
                {boardStats.cards}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Cards</div>
            </div>
          </div>

          {/* List preview */}
          <div className="space-y-2">
            {board.lists.slice(0, 3).map((list, idx) => (
              <div
                key={idx}
                className="p-2 bg-[var(--color-bg-secondary)] rounded border border-[var(--color-border)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {list.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {list.cards.length} cards
                  </span>
                </div>
              </div>
            ))}
            {board.lists.length > 3 && (
              <div className="text-xs text-center text-[var(--color-text-muted)]">
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
          className="w-full px-6 py-3 bg-[var(--color-accent)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download Board JSON
        </button>

        <button
          onClick={handleOpenTrello}
          className="w-full px-6 py-3 bg-[var(--color-accent-secondary)] text-[var(--color-text-inverse)] rounded-xl font-semibold hover:opacity-90 transition-colors flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-5 h-5" />
          Create Board in Trello
        </button>
      </div>

      {/* Instructions Toggle */}
      <button
        onClick={() => setShowInstructions(!showInstructions)}
        className="w-full mb-4 px-4 py-2 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors flex items-center justify-center gap-2"
      >
        <Info className="w-4 h-4" />
        {showInstructions ? 'Hide' : 'Show'} Setup Instructions
      </button>

      {/* Instructions */}
      {showInstructions && (
        <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-xs text-[var(--color-text-secondary)]">
              {TRELLO_IMPORT_INSTRUCTIONS}
            </pre>
          </div>
        </div>
      )}

      {/* Feature Highlight */}
      <div className="mt-6 p-4 bg-[var(--color-accent-light)] rounded-lg border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Why Trello?
        </h3>
        <ul className="text-xs text-[var(--color-text-secondary)] space-y-1">
          <li>• Visual Kanban board for tracking progress</li>
          <li>• Drag-and-drop cards as you complete topics</li>
          <li>• Color-coded labels for different organ systems</li>
          <li>• Checklists for breaking down study sessions</li>
          <li>• Mobile app for studying on the go</li>
          <li>• Collaborate with study partners</li>
        </ul>
      </div>

      {/* Board Structure Info */}
      <div className="mt-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 flex items-center gap-2">
          <Pin className="w-4 h-4" /> Your Board Will Include:
        </h3>
        <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-[var(--color-accent)] flex-shrink-0" />
            <span>
              <span className="font-semibold">Exam Overview:</span> Key dates and study plan summary
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
            <span>
              <span className="font-semibold">To Do:</span> Upcoming study weeks
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-data-provisional flex-shrink-0" />
            <span>
              <span className="font-semibold">In Progress:</span> Current week&apos;s focus
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Circle className="w-3.5 h-3.5 text-data-fail flex-shrink-0" />
            <span>
              <span className="font-semibold">Weak Areas:</span> Topics needing more attention
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-data-pass flex-shrink-0" />
            <span>
              <span className="font-semibold">Completed:</span> Finished modules
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Book className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span>
              <span className="font-semibold">Resources:</span> Study materials
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
