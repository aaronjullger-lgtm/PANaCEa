/**
 * Statistics Preferences Panel
 *
 * Allows users to toggle specific widgets ON/OFF to customize their dashboard view.
 * Deep Insight metrics (Speed, Second-Guess, Topic Split) are in a collapsed accordion by default.
 * Hover over a widget name to see a tiny preview thumbnail and description.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import type { WidgetId, WidgetConfig } from './WidgetGrid';
import { DEFAULT_WIDGET_CONFIG, WIDGET_PREVIEW_INFO } from './WidgetGrid';

interface StatisticsPreferencesProps {
  enabledWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
  onResetToDefaults: () => void;
}

// Separate Deep Insight widgets from standard widgets (accordion only)
const DEEP_INSIGHT_WIDGETS: WidgetId[] = ['speedVsAccuracy', 'secondGuessFactor', 'topicSplit'];

const StatisticsPreferences: React.FC<StatisticsPreferencesProps> = ({
  enabledWidgets,
  onToggleWidget,
  onResetToDefaults,
}) => {
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<WidgetId | null>(null);
  const standardWidgets = DEFAULT_WIDGET_CONFIG.filter((w) => !DEEP_INSIGHT_WIDGETS.includes(w.id));
  const deepInsightWidgets = DEFAULT_WIDGET_CONFIG.filter((w) =>
    DEEP_INSIGHT_WIDGETS.includes(w.id)
  );

  const renderWidgetToggle = (widget: WidgetConfig) => {
    const isEnabled = enabledWidgets.includes(widget.id);
    const preview = WIDGET_PREVIEW_INFO[widget.id];
    const isHovered = hoveredWidgetId === widget.id;

    return (
      <div
        key={widget.id}
        className="relative"
        onMouseEnter={() => setHoveredWidgetId(widget.id)}
        onMouseLeave={() => setHoveredWidgetId(null)}
      >
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onToggleWidget(widget.id)}
          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
            isEnabled
              ? 'bg-data-neutral dark:bg-data-neutral border-data-neutral dark:border-data-neutral text-data-neutral dark:text-data-neutral'
              : 'bg-white dark:bg-data-neutral-bg border-data-neutral dark:border-data-neutral text-data-neutral dark:text-data-neutral'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={
                isEnabled
                  ? 'text-data-neutral dark:text-data-neutral'
                  : 'text-data-neutral dark:text-data-neutral'
              }
            >
              {widget.icon}
            </span>
            <span className="text-sm font-medium">{widget.label}</span>
          </div>
          <span
            className={
              isEnabled
                ? 'text-data-neutral dark:text-data-neutral'
                : 'text-data-neutral dark:text-data-neutral'
            }
          >
            {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </span>
        </motion.button>

        {/* Tooltip thumbnail + description on hover */}
        {isHovered && preview && (
          <div
            className="absolute bottom-full left-0 mb-1 z-50 w-44 pointer-events-none"
            role="tooltip"
            aria-hidden
          >
            <div className="rounded-lg border border-data-neutral dark:border-data-neutral bg-white dark:bg-data-neutral-bg shadow-lg overflow-hidden">
              <div className="p-2.5 border-b border-data-neutral dark:border-data-neutral flex items-center gap-2 bg-data-neutral dark:bg-data-neutral/80">
                <span className="text-data-neutral dark:text-data-neutral shrink-0">{widget.icon}</span>
                <span className="text-xs font-medium text-data-neutral dark:text-data-neutral truncate">
                  {widget.label}
                </span>
              </div>
              <div className="p-2 flex items-baseline gap-1">
                <span className="text-lg font-light text-data-neutral dark:text-data-neutral">…</span>
              </div>
              <div className="px-2.5 pb-2.5 pt-0">
                <p className="text-[11px] text-data-neutral dark:text-data-neutral leading-snug">
                  {preview.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Standard Widgets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-data-neutral dark:text-data-neutral" />
            <h3 className="font-medium text-data-neutral dark:text-data-neutral">Dashboard Widgets</h3>
          </div>
          <button
            onClick={onResetToDefaults}
            className="text-xs text-data-neutral hover:text-data-neutral dark:hover:text-data-neutral transition-colors"
          >
            Reset to defaults
          </button>
        </div>

        <p className="text-xs text-data-neutral dark:text-data-neutral">
          Choose which statistics to display on your dashboard.
        </p>

        <div className="space-y-2">{standardWidgets.map(renderWidgetToggle)}</div>
      </div>

      {/* Deep Insight Metrics: collapsed accordion by default to reduce cognitive load */}
      <div className="border border-data-neutral dark:border-data-neutral rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left bg-data-neutral dark:bg-data-neutral/50 hover:bg-data-neutral dark:hover:bg-data-neutral transition-colors"
          aria-expanded={advancedExpanded ? 'true' : 'false'}
          aria-controls="deep-insight-accordion"
          id="deep-insight-accordion-trigger"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
            <h3 className="font-medium text-data-neutral dark:text-data-neutral">Deep Insight Metrics</h3>
          </div>
          {advancedExpanded ? (
            <ChevronUp className="w-5 h-5 text-data-neutral flex-shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="w-5 h-5 text-data-neutral flex-shrink-0" aria-hidden />
          )}
        </button>
        <AnimatePresence initial={false}>
          {advancedExpanded && (
            <motion.div
              id="deep-insight-accordion"
              role="region"
              aria-labelledby="deep-insight-accordion-trigger"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-2 border-t border-data-neutral dark:border-data-neutral">
                <p className="text-xs text-data-neutral dark:text-data-neutral mb-3">
                  Optional analytics for deeper learning insights.
                </p>
                {deepInsightWidgets.map(renderWidgetToggle)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StatisticsPreferences;
