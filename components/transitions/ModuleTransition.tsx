/**
 * Module Transition
 * 
 * Smooth animated transitions between modules with context preservation.
 * Supports: medical scan, zoom, fade, and crossfade animations.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModuleTransitionProps {
  fromModule: string;
  toModule: string;
  children: React.ReactNode;
  type?: 'medical_scan' | 'zoom' | 'fade' | 'crossfade';
  contextPreview?: {
    patientName?: string;
    diagnosis?: string;
    [key: string]: any;
  };
  onComplete?: () => void;
}

export function ModuleTransition({
  fromModule,
  toModule,
  children,
  type = 'fade',
  contextPreview,
  onComplete,
}: ModuleTransitionProps) {
  const [showPreview, setShowPreview] = useState(!!contextPreview);

  useEffect(() => {
    if (contextPreview) {
      const timer = setTimeout(() => {
        setShowPreview(false);
        onComplete?.();
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      onComplete?.();
    }
  }, [contextPreview, onComplete]);

  const getTransitionVariants = () => {
    switch (type) {
      case 'medical_scan':
        return {
          initial: { clipPath: 'inset(0 0 100% 0)', filter: 'hue-rotate(0deg)' },
          animate: { clipPath: 'inset(0 0 0 0)', filter: 'hue-rotate(20deg)' },
          exit: { clipPath: 'inset(0 0 0 0)', filter: 'hue-rotate(0deg)' },
        };
      case 'zoom':
        return {
          initial: { scale: 0.5, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 2, opacity: 0 },
        };
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case 'crossfade':
        return {
          initial: { opacity: 0, x: 20 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -20 },
        };
    }
  };

  return (
    <>
      {/* Context Preview Overlay */}
      <AnimatePresence>
        {showPreview && contextPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[var(--color-bg-primary)] rounded-2xl p-8 max-w-md border border-[var(--color-border)] shadow-2xl"
            >
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
                Transitioning: {fromModule} → {toModule}
              </h3>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs">
                    ✓
                  </div>
                  <span className="text-[var(--color-text-secondary)]">
                    Context preserved
                  </span>
                </div>
                
                {contextPreview.patientName && (
                  <div className="pl-8 text-[var(--color-text-muted)]">
                    Patient: {contextPreview.patientName}
                  </div>
                )}
                
                {contextPreview.diagnosis && (
                  <div className="pl-8 text-[var(--color-text-muted)]">
                    Diagnosis: {contextPreview.diagnosis}
                  </div>
                )}
              </div>

              <div className="mt-4 h-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5 }}
                  className="h-full bg-[var(--color-accent)]"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content with transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={toModule}
          variants={getTransitionVariants()}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: type === 'medical_scan' ? 0.8 : 0.5 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
