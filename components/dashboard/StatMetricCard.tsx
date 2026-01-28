import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatMetricCardProps {
  /** The primary value to display (e.g., "57%", "12", "3 days") */
  value: string | number;
  /** The label describing the metric (e.g., "Accuracy", "Due for Review") */
  label: string;
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Optional trend indicator (e.g., "+5%", "-2") */
  trend?: string;
  /** Whether the trend is positive (green) or negative (red) */
  trendPositive?: boolean;
}

/**
 * StatMetricCard - Premium stat display matching DashboardActionCard aesthetic
 * 
 * Features:
 * - Deep slate gradient backgrounds (light/dark mode adaptive)
 * - Glass-morphism icon container with indigo glow
 * - High contrast value text with subtle label
 * - Optional trend indicator with color coding
 * - Smooth hover animations
 */
export const StatMetricCard: React.FC<StatMetricCardProps> = ({
  value,
  label,
  icon: Icon,
  trend,
  trendPositive = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-xl 
                 border border-slate-200 dark:border-slate-800 
                 bg-gradient-to-br from-white via-slate-50 to-slate-100 
                 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 
                 p-6 
                 hover:border-indigo-400/40 dark:hover:border-indigo-500/30 
                 hover:shadow-lg hover:shadow-indigo-400/10 dark:hover:shadow-indigo-500/10 
                 transition-all duration-300"
    >
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br 
                      from-indigo-400/5 via-transparent to-purple-400/5 
                      dark:from-indigo-500/5 dark:via-transparent dark:to-purple-500/5 
                      opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Content */}
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          {/* Value */}
          <p className="mb-1 text-3xl font-bold text-slate-900 dark:text-white 
                        tabular-nums tracking-tight">
            {value}
          </p>

          {/* Label */}
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 
                        tracking-wide">
            {label}
          </p>

          {/* Trend Indicator */}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-xs font-semibold ${
                  trendPositive
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {trend}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-500">
                vs last week
              </span>
            </div>
          )}
        </div>

        {/* Icon Container - Glass-morphism with glow */}
        <div className="flex-shrink-0 rounded-lg 
                        bg-slate-100/80 dark:bg-white/5 
                        backdrop-blur-sm 
                        border border-slate-200 dark:border-white/10 
                        p-3 
                        group-hover:bg-slate-200/90 dark:group-hover:bg-white/10 
                        group-hover:shadow-lg group-hover:shadow-indigo-400/20 dark:group-hover:shadow-indigo-500/20 
                        transition-all duration-300">
          <Icon className="h-6 w-6 text-indigo-600 dark:text-indigo-400 
                           group-hover:text-indigo-700 dark:group-hover:text-indigo-300 
                           transition-colors duration-300" />
        </div>
      </div>
    </motion.div>
  );
};
