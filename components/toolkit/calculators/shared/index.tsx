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
        <label className="text-sm font-semibold text-slate-200">
          {label}
          {unit && <span className="ml-2 text-slate-400 font-normal">({unit})</span>}
        </label>
        {range && (
          <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-800/50 rounded">
            Normal: {range}
          </span>
        )}
      </div>
      
      {sublabel && (
        <p className="text-xs text-slate-400">{sublabel}</p>
      )}

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
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-lg font-medium placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {unit && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">
              {unit}
            </span>
          )}
        </div>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none cursor-pointer"
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
  variant = 'default' 
}) => {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <label
          key={idx}
          className={`
            flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all
            ${item.disabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-slate-800/60 hover:border-slate-600'
            }
            ${item.state 
              ? 'bg-blue-950/30 border-2 border-blue-700' 
              : 'bg-slate-900/50 border-2 border-slate-700'
            }
          `}
        >
          <input
            type="checkbox"
            checked={item.state}
            onChange={(e) => !item.disabled && item.setState(e.target.checked)}
            disabled={item.disabled}
            className="w-5 h-5 mt-0.5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="font-semibold text-slate-100">
                {item.title}
              </div>
              {item.points !== undefined && (
                <span className={`
                  px-2 py-0.5 rounded text-xs font-bold
                  ${item.state 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-slate-400'
                  }
                `}>
                  +{item.points}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-400 leading-relaxed">
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
  className = '' 
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
    result.riskLevel === 'low' ? CheckCircle2 
    : result.riskLevel === 'moderate' ? Info 
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
                className="text-5xl font-bold text-slate-100"
                style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
              >
                {result.score}
              </motion.span>
              <span className={`text-xl font-semibold ${colors.text}`}>
                {result.interpretation}
              </span>
            </div>
            
            {/* Risk Bar */}
            {showRiskBar && (
              <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ 
                    width: result.riskLevel === 'low' ? '33%' 
                      : result.riskLevel === 'moderate' ? '66%' 
                      : '100%' 
                  }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  className={`h-full ${
                    result.riskLevel === 'low' ? 'bg-emerald-500' 
                    : result.riskLevel === 'moderate' ? 'bg-amber-500' 
                    : 'bg-red-500'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                Clinical Recommendation
              </h4>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {result.recommendation}
            </p>
          </div>

          {/* Additional Details */}
          {result.details && (
            <div className="pt-3 border-t border-slate-700">
              <p className="text-sm text-slate-400 leading-relaxed">
                {result.details}
              </p>
            </div>
          )}

          {/* Reference */}
          {result.reference && (
            <div className="pt-2">
              <p className="text-xs text-slate-500 italic">
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
 * CalculatorHeader - Consistent header with back button
 */
interface CalculatorHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

export const CalculatorHeader: React.FC<CalculatorHeaderProps> = ({
  title,
  subtitle,
  onBack,
}) => {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 
          className="text-4xl font-bold text-slate-100 tracking-wide mb-1"
          style={{ fontFamily: "'Teko', 'Poppins', sans-serif" }}
        >
          {title}
        </h2>
        <p className="text-slate-400">{subtitle}</p>
      </div>
      <button
        onClick={onBack}
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
      >
        <span>← Back</span>
      </button>
    </div>
  );
};
