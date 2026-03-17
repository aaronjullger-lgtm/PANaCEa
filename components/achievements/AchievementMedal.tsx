/**
 * Achievement Medal Component
 * Circular medal design for displaying achievements
 * Shows locked/unlocked state with professional styling
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Award, Trophy, Star, Shield, Lock } from 'lucide-react';
import {
  getAchievementById,
  getAchievementDisplayName,
  getAchievementDisplayDescription,
  getAchievementRarityColor,
  type AchievementDefinition,
} from '../../config/achievements';

interface AchievementMedalProps {
  achievementId: string;
  isUnlocked: boolean;
  progress?: number; // 0-100 for progressive achievements
  size?: 'small' | 'medium' | 'large';
  showTooltip?: boolean;
  onClick?: () => void;
}

export function AchievementMedal({
  achievementId,
  isUnlocked,
  progress = 0,
  size = 'medium',
  showTooltip = true,
  onClick,
}: AchievementMedalProps) {
  const achievement = getAchievementById(achievementId);

  if (!achievement) return null;

  const rarityColor = getAchievementRarityColor(achievement.rarity);
  const displayName = getAchievementDisplayName(achievement, isUnlocked);
  const displayDescription = getAchievementDisplayDescription(achievement, isUnlocked);

  // Size mappings
  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-20 h-20',
    large: 'w-28 h-28',
  };

  const iconSizes = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };

  // Icon mapping
  const getIcon = () => {
    if (!isUnlocked) return Lock;

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
    <div className="relative group">
      {/* Medal Container */}
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative ${sizeClasses[size]} rounded-full flex items-center justify-center transition-all duration-200 ${
          onClick ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{
          backgroundColor: isUnlocked ? `${rarityColor}20` : 'var(--color-bg-secondary)',
          border: `2px solid ${isUnlocked ? rarityColor : 'var(--color-border)'}`,
        }}
      >
        {/* Icon */}
        <Icon
          className={`${iconSizes[size]} ${isUnlocked ? '' : 'opacity-40'}`}
          style={{ color: isUnlocked ? rarityColor : 'var(--color-text-[var(--color-text-muted)])' }}
          strokeWidth={2}
        />

        {/* Progress ring for progressive achievements */}
        {!isUnlocked && progress > 0 && (
          <svg className="absolute inset-0 -rotate-90" style={{ width: '100%', height: '100%' }}>
            <circle
              cx="50%"
              cy="50%"
              r="48%"
              fill="none"
              stroke={rarityColor}
              strokeWidth="2"
              strokeDasharray={`${progress * 3} 300`}
              opacity="0.5"
            />
          </svg>
        )}

        {/* Shimmer effect for unlocked achievements */}
        {isUnlocked && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 3,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"
          />
        )}
      </motion.button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
          <div
            className="bg-[var(--color-bg-tertiary)] border rounded-lg p-3 shadow-xl min-w-[200px] max-w-[280px]"
            style={{ borderColor: isUnlocked ? rarityColor : 'var(--color-border)' }}
          >
            {/* Name */}
            <div
              className="font-semibold text-sm mb-1"
              style={{ color: isUnlocked ? rarityColor : 'var(--color-text-primary)' }}
            >
              {displayName}
            </div>

            {/* Description */}
            <div className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-2">
              {displayDescription}
            </div>

            {/* Rarity */}
            <div className="flex items-center gap-1 text-xs">
              <Star className="w-3 h-3" style={{ color: rarityColor }} fill={rarityColor} />
              <span style={{ color: rarityColor }}>
                {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)}
              </span>
            </div>

            {/* Progress indicator */}
            {!isUnlocked && progress > 0 && (
              <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">
                  Progress: {progress}%
                </div>
                <div className="h-1 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: rarityColor,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tooltip arrow */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderRight: `1px solid ${isUnlocked ? rarityColor : 'var(--color-border)'}`,
                borderBottom: `1px solid ${isUnlocked ? rarityColor : 'var(--color-border)'}`,
                marginTop: '-5px',
              }}
            />
          </div>
        </div>
      )}

      {/* Rarity indicator dot */}
      <div
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-[var(--color-bg-primary)]"
        style={{ backgroundColor: rarityColor }}
      />
    </div>
  );
}
