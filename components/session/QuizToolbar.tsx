/**
 * QuizToolbar — Extracted from QuizView.tsx
 *
 * Renders the sticky header bar during a quiz session:
 * - Back link + mode label + question number
 * - Momentum badge, streak badge, question timer
 * - Session time remaining
 * - Toolbar buttons: Stats, Flag, Normal Labs, Overflow menu (Report, Highlights, Calc, Font size), End Session
 * - Full sit-down test progress bar
 * - Replenishment error banner
 */

import React, { useRef, useEffect } from 'react';
import { BackLink } from '@/components/navigation/BackLink';
import { ROUTES } from '@/config/routes';
import { CloseIcon } from '@/components/icons/CloseIcon';
import { FlagIcon } from '@/components/icons/FlagIcon';
import { ClearHighlightIcon } from '@/components/icons/ClearHighlightIcon';
import {
  MomentumBadge,
  StreakBadge,
  QuestionTimer,
} from '@/components/quiz';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Calculator,
  Clock,
  MoreHorizontal,
} from 'lucide-react';

export interface QuizToolbarProps {
  questionNumber: number;
  isFullSitDownTest: boolean;
  totalQuestions?: number;
  modeLabel?: string;
  behavioralRefreshKey: number;
  currentStreak: number;
  questionStartTime: number;
  parTimeMs: number | null;
  isAnswered: boolean;
  showTimerVisible: boolean;
  isCommuterMode: boolean;
  timeRemainingMs: number | null;
  showStatsOverlay: boolean;
  onToggleStatsOverlay: () => void;
  isFlagged: boolean;
  onToggleFlag: () => void;
  showNormalLabsPanel: boolean;
  onToggleNormalLabs: () => void;
  onShowReportModal: () => void;
  onShowLabCalcModal: () => void;
  fontSizeAdjustment: number;
  setFontSizeAdjustment: React.Dispatch<React.SetStateAction<number>>;
  onEndSession: () => void;
  replenishmentError: string | null;
  onRetryReplenish: () => void;
  currentQuestion: { id?: string } | null;
}

const QuizToolbar: React.FC<QuizToolbarProps> = ({
  questionNumber,
  isFullSitDownTest,
  totalQuestions,
  modeLabel,
  behavioralRefreshKey,
  currentStreak,
  questionStartTime,
  parTimeMs,
  isAnswered,
  showTimerVisible,
  isCommuterMode,
  timeRemainingMs,
  showStatsOverlay,
  onToggleStatsOverlay,
  isFlagged,
  onToggleFlag,
  showNormalLabsPanel,
  onToggleNormalLabs,
  onShowReportModal,
  onShowLabCalcModal,
  fontSizeAdjustment,
  setFontSizeAdjustment,
  onEndSession,
  replenishmentError,
  onRetryReplenish,
  currentQuestion,
}) => {
  const [showOverflowMenu, setShowOverflowMenu] = React.useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on click outside or Escape key
  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOverflowMenu(false);
        // Return focus to the trigger button
        const trigger = overflowMenuRef.current?.querySelector('button');
        trigger?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showOverflowMenu]);

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4 mt-1">
        <div className="flex items-center space-x-3 min-w-0">
          {/* Back to Practice */}
          {!isFullSitDownTest && (
            <BackLink
              to={ROUTES.PRACTICE}
              label="Back to Practice"
              className="rounded-full bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] flex-shrink-0"
            />
          )}
          {modeLabel && (
            <span
              className="text-sm text-[var(--color-text-muted)] truncate hidden sm:inline"
              aria-hidden
            >
              {modeLabel}
            </span>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium text-[var(--color-text-muted)] truncate">
              Question {questionNumber}
            </h1>
            {/* Momentum Badge (compact) */}
            {questionNumber > 3 && <MomentumBadge refreshKey={behavioralRefreshKey} />}
            {/* Streak Badge */}
            {currentStreak >= 3 && <StreakBadge streak={currentStreak} />}
            {/* Question Timer — hidden in Commuter Mode */}
            {currentQuestion && !isCommuterMode && (
              <QuestionTimer
                startTime={questionStartTime}
                parTimeMs={parTimeMs}
                isAnswered={isAnswered}
                isVisible={showTimerVisible}
                compact
              />
            )}
            {/* Time-box session timer — hidden in Commuter Mode */}
            {!isCommuterMode && timeRemainingMs !== null && timeRemainingMs > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
                <Clock className="w-3.5 h-3.5 text-[var(--color-text-primary)]" />
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {Math.ceil(timeRemainingMs / 60000)} min
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Session Stats Toggle — hidden on mobile (available in overflow) */}
          <button
            onClick={onToggleStatsOverlay}
            title="Toggle session stats (S)"
            aria-label="Toggle session stats"
            aria-pressed={showStatsOverlay}
            className={`hidden md:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors border ${
              showStatsOverlay
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]'
            }`}
          >
            <BarChart3 className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Flag for personal review */}
          <button
            onClick={onToggleFlag}
            title={isFlagged ? 'Unflag for review' : 'Flag for review'}
            aria-label={isFlagged ? 'Unflag for review' : 'Flag for review'}
            aria-pressed={isFlagged}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors border ${
              isFlagged
                ? 'bg-data-provisional/10 text-data-provisional border-data-provisional'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]'
            }`}
          >
            <FlagIcon className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Normal Labs reference — hidden on mobile (available in overflow) */}
          <button
            onClick={onToggleNormalLabs}
            title="Normal Labs reference"
            aria-label="Toggle Normal Labs reference"
            aria-pressed={showNormalLabsPanel}
            className={`hidden md:flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors border ${
              showNormalLabsPanel
                ? 'bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] border-[var(--color-accent)]'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]'
            }`}
          >
            <Beaker className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Overflow menu — secondary actions */}
          <div className="relative" ref={overflowMenuRef}>
            <button
              onClick={() => setShowOverflowMenu((prev) => !prev)}
              title="More actions"
              aria-label="More actions"
              aria-expanded={showOverflowMenu}
              aria-haspopup="menu"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors border ${
                showOverflowMenu
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] border-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            </button>
            {showOverflowMenu && (
              <div
                role="menu"
                aria-label="More actions"
                className="absolute right-0 top-full mt-1 w-56 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1 animate-fade-in"
              >
                {/* Mobile-only: Session Stats — has dedicated button on desktop */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onToggleStatsOverlay();
                    setShowOverflowMenu(false);
                  }}
                  className="md:hidden w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <BarChart3 className="w-4 h-4" aria-hidden="true" />
                  {showStatsOverlay ? 'Hide Session Stats' : 'Session Stats'}
                </button>
                {/* Mobile-only: Normal Labs — has dedicated button on desktop */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onToggleNormalLabs();
                    setShowOverflowMenu(false);
                  }}
                  className="md:hidden w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <Beaker className="w-4 h-4" aria-hidden="true" />
                  Normal Labs
                </button>
                {/* Divider between mobile-only and always-visible items */}
                <div className="md:hidden border-t border-[var(--color-border)] my-1" />
                {/* Report Issue */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onShowReportModal();
                    setShowOverflowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <AlertTriangle className="w-4 h-4 text-data-fail" aria-hidden="true" />
                  Report Issue
                </button>
                {/* Clear Highlights */}
                <button
                  role="menuitem"
                  onClick={() => {
                    const container = document.getElementById('question-container');
                    if (!container) return;
                    const spans = container.querySelectorAll('span.user-highlight');
                    spans.forEach((s) => {
                      const parent = s.parentNode;
                      if (!parent) return;
                      while (s.firstChild) {
                        parent.insertBefore(s.firstChild, s);
                      }
                      parent.removeChild(s);
                    });
                    setShowOverflowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <ClearHighlightIcon className="w-4 h-4" aria-hidden="true" />
                  Clear Highlights
                </button>
                {/* Lab Calculators */}
                <button
                  role="menuitem"
                  onClick={() => {
                    onShowLabCalcModal();
                    setShowOverflowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                >
                  <Calculator className="w-4 h-4 text-[var(--color-text-primary)]" aria-hidden="true" />
                  Lab Calculators
                </button>
                {/* Font size controls */}
                <div className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)]">Font Size</span>
                  <div className="ml-auto flex items-center border border-[var(--color-border)] rounded-md bg-[var(--color-bg-secondary)]">
                    <button
                      onClick={() => setFontSizeAdjustment((prev) => prev - 1)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-l-md text-sm font-medium"
                      aria-label="Decrease font size"
                    >
                      A−
                    </button>
                    <div className="w-px h-5 bg-[var(--color-border)]"></div>
                    <button
                      onClick={() => setFontSizeAdjustment((prev) => prev + 1)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded-r-md text-sm font-medium"
                      aria-label="Increase font size"
                    >
                      A+
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* End session */}
          {!isFullSitDownTest && (
            <button
              onClick={onEndSession}
              title="End Session"
              aria-label="End Session"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-data-fail/10 hover:border-data-fail hover:text-data-fail transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      {isFullSitDownTest && (
        <div className="mt-4 mb-4">
          <Progress value={((questionNumber - 1) / (totalQuestions || 300)) * 100} />
          <div className="flex justify-between text-sm text-[var(--color-text-muted)] mt-1">
            <span>
              Question {questionNumber} of {totalQuestions || 300}
            </span>
            <span>
              {Math.round(((questionNumber - 1) / (totalQuestions || 300)) * 100)}%
            </span>
          </div>
        </div>
      )}
      {replenishmentError && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-data-provisional/50 bg-data-provisional/10 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          <span>{replenishmentError}</span>
          <button
            type="button"
            onClick={onRetryReplenish}
            className="flex-shrink-0 rounded-md px-3 py-1 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/10"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizToolbar;
