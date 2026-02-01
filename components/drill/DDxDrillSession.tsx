/**
 * DDxDrillSession - Differential Diagnosis drill mode
 *
 * Quiz on must-not-miss diagnoses, most common causes, distinguishing features,
 * and red flags for various presenting complaints.
 */

import React, { useState, useCallback } from 'react';
import { Stethoscope, AlertTriangle, Activity, Target } from 'lucide-react';
import MiniDrillLayout, { QuestionCard, AnswerOption } from './MiniDrillLayout';
import { EnhancedFeedbackPanel } from './EnhancedFeedbackPanel';
import { DrillLandingPage } from './DrillLandingPage';
import { QuestionSkeleton } from '@/components/loading/SkeletonLoader';
import { useDifferentialDrill } from '@/hooks/game/use-ddx-drill';
import { getDrillLandingStats, DrillType } from '@/services/analytics';

interface DDxDrillSessionProps {
  onExit?: () => void;
}

const QUESTION_TYPE_LABELS = {
  mustNotMiss: {
    label: 'Must Not Miss',
    icon: AlertTriangle,
    className: 'bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]',
  },
  mostCommon: {
    label: 'Most Common',
    icon: Activity,
    className: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  },
  distinguishing: {
    label: 'Distinguishing Feature',
    icon: Target,
    className: 'bg-[var(--color-data-provisional)]/10 text-[var(--color-data-provisional)]',
  },
  redFlag: {
    label: 'Red Flag',
    icon: AlertTriangle,
    className: 'bg-[var(--color-data-fail)]/10 text-[var(--color-data-fail)]',
  },
  workup: {
    label: 'Workup',
    icon: Stethoscope,
    className: 'bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]',
  },
};

const DDxDrillSession: React.FC<DDxDrillSessionProps> = ({ onExit }) => {
  const drill = useDifferentialDrill();
  const stats = getDrillLandingStats('ddx_drill' as DrillType);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const handleDeepDive = useCallback((topic: string) => {
    console.log('Deep dive into:', topic);
    // Could open a modal, navigate to reference library, etc.
  }, []);

  // Landing page
  if (drill.status === 'landing') {
    return (
      <DrillLandingPage
        title="Differential Diagnosis Drill"
        description="Master the differential diagnosis for common presenting complaints"
        icon={Stethoscope}
        accentColor="indigo"
        stats={stats}
        onStart={() => drill.startSession(selectedCategory)}
        onExit={onExit}
        instructions={[
          'Identify must-not-miss diagnoses',
          'Recognize the most common causes',
          'Learn distinguishing features between conditions',
          'Spot red flags requiring urgent evaluation',
        ]}
        objectives={[
          'Build systematic DDx approach',
          'Prioritize dangerous diagnoses',
          'Recognize clinical patterns',
          'Prepare for PANCE clinical scenarios',
        ]}
        estimatedMinutes={12}
      >
        {drill.availableCategories.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Filter by System (Optional)
            </label>
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory(e.target.value || undefined)}
              className="w-full p-2 border border-[var(--color-border)] rounded-lg 
                         bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
            >
              <option value="">All Systems</option>
              {drill.availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </DrillLandingPage>
    );
  }

  // Loading state
  if (drill.status === 'loading') {
    return (
      <MiniDrillLayout
        title="DDx Drill"
        score={0}
        totalAttempts={0}
        streak={0}
        isFeedback={false}
        isCorrect={null}
        onExit={drill.exitToMenu}
        onReset={drill.reset}
      >
        <QuestionSkeleton />
      </MiniDrillLayout>
    );
  }

  // Error state
  if (drill.status === 'error') {
    return (
      <MiniDrillLayout
        title="DDx Drill"
        score={drill.score}
        totalAttempts={drill.totalAttempts}
        streak={drill.streak}
        isFeedback={false}
        isCorrect={null}
        onExit={drill.exitToMenu}
        onReset={drill.reset}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-[var(--color-data-fail)] mx-auto mb-4" />
            <p className="text-[var(--color-data-fail)] mb-4">{drill.error}</p>
            <button
              onClick={() => drill.startSession(selectedCategory)}
              className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        </div>
      </MiniDrillLayout>
    );
  }

  // Complete state
  if (drill.status === 'complete') {
    const accuracy =
      drill.totalAttempts > 0 ? Math.round((drill.score / drill.totalAttempts) * 100) : 0;

    return (
      <MiniDrillLayout
        title="DDx Drill"
        score={drill.score}
        totalAttempts={drill.totalAttempts}
        streak={drill.streak}
        isFeedback={false}
        isCorrect={null}
        onExit={drill.exitToMenu}
        onReset={drill.reset}
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
              Session Complete!
            </h2>
            <p className="text-lg text-[var(--color-text-secondary)] mb-4">
              Score: {drill.score}/{drill.totalAttempts} ({accuracy}%)
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => drill.startSession(selectedCategory)}
                className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-lg hover:opacity-90"
              >
                Play Again
              </button>
              <button
                onClick={drill.exitToMenu}
                className="px-6 py-2 border border-[var(--color-border)] rounded-lg 
                           text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </MiniDrillLayout>
    );
  }

  const isFeedback = drill.status === 'feedback';
  const question = drill.currentQuestion;

  if (!question) {
    return null;
  }

  const typeInfo = QUESTION_TYPE_LABELS[question.questionType];
  const TypeIcon = typeInfo.icon;

  return (
    <MiniDrillLayout
      title="DDx Drill"
      score={drill.score}
      totalAttempts={drill.totalAttempts}
      streak={drill.streak}
      isFeedback={isFeedback}
      isCorrect={drill.isCorrect}
      onExit={drill.exitToMenu}
      onReset={drill.reset}
      footer={
        isFeedback && question ? (
          <EnhancedFeedbackPanel
            isCorrect={drill.isCorrect || false}
            explanation={question.explanation}
            onNext={drill.nextQuestion}
            nextLabel="Next Question"
            category="finding"
            tags={['ddx', question.category, question.presentingComplaint, question.questionType]}
            onDeepDive={handleDeepDive}
          />
        ) : null
      }
    >
      {/* Question Type Badge */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${typeInfo.className}`}
        >
          <TypeIcon className="w-4 h-4" />
          {typeInfo.label}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">{question.category}</span>
      </div>

      {/* Presenting Complaint Context */}
      <div className="bg-[var(--color-accent)]/10 rounded-lg p-3 mb-4">
        <p className="text-sm text-[var(--color-accent)]">
          <span className="font-semibold">Presenting Complaint:</span>{' '}
          {question.presentingComplaint}
        </p>
      </div>

      {/* Question Card */}
      <QuestionCard question={question.questionText} />

      {/* Answer Options */}
      <div className="space-y-3">
        {question.options.map((option, index) => (
          <AnswerOption
            key={index}
            text={option}
            index={index}
            isSelected={drill.userAnswerIndex === index}
            isCorrect={isFeedback ? index === question.correctIndex : null}
            isAnswered={isFeedback}
            onSelect={drill.submitAnswer}
          />
        ))}
      </div>
    </MiniDrillLayout>
  );
};

export default DDxDrillSession;
