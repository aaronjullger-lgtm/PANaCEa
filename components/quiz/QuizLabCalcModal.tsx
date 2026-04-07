/**
 * QuizLabCalcModal – Built-in Calc button for Anion Gap, Osmolar Gap, Parkland
 *
 * Shown inside the question interface to encourage active calculation.
 * @see docs/IMMEDIATE_CONTENT_ACTION_PLAN.md
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Beaker, Droplet, Flame } from 'lucide-react';
import {
  AnionGapCalculator,
  OsmolarGapCalculator,
  ParklandCalculator,
} from '@/components/toolkit/calculators/lab';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '@/lib/utils/accessibilityUtils';

export interface QuizLabCalcModalProps {
  onClose: () => void;
}

type CalcTab = 'anion_gap' | 'osmolar_gap' | 'parkland';

const TABS: { id: CalcTab; label: string; icon: React.ElementType }[] = [
  { id: 'anion_gap', label: 'Anion Gap', icon: Beaker },
  { id: 'osmolar_gap', label: 'Osmolar Gap', icon: Beaker },
  { id: 'parkland', label: 'Parkland Formula', icon: Flame },
];

export const QuizLabCalcModal: React.FC<QuizLabCalcModalProps> = ({ onClose }) => {
  const [selectedTab, setSelectedTab] = useState<CalcTab | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Accessibility: trap focus within modal
  useFocusTrap(modalRef as React.RefObject<HTMLElement>, true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBack = () => setSelectedTab(null);

  return (
    <div ref={modalRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-overlay)] backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-label="Lab Calculators"
        className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">Lab Calculators</span>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <AnimatePresence mode="wait">
          {selectedTab === null ? (
            <motion.div
              key="tabs"
              initial={false}
              animate={{}}
              exit={{ opacity: 0 }}
              className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedTab(tab.id)}
                    className="flex items-center gap-3 p-4 rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] transition-colors text-left"
                  >
                    <Icon className="w-8 h-8 text-[var(--color-accent)] flex-shrink-0" />
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key={selectedTab}
              initial={{ x: 8 }}
              animate={{ x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex-1 overflow-y-auto p-4"
            >
              {selectedTab === 'anion_gap' && <AnionGapCalculator onBack={handleBack} />}
              {selectedTab === 'osmolar_gap' && <OsmolarGapCalculator onBack={handleBack} />}
              {selectedTab === 'parkland' && <ParklandCalculator onBack={handleBack} />}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
