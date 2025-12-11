import React, { useState } from 'react';
import type { SessionSettings } from '../types';
import { InfoIcon } from './icons/InfoIcon';

interface SessionSetupModalProps {
  onClose: () => void;
  onStart: (settings: SessionSettings) => void;
  growthAreas: string[];
  dueQuestionsCount: number;
  flaggedQuestionsCount: number;
}

type Focus = SessionSettings['focus'];
type Difficulty = SessionSettings['difficulty'];

// FIX: Use React.PropsWithChildren for better type definition of components with children.
type ToggleButtonProps = {
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
  title?: string;
};

const ToggleButton = ({ children, onClick, isActive, disabled = false, title = "" }: React.PropsWithChildren<ToggleButtonProps>) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`px-4 py-2 rounded-md font-semibold text-sm transition-colors ${
      isActive 
        ? 'bg-[var(--color-accent)] text-white dark:text-slate-900' 
        : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const SessionSetupModal: React.FC<SessionSetupModalProps> = ({ onClose, onStart, growthAreas, dueQuestionsCount, flaggedQuestionsCount }) => {
  const [focus, setFocus] = useState<Focus>('all');
  const [difficulty, setDifficulty] = useState<Difficulty>('same');

  const canSelectGrowth = growthAreas.length > 0;
  const canSelectReview = dueQuestionsCount > 0;
  const canSelectFlagged = flaggedQuestionsCount > 0;

  const handleStart = () => {
    onStart({ focus, difficulty });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">New Study Session</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Customize your practice quiz.</p>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Focus</h3>
            <div className="flex flex-wrap gap-2">
              <ToggleButton isActive={focus === 'all'} onClick={() => setFocus('all')}>
                All Topics
              </ToggleButton>
              <ToggleButton 
                isActive={focus === 'growth'} 
                onClick={() => setFocus('growth')}
                disabled={!canSelectGrowth}
                title={!canSelectGrowth ? "No topics need focused review. Great job!" : `Focus on ${growthAreas.length} growth area(s)`}
              >
                Growth Areas
              </ToggleButton>
              <ToggleButton 
                isActive={focus === 'review'} 
                onClick={() => setFocus('review')}
                disabled={!canSelectReview}
                title={!canSelectReview ? "No questions are due for review today" : `Review ${dueQuestionsCount} due questions`}
              >
                Review Due ({dueQuestionsCount})
              </ToggleButton>
              <ToggleButton 
                isActive={focus === 'reviewFlagged'} 
                onClick={() => setFocus('reviewFlagged')}
                disabled={!canSelectFlagged}
                title={!canSelectFlagged ? "No questions have been flagged for review" : `Review ${flaggedQuestionsCount} flagged questions`}
              >
                Review Flagged ({flaggedQuestionsCount})
              </ToggleButton>
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">Difficulty</h3>
              <div className="relative group">
                <InfoIcon className="w-5 h-5 text-slate-400 dark:text-slate-500"/>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                  <strong className="font-semibold block text-sm">Difficulty Guide</strong>
                  <span className="block mt-1"><strong className="font-semibold text-blue-400">Easier:</strong> Focuses on more common, foundational concepts.</span>
                  <span className="block mt-1"><strong className="font-semibold text-blue-400">Harder:</strong> Generates more complex, multi-step questions requiring deeper knowledge.</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ToggleButton isActive={difficulty === 'easier'} onClick={() => setDifficulty('easier')}>
                Easier
              </ToggleButton>
              <ToggleButton isActive={difficulty === 'same'} onClick={() => setDifficulty('same')}>
                PANCE-level
              </ToggleButton>
              <ToggleButton isActive={difficulty === 'harder'} onClick={() => setDifficulty('harder')}>
                Harder
              </ToggleButton>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="px-5 py-2 rounded-lg font-semibold text-white dark:text-slate-900 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors shadow-md hover:shadow-lg"
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionSetupModal;
