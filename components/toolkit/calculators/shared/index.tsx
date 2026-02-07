/**
 * Shared Calculator Components
 *
 * Reusable UI components for standardized calculator design
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, TrendingUp } from 'lucide-react';
import type { CalculatorResult, CriteriaItem, InputFieldConfig } from '../types';

/**
 * ClinicalInput - Standardized input field for calculators
 *
 * Supports both number and select inputs with consistent styling
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ClinicalInputProps extends InputFieldConfig {}

export const ClinicalInput: React.FC<ClinicalInputProps> = ({
  label,
  sublabel,
  value,
  onChange,
  type,
  unit,
  range,
  options,
  placeholder,
  min,
  max,
  step = 1,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-[var(--color-text-primary)]">
          {label}
          {unit && <span className="ml-2 text-[var(--color-text-muted)] font-normal">({unit})</span>}
        </label>
        {range && (
          <span className="text-xs text-[var(--color-text-muted)] px-2 py-0.5 bg-[var(--color-bg-tertiary)] rounded">
            Normal: {range}
          </span>
        )}
      </div>

      {sublabel && <p className="text-xs text-[var(--color-text-muted)]">{sublabel}</p>}

      {type === 'number' ? (
        <div className="relative">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-lg font-medium placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all"
          />
          {unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm font-medium pointer-events-none">
              {unit}
            </span>
          )}
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-lg font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all appearance-none cursor-pointer"
        >
          <option value="">Select...</option>
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

/**
 * CheckboxCriteria - Checkbox list for scoring calculators
 *
 * Consistent styling for CURB-65, CHA₂DS₂-VASc, Wells, etc.
 */
interface CheckboxCriteriaProps {
  items: CriteriaItem[];
  variant?: 'default' | 'compact';
}

export const CheckboxCriteria: React.FC<CheckboxCriteriaProps> = ({
  items,
  variant = 'default',
}) => {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <label
          key={idx}
          className={`
            flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all
            ${
              item.disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)]'
            }
            ${
              item.state
                ? 'bg-[var(--color-bg-tertiary)] border-2 border-[var(--color-border)]'
                : 'bg-[var(--color-bg-secondary)]/50 border-2 border-[var(--color-border)]'
            }
          `}
        >
          <input
            type="checkbox"
            checked={item.state}
            onChange={(e) => !item.disabled && item.setState(e.target.checked)}
            disabled={item.disabled}
            className="w-5 h-5 mt-0.5 text-[var(--color-accent)] bg-[var(--color-bg-tertiary)] border-[var(--color-border)] rounded focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-semibold text-[var(--color-text-primary)]">{item.title}</div>
              {item.points !== undefined && (
                <span
                  className={`
                  px-2 py-0.5 rounded text-xs font-bold
                  ${item.state ? 'bg-[var(--color-accent)] text-[var(--color-text-inverse)]' : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]'}
                `}
                >
                  +{item.points}
                </span>
              )}
            </div>
            <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item.description}</div>
          </div>
        </label>
      ))}
    </div>
  );
};

/**
 * ResultDisplay - Animated result card with risk bar
 *
 * Shows score, interpretation, and clinical recommendation
 */
interface ResultDisplayProps {
  result: CalculatorResult;
  showRiskBar?: boolean;
  className?: string;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  result,
  showRiskBar = true,
  className = '',
}) => {
  const getRiskColor = () => {
    switch (result.riskLevel) {
      case 'low':
        return {
          bg: 'bg-emerald-950/40',
          border: 'border-emerald-700',
          text: 'text-emerald-300',
          icon: 'text-emerald-400',
        };
      case 'moderate':
        return {
          bg: 'bg-amber-950/40',
          border: 'border-amber-700',
          text: 'text-amber-300',
          icon: 'text-amber-400',
        };
      case 'high':
        return {
          bg: 'bg-red-950/40',
          border: 'border-red-700',
          text: 'text-red-300',
          icon: 'text-red-400',
        };
    }
  };

  const colors = getRiskColor();
  const IconComponent =
    result.riskLevel === 'low'
      ? CheckCircle2
      : result.riskLevel === 'moderate'
        ? Info
        : AlertCircle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        ${colors.bg} border-2 ${colors.border} rounded-2xl p-6 ${className}
      `}
    >
      <div className="flex items-start gap-4">
        <IconComponent className={`w-10 h-10 ${colors.icon} flex-shrink-0`} />

        <div className="flex-1 space-y-4">
          {/* Score & Interpretation */}
          <div>
            <div className="flex items-baseline gap-3 mb-2">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="text-5xl font-bold text-[var(--color-text-primary)] font-teko"
              >
                {result.score}
              </motion.span>
              <span className={`text-xl font-semibold ${colors.text}`}>
                {result.interpretation}
              </span>
            </div>

            {/* Risk Bar */}
            {showRiskBar && (
              <div className="relative h-3 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width:
                      result.riskLevel === 'low'
                        ? '33%'
                        : result.riskLevel === 'moderate'
                          ? '66%'
                          : '100%',
                  }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  className={`h-full ${
                    result.riskLevel === 'low'
                      ? 'bg-emerald-500'
                      : result.riskLevel === 'moderate'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-text-muted)]" />
              <h4 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                Clinical Recommendation
              </h4>
            </div>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">{result.recommendation}</p>
          </div>

          {/* Additional Details */}
          {result.details && (
            <div className="pt-3 border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{result.details}</p>
            </div>
          )}

          {/* Reference */}
          {result.reference && (
            <div className="pt-2">
              <p className="text-xs text-[var(--color-text-muted)] italic">Reference: {result.reference}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * CalculatorHeader - Consistent header with back button
 */
interface CalculatorHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

export const CalculatorHeader: React.FC<CalculatorHeaderProps> = ({ title, subtitle, onBack }) => {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2
          className="text-4xl font-bold text-[var(--color-text-primary)] tracking-wide mb-1 font-teko"
        >
          {title}
        </h2>
        <p className="text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
      <button
        onClick={onBack}
        className="px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
      >
        <span>← Back</span>
      </button>
    </div>
  );
};

/**
 * Simple result display component for calculators
 */
interface SimpleResultProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export const SimpleCalculatorResult: React.FC<SimpleResultProps> = ({ label, value, highlight = false }) => {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/50' : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'}`}>
      <div className="text-sm text-[var(--color-text-muted)] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
        {value}
      </div>
    </div>
  );
};

// Aliases for backward compatibility
export const CalculatorInput = ClinicalInput;
