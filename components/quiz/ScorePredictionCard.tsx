/**
 * Score Prediction Card
 * 
 * Displays predicted PANCE score with visual gauge and insights.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Award, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Target,
  Lightbulb,
} from 'lucide-react';
import { 
  predictPANCEScore, 
  calculateTrend,
  type PerformanceSnapshot,
} from '../../services/performancePredictionService';
import type { PerformanceRecord } from '../../types';

interface ScorePredictionCardProps {
  performanceData: PerformanceRecord[];
  avgTimePerQuestionMs: number;
  maxStreak: number;
  avgStreak: number;
}

export const ScorePredictionCard: React.FC<ScorePredictionCardProps> = ({
  performanceData,
  avgTimePerQuestionMs,
  maxStreak,
  avgStreak,
}) => {
  const prediction = useMemo(() => {
    if (performanceData.length < 10) return null;
    
    // Calculate overall accuracy
    const correct = performanceData.filter(p => p.isCorrect).length;
    const overallAccuracy = (correct / performanceData.length) * 100;
    
    // Build system performance snapshots
    const systemMap = new Map<string, PerformanceRecord[]>();
    performanceData.forEach(p => {
      const system = p.topic || p.system || 'Unknown';
      if (!systemMap.has(system)) {
        systemMap.set(system, []);
      }
      systemMap.get(system)!.push(p);
    });
    
    const systemPerformance: PerformanceSnapshot[] = [];
    systemMap.forEach((records, system) => {
      if (records.length >= 2) {
        const sysCorrect = records.filter(r => r.isCorrect).length;
        const accuracy = (sysCorrect / records.length) * 100;
        const avgTime = records.reduce((s, r) => s + (r.timeSpentMs || 60000), 0) / records.length;
        
        // Calculate trend from last 5 questions in this system
        const recentAccuracies = records.slice(-5).map(r => r.isCorrect ? 100 : 0);
        const trend = calculateTrend(recentAccuracies);
        
        systemPerformance.push({
          system,
          accuracy,
          totalQuestions: records.length,
          avgTimeMs: avgTime,
          trend,
        });
      }
    });
    
    return predictPANCEScore(
      overallAccuracy,
      performanceData.length,
      systemPerformance,
      avgTimePerQuestionMs,
      { maxStreak, avgStreak }
    );
  }, [performanceData, avgTimePerQuestionMs, maxStreak, avgStreak]);
  
  if (!prediction) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Answer at least 10 questions to see score prediction
        </p>
      </div>
    );
  }
  
  // Calculate gauge rotation (200-800 scale → 0-180 degrees)
  const gaugeRotation = ((prediction.predictedScore - 200) / 600) * 180;
  const passingRotation = ((450 - 200) / 600) * 180; // 450 is passing threshold
  
  // Color based on score
  const scoreColor = prediction.predictedScore >= 500 
    ? 'text-emerald-600 dark:text-emerald-400'
    : prediction.predictedScore >= 450
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-500" />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Score Prediction
            </span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            prediction.confidence === 'high' 
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : prediction.confidence === 'medium'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
          }`}>
            {prediction.confidence} confidence
          </span>
        </div>
      </div>
      
      {/* Score Gauge */}
      <div className="p-4">
        <div className="relative w-40 h-20 mx-auto mb-4">
          {/* Gauge background */}
          <svg viewBox="0 0 100 50" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 5 50 A 45 45 0 0 1 95 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-slate-200 dark:text-slate-700"
            />
            {/* Passing threshold marker */}
            <line
              x1="50"
              y1="5"
              x2="50"
              y2="15"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber-500"
              transform={`rotate(${passingRotation - 90}, 50, 50)`}
            />
            {/* Score indicator */}
            <path
              d="M 5 50 A 45 45 0 0 1 95 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${(gaugeRotation / 180) * 141.37} 141.37`}
              className={
                prediction.predictedScore >= 500 
                  ? 'text-emerald-500'
                  : prediction.predictedScore >= 450
                  ? 'text-amber-500'
                  : 'text-red-500'
              }
            />
          </svg>
          
          {/* Score display */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`text-3xl font-bold ${scoreColor}`}
            >
              {prediction.predictedScore}
            </motion.span>
            <span className="text-xs text-slate-500">/ 800</span>
          </div>
        </div>
        
        {/* Pass likelihood */}
        <div className="text-center mb-4">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
            prediction.passLikelihood >= 70
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : prediction.passLikelihood >= 50
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {prediction.passLikelihood >= 70 ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {prediction.passLikelihood}% pass likelihood
          </div>
        </div>
        
        {/* Strengths & Risk Factors */}
        <div className="space-y-3">
          {prediction.strengths.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                Strengths
              </div>
              <ul className="space-y-0.5">
                {prediction.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-400 pl-4">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {prediction.riskFactors.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <TrendingDown className="w-3.5 h-3.5" />
                Areas to Watch
              </div>
              <ul className="space-y-0.5">
                {prediction.riskFactors.map((r, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-400 pl-4">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {prediction.recommendations.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Lightbulb className="w-3.5 h-3.5" />
                Recommendations
              </div>
              <ul className="space-y-0.5">
                {prediction.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-400 pl-4">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScorePredictionCard;
