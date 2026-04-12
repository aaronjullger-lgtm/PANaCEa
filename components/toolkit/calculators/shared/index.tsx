/**
 * Shared Calculator Components
 *
 * Reusable UI components for standardized calculator design
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, TrendingUp, RotateCcw, Copy, Check } from 'lucide-react';
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
  // Out-of-range validation for numeric inputs
  const validation = useMemo(() => {
    if (type !== 'number' || !value) return null;
    const num = parseFloat(value);
    if (Number.isNaN(num)) return null;
    if (min !== undefined && num < min) return `Below minimum (${min})`;
    if (max !== undefined && num > max) return `Above maximum (${max})`;
    return null;
  }, [type, value, min, max]);

  const hasError = !!validation;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-[var(--color-text-primary)]">
          {label}
          {unit && (
            <span className="ml-2 text-[var(--color-text-muted)] font-normal">({unit})</span>
          )}
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
            aria-invalid={hasError}
            aria-describedby={hasError ? `${label}-error` : undefined}
            className={`w-full px-4 py-3 bg-[var(--color-bg-secondary)] border rounded-lg text-[var(--color-text-primary)] text-lg font-medium placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
              hasError
                ? 'border-[var(--color-data-fail)] focus:ring-[var(--color-data-fail)]/30'
                : 'border-[var(--color-border)] focus:ring-[var(--color-accent)]'
            }`}
          />
          {unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm font-medium pointer-events-none">
              {unit}
            </span>
          )}
        </div>
      ) : (
        <select
          aria-label={label}
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

      {/* Validation error message */}
      {hasError && (
        <p id={`${label}-error`} role="alert" className="flex items-center gap-1.5 text-xs text-[var(--color-data-fail)] font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {validation}
        </p>
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
            <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {item.description}
            </div>
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
          bg: 'bg-data-pass/40',
          border: 'border-data-pass',
          text: 'text-data-pass',
          icon: 'text-data-pass',
        };
      case 'moderate':
        return {
          bg: 'bg-data-provisional/40',
          border: 'border-data-provisional',
          text: 'text-data-provisional',
          icon: 'text-data-provisional',
        };
      case 'high':
        return {
          bg: 'bg-data-fail/40',
          border: 'border-data-fail',
          text: 'text-data-fail',
          icon: 'text-data-fail',
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
                      ? 'bg-data-pass'
                      : result.riskLevel === 'moderate'
                        ? 'bg-data-provisional'
                        : 'bg-data-fail'
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
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              {result.recommendation}
            </p>
          </div>

          {/* Additional Details */}
          {result.details && (
            <div className="pt-3 border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                {result.details}
              </p>
            </div>
          )}

          {/* Reference */}
          {result.reference && (
            <div className="pt-2">
              <p className="text-xs text-[var(--color-text-muted)] italic">
                Reference: {result.reference}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/**
 * CalculatorHeader - Consistent header with optional back button
 * Omit onBack when a parent provides its own BackLink (e.g. ToolkitHub).
 */
interface CalculatorHeaderProps {
  title: string;
  subtitle: string;
  onBack?: () => void;
}

export const CalculatorHeader: React.FC<CalculatorHeaderProps> = ({
  title,
  subtitle,
  onBack,
}) => {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-4xl font-bold text-[var(--color-text-primary)] tracking-wide mb-1">
          {title}
        </h2>
        <p className="text-[var(--color-text-muted)]">{subtitle}</p>
      </div>
      {onBack && (
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>← Back</span>
        </button>
      )}
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

export const SimpleCalculatorResult: React.FC<SimpleResultProps> = ({
  label,
  value,
  highlight = false,
}) => {
  return (
    <div
      className={`p-4 rounded-lg border ${highlight ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/50' : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'}`}
    >
      <div className="text-sm text-[var(--color-text-muted)] mb-1">{label}</div>
      <div
        className={`text-2xl font-bold ${highlight ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}
      >
        {value}
      </div>
    </div>
  );
};

/**
 * ResetButton - Clear all calculator inputs at once
 */
interface ResetButtonProps {
  onReset: () => void;
  label?: string;
}

export const ResetButton: React.FC<ResetButtonProps> = ({
  onReset,
  label = 'Reset',
}) => (
  <button
    type="button"
    onClick={onReset}
    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] text-sm font-medium transition-all"
  >
    <RotateCcw className="w-4 h-4" />
    {label}
  </button>
);

/**
 * CopyResultButton - Copy clinical interpretation text to clipboard
 */
interface CopyResultButtonProps {
  getText: () => string;
  label?: string;
}

export const CopyResultButton: React.FC<CopyResultButtonProps> = ({
  getText,
  label = 'Copy Result',
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = getText();
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
        copied
          ? 'border-[var(--color-data-pass)] bg-[var(--color-data-pass)]/10 text-[var(--color-data-pass)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)]'
      }`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : label}
    </button>
  );
};

// Aliases for backward compatibility
export const CalculatorInput = ClinicalInput;
