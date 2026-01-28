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
        <svg className="absolute inset-0 w-full h-full opacity-30 dark:opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="currentColor" className="text-slate-400 dark:text-slate-600" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      );
    }
    if (backgroundPattern === 'grid') {
      return (
        <svg className="absolute inset-0 w-full h-full opacity-20 dark:opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-400 dark:text-slate-600" />
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
                 border border-slate-200 dark:border-slate-800 
                 bg-gradient-to-br from-white via-slate-50 to-slate-100 
                 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 
                 transition-all duration-300 
                 hover:border-indigo-400/40 dark:hover:border-indigo-500/30 
                 hover:shadow-xl hover:shadow-indigo-400/10 dark:hover:shadow-indigo-500/10"
    >
      {/* Background Pattern Layer */}
      {renderPattern()}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/5 via-transparent to-purple-400/5 dark:from-indigo-500/5 dark:via-transparent dark:to-purple-500/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Content */}
      <div className="relative p-6 md:p-8">
        {/* Header Section */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Glass-morphism Icon Container */}
            <div
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl 
                         bg-slate-100/80 dark:bg-white/5 backdrop-blur-sm 
                         border border-slate-200 dark:border-white/10
                         shadow-lg transition-all duration-300 
                         group-hover:bg-slate-200/90 dark:group-hover:bg-white/10 
                         group-hover:scale-110"
            >
              <Icon className="h-7 w-7 text-indigo-600 dark:text-indigo-400 transition-colors duration-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-300" />
            </div>

            {/* Title & Subtitle */}
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {subtitle}
                </p>
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
                <div className="pulse-badge">
                  {badge}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="mb-6 text-slate-700 dark:text-slate-300 leading-relaxed">
            {description}
          </p>
        )}

        {/* Timer Display */}
        {showTimer && timerText && (
          <div className="mb-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 w-fit">
            <svg 
              className="w-4 h-4 text-amber-600 dark:text-amber-400" 
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
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
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
                  className="rounded-lg bg-slate-100/80 dark:bg-slate-950/50 
                             border border-slate-200 dark:border-slate-800/50 
                             p-4 backdrop-blur-sm transition-colors hover:bg-slate-200/80 dark:hover:bg-slate-900/50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {StatIcon && (
                      <StatIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    )}
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-400">
                      {stat.label}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums leading-none">
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
