import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

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
  badge?: ReactNode;
}

/**
 * DashboardActionCard - Unified premium card component
 * Enforces the "Virtual OSCE" aesthetic: deep slate gradient backgrounds,
 * glowing hover states, and vibrant blue/indigo gradient buttons.
 * Supports both light and dark modes.
 */
export function DashboardActionCard({
  title,
  subtitle,
  description,
  icon: Icon,
  stats,
  buttonText,
  onAction,
  disabled = false,
  variant = 'default',
  badge,
}: DashboardActionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="group relative"
    >
      {/* Card Container - Adaptive Light/Dark Background */}
      <div
        className="relative overflow-hidden rounded-2xl 
                   border border-slate-200 dark:border-slate-800 
                   bg-gradient-to-br from-white via-slate-50 to-slate-100
                   dark:from-slate-900 dark:via-slate-900 dark:to-slate-950
                   shadow-xl transition-all duration-300 ease-out
                   hover:border-indigo-400/40 dark:hover:border-indigo-500/30 
                   hover:shadow-2xl hover:shadow-indigo-400/10 dark:hover:shadow-indigo-500/10"
      >
        {/* Subtle Gradient Overlay */}
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

            {/* Optional Badge */}
            {badge && (
              <div className="flex-shrink-0">
                {badge}
              </div>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="mb-6 text-slate-700 dark:text-slate-300 leading-relaxed">
              {description}
            </p>
          )}

          {/* Stats Grid */}
          {stats && stats.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {stats.map((stat, index) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={index}
                    className="rounded-lg bg-slate-100/80 dark:bg-slate-950/50 
                               border border-slate-200 dark:border-slate-800/50 
                               p-3 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {StatIcon && (
                        <StatIcon className="h-3.5 w-3.5 text-slate-500 dark:text-slate-500" />
                      )}
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">
                        {stat.label}
                      </p>
                    </div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                      {stat.value}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Primary Action Button - Vibrant Blue/Indigo Gradient */}
          <motion.button
            onClick={onAction}
            disabled={disabled}
            whileHover={{ scale: disabled ? 1 : 1.02 }}
            whileTap={{ scale: disabled ? 1 : 0.98 }}
            className="group/btn relative w-full overflow-hidden rounded-xl 
                     bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600
                     px-6 py-4 font-semibold text-white
                     shadow-lg shadow-indigo-500/25 
                     transition-all duration-300 ease-out
                     hover:shadow-xl hover:shadow-indigo-500/40
                     disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {/* Button Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-out" />
            
            <span className="relative z-10 flex items-center justify-center gap-2">
              {buttonText}
              <svg
                className="h-5 w-5 transition-transform duration-300 group-hover/btn:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
