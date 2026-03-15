'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { CATEGORY_INFO, type TrainingCategory, type TrainingModeConfig } from '@/config/training-modes';
import { ICON_MAP, ModeCard } from './ModeCard';

export const CategorySection: React.FC<{
  category: TrainingCategory;
  modes: TrainingModeConfig[];
  onSelectMode: (mode: TrainingModeConfig) => void;
}> = ({ category, modes, onSelectMode }) => {
  const info = CATEGORY_INFO[category];
  const Icon = ICON_MAP[info.iconName] || Target;

  if (modes.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)]">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{info.label}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{info.description}</p>
        </div>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
        variants={{
          animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
        }}
        initial="initial"
        animate="animate"
      >
        {modes.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onSelect={() => onSelectMode(mode)} />
        ))}
      </motion.div>
    </section>
  );
};
