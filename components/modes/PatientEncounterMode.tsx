import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Send, User, Clock, Award, CheckCircle, XCircle } from 'lucide-react';
import type { PatientEncounterCase, PatientQuestion, EncounterSession } from '@/types/drill-modes';
import { getRandomEncounterCase, evaluateQuestion, calculateEncounterScore } from '@/data/modes/patientEncounterData';
import { hapticSuccess, hapticError } from '@/lib/hapticFeedback';

interface PatientEncounterModeProps {
  onExit?: () => void;
}

type ViewState = 'landing' | 'active' | 'results';

const PatientEncounterMode: React.FC<PatientEncounterModeProps> = ({ onExit }) => {
  const [viewState, setViewState] = useState<ViewState>('landing');
  const [currentCase, setCurrentCase] = useState<PatientEncounterCase | null>(null);
  const [session, setSession] = useState<EncounterSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [userDiagnosis, setUserDiagnosis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleStartEncounter = () => {
    setIsLoading(true);
    // Simulate loading for content generation buffer
    setTimeout(() => {
      // Use dynamic generation to ensure fresh content each time
      const newCase = getRandomEncounterCase(true);
      setCurrentCase(newCase);
      setSession({
        caseId: newCase.id,
        questions: [],
        startTime: Date.now(),
      });
      setIsLoading(false);
      setViewState('active');
    }, 1500);
  };

  const handleAskQuestion = () => {
    if (!currentQuestion.trim() || !currentCase || !session) return;

    const { relevance, response } = evaluateQuestion(currentQuestion, currentCase);

    const newQuestion: PatientQuestion = {
      questionText: currentQuestion,
      category: determineCategory(currentQuestion),
      relevance,
      response,
      timestamp: Date.now(),
    };

    setSession({
      ...session,
      questions: [...session.questions, newQuestion],
    });

    setCurrentQuestion('');

    // Haptic feedback based on relevance
    if (relevance === 'essential') {
      hapticSuccess();
    } else if (relevance === 'unnecessary') {
      hapticError();
    }
  };

  const handleSubmitDiagnosis = () => {
    if (!session || !currentCase) return;

    const score = calculateEncounterScore(session.questions, currentCase);
    
    setSession({
      ...session,
      endTime: Date.now(),
      diagnosis: userDiagnosis,
      score,
    });

    setViewState('results');
  };

  const handleNewCase = () => {
    setCurrentCase(null);
    setSession(null);
    setUserDiagnosis('');
    setCurrentQuestion('');
    setViewState('landing');
  };

  const determineCategory = (question: string): PatientQuestion['category'] => {
    const lowerQ = question.toLowerCase();
    if (lowerQ.includes('history') || lowerQ.includes('when') || lowerQ.includes('how long') || lowerQ.includes('family')) {
      return 'history';
    }
    if (lowerQ.includes('exam') || lowerQ.includes('physical') || lowerQ.includes('abdomen') || lowerQ.includes('heart')) {
      return 'physical';
    }
    if (lowerQ.includes('lab') || lowerQ.includes('test') || lowerQ.includes('ecg') || lowerQ.includes('xray')) {
      return 'labs';
    }
    return 'other';
  };

  const getRelevanceColor = (relevance: PatientQuestion['relevance']) => {
    switch (relevance) {
      case 'essential': return 'text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/30 dark:border-green-900';
      case 'helpful': return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-900';
      case 'unnecessary': return 'text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-900';
      case 'redundant': return 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/30 dark:border-slate-700';
      default: return 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-900/30 dark:border-slate-700';
    }
  };

  const getRelevanceLabel = (relevance: PatientQuestion['relevance']) => {
    switch (relevance) {
      case 'essential': return 'Essential';
      case 'helpful': return 'Helpful';
      case 'unnecessary': return 'Unnecessary';
      case 'redundant': return 'Redundant';
      default: return 'Other';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // Landing Page View - Clinical White/Navy Theme
  if (viewState === 'landing') {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1] transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1F283A] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#E9ECF1] dark:bg-[#364154] flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Interactive Patient Interviews</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#364154] dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">Ready to Interview Your Patient?</h2>
              <p className="text-xl text-[#364154] dark:text-[#cbd5e1]">
                Test your clinical reasoning and history-taking skills
              </p>
            </div>

            {/* How It Works Card */}
            <div className="bg-white dark:bg-[#364154] rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg space-y-6">
              <h3 className="text-2xl font-semibold text-[#1F283A] dark:text-[#E9ECF1]">How It Works</h3>
              
              <div className="space-y-5">
                {[
                  {
                    num: 1,
                    title: 'Review the Chief Complaint',
                    desc: "You'll be presented with a patient's chief complaint and vital signs",
                    icon: '👤'
                  },
                  {
                    num: 2,
                    title: 'Ask Questions',
                    desc: 'Type questions to gather history, physical exam findings, and test results. Information is revealed only when you ask!',
                    icon: '💬'
                  },
                  {
                    num: 3,
                    title: 'Make Your Diagnosis',
                    desc: 'Submit your diagnosis when you feel you have enough information',
                    icon: '🔍'
                  },
                  {
                    num: 4,
                    title: 'Get Scored',
                    desc: 'Receive feedback on your thoroughness, efficiency, and diagnostic accuracy',
                    icon: '📊'
                  }
                ].map((step) => (
                  <div key={step.num} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center flex-shrink-0 border border-teal-200 dark:border-teal-900">
                      <span className="text-xl">{step.icon}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#1F283A] dark:text-[#E9ECF1] mb-1">{step.title}</h4>
                      <p className="text-[#364154] dark:text-[#cbd5e1] text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro Tips */}
              <div className="bg-teal-50 dark:bg-teal-950/30 rounded-xl p-6 border border-teal-200 dark:border-teal-900">
                <p className="text-sm text-teal-600 dark:text-teal-400 font-semibold mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Pro Tips
                </p>
                <ul className="text-sm text-[#364154] dark:text-[#cbd5e1] space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 dark:text-teal-400 mt-0.5">•</span>
                    <span>Ask essential questions first (onset, character, severity)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 dark:text-teal-400 mt-0.5">•</span>
                    <span>Avoid unnecessary questions that waste time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 dark:text-teal-400 mt-0.5">•</span>
                    <span>Be thorough but efficient - quality over quantity</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 dark:text-teal-400 mt-0.5">•</span>
                    <span>Consider differential diagnoses as you gather information</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center">
              <motion.button
                onClick={handleStartEncounter}
                disabled={isLoading}
                className="px-10 py-4 bg-[#1F283A] text-[#E9ECF1] dark:bg-[#E9ECF1] dark:text-[#1F283A] hover:bg-[#364154] dark:hover:bg-white
                         disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-lg
                         transition-all flex items-center justify-center gap-3 mx-auto shadow-lg hover:shadow-xl"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Case...
                  </>
                ) : (
                  <>
                    Start Interview
                    <MessageSquare className="w-5 h-5" />
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Active Interview View - Clinical White/Navy Theme
  if (viewState === 'active' && currentCase && session) {
    const elapsedSeconds = Math.floor((Date.now() - session.startTime) / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#1F283A] text-[#1F283A] dark:text-[#E9ECF1]">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#364154] sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E9ECF1] dark:bg-[#1F283A] flex items-center justify-center shadow-sm">
                <MessageSquare className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Virtual OSCE</h1>
                <p className="text-sm text-[#364154] dark:text-[#cbd5e1]">Interview in Progress</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-[#364154] dark:text-[#cbd5e1]" />
                <span className="font-mono text-[#1F283A] dark:text-[#E9ECF1]">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#364154] dark:text-[#cbd5e1]">Questions Asked</p>
                <p className="text-lg font-bold text-[#1F283A] dark:text-[#E9ECF1]">{session.questions.length}</p>
              </div>
              {onExit && (
                <button
                  onClick={onExit}
                  className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1F283A] dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Patient Info & Question Input */}
            <div className="space-y-4">
              {/* Patient Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center border border-teal-200 dark:border-teal-900">
                    <User className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.patientName}</h2>
                    <p className="text-[#364154] dark:text-[#cbd5e1]">{currentCase.age} year old {currentCase.sex === 'M' ? 'male' : currentCase.sex === 'F' ? 'female' : 'patient'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-teal-50 dark:bg-teal-950/30 rounded-lg p-4 border border-teal-200 dark:border-teal-900">
                    <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-1">CHIEF COMPLAINT</p>
                    <p className="text-lg font-semibold text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.chiefComplaint}</p>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#1F283A] rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-semibold text-[#364154] dark:text-[#cbd5e1] mb-3">VITAL SIGNS</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">BP:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.bp}</span>
                      </div>
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">HR:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.hr} bpm</span>
                      </div>
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">RR:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.rr} /min</span>
                      </div>
                      <div>
                        <span className="text-[#364154] dark:text-[#cbd5e1]">Temp:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.temp}°F</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#364154] dark:text-[#cbd5e1]">O₂ Sat:</span>
                        <span className="ml-2 font-mono text-[#1F283A] dark:text-[#E9ECF1]">{currentCase.vitalSigns.o2sat}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Question Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
              >
                <h3 className="text-lg font-semibold mb-4 text-teal-600 dark:text-teal-400">Ask a Question</h3>
                <div className="flex gap-2">
                  <input
                    id="patient-question"
                    name="patient-question"
                    type="text"
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                    placeholder="e.g., When did the chest pain start?"
                    className="flex-1 px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg 
                             text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                             focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent shadow-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={handleAskQuestion}
                    disabled={!currentQuestion.trim()}
                    className="px-4 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 
                             disabled:cursor-not-allowed rounded-lg transition-colors text-white shadow-sm"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>

              {/* Diagnosis Submission */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-teal-50 dark:bg-teal-950/30 rounded-xl p-6 border border-teal-200 dark:border-teal-900 shadow-md"
              >
                <h3 className="text-lg font-semibold mb-4 text-teal-600 dark:text-teal-400">Your Diagnosis</h3>
                <input
                  id="patient-diagnosis"
                  name="patient-diagnosis"
                  type="text"
                  value={userDiagnosis}
                  onChange={(e) => setUserDiagnosis(e.target.value)}
                  placeholder="Enter your diagnosis..."
                  className="w-full px-4 py-3 bg-white dark:bg-[#1F283A] border border-slate-300 dark:border-slate-700 rounded-lg mb-4
                           text-[#1F283A] dark:text-[#E9ECF1] placeholder-slate-400 dark:placeholder-slate-500 
                           focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent shadow-sm"
                  autoComplete="off"
                />
                <button
                  onClick={handleSubmitDiagnosis}
                  disabled={!userDiagnosis.trim() || session.questions.length === 0}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 
                           disabled:cursor-not-allowed py-3 rounded-lg font-semibold text-white
                           transition-colors shadow-sm"
                >
                  Submit Diagnosis & View Results
                </button>
              </motion.div>
            </div>

            {/* Right: Q&A History */}
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-[#364154] rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-md"
              >
                <h3 className="text-lg font-semibold mb-4 text-teal-600 dark:text-teal-400">Interview History</h3>
                
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                  {session.questions.length === 0 ? (
                    <p className="text-[#364154] dark:text-[#cbd5e1] text-center py-8 italic">
                      No questions asked yet. Start by asking about the patient's history!
                    </p>
                  ) : (
                    session.questions.map((q, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-[#1F283A] rounded-lg p-4 space-y-2 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[#1F283A] dark:text-[#E9ECF1] font-semibold flex-1">Q: {q.questionText}</p>
                          <span className={`px-2 py-1 rounded text-xs font-semibold border ${getRelevanceColor(q.relevance)}`}>
                            {getRelevanceLabel(q.relevance)}
                          </span>
                        </div>
                        <p className="text-[#364154] dark:text-[#cbd5e1] text-sm pl-4 border-l-2 border-teal-200 dark:border-teal-900">
                          A: {q.response}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results View
  if (viewState === 'results' && currentCase && session && session.score) {
    const { score } = session;
    // Simple diagnosis matching - normalize and check for key terms
    const normalizeText = (text: string) => text.toLowerCase().trim().replace(/[^\w\s]/g, '');
    const userDx = normalizeText(userDiagnosis);
    const correctDx = normalizeText(currentCase.correctDiagnosis);
    
    // Check if the main diagnosis terms are present (allowing for some flexibility)
    const userTerms = userDx.split(/\s+/);
    const correctTerms = correctDx.split(/\s+/);
    const matchCount = correctTerms.filter(term => 
      term.length > 3 && userTerms.some(userTerm => userTerm.includes(term) || term.includes(userTerm))
    ).length;
    const isCorrectDiagnosis = matchCount >= Math.ceil(correctTerms.length * 0.6); // 60% of key terms match

    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-950 via-slate-900 to-cyan-950 text-white">
        {/* Header */}
        <div className="border-b border-teal-800/30 bg-black/20 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-teal-400" />
              <div>
                <h1 className="text-2xl font-bold">Virtual OSCE - Results</h1>
                <p className="text-sm text-teal-300">Performance Summary</p>
              </div>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          {/* Diagnosis Result */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl p-6 border ${
              isCorrectDiagnosis
                ? 'bg-green-900/40 border-green-600/30'
                : 'bg-orange-900/40 border-orange-600/30'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {isCorrectDiagnosis ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <XCircle className="w-8 h-8 text-orange-400" />
              )}
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {isCorrectDiagnosis ? 'Correct Diagnosis!' : 'Diagnosis Review'}
                </h2>
                <p className="text-slate-300">Your diagnosis: {userDiagnosis}</p>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-sm text-slate-400 mb-1">Correct Diagnosis:</p>
              <p className="text-lg font-semibold text-white">{currentCase.correctDiagnosis}</p>
            </div>
          </motion.div>

          {/* Score Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-teal-800/30 text-center"
            >
              <Award className="w-8 h-8 text-teal-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-1">Overall Score</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.overall)}`}>
                {Math.round(score.overall)}%
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-teal-800/30 text-center"
            >
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-1">Thoroughness</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.thoroughness)}`}>
                {Math.round(score.thoroughness)}%
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-teal-800/30 text-center"
            >
              <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400 mb-1">Efficiency</p>
              <p className={`text-4xl font-bold ${getScoreColor(score.efficiency)}`}>
                {Math.round(score.efficiency)}%
              </p>
            </motion.div>
          </div>

          {/* Ideal Workup */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-teal-800/30"
          >
            <h3 className="text-xl font-semibold mb-4 text-teal-400">Ideal Workup</h3>
            <ul className="space-y-2">
              {currentCase.idealWorkup.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-slate-300">
                  <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Teaching Points */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-teal-800/30"
          >
            <h3 className="text-xl font-semibold mb-4 text-teal-400">Teaching Points</h3>
            <ul className="space-y-3">
              {currentCase.teachingPoints.map((point, idx) => (
                <li key={idx} className="text-slate-300 pl-4 border-l-2 border-teal-800/30">
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Differential Diagnoses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-teal-800/30"
          >
            <h3 className="text-xl font-semibold mb-4 text-teal-400">Differential Diagnoses to Consider</h3>
            <div className="flex flex-wrap gap-2">
              {currentCase.differentialDiagnoses.map((dx, idx) => (
                <span
                  key={idx}
                  className="px-3 py-2 bg-teal-900/30 rounded-lg text-teal-300 text-sm border border-teal-700/30"
                >
                  {dx}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleNewCase}
              className="flex-1 bg-teal-600 hover:bg-teal-700 py-4 rounded-lg font-semibold text-lg
                       transition-colors"
            >
              New Case
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="px-8 py-4 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold text-lg
                         transition-colors"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PatientEncounterMode;
