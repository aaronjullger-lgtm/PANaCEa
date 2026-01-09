/**
 * Session End Summary
 * 
 * Comprehensive summary displayed when ending a study session.
 * Shows performance metrics, PANCE distribution adherence, and recommendations.
 * Syncs session analytics to the database.
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { 
  Trophy, 
  Target, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Flame,
  Zap,
  BookOpen,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { 
  getSessionSummary, 
  calculateDistributionDrift,
  resetSessionDistribution,
  PANCE_SYSTEM_PERCENTAGES 
} from '../../services/panceDistributionService';
import { analyzePatterns, resetAnswerPatterns } from '../../services/answerPatternService';
import { calculateBehavioralCalibration, resetBehavioralRecords, getBehavioralInsights } from '../../services/behavioralConfidenceService';
import { resetMomentum, getMomentumInsights } from '../../services/sessionMomentumService';
import { getPrediction, resetPrediction } from '../../services/performancePredictionService';
import { resetPauseTracking } from '../../services/smartPauseService';
import { collectSessionAnalytics, syncSessionAnalytics } from '../../services/sessionAnalyticsSyncService';
import { ABBREVIATION_TO_TOPIC_MAP } from '../../src/constants';
import type { PerformanceRecord } from '../../types';
import { StreakVisualization } from './StreakVisualization';
import { ScorePredictionCard } from './ScorePredictionCard';
import { MetacognitiveReflection } from '../session/MetacognitiveReflection';

interface SessionEndSummaryProps {
  isOpen?: boolean;  // For conditional rendering from parent
  performanceData: PerformanceRecord[];
  sessionDurationMs?: number;
  sessionStartTime?: number;
  sessionSummary?: any; // PANCE distribution summary
  onClose: () => void;
  onReviewMissed?: () => void;
  onStartNewSession?: () => void;
  onContinueStudying?: () => void;
  onViewAnalytics?: () => void;
  sessionSettings?: {
    mode?: string;
    focus?: string;
    // difficulty is always 'same' (PANCE-level)
  };
}

interface SystemPerformance {
  system: string;
  name: string;
  correct: number;
  total: number;
  accuracy: number;
  targetPercent: number;
  actualPercent: number;
}

export const SessionEndSummary: React.FC<SessionEndSummaryProps> = ({
  isOpen = true,
  performanceData,
  sessionDurationMs,
  sessionStartTime,
  sessionSummary: externalSummary,
  onClose,
  onReviewMissed,
  onStartNewSession,
  onContinueStudying,
  onViewAnalytics,
  sessionSettings,
}) => {
  const { getToken } = useAuth();
  const syncAttempted = useRef(false);
  const [syncStatus, setSyncStatus] = React.useState<'pending' | 'synced' | 'failed' | null>(null);
  const [showReflection, setShowReflection] = React.useState(false);
  
  // Use external summary if provided, otherwise calculate
  const summary = externalSummary || getSessionSummary();
  const drifts = calculateDistributionDrift();
  const patternAnalysis = analyzePatterns();
  const behavioralCalibration = calculateBehavioralCalibration();
  
  // Calculate overall stats
  const overallStats = useMemo(() => {
    const total = performanceData.length;
    const correct = performanceData.filter(p => p.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    // Calculate streaks
    let maxStreak = 0;
    let currentStreak = 0;
    const streaks: number[] = [];
    for (const p of performanceData) {
      if (p.isCorrect) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        if (currentStreak > 0) streaks.push(currentStreak);
        currentStreak = 0;
      }
    }
    // Push final streak if it ended on a correct answer
    if (currentStreak > 0) streaks.push(currentStreak);
    
    // Calculate average streak
    const avgStreak = streaks.length > 0 
      ? Math.round((streaks.reduce((a, b) => a + b, 0) / streaks.length) * 10) / 10
      : 0;
    
    // Calculate average time per question
    const avgTimePerQuestionMs = performanceData.length > 0
      ? performanceData.reduce((sum, p) => sum + (p.timeSpentMs || 0), 0) / performanceData.length
      : 0;
    
    // Duration
    const durationMinutes = sessionDurationMs 
      ? Math.round(sessionDurationMs / 60000) 
      : summary.sessionDuration;
    
    const questionsPerMinute = durationMinutes > 0 
      ? Math.round((total / durationMinutes) * 10) / 10 
      : 0;
    
    return {
      total,
      correct,
      incorrect: total - correct,
      accuracy,
      maxStreak,
      avgStreak,
      avgTimePerQuestionMs,
      durationMinutes,
      questionsPerMinute,
    };
  }, [performanceData, sessionDurationMs, summary]);
  
  // Calculate per-system performance
  const systemPerformance: SystemPerformance[] = useMemo(() => {
    const systemStats: Record<string, { correct: number; total: number }> = {};
    
    for (const p of performanceData) {
      const system = p.topic;
      if (!systemStats[system]) {
        systemStats[system] = { correct: 0, total: 0 };
      }
      systemStats[system].total++;
      if (p.isCorrect) systemStats[system].correct++;
    }
    
    return Object.entries(systemStats)
      .map(([system, stats]) => ({
        system,
        name: ABBREVIATION_TO_TOPIC_MAP[system] || system,
        correct: stats.correct,
        total: stats.total,
        accuracy: Math.round((stats.correct / stats.total) * 100),
        targetPercent: PANCE_SYSTEM_PERCENTAGES[system] || 0,
        actualPercent: overallStats.total > 0 
          ? Math.round((stats.total / overallStats.total) * 100) 
          : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [performanceData, overallStats.total]);
  
  // Identify weak areas
  const weakAreas = systemPerformance.filter(s => s.accuracy < 60 && s.total >= 3);
  const strongAreas = systemPerformance.filter(s => s.accuracy >= 80 && s.total >= 3);
  
  // Get grade/rating
  const getGrade = (accuracy: number) => {
    if (accuracy >= 90) return { grade: 'A', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' };
    if (accuracy >= 80) return { grade: 'B', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
    if (accuracy >= 70) return { grade: 'C', color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' };
    if (accuracy >= 60) return { grade: 'D', color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
    return { grade: 'F', color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
  };
  
  const grade = getGrade(overallStats.accuracy);
  
  // Sync session analytics to database on mount
  useEffect(() => {
    if (syncAttempted.current || performanceData.length < 3) return;
    syncAttempted.current = true;
    
    const syncToDatabase = async () => {
      try {
        setSyncStatus('pending');
        
        // Get auth token
        const token = await getToken();
        
        // Calculate final streak (current streak at end of session)
        let finalStreak = 0;
        for (let i = performanceData.length - 1; i >= 0; i--) {
          if (performanceData[i].isCorrect) finalStreak++;
          else break;
        }
        
        // Collect all analytics
        const analytics = collectSessionAnalytics(
          sessionStartTime || Date.now() - (sessionDurationMs || 0),
          overallStats.total,
          overallStats.correct,
          overallStats.maxStreak,
          finalStreak,
          sessionSettings?.mode,
          sessionSettings?.focus,
          'same' // All sessions are PANCE-level
        );
        
        // Sync to database
        const result = await syncSessionAnalytics(analytics, token);
        
        if (result.success) {
          setSyncStatus('synced');
          console.log('[SessionEndSummary] Analytics synced:', result.sessionId);
        } else {
          setSyncStatus('failed');
          console.warn('[SessionEndSummary] Sync failed:', result.error);
        }
      } catch (error) {
        setSyncStatus('failed');
        console.error('[SessionEndSummary] Sync error:', error);
      }
    };
    
    syncToDatabase();
  }, [performanceData, sessionStartTime, sessionDurationMs, overallStats, sessionSettings, getToken]);
  
  // Clean up all session data on unmount
  const handleClose = () => {
    resetSessionDistribution();
    resetAnswerPatterns();
    resetBehavioralRecords();
    resetMomentum();
    resetPrediction();
    resetPauseTracking();
    onClose();
  };
  
  // Get performance prediction
  const prediction = getPrediction();
  
  // Don't render if not open
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header with Grade */}
        <div className={`${grade.bg} p-6 text-center border-b border-slate-200 dark:border-slate-700`}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className="mb-4"
          >
            <Trophy className={`w-16 h-16 mx-auto ${grade.color}`} />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Session Complete!
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className={`text-5xl font-bold ${grade.color}`}>
              {grade.grade}
            </div>
            <div className="text-left">
              <div className="text-3xl font-bold text-slate-700 dark:text-slate-200">
                {overallStats.accuracy}%
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {overallStats.correct}/{overallStats.total} correct
              </div>
            </div>
          </div>
          {/* Sync status indicator */}
          {syncStatus && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs">
              {syncStatus === 'pending' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
                  <span className="text-slate-500">Saving progress...</span>
                </>
              )}
              {syncStatus === 'synced' && (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Progress saved</span>
                </>
              )}
              {syncStatus === 'failed' && (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">Saved locally</span>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Stats Grid */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {overallStats.total}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Questions</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {overallStats.durationMinutes}m
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Duration</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
              <Zap className="w-6 h-6 mx-auto mb-2 text-amber-500" />
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {overallStats.questionsPerMinute}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Q/min</div>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-center">
              <Flame className="w-6 h-6 mx-auto mb-2 text-orange-500" />
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                {overallStats.maxStreak}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Best Streak</div>
            </div>
          </div>
          
          {/* Distribution Score */}
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  PANCE Distribution Score
                </span>
              </div>
              <span className={`text-xl font-bold ${
                summary.distributionScore >= 80 ? 'text-emerald-500' :
                summary.distributionScore >= 60 ? 'text-amber-500' :
                'text-red-500'
              }`}>
                {summary.distributionScore}/100
              </span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.distributionScore}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className={`h-full rounded-full ${
                  summary.distributionScore >= 80 ? 'bg-emerald-500' :
                  summary.distributionScore >= 60 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              How closely your session followed the official PANCE content blueprint
            </p>
          </div>
          
          {/* System Breakdown */}
          {systemPerformance.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Performance by System
              </h3>
              <div className="space-y-2">
                {systemPerformance.slice(0, 8).map(sp => (
                  <div key={sp.system} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {sp.system}
                    </span>
                    <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          sp.accuracy >= 80 ? 'bg-emerald-400' :
                          sp.accuracy >= 60 ? 'bg-amber-400' :
                          'bg-red-400'
                        }`}
                        style={{ width: `${sp.accuracy}%` }}
                      />
                    </div>
                    <span className={`w-12 text-xs font-bold text-right ${
                      sp.accuracy >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                      sp.accuracy >= 60 ? 'text-amber-600 dark:text-amber-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {sp.accuracy}%
                    </span>
                    <span className="w-10 text-xs text-slate-400 text-right">
                      {sp.correct}/{sp.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Weak Areas Alert */}
          {weakAreas.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  Focus Areas
                </span>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                {weakAreas.map(w => w.name).join(', ')} — consider reviewing these topics
              </p>
            </div>
          )}
          
          {/* Strong Areas */}
          {strongAreas.length > 0 && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-emerald-500" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Strong Areas
                </span>
              </div>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                {strongAreas.map(s => s.name).join(', ')}
              </p>
            </div>
          )}

          {/* Behavioral Insights Section */}
          {(patternAnalysis.overallInsights.length > 0 || behavioralCalibration.insights.length > 0) && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-blue-700 dark:text-blue-400">
                  Test-Taking Insights
                </span>
              </div>
              <ul className="space-y-2">
                {patternAnalysis.overallInsights.slice(0, 3).map((insight, i) => (
                  <li key={`pattern-${i}`} className="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
                {behavioralCalibration.insights.slice(0, 2).map((insight, i) => (
                  <li key={`behavior-${i}`} className="flex items-start gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
              
              {/* Answer change stats */}
              {(patternAnalysis.changedToCorrect > 0 || patternAnalysis.changedToWrong > 0) && (
                <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <p className="text-xs text-blue-500 dark:text-blue-400 mb-2">Answer Changes</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ {patternAnalysis.changedToCorrect} helped
                    </span>
                    <span className="text-red-500 dark:text-red-400">
                      ✗ {patternAnalysis.changedToWrong} hurt
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Sprint 4: Score Prediction Card */}
          {prediction && overallStats.total >= 5 && (
            <div className="mb-6">
              <ScorePredictionCard 
                performanceData={performanceData}
                avgTimePerQuestionMs={overallStats.avgTimePerQuestionMs}
                maxStreak={overallStats.maxStreak}
                avgStreak={overallStats.avgStreak}
              />
            </div>
          )}
          
          {/* Sprint 4: Streak Visualization */}
          {performanceData.length >= 5 && (
            <div className="mb-6">
              <StreakVisualization 
                performanceData={performanceData}
                maxDisplay={50}
              />
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-3">
          {overallStats.incorrect > 0 && onReviewMissed && (
            <button
              onClick={onReviewMissed}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
            >
              <XCircle className="w-5 h-5" />
              Review {overallStats.incorrect} Missed
            </button>
          )}
          
          {/* Metacognitive Reflection Button - Research shows 15-20% learning gains */}
          <button
            onClick={() => setShowReflection(true)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Reflect
          </button>
          
          {onStartNewSession && (
            <button
              onClick={() => {
                resetSessionDistribution();
                resetAnswerPatterns();
                resetBehavioralRecords();
                resetMomentum();
                resetPrediction();
                resetPauseTracking();
                onStartNewSession();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
            >
              <Zap className="w-5 h-5" />
              New Session
            </button>
          )}
          
          <button
            onClick={handleClose}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
      
      {/* Metacognitive Reflection Modal */}
      {showReflection && (
        <MetacognitiveReflection
          sessionPerformance={{
            totalQuestions: overallStats.total,
            correctAnswers: overallStats.correct,
            missedSystems: weakAreas.map(w => w.name),
            missedConditions: performanceData.filter(p => !p.isCorrect).map(p => p.condition || '').filter(Boolean),
            averageTimePerQuestion: overallStats.avgTimePerQuestionMs,
            difficulty: 'medium', // PANCE-level is always medium
          }}
          onComplete={(reflection) => {
            console.log('[SessionEndSummary] Reflection submitted:', reflection);
            // TODO: Sync to database via API
            setShowReflection(false);
          }}
          onSkip={() => setShowReflection(false)}
        />
      )}
    </motion.div>
  );
};

export default SessionEndSummary;
