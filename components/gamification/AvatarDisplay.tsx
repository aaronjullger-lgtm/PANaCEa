/**
 * Avatar Display
 * 
 * Shows user's evolving avatar with progression indicators.
 * Displays current stage, XP, and equipped accessories.
 */

import React from 'react';
import { User, Star, Award } from 'lucide-react';
import type { UserAvatar } from '@/types/interface-fabric-system';

interface AvatarDisplayProps {
  avatar: UserAvatar | null;
  compact?: boolean;
  className?: string;
}

export function AvatarDisplay({ avatar, compact = false, className = '' }: AvatarDisplayProps) {
  if (!avatar) {
    return compact ? (
      <div className="w-10 h-10 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center">
        <User className="w-5 h-5 text-[var(--color-text-muted)]" />
      </div>
    ) : (
      <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 ${className}`}>
        <p className="text-sm text-[var(--color-text-muted)]">
          Complete your profile to see your avatar!
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-secondary)] flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        {avatar.xp > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold flex items-center justify-center border-2 border-[var(--color-bg-primary)]">
            {Math.floor(avatar.xp / 100)}
          </div>
        )}
      </div>
    );
  }

  const stageLabels: Record<string, string> = {
    student_year_1: 'First Year Student',
    student_year_2: 'Second Year Student',
    clinical_year: 'Clinical Year',
    graduate: 'Graduate',
    practicing_pa: 'Practicing PA',
  };

  const currentLevel = Math.floor(avatar.xp / 100);
  const xpInLevel = avatar.xp % 100;

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        {/* Avatar Circle */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-secondary)] flex items-center justify-center border-4 border-[var(--color-bg-primary)]">
          <User className="w-10 h-10 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="text-sm text-[var(--color-text-muted)] mb-1">
            {stageLabels[avatar.stage] || avatar.stage}
          </div>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-[var(--color-accent)]" />
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">
              Level {currentLevel}
            </span>
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="text-[var(--color-text-muted)]">XP Progress</span>
          <span className="text-[var(--color-text-primary)] font-mono">
            {xpInLevel}/100
          </span>
        </div>
        <div className="w-full h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-500"
            style={{ width: `${xpInLevel}%` }}
          />
        </div>
      </div>

      {/* Equipped Accessories */}
      {avatar.equippedAccessories && avatar.equippedAccessories.length > 0 && (
        <div className="pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Equipped
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {avatar.equippedAccessories.map((accessory: any, i: number) => (
              <div
                key={i}
                className="px-2 py-1 rounded-md bg-[var(--color-accent)]/10 text-xs text-[var(--color-accent)] border border-[var(--color-accent)]/30"
              >
                {accessory.name || `Accessory ${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Unlock */}
      <div className="mt-4 p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-muted)] mb-1">Next unlock at Level {currentLevel + 1}</div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          {100 - xpInLevel} XP to go
        </div>
      </div>
    </div>
  );
}
