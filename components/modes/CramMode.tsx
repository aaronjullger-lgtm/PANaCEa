/**
 * Cram Mode Component
 * 
 * High-yield rapid review mode featuring the 50 most important PANCE conditions.
 * Generates PANCE-style clinical vignette questions using AI.
 * Optimized for last-minute review and quick knowledge reinforcement.
 * 
 * Database-First: Fetches high-yield conditions from PostgreSQL via /api/conditions/high-yield
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Check, 
  X, 
  ChevronRight, 
  RotateCcw, 
  Trophy,
  Zap,
  BookOpen,
  Target,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { geminiService } from '@/services/ai';
import { GEMINI_FLASH_MODEL } from '@/src/constants';

/**
 * HighYieldCondition interface - matches database API response
 * Source: /api/conditions/high-yield
 */
export interface HighYieldCondition {
  condition: string;
  system: string;
  pearl: string;
  buzzwords: string[];
  importance: 'critical' | 'very_high' | 'high';
}

interface CramModeProps {
  onExit: () => void;
}

interface CramQuestion {
  id: string;
  vignette: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  condition: string;
  system: string;
  pearl: string;
}

/**
 * Generate a PANCE-style vignette question for a condition
 */
async function generateVignetteQuestion(
  condition: HighYieldCondition,
  allConditions: HighYieldCondition[],
  index: number
): Promise<CramQuestion> {
  // Generate distractors from same or related systems
  const distractors = allConditions
    .filter(c => c.condition !== condition.condition)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(c => c.condition);

  const allOptions = [condition.condition, ...distractors].sort(() => Math.random() - 0.5);
  const correctIndex = allOptions.indexOf(condition.condition);

  const prompt = `Generate a PANCE-style clinical vignette question for: ${condition.condition}

KEY CLINICAL FEATURES to incorporate:
- Buzzwords: ${condition.buzzwords.join(', ')}
- Pearl: ${condition.pearl}

REQUIREMENTS:
1. Create a realistic patient scenario (age, gender, chief complaint, relevant history)
2. Include 2-3 key clinical findings from the buzzwords
3. Ask "What is the most likely diagnosis?" or similar diagnostic question
4. Keep the vignette to 3-4 sentences
5. Provide a clear, educational explanation (2-3 sentences)

FORMAT YOUR RESPONSE AS VALID JSON:
{
  "vignette": "A [age]-year-old [gender] presents with...",
  "question": "What is the most likely diagnosis?",
  "explanation": "This presentation is classic for [condition] because..."
}

IMPORTANT: Return ONLY valid JSON, no markdown or code blocks.`;

  try {
    const response = await geminiService.callGeminiText(GEMINI_FLASH_MODEL, prompt, 0.7);
    
    // Clean response - remove markdown code blocks if present
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanedResponse);

    return {
      id: `cram-${index}`,
      vignette: parsed.vignette || `Patient presents with ${condition.buzzwords[0]}`,
      question: parsed.question || "What is the most likely diagnosis?",
      options: allOptions,
      correctIndex,
      explanation: parsed.explanation || condition.pearl,
      condition: condition.condition,
      system: condition.system,
      pearl: condition.pearl
    };
  } catch (error) {
    console.error(`Failed to generate question for ${condition.condition}:`, error);
    
    // Fallback to a simple question if AI generation fails
    return {
      id: `cram-${index}`,
      vignette: `A patient presents with ${condition.buzzwords.slice(0, 2).join(' and ')}.`,
      question: "What is the most likely diagnosis?",
      options: allOptions,
      correctIndex,
      explanation: condition.pearl,
      condition: condition.condition,
      system: condition.system,
      pearl: condition.pearl
    };
  }
}

/**
 * Generate questions in batches with rate limiting
 */
async function generateQuestionBatch(
  conditions: HighYieldCondition[],
  batchSize: number = 5,
  onProgress?: (completed: number, total: number) => void
): Promise<CramQuestion[]> {
  const questions: CramQuestion[] = [];
  
  for (let i = 0; i < conditions.length; i += batchSize) {
    const batch = conditions.slice(i, i + batchSize);
    const batchPromises = batch.map((condition, idx) => 
      generateVignetteQuestion(condition, conditions, i + idx)
    );
    
    const batchResults = await Promise.all(batchPromises);
    questions.push(...batchResults);
    
    onProgress?.(Math.min(i + batchSize, conditions.length), conditions.length);
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < conditions.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return questions;
}

export const CramMode: React.FC<CramModeProps> = ({ onExit }) => {
  const [questions, setQuestions] = useState<CramQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ completed: 0, total: 50 });
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadError(null);
        
        // Database-First: Fetch high-yield conditions from API
        const response = await fetch('/api/conditions/high-yield?limit=50&random=true');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch conditions: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.conditions || data.conditions.length === 0) {
          throw new Error('No high-yield conditions found in database');
        }
        
        const selectedConditions: HighYieldCondition[] = data.conditions;
        
        const generatedQuestions = await generateQuestionBatch(
          selectedConditions,
          5,
          (completed, total) => setLoadingProgress({ completed, total })
        );
        
        // Shuffle the final questions
        const shuffled = generatedQuestions.sort(() => Math.random() - 0.5);
        setQuestions(shuffled);
      } catch (error) {
        console.error("Failed to generate questions:", error);
        setLoadError(error instanceof Error ? error.message : "Failed to generate questions. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // Update elapsed time
  useEffect(() => {
    if (isLoading || isComplete) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, isLoading, isComplete]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return; // Already answered
    
    setSelectedAnswer(index);
    setShowExplanation(true);
    
    if (index === currentQuestion.correctIndex) {
      setCorrectCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setIsComplete(true);
    }
  };

  const handleRestart = () => {
    window.location.reload(); // Simple restart
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Generating PANCE Questions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Creating clinical vignettes for the Top 50 High-Yield Conditions...
          </p>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(loadingProgress.completed / loadingProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {loadingProgress.completed} / {loadingProgress.total} questions
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Failed to Load
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {loadError}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              Try Again
            </button>
            <button
              onClick={onExit}
              className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
            >
              Exit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    const accuracy = (correctCount / questions.length) * 100;
    const avgTimePerQuestion = elapsedTime / questions.length;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4"
      >
        <div className="max-w-2xl mx-auto py-12">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center"
          >
            <Trophy className="w-20 h-20 mx-auto mb-6 text-orange-500" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-2">
              Cram Session Complete! <Trophy className="w-8 h-8 text-amber-500" />
            </h2>
            
            <div className="grid grid-cols-2 gap-4 my-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6">
                <Target className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400" />
                <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {accuracy.toFixed(0)}%
                </div>
                <div className="text-sm text-green-600 dark:text-green-300">Accuracy</div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6">
                <Clock className="w-8 h-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                  {formatTime(elapsedTime)}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-300">Total Time</div>
              </div>
            </div>

            <div className="space-y-3 mb-8">
              <div className="text-lg">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Questions Correct:
                </span>{' '}
                <span className="text-green-600 dark:text-green-400 font-bold">
                  {correctCount} / {questions.length}
                </span>
              </div>
              <div className="text-lg">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Avg Time/Question:
                </span>{' '}
                <span className="text-blue-600 dark:text-blue-400 font-bold">
                  {avgTimePerQuestion.toFixed(1)}s
                </span>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Try Again
              </button>
              <button
                onClick={onExit}
                className="flex items-center gap-2 px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
              >
                <BookOpen className="w-5 h-5" />
                Exit
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2 rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Cram Session
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Top 50 High-Yield PANCE Questions
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatTime(elapsedTime)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {currentIndex + 1} / {questions.length}
                </div>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-orange-500 to-amber-600 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
          >
            {/* System Badge */}
            <div className="flex items-center justify-between mb-6">
              <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm font-semibold">
                {currentQuestion.system}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Question {currentIndex + 1} of {questions.length}
              </span>
            </div>

            {/* Clinical Vignette */}
            <div className="mb-6">
              <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
                {currentQuestion.vignette}
              </p>
            </div>

            {/* Question */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                {currentQuestion.question}
              </h3>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === index;
                const isCorrect = index === currentQuestion.correctIndex;
                const showResult = showExplanation;

                let buttonClass = 'w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ';
                
                if (!showResult) {
                  buttonClass += 'border-gray-300 dark:border-gray-600 hover:border-orange-500 dark:hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20';
                } else if (isCorrect) {
                  buttonClass += 'border-green-500 bg-green-50 dark:bg-green-900/20';
                } else if (isSelected && !isCorrect) {
                  buttonClass += 'border-red-500 bg-red-50 dark:bg-red-900/20';
                } else {
                  buttonClass += 'border-gray-300 dark:border-gray-600 opacity-50';
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={showExplanation}
                    className={buttonClass}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-gray-900 dark:text-white">
                        {option}
                      </span>
                      {showResult && isCorrect && (
                        <Check className="w-6 h-6 text-green-600" />
                      )}
                      {showResult && isSelected && !isCorrect && (
                        <X className="w-6 h-6 text-red-600" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            <AnimatePresence>
              {showExplanation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 space-y-4"
                >
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Explanation
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {currentQuestion.explanation}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      High-Yield Pearl
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {currentQuestion.pearl}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Next Button */}
            {showExplanation && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleNext}
                className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                {currentIndex < questions.length - 1 ? (
                  <>
                    Next Question
                    <ChevronRight className="w-6 h-6" />
                  </>
                ) : (
                  <>
                    View Results
                    <Trophy className="w-6 h-6" />
                  </>
                )}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CramMode;
