/**
 * StudyTimerOverlay — Floating study timer that sits in the corner of study views.
 *
 * Renders as a fixed-position compact timer in the bottom-right corner.
 * Auto-minimizes after starting. Click to expand. Dismissible.
 *
 * Wired into session_runner and quiz views via AppRoutes.
 */

import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, X } from 'lucide-react';
import { StudyTimer } from './StudyTimer';

interface StudyTimerOverlayProps {
  /** Whether to show the overlay */
  visible?: boolean;
}

export const StudyTimerOverlay: React.FC<StudyTimerOverlayProps> = ({ visible = true }) => {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 40,
          maxWidth: 280,
        }}
      >
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss timer"
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              zIndex: 50,
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 10,
            }}
          >
            <X size={10} />
          </button>
          <StudyTimer compact />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default StudyTimerOverlay;
