/**
 * Confidence Calibration
 * 
 * Tracks how well users' confidence aligns with actual performance.
 * Helps identify overconfidence or underconfidence patterns.
 * Key for PANCE success: knowing what you don't know.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Info, ChevronDown, ChevronUp } from 'lucide-react';

// Confidence levels
export type ConfidenceLevel = 'very_sure' | 'somewhat_sure' | 'guessing';

interface ConfidenceRecord {
  confidence: ConfidenceLevel;
  wasCorrect: boolean;
  timestamp: number;
}

interface ConfidenceSelectorProps {
  onSelect: (confidence: ConfidenceLevel) => void;
  disabled?: boolean;
  selectedConfidence?: ConfidenceLevel | null;
}

interface ConfidenceCalibrationProps {
  records: ConfidenceRecord[];
  isExpanded?: boolean;
  onToggle?: () => void;
}

// Confidence selection buttons
export const ConfidenceSelector: React.FC<ConfidenceSelectorProps> = ({
  onSelect,
  disabled = false,
  selectedConfidence = null,
}) => {
  const options: { value: ConfidenceLevel; label: string; shortLabel: string; color: string }[] = [
    { value: 'very_sure', label: 'Very Sure', shortLabel: 'Sure', color: 'bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200' },
    { value: 'somewhat_sure', label: 'Somewhat Sure', shortLabel: 'Maybe', color: 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200' },
    { value: 'guessing', label: 'Guessing', shortLabel: 'Guess', color: 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' },
  ];
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 mr-1">Confidence:</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          disabled={disabled}
          className={`px-2 py-1 text-xs font-medium rounded-md border transition-all ${
            selectedConfidence === opt.value
              ? `${opt.color} ring-2 ring-offset-1 ring-slate-400`
              : `${opt.color} opacity-70`
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className="hidden sm:inline">{opt.label}</span>
          <span className="sm:hidden">{opt.shortLabel}</span>
        </button>
      ))}
    </div>
  );
};

// Calibration score and breakdown
export const ConfidenceCalibration: React.FC<ConfidenceCalibrationProps> = ({
  records,
  isExpanded = false,
  onToggle,
}) => {
  const stats = useMemo(() => {
    if (records.length === 0) return null;
    
    const byConfidence = {
      very_sure: { correct: 0, total: 0 },
      somewhat_sure: { correct: 0, total: 0 },
      guessing: { correct: 0, total: 0 },
    };
    
    records.forEach(r => {
      byConfidence[r.confidence].total++;
      if (r.wasCorrect) byConfidence[r.confidence].correct++;
    });
    
    // Calculate accuracy for each level
    const getAccuracy = (level: ConfidenceLevel) => {
      const { correct, total } = byConfidence[level];
      return total > 0 ? Math.round((correct / total) * 100) : null;
    };
    
    // Expected accuracy ranges
    const expectedRanges = {
      very_sure: { min: 85, max: 100 },
      somewhat_sure: { min: 50, max: 85 },
      guessing: { min: 20, max: 50 },
    };
    
    // Calculate calibration score (how well confidence matches performance)
    let calibrationScore = 0;
    let calibrationCount = 0;
    
    Object.entries(byConfidence).forEach(([level, data]) => {
      if (data.total >= 3) {
        const accuracy = (data.correct / data.total) * 100;
        const expected = expectedRanges[level as ConfidenceLevel];
        const midpoint = (expected.min + expected.max) / 2;
        
        // Perfect calibration = 100, off by 50 percentage points = 0
        const deviation = Math.abs(accuracy - midpoint);
        const levelScore = Math.max(0, 100 - (deviation * 2));
        
        calibrationScore += levelScore;
        calibrationCount++;
      }
    });
    
    const finalScore = calibrationCount > 0 ? Math.round(calibrationScore / calibrationCount) : null;
    
    return {
      byConfidence,
      verySureAccuracy: getAccuracy('very_sure'),
      somewhatSureAccuracy: getAccuracy('somewhat_sure'),
      guessingAccuracy: getAccuracy('guessing'),
      calibrationScore: finalScore,
      total: records.length,
    };
  }, [records]);
  
  if (!stats || stats.total < 5) {
    return (
      <div className="text-xs text-slate-500 italic">
        Answer {5 - (stats?.total || 0)} more questions with confidence ratings to see calibration
      </div>
    );
  }
  
  const getCalibrationStatus = (accuracy: number | null, expected: { min: number; max: number }) => {
    if (accuracy === null) return { icon: Minus, color: 'text-slate-400', label: 'N/A' };
    if (accuracy >= expected.min && accuracy <= expected.max) {
      return { icon: TrendingUp, color: 'text-emerald-600', label: 'Well calibrated' };
    }
    if (accuracy > expected.max) {
      return { icon: TrendingUp, color: 'text-blue-600', label: 'Underconfident' };
    }
    return { icon: TrendingDown, color: 'text-amber-600', label: 'Overconfident' };
  };
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Confidence Calibration
            </span>
          </div>
          {stats.calibrationScore !== null && (
            <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              stats.calibrationScore >= 75 ? 'bg-emerald-100 text-emerald-700' :
              stats.calibrationScore >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {stats.calibrationScore}%
            </div>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      
      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              {/* Very Sure */}
              <ConfidenceRow
                label="Very Sure"
                accuracy={stats.verySureAccuracy}
                count={stats.byConfidence.very_sure.total}
                expected={{ min: 85, max: 100 }}
                color="emerald"
              />
              
              {/* Somewhat Sure */}
              <ConfidenceRow
                label="Somewhat Sure"
                accuracy={stats.somewhatSureAccuracy}
                count={stats.byConfidence.somewhat_sure.total}
                expected={{ min: 50, max: 85 }}
                color="amber"
              />
              
              {/* Guessing */}
              <ConfidenceRow
                label="Guessing"
                accuracy={stats.guessingAccuracy}
                count={stats.byConfidence.guessing.total}
                expected={{ min: 20, max: 50 }}
                color="slate"
              />
              
              {/* Interpretation */}
              <div className="pt-2 text-xs text-slate-500 leading-relaxed">
                {stats.calibrationScore !== null && stats.calibrationScore >= 75 ? (
                  <span className="text-emerald-600">
                    ✓ Your confidence aligns well with performance - you know what you know!
                  </span>
                ) : stats.verySureAccuracy !== null && stats.verySureAccuracy < 80 ? (
                  <span className="text-amber-600">
                    ⚠ Consider slowing down on "Very Sure" answers - review before submitting.
                  </span>
                ) : stats.guessingAccuracy !== null && stats.guessingAccuracy > 50 ? (
                  <span className="text-blue-600">
                    💡 You're underconfident! Trust your knowledge more on uncertain questions.
                  </span>
                ) : (
                  <span>Keep answering to improve calibration insights.</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Individual confidence row
const ConfidenceRow: React.FC<{
  label: string;
  accuracy: number | null;
  count: number;
  expected: { min: number; max: number };
  color: 'emerald' | 'amber' | 'slate';
}> = ({ label, accuracy, count, expected, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-100 border-emerald-200',
    amber: 'bg-amber-100 border-amber-200',
    slate: 'bg-slate-100 border-slate-200',
  };
  
  const status = (() => {
    if (accuracy === null || count < 3) return null;
    if (accuracy >= expected.min && accuracy <= expected.max) return 'calibrated';
    if (accuracy > expected.max) return 'underconfident';
    return 'overconfident';
  })();
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colorClasses[color].split(' ')[0]}`} />
        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-xs text-slate-400">({count})</span>
      </div>
      <div className="flex items-center gap-2">
        {accuracy !== null ? (
          <>
            <span className={`text-sm font-medium ${
              status === 'calibrated' ? 'text-emerald-600' :
              status === 'underconfident' ? 'text-blue-600' :
              status === 'overconfident' ? 'text-amber-600' :
              'text-slate-600'
            }`}>
              {accuracy}%
            </span>
            <span className="text-xs text-slate-400">
              (expect {expected.min}-{expected.max}%)
            </span>
          </>
        ) : (
          <span className="text-xs text-slate-400">Need more data</span>
        )}
      </div>
    </div>
  );
};

// Hook for managing confidence state
export function useConfidenceTracking() {
  const [records, setRecords] = useState<ConfidenceRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = sessionStorage.getItem('panceai_confidence_records');
    return stored ? JSON.parse(stored) : [];
  });
  
  const [currentConfidence, setCurrentConfidence] = useState<ConfidenceLevel | null>(null);
  
  const recordConfidence = (wasCorrect: boolean) => {
    if (!currentConfidence) return;
    
    const newRecord: ConfidenceRecord = {
      confidence: currentConfidence,
      wasCorrect,
      timestamp: Date.now(),
    };
    
    setRecords(prev => {
      const updated = [...prev, newRecord];
      sessionStorage.setItem('panceai_confidence_records', JSON.stringify(updated));
      return updated;
    });
    
    setCurrentConfidence(null);
  };
  
  const resetRecords = () => {
    setRecords([]);
    sessionStorage.removeItem('panceai_confidence_records');
  };
  
  return {
    records,
    currentConfidence,
    setCurrentConfidence,
    recordConfidence,
    resetRecords,
  };
}

export default ConfidenceCalibration;
