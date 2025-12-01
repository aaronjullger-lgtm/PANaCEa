/**
 * Statistics Preferences Panel
 * 
 * Allows users to toggle specific widgets ON/OFF to customize their dashboard view.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Eye, EyeOff } from 'lucide-react';
import type { WidgetId, WidgetConfig } from './WidgetGrid';
import { DEFAULT_WIDGET_CONFIG } from './WidgetGrid';

interface StatisticsPreferencesProps {
  enabledWidgets: WidgetId[];
  onToggleWidget: (widgetId: WidgetId) => void;
  onResetToDefaults: () => void;
}

const StatisticsPreferences: React.FC<StatisticsPreferencesProps> = ({
  enabledWidgets,
  onToggleWidget,
  onResetToDefaults,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="font-medium text-[var(--color-text-primary)]">Dashboard Widgets</h3>
        </div>
        <button
          onClick={onResetToDefaults}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        >
          Reset to defaults
        </button>
      </div>
      
      <p className="text-xs text-[var(--color-text-muted)]">
        Choose which statistics to display on your dashboard.
      </p>
      
      <div className="space-y-2">
        {DEFAULT_WIDGET_CONFIG.map((widget) => {
          const isEnabled = enabledWidgets.includes(widget.id);
          
          return (
            <motion.button
              key={widget.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onToggleWidget(widget.id)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                isEnabled
                  ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30 text-[var(--color-text-primary)]'
                  : 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isEnabled ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
                  {widget.icon}
                </span>
                <span className="text-sm font-medium">{widget.label}</span>
              </div>
              <span className={isEnabled ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>
                {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default StatisticsPreferences;
