/**
 * PANRE-LA Simulator
 * Simulates the Longitudinal Assessment format for PA recertification
 * Phase 19: Requirement 71
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, BookOpen, CheckCircle, Calendar, AlertCircle, Award } from 'lucide-react';

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  rationale: string;
  references: string[];
  canUseResources: boolean;
}

interface PANRELASimulatorProps {
  onComplete: (score: number) => void;
}

type QuarterlyBlock = 1 | 2 | 3 | 4;

interface QuarterlyProgress {
  quarter: QuarterlyBlock;
  questionsCompleted: number;
  totalQuestions: number;
  score: number;
  dueDate: string;
}

export const PANRELASimulator: React.FC<PANRELASimulatorProps> = ({ onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300); // 5 minutes per question
  const [isResourcesOpen, setIsResourcesOpen] = useState(false);
  const [quarterlyProgress, setQuarterlyProgress] = useState<QuarterlyProgress>({
    quarter: 1,
    questionsCompleted: 0,
    totalQuestions: 25,
    score: 0,
    dueDate: getQuarterEndDate(1)
  });
  const [showIntro, setShowIntro] = useState(true);

  const sampleQuestions: Question[] = [
    {
      id: '1',
      question: 'A 62-year-old male with a history of hypertension presents with sudden onset chest pain radiating to the back. Blood pressure is 180/110 in the right arm and 140/90 in the left arm. What is the most appropriate next step?',
      options: [
        'Obtain ECG and troponins',
        'CT angiography of the chest',
        'Administer aspirin and call cardiology',
        'Obtain chest X-ray'
      ],
      correctAnswerIndex: 1,
      rationale: 'This presentation is classic for aortic dissection (BP differential between arms). CT angiography is the gold standard diagnostic test. While ECG and troponins are important, they would delay the critical diagnosis.',
      references: [
        'ACC/AHA Guidelines on Thoracic Aortic Disease',
        'UpToDate: Clinical features and diagnosis of acute aortic dissection'
      ],
      canUseResources: true
    },
    {
      id: '2',
      question: 'A 45-year-old woman with diabetes presents with a non-healing foot ulcer. Which of the following is the most important initial step in management?',
      options: [
        'Start broad-spectrum antibiotics',
        'Refer to podiatry',
        'Assess vascular status and perfusion',
        'Debride the wound'
      ],
      correctAnswerIndex: 2,
      rationale: 'Before any intervention, assessing vascular status is critical. Poor perfusion will prevent healing regardless of other interventions. Use ankle-brachial index or refer for vascular studies.',
      references: [
        'ADA Standards of Medical Care: Diabetic Foot Care',
        'Wound Healing Society Guidelines'
      ],
      canUseResources: true
    }
  ];

  const currentQuestionData = sampleQuestions[currentQuestion];

  // Timer countdown
  useEffect(() => {
    if (showFeedback || showIntro) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showFeedback, showIntro]);

  const handleTimeout = () => {
    // Auto-submit on timeout
    if (selectedAnswer !== null) {
      handleSubmit();
    } else {
      alert('Time expired! Please select an answer.');
    }
  };

  const handleAnswerSelect = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
  };

  const handleSubmit = () => {
    if (selectedAnswer === null) {
      alert('Please select an answer before submitting.');
      return;
    }

    setShowFeedback(true);
    
    // Update progress
    const isCorrect = selectedAnswer === currentQuestionData.correctAnswerIndex;
    setQuarterlyProgress(prev => ({
      ...prev,
      questionsCompleted: prev.questionsCompleted + 1,
      score: isCorrect ? prev.score + 1 : prev.score
    }));
  };

  const handleNext = () => {
    if (currentQuestion < sampleQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setTimeRemaining(300);
      setIsResourcesOpen(false);
    } else {
      const finalScore = (quarterlyProgress.score / sampleQuestions.length) * 100;
      onComplete(finalScore);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    if (timeRemaining > 180) return 'text-green-600 dark:text-green-400';
    if (timeRemaining > 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (showIntro) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full 
              flex items-center justify-center mx-auto mb-4">
              <Award className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              PANRE-LA Simulator
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Practice the Longitudinal Assessment Format
            </p>
          </div>

          <div className="space-y-6 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
              <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                About PANRE-LA
              </h3>
              <ul className="space-y-3 text-sm text-blue-800 dark:text-blue-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span><strong>Quarterly Format:</strong> Complete 25 questions every quarter (4 times per year)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span><strong>Open Book:</strong> You can use reference materials during the assessment</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span><strong>Time Limit:</strong> 5 minutes per question (but you can use less)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span><strong>Flexible Schedule:</strong> Complete within the quarterly window</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span><strong>Lower Stakes:</strong> Smaller assessments spread throughout the year</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Current Quarter Progress
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Quarter</div>
                  <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    Q{quarterlyProgress.quarter}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Due Date</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {quarterlyProgress.dueDate}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Questions</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {quarterlyProgress.questionsCompleted}/{quarterlyProgress.totalQuestions}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Score</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {quarterlyProgress.questionsCompleted > 0 
                      ? Math.round((quarterlyProgress.score / quarterlyProgress.questionsCompleted) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowIntro(false)}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl 
              font-bold text-lg hover:shadow-2xl transition-all hover:scale-105"
          >
            Begin Assessment
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with Timer */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">PANRE-LA - Q{quarterlyProgress.quarter}</h2>
            <p className="text-white/90">
              Question {currentQuestion + 1} of {sampleQuestions.length}
            </p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold ${getTimeColor()}`}>
              <Clock className="w-8 h-8 inline-block mr-2" />
              {formatTime(timeRemaining)}
            </div>
            <div className="text-white/80 text-sm">Time Remaining</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Question Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 
                  bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
                  Open Book Question
                </span>
                <button
                  onClick={() => setIsResourcesOpen(!isResourcesOpen)}
                  className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {isResourcesOpen ? 'Hide' : 'Show'} References
                </button>
              </div>
              
              <p className="text-lg text-gray-900 dark:text-white leading-relaxed">
                {currentQuestionData.question}
              </p>
            </div>

            <div className="space-y-3">
              {currentQuestionData.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showFeedback}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    showFeedback
                      ? index === currentQuestionData.correctAnswerIndex
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : index === selectedAnswer
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600 opacity-50'
                      : selectedAnswer === index
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  } disabled:cursor-not-allowed`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      showFeedback && index === currentQuestionData.correctAnswerIndex
                        ? 'border-green-500 bg-green-500'
                        : selectedAnswer === index
                        ? 'border-current'
                        : 'border-gray-400'
                    }`}>
                      {selectedAnswer === index && !showFeedback && (
                        <div className="w-3 h-3 bg-current rounded-full" />
                      )}
                      {showFeedback && index === currentQuestionData.correctAnswerIndex && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className="text-gray-900 dark:text-white">{option}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              {!showFeedback ? (
                <button
                  onClick={handleSubmit}
                  disabled={selectedAnswer === null}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white 
                    rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white 
                    rounded-lg font-semibold hover:shadow-lg transition-all hover:scale-105"
                >
                  {currentQuestion < sampleQuestions.length - 1 ? 'Next Question' : 'Complete Assessment'}
                </button>
              )}
            </div>
          </div>

          {/* Feedback Panel */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`rounded-xl p-6 ${
                  selectedAnswer === currentQuestionData.correctAnswerIndex
                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-500'
                    : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-500'
                }`}
              >
                <h4 className={`text-xl font-bold mb-3 ${
                  selectedAnswer === currentQuestionData.correctAnswerIndex
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {selectedAnswer === currentQuestionData.correctAnswerIndex 
                    ? '✅ Correct Answer!' 
                    : '❌ Incorrect'}
                </h4>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {currentQuestionData.rationale}
                </p>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                    📚 References:
                  </h5>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {currentQuestionData.references.map((ref, i) => (
                      <li key={i}>• {ref}</li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Resources Sidebar */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">
              📖 Quick Resources
            </h3>
            
            {isResourcesOpen ? (
              <div className="space-y-3">
                <a href="#" className="block p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg 
                  hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                  <div className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                    UpToDate
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    Evidence-based clinical resource
                  </div>
                </a>
                <a href="#" className="block p-3 bg-green-50 dark:bg-green-900/20 rounded-lg 
                  hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                  <div className="font-semibold text-green-900 dark:text-green-200 text-sm">
                    Clinical Guidelines
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-300">
                    ACC/AHA, ADA, IDSA guidelines
                  </div>
                </a>
                <a href="#" className="block p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg 
                  hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                  <div className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
                    Drug Reference
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-300">
                    Epocrates, Lexicomp
                  </div>
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click "Show References" above to access clinical resources for this question.
              </p>
            )}
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Tip:</strong> PANRE-LA is open book, but time is limited. Use resources 
                wisely to verify your clinical decision-making.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Calculate the end date for a given quarter
 * Handles year rollover for Q1 assessments
 */
function getQuarterEndDate(quarter: QuarterlyBlock): string {
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  let year = today.getFullYear();

  // Quarter end months: Q1=2 (March), Q2=5 (June), Q3=8 (Sept), Q4=11 (Dec)
  const quarterEndMonths = [2, 5, 8, 11];
  const quarterEndMonth = quarterEndMonths[quarter - 1];

  // If we're past the quarter end date, use next year
  if (currentMonth > quarterEndMonth) {
    year += 1;
  }

  const endDates = {
    1: `March 31, ${year}`,
    2: `June 30, ${year}`,
    3: `September 30, ${year}`,
    4: `December 31, ${year}`
  };
  return endDates[quarter];
}

export default PANRELASimulator;
