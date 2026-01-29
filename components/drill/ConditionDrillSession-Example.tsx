/**
 * Example: ConditionDrillSession with Database-Driven Registry
 *
 * This component demonstrates how to use the new DrillSetup component
 * with the database-driven condition registry.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DrillSetup, type DrillConfiguration } from './DrillSetup';
import { Brain, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import type { SystemCode } from '../../types';

interface ConditionDrillSessionProps {
  onExit: () => void;
}

type DrillPhase = 'setup' | 'active' | 'complete';

interface QuestionData {
  condition: string;
  system: SystemCode;
  question: string;
  options: string[];
  correctIndex: number;
}

const ConditionDrillSession: React.FC<ConditionDrillSessionProps> = ({ onExit }) => {
  const [phase, setPhase] = useState<DrillPhase>('setup');
  const [config, setConfig] = useState<DrillConfiguration | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Handle drill start from setup
  const handleDrillStart = (drillConfig: DrillConfiguration) => {
    console.log('Starting drill with config:', drillConfig);
    console.log('Available conditions:', drillConfig.availableConditions.length);

    setConfig(drillConfig);
    setPhase('active');

    // In a real implementation, you would:
    // 1. Use drillConfig.availableConditions to pick random conditions
    // 2. Call geminiService to generate questions for those conditions
    // 3. Filter by drillConfig.system if specified
    // 4. Set difficulty to drillConfig.difficulty
  };

  // Mock question generation (in real app, this would use geminiService)
  const generateMockQuestion = (): QuestionData => {
    if (!config || config.availableConditions.length === 0) {
      return {
        condition: 'Mock Condition',
        system: 'CV',
        question: 'Preparing question...',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 0,
      };
    }

    // Pick a random condition from the filtered pool
    const randomCondition =
      config.availableConditions[Math.floor(Math.random() * config.availableConditions.length)];

    if (!randomCondition) {
      return {
        condition: 'Mock Condition',
        system: 'CV',
        question: 'Preparing question...',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctIndex: 0,
      };
    }

    return {
      condition: randomCondition.name,
      system: randomCondition.system,
      question: `A patient presents with symptoms consistent with ${randomCondition.name}. What is the most likely diagnosis?`,
      options: [
        randomCondition.name,
        'Alternative diagnosis 1',
        'Alternative diagnosis 2',
        'Alternative diagnosis 3',
      ],
      correctIndex: 0,
    };
  };

  const currentQuestion = phase === 'active' ? generateMockQuestion() : null;

  // Handle answer selection
  const handleAnswerSelect = (index: number) => {
    if (showResult) return;

    setSelectedAnswer(index);
    setShowResult(true);

    if (currentQuestion && index === currentQuestion.correctIndex) {
      setScore(score + 1);
    }
  };

  // Handle next question
  const handleNext = () => {
    if (!config) return;

    if (currentQuestionIndex + 1 >= config.questionCount) {
      setPhase('complete');
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  // Render setup phase
  if (phase === 'setup') {
    return (
      <DrillSetup
        title="Condition Recognition Drill"
        description="Test your ability to recognize and diagnose medical conditions"
        defaultDifficulty="same"
        showSystemFilter={true}
        showQuestionCount={true}
        defaultQuestionCount={10}
        onStart={handleDrillStart}
        onBack={onExit}
      />
    );
  }

  // Render active drill phase
  if (phase === 'active' && currentQuestion && config) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-[var(--color-accent)]" />
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                Condition Drill
              </h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
              <span>
                Question {currentQuestionIndex + 1} / {config.questionCount}
              </span>
              <span className="font-medium">Score: {score}</span>
            </div>
          </div>

          {/* Question Card */}
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-8 mb-6"
          >
            {/* System Badge */}
            <div className="mb-4">
              <span className="px-3 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full text-sm font-medium">
                {currentQuestion.system}
              </span>
            </div>

            {/* Question */}
            <p className="text-lg text-[var(--color-text-primary)] mb-6 leading-relaxed">
              {currentQuestion.question}
            </p>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correctIndex;

                let bgColor = 'bg-[var(--color-bg-tertiary)]';
                let borderColor = 'border-[var(--color-border)]';
                let textColor = 'text-[var(--color-text-primary)]';

                if (showResult) {
                  if (isCorrect) {
                    bgColor = 'bg-[var(--color-data-pass)]/10';
                    borderColor = 'border-[var(--color-data-pass)]';
                    textColor = 'text-[var(--color-data-pass)]';
                  } else if (isSelected) {
                    bgColor = 'bg-[var(--color-data-fail)]/10';
                    borderColor = 'border-[var(--color-data-fail)]';
                    textColor = 'text-[var(--color-data-fail)]';
                  }
                } else if (isSelected) {
                  bgColor = 'bg-[var(--color-accent)]/10';
                  borderColor = 'border-[var(--color-accent)]';
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={showResult}
                    className={`w-full p-4 ${bgColor} border-2 ${borderColor} ${textColor} rounded-lg text-left transition-all hover:scale-[1.01] disabled:cursor-default flex items-center justify-between`}
                  >
                    <span>{option}</span>
                    {showResult && isCorrect && <CheckCircle className="w-5 h-5" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5" />}
                  </button>
                );
              })}
            </div>

            {/* Next Button */}
            {showResult && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleNext}
                className="w-full mt-6 bg-[var(--color-accent)] text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                {currentQuestionIndex + 1 >= config.questionCount
                  ? 'Complete Drill'
                  : 'Next Question'}
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            )}
          </motion.div>

          {/* Metadata */}
          <div className="text-center text-sm text-[var(--color-text-muted)]">
            <p>
              Difficulty:{' '}
              {config.difficulty === 'easier'
                ? 'Easier'
                : config.difficulty === 'same'
                  ? 'PANCE-Level'
                  : 'Harder'}
            </p>
            <p>Condition Pool: {config.availableConditions.length} conditions</p>
          </div>
        </div>
      </div>
    );
  }

  // Render completion phase
  if (phase === 'complete' && config) {
    const percentage = Math.round((score / config.questionCount) * 100);

    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-8 text-center"
        >
          <Brain className="w-16 h-16 text-[var(--color-accent)] mx-auto mb-4" />

          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Drill Complete!
          </h2>

          <div className="my-6">
            <div className="text-6xl font-bold text-[var(--color-accent)] mb-2">{percentage}%</div>
            <p className="text-[var(--color-text-secondary)]">
              {score} / {config.questionCount} correct
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setPhase('setup');
                setCurrentQuestionIndex(0);
                setScore(0);
                setSelectedAnswer(null);
                setShowResult(false);
              }}
              className="w-full bg-[var(--color-accent)] text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity"
            >
              Start New Drill
            </button>

            <button
              onClick={onExit}
              className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-medium py-3 px-6 rounded-lg hover:bg-[var(--color-bg-primary)] transition-colors"
            >
              Exit to Dashboard
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default ConditionDrillSession;
