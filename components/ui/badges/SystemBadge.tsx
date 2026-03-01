import React from 'react';
import { Activity, Brain, Heart, Droplet, Eye, Ear, Bone, Baby, Pill, User } from 'lucide-react';

interface SystemBadgeProps {
  system: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SystemBadge - Displays organ system with icon and color coding
 *
 * Professional dark mode aesthetic with deep colored backgrounds and icons.
 * Each system has a unique color scheme for quick visual recognition.
 */
export const SystemBadge: React.FC<SystemBadgeProps> = ({
  system,
  className = '',
  size = 'md',
}) => {
  const config = getSystemConfig(system);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const Icon = config.icon;

  return (
    <div
      className={`
        inline-flex items-center ${sizeClasses[size]} rounded-lg font-semibold
        ${config.bgClass} ${config.textClass} ${config.borderClass}
        border transition-all duration-200
        hover:scale-105 hover:shadow-lg
        ${className}
      `}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
    </div>
  );
};

/**
 * Get configuration for a system code
 */
function getSystemConfig(system: string) {
  const systemUpper = system.toUpperCase();

  const configs: Record<
    string,
    {
      label: string;
      icon: typeof Heart;
      bgClass: string;
      textClass: string;
      borderClass: string;
    }
  > = {
    CV: {
      label: 'Cardiovascular',
      icon: Heart,
      bgClass: 'bg-data-fail/40',
      textClass: 'text-data-fail',
      borderClass: 'border-data-fail/50',
    },
    PULM: {
      label: 'Pulmonary',
      icon: Activity,
      bgClass: 'bg-cyan-950/40',
      textClass: 'text-cyan-300',
      borderClass: 'border-cyan-800/50',
    },
    GI: {
      label: 'Gastroenterology',
      icon: Activity,
      bgClass: 'bg-data-provisional/40',
      textClass: 'text-data-provisional',
      borderClass: 'border-data-provisional/50',
    },
    NEURO: {
      label: 'Neurology',
      icon: Brain,
      bgClass: 'bg-purple-950/40',
      textClass: 'text-purple-300',
      borderClass: 'border-purple-800/50',
    },
    RENAL: {
      label: 'Renal',
      icon: Droplet,
      bgClass: 'bg-[color-mix(in_srgb,var(--color-category-practice)_40%,transparent)]',
      textClass: 'text-[var(--color-category-practice)]',
      borderClass: 'border-[color-mix(in_srgb,var(--color-category-practice)_50%,transparent)]',
    },
    ENDO: {
      label: 'Endocrine',
      icon: Pill,
      bgClass: 'bg-pink-950/40',
      textClass: 'text-pink-300',
      borderClass: 'border-pink-800/50',
    },
    EENT: {
      label: 'EENT',
      icon: Eye,
      bgClass: 'bg-teal-950/40',
      textClass: 'text-teal-300',
      borderClass: 'border-teal-800/50',
    },
    MSK: {
      label: 'Musculoskeletal',
      icon: Bone,
      bgClass: 'bg-data-neutral/40',
      textClass: 'text-data-neutral',
      borderClass: 'border-data-neutral/50',
    },
    REPRO: {
      label: 'Reproductive',
      icon: User,
      bgClass: 'bg-rose-950/40',
      textClass: 'text-rose-300',
      borderClass: 'border-rose-800/50',
    },
    PEDS: {
      label: 'Pediatrics',
      icon: Baby,
      bgClass: 'bg-data-pass/40',
      textClass: 'text-data-pass',
      borderClass: 'border-data-pass/50',
    },
    PSYCH: {
      label: 'Psychiatry',
      icon: Brain,
      bgClass: 'bg-indigo-950/40',
      textClass: 'text-indigo-300',
      borderClass: 'border-indigo-800/50',
    },
    DERM: {
      label: 'Dermatology',
      icon: Activity,
      bgClass: 'bg-orange-950/40',
      textClass: 'text-orange-300',
      borderClass: 'border-orange-800/50',
    },
  };

  return (
    configs[systemUpper] || {
      label: system,
      icon: Activity,
      bgClass: 'bg-data-neutral/40',
      textClass: 'text-data-neutral',
      borderClass: 'border-data-neutral/50',
    }
  );
}

export default SystemBadge;
