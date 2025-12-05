/**
 * Character Card Component
 * 
 * Displays a single organ character in the collection grid
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Lock, CheckCircle } from 'lucide-react';
import type { OrganCharacter } from '@/config/organ-characters';

interface CharacterCardProps {
  character: OrganCharacter;
  unlockedCount: number;
  totalCount: number;
  completion: number;
  onClick: () => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  unlockedCount,
  totalCount,
  completion,
  onClick,
}) => {
  const isFullyUnlocked = completion === 100;

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border-2 border-[var(--color-border)] rounded-xl p-4 transition-all flex flex-col items-center gap-2 group"
    >
      {/* Fully Unlocked Badge */}
      {isFullyUnlocked && (
        <div className="absolute top-2 right-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
      )}

      {/* Character Emoji */}
      <div className="text-5xl mb-2 group-hover:scale-110 transition-transform">
        {character.emoji}
      </div>

      {/* Character Name */}
      <h3 className="font-semibold text-[var(--color-text-primary)] text-center text-sm">
        {character.name}
      </h3>

      {/* Progress Bar */}
      <div className="w-full">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
          <span>{unlockedCount}/{totalCount}</span>
          <span>{completion}%</span>
        </div>
        <div className="w-full h-2 bg-[var(--color-bg-primary)] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full ${
              completion === 100
                ? 'bg-green-500'
                : completion >= 50
                ? 'bg-blue-500'
                : 'bg-slate-400'
            }`}
          />
        </div>
      </div>

      {/* System Label */}
      <div className="text-xs text-[var(--color-text-muted)] font-mono">
        {character.system}
      </div>
    </motion.button>
  );
};

export default CharacterCard;
