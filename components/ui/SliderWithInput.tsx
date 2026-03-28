/**
 * SliderWithInput - Form input UX: avoid the "slider trap"
 *
 * Pairs a slider with a typed input and [-] [+] stepper so users can:
 * - Type exact values (e.g. 50 questions) instead of dragging to 49...51...50
 * - Use stepper for quick adjustments
 *
 * Optional snap-to-grid: for "Questions" etc., snap to logical increments
 * (e.g. 10, 20, 40, 60) instead of 1, 2, 3...
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

export interface SliderWithInputProps {
  /** Current value */
  value: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step when no snapValues (e.g. 0.01, 1, 5) */
  step?: number;
  /** Optional snap-to-grid values (e.g. [10, 20, 40, 60] for questions) */
  snapValues?: number[];
  /** Unit suffix for display (e.g. '%', ' min', '') */
  unit?: string;
  /** Label above the control */
  label?: React.ReactNode;
  /** Convert value to string for the input (e.g. 0.9 -> "90" for percentage) */
  toInputValue?: (value: number) => string;
  /** Parse input string to number (e.g. "90" -> 0.9) */
  fromInputValue?: (input: string) => number;
  /** Optional commit on blur only (e.g. for retention callback) */
  onCommit?: (value: number) => void;
  /** Snap input to grid on blur (default true) */
  snapInputOnBlur?: boolean;
  /** Input width class (default w-16) */
  inputClassName?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Hide slider, show only input + stepper */
  sliderHidden?: boolean;
  /** aria-label for accessibility */
  'aria-label'?: string;
}

function defaultToInput(v: number): string {
  return String(v);
}
function defaultFromInput(s: string): number {
  return parseFloat(s) || 0;
}

/** Clamp value to [min, max] and optionally to nearest snap */
function clampAndSnap(
  value: number,
  min: number,
  max: number,
  snapValues: number[] | undefined
): number {
  let n = Math.max(min, Math.min(max, value));
  if (snapValues != null && snapValues.length > 0) {
    const nearest = snapValues.reduce((best, s) =>
      Math.abs(s - n) < Math.abs(best - n) ? s : best
    );
    n = nearest;
  }
  return n;
}

/** Index of nearest snap value for slider position */
function indexOfNearest(value: number, snapValues: number[]): number {
  if (snapValues.length === 0) return 0;
  let best = 0;
  const fallback = snapValues[0] ?? value;
  for (let i = 1; i < snapValues.length; i++) {
    const candidate = snapValues[i] ?? fallback;
    const bestVal = snapValues[best] ?? fallback;
    if (Math.abs(candidate - value) < Math.abs(bestVal - value)) best = i;
  }
  return best;
}

export const SliderWithInput: React.FC<SliderWithInputProps> = ({
  value,
  onChange,
  min,
  max,
  step: stepProp,
  snapValues,
  unit = '',
  label,
  toInputValue = defaultToInput,
  fromInputValue = defaultFromInput,
  onCommit,
  snapInputOnBlur = true,
  inputClassName = 'w-16',
  disabled = false,
  sliderHidden = false,
  'aria-label': ariaLabel,
}) => {
  const step =
    stepProp ??
    (snapValues && snapValues.length > 1
      ? Math.min(
          ...snapValues.slice(1).map((s, i) => {
            const prev = snapValues[i] ?? s;
            return Math.abs(s - prev);
          })
        )
      : 1);

  const [inputStr, setInputStr] = useState<string>(() => toInputValue(value));
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = isFocused ? inputStr : toInputValue(value);

  useEffect(() => {
    if (!isFocused) setInputStr(toInputValue(value));
  }, [value, isFocused, toInputValue]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setInputStr(raw);
      const parsed = fromInputValue(raw);
      if (!Number.isNaN(parsed)) {
        const next = snapValues
          ? clampAndSnap(parsed, min, max, undefined)
          : Math.max(min, Math.min(max, parsed));
        onChange(next);
      }
    },
    [min, max, snapValues, fromInputValue, onChange]
  );

  const handleInputBlur = useCallback(() => {
    setIsFocused(false);
    const parsed = fromInputValue(inputStr);
    const next = Number.isNaN(parsed)
      ? value
      : snapInputOnBlur
        ? clampAndSnap(parsed, min, max, snapValues)
        : Math.max(min, Math.min(max, parsed));
    setInputStr(toInputValue(next));
    onChange(next);
    onCommit?.(next);
  }, [
    inputStr,
    value,
    min,
    max,
    snapValues,
    snapInputOnBlur,
    fromInputValue,
    toInputValue,
    onChange,
    onCommit,
  ]);

  const handleInputFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const stepDown = useCallback(() => {
    let next: number;
    if (snapValues && snapValues.length > 0) {
      const idx = indexOfNearest(value, snapValues);
      next = idx <= 0 ? min : ((snapValues[idx - 1] ?? min) as number);
    } else {
      next = Math.max(min, value - step);
    }
    next = Math.max(min, next);
    onChange(next);
    setInputStr(toInputValue(next));
    onCommit?.(next);
  }, [value, min, step, snapValues, toInputValue, onChange, onCommit]);

  const stepUp = useCallback(() => {
    let next: number;
    if (snapValues && snapValues.length > 0) {
      const idx = indexOfNearest(value, snapValues);
      next = idx >= snapValues.length - 1 ? max : ((snapValues[idx + 1] ?? max) as number);
    } else {
      next = Math.min(max, value + step);
    }
    next = Math.min(max, next);
    onChange(next);
    setInputStr(toInputValue(next));
    onCommit?.(next);
  }, [value, max, step, snapValues, toInputValue, onChange, onCommit]);

  const sliderValue = useMemo(() => {
    if (snapValues && snapValues.length > 0) {
      const idx = indexOfNearest(value, snapValues);
      return snapValues[idx] ?? value;
    }
    return value;
  }, [value, snapValues]);

  const sliderMin = snapValues && snapValues.length > 0 ? (snapValues[0] ?? min) : min;
  const sliderMax =
    snapValues && snapValues.length > 0 ? (snapValues[snapValues.length - 1] ?? max) : max;
  const sliderStep =
    snapValues && snapValues.length > 1
      ? Math.min(
          ...snapValues.slice(1).map((s, i) => {
            const prev = snapValues[i] ?? s;
            return Math.abs(s - prev);
          })
        )
      : step;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      const next =
        snapValues && snapValues.length > 0
          ? (snapValues[indexOfNearest(v, snapValues)] ?? v)
          : Math.max(min, Math.min(max, v));
      onChange(next);
      setInputStr(toInputValue(next));
    },
    [min, max, snapValues, toInputValue, onChange]
  );

  const handleSliderCommit = useCallback(() => {
    onCommit?.(value);
  }, [value, onCommit]);

  return (
    <div
      className="space-y-2"
      role="group"
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
    >
      {label != null && (
        <div className="flex items-center justify-between">
          {typeof label === 'string' ? (
            <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
          ) : (
            label
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={stepDown}
          disabled={disabled || value <= min}
          aria-label="Decrease"
          className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <label className="flex items-center gap-1.5">
          <input
            type="number"
            min={min}
            max={max}
            step={snapValues ? undefined : step}
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            disabled={disabled}
            inputMode="numeric"
            className={`${inputClassName} px-2 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-center text-sm focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            aria-label="Value"
          />
          {unit && <span className="text-sm text-[var(--color-text-secondary)]">{unit}</span>}
        </label>
        <button
          type="button"
          onClick={stepUp}
          disabled={disabled || value >= max}
          aria-label="Increase"
          className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {!sliderHidden && (
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          value={sliderValue}
          onChange={handleSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          disabled={disabled}
          className="w-full h-2 appearance-none bg-transparent cursor-pointer relative z-10
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[var(--color-text-primary)]
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-[var(--color-bg-primary)]
            [&::-webkit-slider-thumb]:shadow-lg
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[var(--color-text-primary)]
            [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-[var(--color-bg-primary)]
            [&::-moz-range-thumb]:cursor-pointer
          "
        />
      )}
    </div>
  );
};

export default SliderWithInput;
