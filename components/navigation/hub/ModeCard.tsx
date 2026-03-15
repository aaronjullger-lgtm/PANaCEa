'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Timer, Target, LucideIcon } from 'lucide-react';
import {
  Zap,
  Brain,
  Stethoscope,
  BarChart3,
  Calculator,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  Flame,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  Beaker,
  Layers,
  FileImage,
  Shield,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { TrainingModeConfig } from '@/config/training-modes';

export const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  Zap,
  Target,
  Stethoscope,
  BookOpen,
  Pill,
  Activity,
  Clock,
  Trophy,
  Flame,
  AlertCircle,
  CheckCircle,
  Timer,
  GraduationCap,
  Beaker,
  FileImage,
  Shield,
  Layers,
  Droplets,
  GitCompare,
  FileCheck,
  Siren,
  Hash,
  Heart,
  Wind,
  Eye,
  MessageSquare,
  Image,
  Scan,
  FlaskConical,
  Headphones,
  FolderTree,
  Calculator,
  BarChart3,
  TrendingUp,
  Sparkles,
};

export const ModeCard: React.FC<{
  mode: TrainingModeConfig;
  onSelect: () => void;
}> = ({ mode, onSelect }) => {
  const Icon = ICON_MAP[mode.iconName] || Target;
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      variants={{
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
      }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 28 }
      }
      whileHover={prefersReducedMotion ? undefined : { y: -2, scale: 1.01 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onClick={onSelect}
      disabled={mode.isComingSoon}
      title={
        mode.isComingSoon
          ? `${mode.label} - Feature in development, available soon`
          : mode.description
      }
      aria-label={mode.isComingSoon ? `${mode.label} - Coming soon` : mode.label}
      className={`
        w-full text-left p-4 rounded-xl border transition-all duration-200 group min-h-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
        ${
          mode.isComingSoon
            ? 'opacity-50 cursor-not-allowed bg-[var(--color-bg-tertiary)] border-dashed border-[var(--color-border)]'
            : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:shadow-lg shadow-md shadow-[var(--color-shadow-soft)]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-accent)]/10 transition-colors duration-200 flex-shrink-0">
          <Icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors" />
        </div>
        <div className="flex-1 min-w-0 max-w-xl">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h4 className="font-semibold text-[var(--color-text-primary)] break-words">
              {mode.label}
            </h4>
            {mode.isComingSoon && (
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full flex-shrink-0">
                Soon
              </span>
            )}
          </div>
          <p className="text-[15px] text-[var(--color-text-secondary)] line-clamp-3">
            {mode.description}
          </p>
          {mode.estimatedMinutes && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-text-muted)]">
              <Timer className="w-3 h-3" />
              <span>~{mode.estimatedMinutes} min</span>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
};
