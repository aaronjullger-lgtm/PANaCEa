/**
 * Streak Flame Component
 * Visual representation of daily study streak with flame intensity
 * Professional medical aesthetic - no cartoonish elements
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

interface StreakFlameProps {
  streak: number;
  flameLevel: number; // 0-5 intensity
  isActiveToday?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export function StreakFlame({
  streak,
  flameLevel,
  isActiveToday = true,
  size = 'medium',
}: StreakFlameProps) {
  // Size mappings
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  const textSizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  // Flame color based on level
  const getFlameColor = () => {
    if (!isActiveToday || streak === 0) return '#64748b'; // Gray for inactive
    if (flameLevel === 0) return '#94a3b8'; // Light gray
    if (flameLevel === 1) return '#f97316'; // Orange
    if (flameLevel === 2) return '#f59e0b'; // Amber
    if (flameLevel === 3) return '#eab308'; // Yellow
    if (flameLevel === 4) return '#3b82f6'; // Blue (hot flame)
    return '#8b5cf6'; // Purple (legendary)
  };

  const flameColor = getFlameColor();

  // Animation intensity based on level
  const getAnimationIntensity = () => {
    if (!isActiveToday || streak === 0) return 0;
    return 0.1 + flameLevel * 0.05;
  };

  const intensity = getAnimationIntensity();

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      {/* Flame Icon Container */}
      <div className="relative">
        {/* Outer glow */}
        {isActiveToday && streak > 0 && (
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={`absolute inset-0 ${sizeClasses[size]} rounded-full blur-lg`}
            style={{ backgroundColor: flameColor }}
          />
        )}

        {/* Flame Icon */}
        <motion.div
          animate={
            isActiveToday && streak > 0
              ? {
                  y: [-intensity * 10, intensity * 10, -intensity * 10],
                  scale: [1, 1 + intensity, 1],
                }
              : {}
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`relative ${sizeClasses[size]} flex items-center justify-center`}
        >
          <Flame
            className={sizeClasses[size]}
            style={{ color: flameColor }}
            fill={isActiveToday && streak > 0 ? flameColor : 'none'}
            strokeWidth={2}
          />

          {/* Streak number overlay */}
          {streak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`absolute inset-0 flex items-center justify-center font-bold ${textSizes[size]}`}
              style={{
                color: isActiveToday ? '#ffffff' : flameColor,
                textShadow: isActiveToday ? '0 1px 2px rgba(0, 0, 0, 0.8)' : 'none',
              }}
            >
              {streak}
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Streak label */}
      <div className={`text-center ${textSizes[size]}`}>
        <div
          className="font-medium"
          style={{ color: isActiveToday ? flameColor : 'var(--color-text-muted)' }}
        >
          {streak === 0 ? 'Start' : streak}
        </div>
        <div className="text-[var(--color-text-muted)] text-xs">
          {streak === 1 ? 'day' : 'days'}
        </div>
      </div>

      {/* Milestone indicators */}
      {streak >= 7 && (
        <div className="flex gap-0.5 mt-1">
          {[7, 14, 30, 100].map((milestone) => (
            <div
              key={milestone}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                streak >= milestone ? '' : 'opacity-30'
              }`}
              style={{
                backgroundColor: streak >= milestone ? flameColor : 'var(--color-text-muted)',
              }}
            />
          ))}
        </div>
      )}

      {/* At-risk indicator (if streak is about to break) */}
      {!isActiveToday && streak > 0 && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--color-data-fail)] rounded-full border-2 border-[var(--color-bg-primary)]"
        />
      )}
    </div>
  );
}

/**
 * Compact streak display for nav/header
 */
export function StreakBadge({
  streak,
  isActiveToday = true,
}: {
  streak: number;
  isActiveToday?: boolean;
}) {
  const getFlameColor = () => {
    if (!isActiveToday || streak === 0) return '#64748b';
    if (streak < 3) return '#f97316';
    if (streak < 7) return '#f59e0b';
    if (streak < 30) return '#eab308';
    if (streak < 100) return '#3b82f6';
    return '#8b5cf6';
  };

  const flameColor = getFlameColor();

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <Flame
        className="w-4 h-4"
        style={{ color: flameColor }}
        fill={isActiveToday && streak > 0 ? flameColor : 'none'}
        strokeWidth={2}
      />
      <span className="text-sm font-medium" style={{ color: flameColor }}>
        {streak}
      </span>
      {!isActiveToday && streak > 0 && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-2 h-2 bg-[var(--color-data-fail)] rounded-full"
        />
      )}
    </div>
  );
}
