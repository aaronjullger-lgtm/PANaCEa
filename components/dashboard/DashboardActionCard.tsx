import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import { PrimaryButton, type ButtonVariant } from '../ui/PrimaryButton';

interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
}

interface DashboardActionCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon: LucideIcon;
  stats?: StatItem[];
  buttonText: string;
  onAction: () => void;
  disabled?: boolean;
  variant?: 'default' | 'daily' | 'premium';
  buttonVariant?: ButtonVariant;
  badge?: ReactNode;
  showTimer?: boolean;
  timerText?: string;
  backgroundPattern?: 'dots' | 'grid' | 'none';
}

/**
 * DashboardActionCard - Unified premium card component
 * Enforces the "Virtual OSCE" aesthetic: deep slate gradient backgrounds,
 * glowing hover states, and vibrant blue/indigo gradient buttons.
 * Supports both light and dark modes.
 */
export function DashboardActionCard(props: Readonly<DashboardActionCardProps>) {
  const {
    title,
    subtitle,
    description,
    icon: Icon,
    stats,
    buttonText,
    onAction,
    disabled = false,
    variant: _variant = 'default',
    buttonVariant = 'primary',
    badge,
    showTimer = false,
    timerText,
    backgroundPattern = 'none',
  } = props;

  // Background pattern SVG
  const renderPattern = () => {
    if (backgroundPattern === 'dots') {
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-30"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle
                cx="2"
                cy="2"
                r="1"
                fill="currentColor"
                className="text-[var(--color-text-muted)]"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      );
    }
    if (backgroundPattern === 'grid') {
      return (
        <svg
          className="absolute inset-0 w-full h-full opacity-20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-[var(--color-text-muted)]"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      );
    }
    return null;
  };
  return (
    <motion.div
      className="group relative overflow-hidden rounded-2xl 
                 border border-slate-200 dark:border-[var(--color-border)] 
                 bg-gradient-to-br from-[var(--color-bg-primary)] via-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] 
                 shadow-md shadow-slate-300/10 dark:shadow-none
                 transition-all duration-300 
                 hover:border-[var(--color-accent)]/40 
                 hover:shadow-xl hover:shadow-[var(--color-accent)]/10"
    >
      {/* Background Pattern Layer */}
      {renderPattern()}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 via-transparent to-[var(--color-accent)]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Content */}
      <div className="relative p-6 md:p-8">
        {/* Header Section */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Glass-morphism Icon Container */}
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl 
                         bg-[var(--color-bg-tertiary)]/80 backdrop-blur-sm 
                         border border-[var(--color-border)]
                         shadow-lg transition-all duration-300 
                         group-hover:bg-[var(--color-bg-tertiary)]/90 
                         group-hover:scale-110"
            >
              <Icon className="h-7 w-7 text-[var(--color-accent)] transition-colors duration-300 group-hover:text-[var(--color-accent)]" />
            </div>

            {/* Title & Subtitle */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1 tracking-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm font-medium text-[var(--color-text-muted)]">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Optional Badge (with pulsing animation) */}
          {badge && (
            <div className="flex-shrink-0">
              <div className="relative">
                <style>{`
                  @keyframes pulse-glow {
                    0%, 100% {
                      opacity: 1;
                      transform: scale(1);
                    }
                    50% {
                      opacity: 0.8;
                      transform: scale(1.05);
                    }
                  }
                  .pulse-badge {
                    animation: pulse-glow 2s ease-in-out infinite;
                  }
                `}</style>
                <div className="pulse-badge">{badge}</div>
              </div>
            </div>
          )}
        </div>

        {/* Description - slightly larger and darker for readability (blue-gray on dark, not muddy gray) */}
        {description && (
          <p className="mb-6 text-[0.9375rem] leading-relaxed text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}

        {/* Timer Display */}
        {showTimer && timerText && (
          <div className="mb-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-data-provisional)]/10 border border-[var(--color-data-provisional)]/30 w-fit">
            <svg
              className="w-4 h-4 text-[var(--color-data-provisional)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm font-medium text-[var(--color-data-provisional)]">
              {timerText}
            </span>
          </div>
        )}

        {/* Stats Grid - Enhanced Typography */}
        {stats && stats.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            {stats.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-lg bg-[var(--color-bg-tertiary)]/80 
                             border border-[var(--color-border)] 
                             p-4 backdrop-blur-sm transition-colors hover:bg-[var(--color-bg-tertiary)]/90"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {StatIcon && <StatIcon className="h-4 w-4 text-[var(--color-text-muted)]" />}
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                      {stat.label}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums leading-none">
                    {stat.value}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <PrimaryButton
          variant={buttonVariant}
          size="md"
          fullWidth
          disabled={disabled}
          onClick={onAction}
        >
          {buttonText}
        </PrimaryButton>
      </div>
    </motion.div>
  );
}
