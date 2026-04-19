/**
 * PhysiologyDrillSession - Organ system physiology review drill
 *
 * Multiple-choice questions covering physiology concepts across organ systems.
 * Enhanced with database-linked reference material in feedback panels.
 */

import React, { useCallback, useState } from 'react';
import { Activity } from 'lucide-react';
import MiniDrillLayout, { QuestionCard, AnswerOption } from './MiniDrillLayout';
import { EnhancedFeedbackPanel } from './EnhancedFeedbackPanel';
import { DrillLandingPage } from './DrillLandingPage';
import { usePhysiologyDrill } from '@/hooks/game/use-physiology-drill';
import { getDrillLandingStats } from '@/services/analytics';
import DrillShell from './DrillShell';
import DrillSummaryCard from './DrillSummaryCard';
import { ROUTES } from '@/config/routes';

interface PhysiologyDrillSessionProps {
  onExit?: () => void;
  onNavigateToReference?: (type: string, id: string) => void;
}

const PhysiologyDrillSession: React.FC<PhysiologyDrillSessionProps> = ({
  onExit,
  onNavigateToReference,
}) => {
  const [showSummary, setShowSummary] = useState(false);
  const drill = usePhysiologyDrill();
  const stats = getDrillLandingStats('physiology_drill');

  const handleExit = useCallback(() => {
    if (drill.totalAttempts > 0 && !showSummary) {
      setShowSummary(true);
      return;
    }
    drill.exitToMenu();
    onExit?.();
  }, [drill.totalAttempts, showSummary, drill.exitToMenu, onExit]);

  // Handler for deep dive into reference material
  const handleDeepDive = useCallback(
    (type: string, id: string) => {
      if (onNavigateToReference) {
        onNavigateToReference(type, id);
      }
    },
    [onNavigateToReference]
  );

  // Summary
  if (showSummary) {
    return (
      <DrillShell
        title="Physiology Review — Complete"
        breadcrumb={['Drills', 'Physiology', 'Results']}
        onBackToHub={() => { drill.exitToMenu(); onExit?.(); }}
        backTo={ROUTES.PRACTICE}
      >
        <DrillSummaryCard
          drillName="Physiology Review"
          icon={Activity}
          accentColor="var(--color-accent)"
          stats={{ correct: drill.score, total: drill.totalAttempts, streak: drill.streak }}
          onNewSession={() => { setShowSummary(false); drill.reset(); drill.startSession(); }}
          onExit={() => { drill.exitToMenu(); onExit?.(); }}
          newSessionLabel="Play Again"
        />
      </DrillShell>
    );
  }

  // Landing page
  if (drill.status === 'landing') {
    return (
      <DrillShell
        title="Physiology Review"
        breadcrumb={['Drills', 'Physiology']}
        onBackToHub={handleExit}
        backTo={ROUTES.PRACTICE}
        hideBreadcrumb
      >
        <DrillLandingPage
          title="Physiology Review"
          description="Master organ system physiology"
          icon={Activity}
          accentColor="purple"
          stats={stats}
          onStart={drill.startSession}
          onExit={handleExit}
          instructions={[
            'Review fundamental physiology concepts',
            'Cover all major organ systems',
            'Connect structure to function',
            'Apply physiologic principles clinically',
          ]}
          objectives={[
            'Master key physiologic mechanisms',
            'Understand organ system interactions',
            'Build foundation for clinical reasoning',
            'Prepare for PANCE physiology questions',
          ]}
          estimatedMinutes={10}
        />
      </DrillShell>
    );
  }

  const isFeedback = drill.status === 'feedback';

  return (
    <MiniDrillLayout
      title="Physiology Review"
      score={drill.score}
      totalAttempts={drill.totalAttempts}
      streak={drill.streak}
      isFeedback={isFeedback}
      isCorrect={drill.isCorrect}
      onExit={handleExit}
      onReset={drill.reset}
      footer={
        isFeedback && drill.currentQuestion ? (
          <EnhancedFeedbackPanel
            isCorrect={drill.isCorrect!}
            correctAnswer={drill.currentQuestion.options[drill.currentQuestion.correctIndex]}
            explanation={drill.currentQuestion.explanation}
            userAnswer={
              drill.userAnswerIndex !== null
                ? drill.currentQuestion.options[drill.userAnswerIndex]
                : null
            }
            onNext={drill.nextQuestion}
            category="physiology"
            tags={drill.currentQuestion.tags || []}
            relatedConceptId={drill.currentQuestion.system}
            onDeepDive={onNavigateToReference ? handleDeepDive : undefined}
            nextReview={drill.fsrsNextReview}
          />
        ) : undefined
      }
    >
      {/* Question Card */}
      {drill.currentQuestion && (
        <QuestionCard
          question={drill.currentQuestion.question}
          category={drill.currentQuestion.system}
        />
      )}

      {/* Answer Options */}
      <div className="space-y-3 mt-6" role="radiogroup" aria-label="Answer options">
        {drill.currentQuestion?.options.map((option, index) => (
          <AnswerOption
            key={index}
            index={index}
            text={option}
            isSelected={drill.userAnswerIndex === index}
            isCorrect={isFeedback ? index === drill.currentQuestion?.correctIndex : null}
            isAnswered={isFeedback}
            onSelect={drill.submitAnswer}
          />
        ))}
      </div>
    </MiniDrillLayout>
  );
};

export default PhysiologyDrillSession;
