/**
 * AnatomyDrillSession - Regional anatomy review drill
 *
 * Multiple-choice questions covering anatomical structures and clinical correlates.
 * Enhanced with database-linked reference material in feedback panels.
 *
 * @verified-clean Design tokens compliant - no violations found
 */

import React, { useCallback } from 'react';
import { Bone } from 'lucide-react';
import MiniDrillLayout, { QuestionCard, AnswerOption } from './MiniDrillLayout';
import { EnhancedFeedbackPanel } from './EnhancedFeedbackPanel';
import { DrillLandingPage } from './DrillLandingPage';
import { useAnatomyDrill } from '@/hooks/game/use-anatomy-drill';
import { getDrillLandingStats } from '@/services/analytics';

interface AnatomyDrillSessionProps {
  onExit?: () => void;
  onNavigateToReference?: (type: string, id: string) => void;
}

const AnatomyDrillSession: React.FC<AnatomyDrillSessionProps> = ({
  onExit,
  onNavigateToReference,
}) => {
  const drill = useAnatomyDrill();
  const stats = getDrillLandingStats('anatomy_review');

  // Handler for deep dive into reference material
  const handleDeepDive = useCallback(
    (type: string, id: string) => {
      if (onNavigateToReference) {
        onNavigateToReference(type, id);
      }
    },
    [onNavigateToReference]
  );

  // Landing page
  if (drill.status === 'landing') {
    return (
      <DrillLandingPage
        title="Anatomy Review"
        description="Master regional anatomy with clinical correlates"
        icon={Bone}
        accentColor="slate"
        stats={stats}
        onStart={drill.startSession}
        onExit={onExit}
        instructions={[
          'Review anatomical structures by region',
          'Connect anatomy to clinical presentations',
          'Master high-yield anatomical relationships',
          'Apply anatomical knowledge to patient care',
        ]}
        objectives={[
          'Solidify regional anatomy knowledge',
          'Understand clinically relevant structures',
          'Recognize anatomical landmarks',
          'Prepare for PANCE anatomy questions',
        ]}
        estimatedMinutes={10}
      />
    );
  }

  const isFeedback = drill.status === 'feedback';

  return (
    <MiniDrillLayout
      title="Anatomy Review"
      score={drill.score}
      totalAttempts={drill.totalAttempts}
      streak={drill.streak}
      isFeedback={isFeedback}
      isCorrect={drill.isCorrect}
      onExit={drill.exitToMenu}
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
            category="anatomy"
            tags={drill.currentQuestion.tags || []}
            relatedConceptId={drill.currentQuestion.region}
            onDeepDive={onNavigateToReference ? handleDeepDive : undefined}
          />
        ) : undefined
      }
    >
      {/* Question Card */}
      {drill.currentQuestion && (
        <QuestionCard
          question={drill.currentQuestion.question}
          category={drill.currentQuestion.region}
        />
      )}

      {/* Answer Options */}
      <div className="space-y-3 mt-6">
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

export default AnatomyDrillSession;
