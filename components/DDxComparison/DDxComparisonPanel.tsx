/**
 * DDx Comparison Panel Component
 *
 * Displays a side-by-side comparison of two commonly confused conditions.
 * Shows similarities, differences, buzzwords, diagnostics, and treatments.
 * Slides in from the bottom after an incorrect answer.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Layers } from 'lucide-react';
import type { DDxComparison } from '@/lib/services/confusionService';
import DDxTable from './DDxTable';

interface DDxComparisonPanelProps {
  /** The comparison data to display */
  comparison: DDxComparison | null;
  /** Whether the panel is visible */
  isVisible: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback to start drill mode for both conditions */
  onDrillBoth?: (conditionA: string, conditionB: string) => void;
}

/**
 * DDxComparisonPanel - Slide-up panel showing condition comparison
 */
const DDxComparisonPanel: React.FC<DDxComparisonPanelProps> = ({
  comparison,
  isVisible,
  onClose,
  onDrillBoth,
}) => {
  if (!comparison) return null;

  const handleDrillBoth = () => {
    if (onDrillBoth) {
      onDrillBoth(comparison.conditionA, comparison.conditionB);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-red-500 dark:text-red-400 font-medium mb-1">
                  You confused these conditions
                </p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  {comparison.conditionA} vs {comparison.conditionB}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close comparison panel"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 max-h-[calc(85vh-140px)]">
              <DDxTable comparison={comparison} />
            </div>

            {/* Footer with CTA */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <button
                onClick={handleDrillBoth}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                <Layers className="w-5 h-5" />
                Drill Both Conditions
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DDxComparisonPanel;
