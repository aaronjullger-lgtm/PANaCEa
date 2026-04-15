/**
 * PageTransition — Smooth route-change wrapper using Framer Motion.
 *
 * Wraps page content with a subtle fade + slide animation on mount/unmount.
 * Respects prefers-reduced-motion for accessibility.
 *
 * Usage:
 *   <PageTransition>
 *     <YourPageComponent />
 *   </PageTransition>
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface PageTransitionProps {
  children: React.ReactNode;
  /** Optional unique key for AnimatePresence — defaults to children identity */
  transitionKey?: string;
}

const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  transitionKey,
}) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={transitionKey}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        duration: 0.3,
        ease: PREMIUM_EASE,
      }}
    >
      {children}
    </motion.div>
  );
};
