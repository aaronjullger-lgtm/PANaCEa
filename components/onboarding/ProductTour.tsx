/**
 * ProductTour - Post-onboarding guided tour
 *
 * Highlights key features: Command Center / Start Session, NavRail, ⌘K Command Palette.
 * Triggered after onboarding completion or first visit to Command Center.
 * Dismissible; persists completion in localStorage.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '@/config/appViews';
import { X, ChevronRight, Sparkles, LayoutDashboard, Command } from 'lucide-react';
import { hasCompletedOnboarding } from '@/services/analytics';

/** Get focusable elements within a container */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

const STORAGE_KEY = 'panceai_product_tour_completed';

const STEPS = [
  {
    id: 'command_center',
    title: 'Your Dashboard',
    description: 'Start sessions, see your progress, and access study tools from here.',
    icon: LayoutDashboard,
    targetSelector: '#main-content',
  },
  {
    id: 'nav_rail',
    title: 'Quick Navigation',
    description: 'Use the left rail to jump between Dashboard, Menu, Reference, and Progress.',
    icon: Sparkles,
    targetSelector: '[aria-label="Quick actions"]',
  },
  {
    id: 'command_palette',
    title: 'Power User Tip',
    description: 'Press ⌘K (or Ctrl+K) anytime to open the command palette and navigate quickly.',
    icon: Command,
  },
] as const;

export function useProductTourShouldShow(): boolean {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      // Never show product tour if onboarding hasn't been completed yet
      if (!hasCompletedOnboarding()) {
        setShouldShow(false);
        return;
      }
      const completed = localStorage.getItem(STORAGE_KEY) === 'true';
      setShouldShow(!completed);
    } catch (err) {
      console.debug('[ProductTour] Failed to check localStorage', err);
      setShouldShow(false);
    }
  }, []);

  return shouldShow;
}

export function markProductTourCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch (err) {
    console.debug('[ProductTour] Failed to persist completion', err);
  }
}

interface ProductTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const ProductTour: React.FC<ProductTourProps> = ({ isOpen, onClose, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  const closeAndRestoreFocus = useCallback(() => {
    markProductTourCompleted();
    onComplete?.();
    const toRestore = previousActiveRef.current;
    onClose();
    requestAnimationFrame(() => {
      if (toRestore && typeof toRestore.focus === 'function') {
        toRestore.focus();
      } else {
        const skipLink = document.querySelector<HTMLElement>('a[href="#main-content"]');
        skipLink?.focus();
      }
    });
  }, [onClose, onComplete]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      closeAndRestoreFocus();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [isLastStep, closeAndRestoreFocus]);

  const handleSkip = useCallback(() => {
    closeAndRestoreFocus();
  }, [closeAndRestoreFocus]);

  // Focus trap and initial focus
  useEffect(() => {
    const container = modalRef.current;
    if (!isOpen || !container) return;
    previousActiveRef.current = (document.activeElement as HTMLElement) || null;
    const focusables = getFocusableElements(container);
    focusables[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const currentFocusables = getFocusableElements(container);
      if (currentFocusables.length === 0) return;

      const first = currentFocusables[0];
      const last = currentFocusables.at(-1);
      const current = document.activeElement as HTMLElement;

      if (e.shiftKey && current === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleSkip]);

  if (!isOpen || !step) return null;

  const Icon = step.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={false}
        animate={{}}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] pointer-events-none"
        aria-live="polite"
        aria-label="Product tour"
      >
        {/* Backdrop - clickable to advance */}
        <div
          className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm pointer-events-auto cursor-pointer"
          onClick={handleNext}
          aria-hidden
        />

        {/* Tooltip card */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-tour-title"
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10 }}
          transition={springs.snappy}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md mx-4 pointer-events-auto z-[60]"
        >
          <div className="bg-[var(--color-bg-secondary)] rounded-2xl shadow-[0_18px_42px_var(--color-shadow-soft)] border border-[var(--color-border)] overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-[var(--color-accent)]/10">
                    <Icon className="w-6 h-6 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3
                      id="product-tour-title"
                      className="text-lg font-bold text-[var(--color-text-primary)]"
                    >
                      {step.title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSkip}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] transition-colors"
                  aria-label="Skip tour"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-6">
                <div className="flex gap-1">
                  {STEPS.map((s, i) => (
                    <div
                      key={s.id}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === stepIndex
                          ? 'bg-[var(--color-accent)]'
                          : 'bg-[var(--color-bg-tertiary)]'
                      }`}
                      aria-hidden
                    />
                  ))}
                </div>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  {isLastStep ? 'Get Started' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProductTour;
