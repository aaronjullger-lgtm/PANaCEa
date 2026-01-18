/**
 * Statistics Preferences Panel
 *
 * Allows users to toggle specific widgets ON/OFF to customize their dashboard view.
 * Includes new Deep Insight metrics (Speed, Second-Guess, Topic Split).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Eye, EyeOff, Sparkles } from 'lucide-react';
import type { WidgetId, WidgetConfig } from './WidgetGrid';
import { DEFAULT_WIDGET_CONFIG } from './WidgetGrid';

interface StatisticsPreferencesProps {
  enabledWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
  onResetToDefaults: () => void;
}

// Separate Deep Insight widgets from standard widgets
const DEEP_INSIGHT_WIDGETS: WidgetId[] = ['speedVsAccuracy', 'secondGuessFactor', 'topicSplit'];

const StatisticsPreferences: React.FC<StatisticsPreferencesProps> = ({
  enabledWidgets,
  onToggleWidget,
  onResetToDefaults,
}) => {
  const standardWidgets = DEFAULT_WIDGET_CONFIG.filter((w) => !DEEP_INSIGHT_WIDGETS.includes(w.id));
  const deepInsightWidgets = DEFAULT_WIDGET_CONFIG.filter((w) =>
    DEEP_INSIGHT_WIDGETS.includes(w.id)
  );

  const renderWidgetToggle = (widget: WidgetConfig) => {
    const isEnabled = enabledWidgets.includes(widget.id);

    return (
      <motion.button
        key={widget.id}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onToggleWidget(widget.id)}
        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
          isEnabled
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={
              isEnabled
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-400 dark:text-slate-500'
            }
          >
            {widget.icon}
          </span>
          <span className="text-sm font-medium">{widget.label}</span>
        </div>
        <span
          className={
            isEnabled ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
          }
        >
          {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </span>
      </motion.button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Standard Widgets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-slate-900 dark:text-slate-100" />
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Dashboard Widgets</h3>
          </div>
          <button
            onClick={onResetToDefaults}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Reset to defaults
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose which statistics to display on your dashboard.
        </p>

        <div className="space-y-2">{standardWidgets.map(renderWidgetToggle)}</div>
      </div>

      {/* Deep Insight Widgets Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h3 className="font-medium text-slate-900 dark:text-slate-100">Deep Insight Metrics</h3>
          <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-full">
            Advanced
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Advanced analytics for deeper learning insights.
        </p>

        <div className="space-y-2">{deepInsightWidgets.map(renderWidgetToggle)}</div>
      </div>
    </div>
  );
};

export default StatisticsPreferences;
