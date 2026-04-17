/**
 * Achievement Notification
 *
 * Displays achievement unlock notifications with celebration animation.
 * Shows badge, rarity, and XP gained.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Award, X, Star, Trophy } from 'lucide-react';
import { springs } from '@/config/appViews';
import type { AchievementBadge } from '@/types/interface-fabric-system';

interface AchievementNotificationProps {
  badge: AchievementBadge | null;
  xpGained?: number;
  onDismiss: () => void;
  autoDismiss?: boolean;
  autoDismissDelay?: number;
}

export function AchievementNotification({
  badge,
  xpGained,
  onDismiss,
  autoDismiss = true,
  autoDismissDelay = 5000,
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (badge) {
      setIsVisible(true);

      if (autoDismiss) {
        const timer = setTimeout(() => {
          setIsVisible(false);
          setTimeout(onDismiss, 300);
        }, autoDismissDelay);

        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [badge, autoDismiss, autoDismissDelay, onDismiss]);

  const getRarityColor = (rarity: AchievementBadge['rarity']) => {
    switch (rarity) {
      case 'common':
        return 'from-slate-400 to-slate-600';
      case 'uncommon':
        return 'from-emerald-400 to-emerald-600';
      case 'rare':
        return 'from-blue-400 to-blue-600';
      case 'epic':
        return 'from-purple-400 to-purple-600';
      case 'legendary':
        return 'from-amber-400 to-amber-600';
    }
  };

  const getRarityGlow = (rarity: AchievementBadge['rarity']) => {
    switch (rarity) {
      case 'common':
        return '0 0 20px rgba(148, 163, 184, 0.5)';
      case 'uncommon':
        return '0 0 20px rgba(16, 185, 129, 0.5)';
      case 'rare':
        return '0 0 20px rgba(59, 130, 246, 0.5)';
      case 'epic':
        return '0 0 30px rgba(139, 92, 246, 0.7)';
      case 'legendary':
        return '0 0 40px rgba(245, 158, 11, 0.8)';
    }
  };

  return (
    <AnimatePresence>
      {isVisible && badge && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : undefined}
          className="fixed inset-0 bg-[var(--color-overlay)] backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
          }}
        >
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0, y: 50 }}
            transition={prefersReducedMotion ? { duration: 0 } : springs.bouncy}
            className="bg-[var(--color-bg-primary)] rounded-2xl p-8 max-w-md w-full border border-[var(--color-border)] shadow-[0_18px_42px_var(--color-shadow-soft)]"
            style={{ boxShadow: getRarityGlow(badge.rarity) }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                initial={prefersReducedMotion ? false : { scale: 0 }}
                animate={{ scale: 1, rotate: prefersReducedMotion ? 0 : 360 }}
                transition={
                  prefersReducedMotion ? { duration: 0 } : { delay: 0.2, ...springs.wobbly }
                }
                className="inline-block mb-4"
              >
                <div
                  className={`w-24 h-24 rounded-full bg-gradient-to-br ${getRarityColor(badge.rarity)} flex items-center justify-center`}
                >
                  <Award className="w-12 h-12 text-[var(--color-text-inverse)]" />
                </div>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { y: 20, opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.4 }}
              >
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                  Achievement Unlocked!
                </h2>
                <div
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 bg-gradient-to-r ${getRarityColor(badge.rarity)} text-[var(--color-text-inverse)]`}
                >
                  {badge.rarity}
                </div>
              </motion.div>
            </div>

            {/* Badge Details */}
            <motion.div
              initial={prefersReducedMotion ? false : { y: 20, opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.6 }}
              className="space-y-4"
            >
              <div className="text-center">
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                  {badge.name}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{badge.description}</p>
              </div>

              {/* XP Gained */}
              {xpGained && xpGained > 0 && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30">
                  <Star className="w-5 h-5 text-[var(--color-accent)]" />
                  <span className="text-lg font-bold text-[var(--color-accent)]">
                    +{xpGained} XP
                  </span>
                </div>
              )}

              {/* Confetti Effect */}
              {badge.rarity === 'epic' || badge.rarity === 'legendary' ? (
                <div className="text-center flex justify-center gap-2">
                  <Trophy className="w-12 h-12 text-[var(--color-accent)]" />
                </div>
              ) : null}
            </motion.div>

            {/* Action Button */}
            <motion.button
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.8 }}
              onClick={() => {
                setIsVisible(false);
                setTimeout(onDismiss, 300);
              }}
              className="w-full mt-6 px-4 py-3 rounded-lg bg-[var(--color-accent)] text-[var(--color-btn-primary-text)] font-semibold hover:opacity-90 transition-opacity"
            >
              Awesome!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
