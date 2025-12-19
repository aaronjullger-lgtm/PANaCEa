import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Sparkles } from 'lucide-react';

interface AlgorithmStatusWidgetProps {
  lastTuned: Date;
  reason: string;
  adjustment: 'tighten' | 'loosen';
}

/**
 * Algorithm Status Widget (Refactored from NeuralLinkLog)
 * Professional, clean "System Notification" card showing AI optimization updates
 */
const AlgorithmStatusWidget: React.FC<AlgorithmStatusWidgetProps> = ({
  lastTuned,
  reason,
  adjustment,
}) => {
  const getNextOptimization = () => {
    const now = new Date();
    const nextOptimization = new Date(lastTuned.getTime() + 14 * 60 * 60 * 1000);
    const diff = nextOptimization.getTime() - now.getTime();

    if (diff <= 0) return 'Processing...';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Optimization Update
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {lastTuned.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 bg-blue-500 rounded-full"
        />
      </div>

      {/* Status Message */}
      <div className="space-y-3">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              Algorithm adjusted for{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {reason}
              </span>{' '}
              based on recent drift.
              {adjustment === 'tighten' ? ' Intervals tightened.' : ' Intervals relaxed.'}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Adjustment</p>
            <p className={`text-sm font-semibold ${
              adjustment === 'tighten'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-green-600 dark:text-green-400'
            }`}>
              {adjustment === 'tighten' ? '↑ Tighter' : '↓ Looser'}
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Next Update</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {getNextOptimization()}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AlgorithmStatusWidget;
