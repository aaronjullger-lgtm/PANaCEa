/**
 * CommandCenterPage - Training Command Center Dedicated Page
 *
 * Hub for accessing all training modes and resources
 * Replaces the modal flow with a dedicated route at /training/command-center
 */

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
// ChevronLeft removed — back navigation handled by NavRail home icon in this view
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
  onNavigateToSrsReview?: () => void;
  onOpenSettings?: () => void;
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
  onNavigateToSrsReview,
  onOpenSettings,
  onBack: _onBack,
}) => {
  useEffect(() => { document.title = 'Command Center | PANaCEa'; }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] py-6 px-4">
      <div className="mx-auto" style={{ maxWidth: 'var(--content-max-width, 72rem)' }}>
        {/* Header */}
        <motion.div
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          className="mb-6"
        >
          <h1 className="text-display-sm font-bold text-[var(--color-text-primary)]" style={{ letterSpacing: '-0.025em' }}>
            Training Command Center
          </h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Your mission control for {examLabel} preparation
          </p>
        </motion.div>

        {/* Command Center Hub */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
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
            onNavigateToSrsReview={onNavigateToSrsReview ?? (() => {})}
            onOpenSettings={onOpenSettings}
          />
        </motion.div>
      </div>
    </div>
  );
};
