/**
 * CommandCenterPage - Training Command Center Dedicated Page
 *
 * Hub for accessing all training modes and resources
 * Replaces the modal flow with a dedicated route at /training/command-center
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { CommandCenterHub } from '../components/navigation/CommandCenterHub';
import type { PerformanceRecord, Question, SessionSettings } from '../types';

interface CommandCenterPageProps {
  performanceData: PerformanceRecord[];
  missedQuestions: Question[];
  flaggedQuestions: Question[];
  growthAreas: string[];
  dueCount?: number;
  examLabel?: string;
  onStartSession: (settings?: SessionSettings) => void | Promise<void>;
  onNavigateToDrillMode: (modeId: string) => void;
  onNavigateToToolkit?: () => void;
  onNavigateToGapAnalysis?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToReference?: () => void;
  onNavigateToMyLibrary?: () => void;
  onNavigateToStudyCompanion?: () => void;
  onNavigateToSrsFlashcards?: () => void;
  onBack: () => void;
}

export const CommandCenterPage: React.FC<CommandCenterPageProps> = ({
  performanceData,
  missedQuestions,
  flaggedQuestions,
  growthAreas,
  dueCount,
  examLabel = 'PANCE',
  onStartSession,
  onNavigateToDrillMode,
  onNavigateToToolkit,
  onNavigateToGapAnalysis,
  onNavigateToIntegrations,
  onNavigateToReference,
  onNavigateToMyLibrary,
  onNavigateToStudyCompanion,
  onNavigateToSrsFlashcards,
  onBack,
}) => {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            Training Command Center
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Your mission control for {examLabel} preparation
          </p>
        </motion.div>

        {/* Command Center Hub */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <CommandCenterHub
            performanceData={performanceData}
            missedQuestions={missedQuestions}
            flaggedQuestions={flaggedQuestions}
            growthAreas={growthAreas}
            dueCount={dueCount}
            examLabel={examLabel}
            onStartSession={onStartSession}
            onNavigateToDrillMode={onNavigateToDrillMode}
            onNavigateToToolkit={onNavigateToToolkit ?? (() => {})}
            onNavigateToGapAnalysis={onNavigateToGapAnalysis ?? (() => {})}
            onNavigateToIntegrations={onNavigateToIntegrations ?? (() => {})}
            onNavigateToReference={onNavigateToReference ?? (() => {})}
            onNavigateToMyLibrary={onNavigateToMyLibrary ?? (() => {})}
            onNavigateToStudyCompanion={onNavigateToStudyCompanion ?? (() => {})}
            onNavigateToSrsFlashcards={onNavigateToSrsFlashcards ?? (() => {})}
          />
        </motion.div>
      </div>
    </div>
  );
};
