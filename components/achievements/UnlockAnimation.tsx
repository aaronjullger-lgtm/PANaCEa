/**
 * Achievement Unlock Animation Component
 * Professional, subtle celebration animation for achievement unlocks
 * No cartoonish elements, premium medical platform aesthetic
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Trophy, Star, Shield } from 'lucide-react';
import { getAchievementById, getAchievementRarityColor } from '../../config/achievements';

interface UnlockAnimationProps {
  achievementId: string;
  onComplete?: () => void;
  autoHideDuration?: number; // milliseconds, default 4000
}

export function UnlockAnimation({
  achievementId,
  onComplete,
  autoHideDuration = 4000,
}: UnlockAnimationProps) {
  const [show, setShow] = useState(true);
  const achievement = getAchievementById(achievementId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(() => {
        onComplete?.();
      }, 500);
    }, autoHideDuration);

    return () => clearTimeout(timer);
  }, [autoHideDuration, onComplete]);

  if (!achievement) return null;

  const rarityColor = getAchievementRarityColor(achievement.rarity);

  // Icon mapping
  const getIcon = () => {
    switch (achievement.category) {
      case 'mastery':
        return Trophy;
      case 'performance':
        return Award;
      case 'milestone':
        return Shield;
      case 'special':
        return Star;
      default:
        return Award;
    }
  };

  const Icon = getIcon();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{}}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          {/* Backdrop with subtle blur */}
          <motion.div
            initial={{}}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm"
          />

          {/* Achievement Card */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
            className="relative z-10 pointer-events-auto"
          >
            {/* Outer glow ring */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: [0, 0.6, 0] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 0.5,
              }}
              className="absolute inset-0 rounded-2xl blur-xl"
              style={{ backgroundColor: rarityColor }}
            />

            {/* Card */}
            <div
              className="relative bg-[var(--color-bg-tertiary)] rounded-2xl border-2 border-[var(--color-border)] p-8 min-w-[400px] max-w-[500px] shadow-[0_18px_42px_var(--color-shadow-soft)]"
              style={{ borderColor: rarityColor }}
            >
              {/* Shine effect */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1, delay: 0.3 }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
              />

              {/* Content */}
              <div className="relative text-center">
                {/* Header */}
                <motion.div
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm font-medium text-[var(--color-text-muted)] mb-3"
                >
                  Achievement Unlocked
                </motion.div>

                {/* Icon with pulse */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 15,
                    delay: 0.3,
                  }}
                  className="mb-4 flex justify-center"
                >
                  <div
                    className="relative p-4 rounded-full"
                    style={{
                      backgroundColor: `${rarityColor}20`,
                      border: `2px solid ${rarityColor}`,
                    }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <Icon className="w-12 h-12" style={{ color: rarityColor }} strokeWidth={2} />
                    </motion.div>

                    {/* Outer pulse ring */}
                    <motion.div
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                      className="absolute inset-0 rounded-full border-2"
                      style={{ borderColor: rarityColor }}
                    />
                  </div>
                </motion.div>

                {/* Achievement Name */}
                <motion.h2
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl font-bold text-[var(--color-text-primary)] mb-2"
                  style={{ color: rarityColor }}
                >
                  {achievement.name}
                </motion.h2>

                {/* Achievement Description */}
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-[var(--color-text-muted)] text-sm leading-relaxed"
                >
                  {achievement.description}
                </motion.p>

                {/* Rarity Badge */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${rarityColor}20`,
                    color: rarityColor,
                    border: `1px solid ${rarityColor}40`,
                  }}
                >
                  <Star className="w-3 h-3" fill={rarityColor} />
                  {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
                </motion.div>
              </div>

              {/* Decorative particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{
                    scale: 0,
                    x: 0,
                    y: 0,
                    opacity: 1,
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    x: Math.cos((i * Math.PI * 2) / 8) * 150,
                    y: Math.sin((i * Math.PI * 2) / 8) * 150,
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: 0.5 + i * 0.1,
                    ease: 'easeOut',
                  }}
                  className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: rarityColor }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
