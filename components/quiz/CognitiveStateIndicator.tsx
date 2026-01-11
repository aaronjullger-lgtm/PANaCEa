/**
 * CognitiveStateIndicator
 * 
 * A compact visual indicator showing the user's current cognitive state
 * Used in QuizView to provide real-time feedback on fatigue, focus, and flow
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, Coffee, Target } from 'lucide-react';
import type { CognitiveState } from '@/services/analytics';

interface CognitiveStateIndicatorProps {
  cognitiveState: CognitiveState | null;
  compact?: boolean;
}

export const CognitiveStateIndicator: React.FC<CognitiveStateIndicatorProps> = ({
  cognitiveState,
  compact = true,
}) => {
  if (!cognitiveState) return null;
  
  const { cognitiveLoad, fatigueLevel, flowState, attentionLevel } = cognitiveState;
  
  // Determine overall state
  const getOverallState = (): { 
    label: string; 
    color: string; 
    icon: React.ReactNode;
    bg: string;
  } => {
    if (flowState > 70) {
      return {
        label: 'In Flow',
        color: 'text-emerald-500',
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        icon: <Zap className="w-4 h-4" />,
      };
    }
    if (fatigueLevel > 60) {
      return {
        label: 'Consider Break',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10 border-amber-500/30',
        icon: <Coffee className="w-4 h-4" />,
      };
    }
    if (cognitiveLoad > 75) {
      return {
        label: 'High Load',
        color: 'text-orange-500',
        bg: 'bg-orange-500/10 border-orange-500/30',
        icon: <Brain className="w-4 h-4" />,
      };
    }
    if (attentionLevel > 70) {
      return {
        label: 'Focused',
        color: 'text-blue-500',
        bg: 'bg-blue-500/10 border-blue-500/30',
        icon: <Target className="w-4 h-4" />,
      };
    }
    return {
      label: 'Studying',
      color: 'text-slate-500',
      bg: 'bg-slate-500/10 border-slate-500/30',
      icon: <Brain className="w-4 h-4" />,
    };
  };
  
  const state = getOverallState();
  
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${state.bg} ${state.color} text-xs font-medium`}
      >
        {state.icon}
        <span>{state.label}</span>
      </motion.div>
    );
  }
  
  // Expanded view with all metrics
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-blue-500" />
        <span className="font-medium text-[var(--color-text-primary)]">Cognitive State</span>
        <div className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${state.bg} ${state.color} text-xs font-medium`}>
          {state.icon}
          <span>{state.label}</span>
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricBar label="Focus" value={attentionLevel} color="blue" />
        <MetricBar label="Flow" value={flowState} color="emerald" />
        <MetricBar label="Load" value={cognitiveLoad} color="orange" inverted />
        <MetricBar label="Fatigue" value={fatigueLevel} color="red" inverted />
      </div>
    </motion.div>
  );
};

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
  inverted?: boolean;
}

const MetricBar: React.FC<MetricBarProps> = ({ label, value, color, inverted }) => {
  // For inverted metrics, lower is better
  const displayValue = inverted ? 100 - value : value;
  const barColor = inverted
    ? value > 60 ? 'bg-red-500' : value > 40 ? 'bg-amber-500' : 'bg-emerald-500'
    : `bg-${color}-500`;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-medium text-[var(--color-text-primary)]">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--color-surface)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, displayValue)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={`h-full rounded-full ${inverted ? barColor : `bg-${color}-500`}`}
          style={!inverted ? { backgroundColor: `var(--color-${color}, rgb(59, 130, 246))` } : undefined}
        />
      </div>
    </div>
  );
};

export default CognitiveStateIndicator;
