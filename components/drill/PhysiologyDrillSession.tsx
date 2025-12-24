/**
 * PhysiologyDrillSession - Organ system physiology review drill
 * 
 * Multiple-choice questions covering physiology concepts across organ systems.
 */

import React from 'react';
import { Activity } from 'lucide-react';
import MiniDrillLayout, { QuestionCard, AnswerOption, FeedbackPanel } from './MiniDrillLayout';
import { DrillLandingPage } from './DrillLandingPage';
import { usePhysiologyDrill } from '@/hooks/game/use-physiology-drill';
import { getDrillLandingStats } from '@/services/drillStatsService';

interface PhysiologyDrillSessionProps {
  onExit?: () => void;
}

const PhysiologyDrillSession: React.FC<PhysiologyDrillSessionProps> = ({ onExit }) => {
  const drill = usePhysiologyDrill();
  const stats = getDrillLandingStats('physiology_drill');

  // Landing page
  if (drill.status === 'landing') {
    return (
      <DrillLandingPage
        title="Physiology Review"
        description="Master organ system physiology"
        icon={Activity}
        accentColor="purple"
        stats={stats}
        onStart={drill.startSession}
        onExit={onExit}
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
      onExit={drill.exitToMenu}
      onReset={drill.reset}
      footer={
        isFeedback && drill.currentQuestion ? (
          <FeedbackPanel
            isCorrect={drill.isCorrect!}
            correctAnswer={drill.currentQuestion.options[drill.currentQuestion.correctIndex]}
            explanation={drill.currentQuestion.explanation}
            userAnswer={drill.userAnswerIndex !== null ? drill.currentQuestion.options[drill.userAnswerIndex] : null}
            onNext={drill.nextQuestion}
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

export default PhysiologyDrillSession;
