/**
 * Input & TextArea Primitives
 * 
 * Standardized form inputs using CSS custom properties for consistent theming.
 * Provides focus rings, error states, disabled states, and dark mode support.
 */

import React from 'react';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visual size variant */
  size?: InputSize;
  /** Error message — triggers error styling when truthy */
  error?: string;
  /** Label text rendered above the input */
  label?: string;
  /** Hint text rendered below the input */
  hint?: string;
  /** Left icon/element */
  icon?: React.ReactNode;
  /** Right icon/element (e.g. clear button) */
  iconRight?: React.ReactNode;
  /** Additional wrapper className */
  wrapperClassName?: string;
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-3 py-2 text-base min-h-[44px]',
  lg: 'px-4 py-3 text-lg min-h-[52px]',
};

const baseClasses = `
  w-full rounded-lg font-normal transition-colors
  bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
  border border-[var(--color-border)]
  placeholder:text-[var(--color-text-muted)]
  hover:border-[var(--color-accent)]/40
  focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)]
  disabled:opacity-50 disabled:cursor-not-allowed
`;

const errorClasses = `
  border-[var(--color-data-fail)] 
  focus-visible:ring-[var(--color-data-fail)]
  hover:border-[var(--color-data-fail)]
`;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', error, label, hint, icon, iconRight, wrapperClassName = '', className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint && !error ? `${inputId}-hint` : undefined;

    return (
      <div className={wrapperClassName}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={errorId || hintId}
            className={`
              ${baseClasses}
              ${sizeClasses[size]}
              ${error ? errorClasses : ''}
              ${icon ? 'pl-10' : ''}
              ${iconRight ? 'pr-10' : ''}
              ${className}
            `}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true">
              {iconRight}
            </span>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-[var(--color-data-fail)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-[var(--color-text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ============================================================================
// TextArea
// ============================================================================

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visual size variant */
  size?: InputSize;
  /** Error message — triggers error styling when truthy */
  error?: string;
  /** Label text rendered above the textarea */
  label?: string;
  /** Hint text rendered below the textarea */
  hint?: string;
  /** Additional wrapper className */
  wrapperClassName?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ size = 'md', error, label, hint, wrapperClassName = '', className = '', id, ...props }, ref) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const errorId = error ? `${textareaId}-error` : undefined;
    const hintId = hint && !error ? `${textareaId}-hint` : undefined;

    const textareaSizeClasses: Record<InputSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-3 py-2 text-base',
      lg: 'px-4 py-3 text-lg',
    };

    return (
      <div className={wrapperClassName}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={!!error}
          aria-describedby={errorId || hintId}
          className={`
            ${baseClasses}
            ${textareaSizeClasses[size]}
            resize-vertical
            ${error ? errorClasses : ''}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-[var(--color-data-fail)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-[var(--color-text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
TextArea.displayName = 'TextArea';

export type { InputProps, TextAreaProps, InputSize };
