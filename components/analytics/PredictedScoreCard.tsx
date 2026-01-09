/**
 * Predicted Score Card Component
 * Sprint 7: Visual display of predicted PANCE score with confidence interval
 * 
 * Shows the user's estimated exam score based on their practice performance,
 * with visual indicators for readiness level and actionable recommendations.
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  ChevronRight,
  Sparkles,
  BarChart3,
  Clock,
} from "lucide-react";
import type { PredictedScore } from "../../services/panceScorePredictorService";

// =============================================================================
// TYPES
// =============================================================================

export interface PredictedScoreCardProps {
  prediction: PredictedScore;
  percentile?: number;
  trend?: { direction: "up" | "down" | "stable"; change: number };
  questionsAnswered: number;
  targetDate?: Date;
  onViewDetails?: () => void;
  isLoading?: boolean;
  compact?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const READINESS_CONFIG = {
  confident_pass: {
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    ringColor: "ring-emerald-500",
    label: "Confident Pass",
    description: "You're well-prepared for the exam!",
  },
  likely_pass: {
    icon: Target,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-900/20",
    borderColor: "border-teal-200 dark:border-teal-800",
    ringColor: "ring-teal-500",
    label: "Likely Pass",
    description: "On track - keep up the momentum!",
  },
  borderline: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    ringColor: "ring-amber-500",
    label: "Borderline",
    description: "More focused preparation needed.",
  },
  not_ready: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
    ringColor: "ring-red-500",
    label: "Not Ready",
    description: "Significant improvement needed.",
  },
};

// Pass threshold line position (350 on 200-800 scale)
const PASS_THRESHOLD = 350;
const SCALE_MIN = 200;
const SCALE_MAX = 800;

// =============================================================================
// COMPONENT
// =============================================================================

export function PredictedScoreCard({
  prediction,
  percentile,
  trend,
  questionsAnswered,
  targetDate,
  onViewDetails,
  isLoading = false,
  compact = false,
}: PredictedScoreCardProps) {
  const readinessConfig = READINESS_CONFIG[prediction.readinessLevel];
  const ReadinessIcon = readinessConfig.icon;

  // Calculate score bar position (0-100%)
  const scorePosition = useMemo(() => {
    if (prediction.scaledScore === 0) return 0;
    return ((prediction.scaledScore - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  }, [prediction.scaledScore]);

  // Calculate confidence interval positions
  const confidencePositions = useMemo(() => {
    if (prediction.confidenceInterval.lower === 0) return { lower: 0, upper: 0 };
    return {
      lower: ((prediction.confidenceInterval.lower - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100,
      upper: ((prediction.confidenceInterval.upper - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100,
    };
  }, [prediction.confidenceInterval]);

  // Pass threshold position
  const passPosition = ((PASS_THRESHOLD - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`rounded-2xl border-2 p-6 bg-slate-50 dark:bg-slate-800/50 ${compact ? "p-4" : "p-6"}`}>
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-16 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full" />
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  // Insufficient data state
  if (prediction.scaledScore === 0) {
    return (
      <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-200 dark:bg-slate-700">
            <BarChart3 className="h-6 w-6 text-slate-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Predicted PANCE Score
            </h3>
            <p className="text-sm text-slate-500">Insufficient data</p>
          </div>
        </div>
        
        <div className="text-center py-8">
          <p className="text-4xl font-bold text-slate-300 dark:text-slate-600 mb-2">---</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Answer more questions to see your predicted score
          </p>
          
          {/* Progress to prediction */}
          <div className="max-w-xs mx-auto">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{questionsAnswered} answered</span>
              <span>100 needed</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, questionsAnswered)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {prediction.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="text-slate-600 dark:text-slate-400">{rec}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        rounded-2xl border-2 ${readinessConfig.borderColor}
        ${readinessConfig.bgColor}
        ${compact ? "p-4" : "p-6"}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${readinessConfig.bgColor} ring-2 ${readinessConfig.ringColor}`}>
            <ReadinessIcon className={`h-6 w-6 ${readinessConfig.color}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Predicted PANCE Score
            </h3>
            <p className={`text-sm ${readinessConfig.color}`}>
              {readinessConfig.label}
            </p>
          </div>
        </div>
        
        {/* Trend indicator */}
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
            trend.direction === "up" 
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
              : trend.direction === "down"
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600"
          }`}>
            {trend.direction === "up" && <TrendingUp className="h-4 w-4" />}
            {trend.direction === "down" && <TrendingDown className="h-4 w-4" />}
            <span>{trend.change > 0 ? "+" : ""}{trend.change}</span>
          </div>
        )}
      </div>

      {/* Main Score Display */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <motion.p
            key={prediction.scaledScore}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-5xl font-bold text-slate-900 dark:text-white"
          >
            {prediction.scaledScore}
          </motion.p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {prediction.confidenceInterval.lower} - {prediction.confidenceInterval.upper} (95% CI)
          </p>
        </div>
        
        <div className="flex-grow">
          <div className="flex items-center gap-4">
            {/* Pass Likelihood Gauge */}
            <div className="text-center">
              <div className={`
                relative w-16 h-16 rounded-full border-4
                ${prediction.passLikelihood >= 75 
                  ? "border-emerald-500" 
                  : prediction.passLikelihood >= 50 
                    ? "border-amber-500" 
                    : "border-red-500"
                }
              `}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {prediction.passLikelihood}%
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Pass Likelihood</p>
            </div>
            
            {/* Percentile (if available) */}
            {percentile !== undefined && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500 flex items-center justify-center">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {percentile}th
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Percentile</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score Visualization Bar */}
      {!compact && (
        <div className="mb-6">
          <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-visible">
            {/* Confidence interval range */}
            <div
              className="absolute h-full bg-indigo-200 dark:bg-indigo-900/50 rounded-full"
              style={{
                left: `${confidencePositions.lower}%`,
                width: `${confidencePositions.upper - confidencePositions.lower}%`,
              }}
            />
            
            {/* Pass threshold line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500"
              style={{ left: `${passPosition}%` }}
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs text-slate-500">Pass: {PASS_THRESHOLD}</span>
              </div>
            </div>
            
            {/* Current score indicator */}
            <motion.div
              initial={{ left: "0%" }}
              animate={{ left: `${scorePosition}%` }}
              transition={{ type: "spring", damping: 20 }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            >
              <div className={`
                w-5 h-5 rounded-full border-3 border-white dark:border-slate-800 shadow-lg
                ${prediction.scaledScore >= PASS_THRESHOLD ? "bg-emerald-500" : "bg-red-500"}
              `} />
            </motion.div>
          </div>
          
          {/* Scale labels */}
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>{SCALE_MIN}</span>
            <span>{SCALE_MAX}</span>
          </div>
        </div>
      )}

      {/* Projected Pass Date (if not ready) */}
      {prediction.projectedDate && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 mb-4">
          <Calendar className="h-5 w-5 text-indigo-500" />
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Estimated Ready Date
            </p>
            <p className="text-xs text-slate-500">
              {prediction.projectedDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      {!compact && (prediction.strengths.length > 0 || prediction.weaknesses.length > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {prediction.strengths.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Strengths
              </p>
              <div className="space-y-1">
                {prediction.strengths.slice(0, 3).map((s, i) => (
                  <div key={i} className="text-sm text-emerald-700 dark:text-emerald-300 capitalize">
                    {s.replace(/_/g, " ")}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {prediction.weaknesses.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Focus Areas
              </p>
              <div className="space-y-1">
                {prediction.weaknesses.slice(0, 3).map((w, i) => (
                  <div key={i} className="text-sm text-red-700 dark:text-red-300 capitalize">
                    {w.replace(/_/g, " ")}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {!compact && prediction.recommendations.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-slate-500">Recommendations</p>
          {prediction.recommendations.slice(0, 3).map((rec, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <ChevronRight className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700 dark:text-slate-300">{rec}</span>
            </div>
          ))}
        </div>
      )}

      {/* View Details Button */}
      {onViewDetails && (
        <button
          onClick={onViewDetails}
          className="w-full py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
        >
          View Full Analytics →
        </button>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200/50 dark:border-slate-700/50 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          <span>{questionsAnswered} questions analyzed</span>
        </div>
        {targetDate && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Exam: {targetDate.toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default PredictedScoreCard;
