import React from 'react';
import { Activity, Brain, Heart, Droplet, Eye, Ear, Bone, Baby, Pill, User } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

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
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const Icon = config.icon;

  return (
    <Badge
      size={size}
      variant="neutral"
      className={`
        ${sizeClasses[size]}
        ${config.bgClass} ${config.textClass} ${config.borderClass}
        font-semibold
        ${className}
      `}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
    </Badge>
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
      bgClass: 'bg-[var(--color-data-fail)]/40',
      textClass: 'text-[var(--color-data-fail)]',
      borderClass: 'border-[var(--color-data-fail)]/50',
    },
    PULM: {
      label: 'Pulmonary',
      icon: Activity,
      bgClass: 'bg-[var(--color-accent)]/20',
      textClass: 'text-[var(--color-accent)]',
      borderClass: 'border-[var(--color-accent)]/40',
    },
    GI: {
      label: 'Gastroenterology',
      icon: Activity,
      bgClass: 'bg-[var(--color-data-provisional)]/40',
      textClass: 'text-[var(--color-data-provisional)]',
      borderClass: 'border-[var(--color-data-provisional)]/50',
    },
    NEURO: {
      label: 'Neurology',
      icon: Brain,
      bgClass: 'bg-[var(--color-accent)]/20',
      textClass: 'text-[var(--color-accent)]',
      borderClass: 'border-[var(--color-accent)]/40',
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
      bgClass: 'bg-[var(--color-accent)]/20',
      textClass: 'text-[var(--color-accent)]',
      borderClass: 'border-[var(--color-accent)]/40',
    },
    EENT: {
      label: 'EENT',
      icon: Eye,
      bgClass: 'bg-[var(--color-accent)]/20',
      textClass: 'text-[var(--color-accent)]',
      borderClass: 'border-[var(--color-accent)]/40',
    },
    MSK: {
      label: 'Musculoskeletal',
      icon: Bone,
      bgClass: 'bg-[var(--color-data-neutral)]/40',
      textClass: 'text-[var(--color-data-neutral)]',
      borderClass: 'border-[var(--color-data-neutral)]/50',
    },
    REPRO: {
      label: 'Reproductive',
      icon: User,
      bgClass: 'bg-[var(--color-accent)]/20',
      textClass: 'text-[var(--color-accent)]',
      borderClass: 'border-[var(--color-accent)]/40',
    },
    PEDS: {
      label: 'Pediatrics',
      icon: Baby,
      bgClass: 'bg-[var(--color-data-pass)]/40',
      textClass: 'text-[var(--color-data-pass)]',
      borderClass: 'border-[var(--color-data-pass)]/50',
    },
    PSYCH: {
      label: 'Psychiatry',
      icon: Brain,
      bgClass: 'bg-[var(--color-accent)]/20',
      textClass: 'text-[var(--color-accent)]',
      borderClass: 'border-[var(--color-accent)]/40',
    },
    DERM: {
      label: 'Dermatology',
      icon: Activity,
      bgClass: 'bg-[var(--color-accent)]/20',
      textClass: 'text-[var(--color-accent)]',
      borderClass: 'border-[var(--color-accent)]/40',
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
