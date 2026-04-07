import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, HelpCircle, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export type FieldTooltipSeverity = 'info' | 'help' | 'warning' | 'success' | 'error';

export interface FieldTooltipProps {
  /** ID of the form field this tooltip is associated with */
  fieldId: string;
  /** Tooltip text content */
  content: string;
  /** Severity level (affects color and icon) */
  severity?: FieldTooltipSeverity;
  /** Position relative to the field */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Whether the tooltip is always visible (for required fields) */
  alwaysVisible?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when tooltip is shown */
  onShow?: () => void;
  /** Callback when tooltip is hidden */
  onHide?: () => void;
}

const severityConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-[var(--color-info-bg)]',
    textColor: 'text-[var(--color-info-text)]',
    borderColor: 'border-[var(--color-info-border)]',
    iconColor: 'text-[var(--color-info-icon)]',
  },
  help: {
    icon: HelpCircle,
    bgColor: 'bg-[var(--color-help-bg)]',
    textColor: 'text-[var(--color-help-text)]',
    borderColor: 'border-[var(--color-help-border)]',
    iconColor: 'text-[var(--color-help-icon)]',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-[var(--color-warning-bg)]',
    textColor: 'text-[var(--color-warning-text)]',
    borderColor: 'border-[var(--color-warning-border)]',
    iconColor: 'text-[var(--color-warning-icon)]',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-[var(--color-success-bg)]',
    textColor: 'text-[var(--color-success-text)]',
    borderColor: 'border-[var(--color-success-border)]',
    iconColor: 'text-[var(--color-success-icon)]',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-[var(--color-error-bg)]',
    textColor: 'text-[var(--color-error-text)]',
    borderColor: 'border-[var(--color-error-border)]',
    iconColor: 'text-[var(--color-error-icon)]',
  },
} as const;

/**
 * FieldTooltip Component
 *
 * A specialized tooltip component for form fields that provides contextual help
 * and validation guidance. Automatically associates with form fields via fieldId.
 */
export const FieldTooltip: React.FC<FieldTooltipProps> = ({
  fieldId,
  content,
  severity = 'info',
  position = 'top',
  alwaysVisible = false,
  className = '',
  onShow,
  onHide,
}) => {
  const [isVisible, setIsVisible] = useState(alwaysVisible);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const config = severityConfig[severity];
  const IconComponent = config.icon;

  const showTooltip = () => {
    if (alwaysVisible) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      onShow?.();
    }, 300);
  };

  const hideTooltip = () => {
    if (alwaysVisible) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsVisible(false);
    onHide?.();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    showTooltip();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    hideTooltip();
  };

  const handleFocus = () => {
    showTooltip();
  };

  const handleBlur = () => {
    hideTooltip();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideTooltip();
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Adjust tooltip position to stay in viewport
  useEffect(() => {
    if (isVisible && tooltipRef.current && containerRef.current) {
      const tooltip = tooltipRef.current;
      const container = containerRef.current;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Get container position
      const containerRect = container.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let top = 0;
      let left = 0;

      // Calculate base position
      switch (position) {
        case 'top':
          top = containerRect.top - tooltipRect.height - 8;
          left = containerRect.left + containerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = containerRect.bottom + 8;
          left = containerRect.left + containerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = containerRect.top + containerRect.height / 2 - tooltipRect.height / 2;
          left = containerRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = containerRect.top + containerRect.height / 2 - tooltipRect.height / 2;
          left = containerRect.right + 8;
          break;
      }

      // Adjust for viewport boundaries
      if (left < 8) left = 8;
      if (left + tooltipRect.width > viewportWidth - 8) {
        left = viewportWidth - tooltipRect.width - 8;
      }
      if (top < 8) top = 8;
      if (top + tooltipRect.height > viewportHeight - 8) {
        top = viewportHeight - tooltipRect.height - 8;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }
  }, [isVisible, position]);

  // Link to form field for accessibility
  useEffect(() => {
    const field = document.getElementById(fieldId);
    if (field) {
      const currentAriaDescribedBy = field.getAttribute('aria-describedby');
      const tooltipId = `field-tooltip-${fieldId}`;

      // Add tooltip ID to aria-describedby if not already present
      if (currentAriaDescribedBy) {
        if (!currentAriaDescribedBy.includes(tooltipId)) {
          field.setAttribute('aria-describedby', `${currentAriaDescribedBy} ${tooltipId}`);
        }
      } else {
        field.setAttribute('aria-describedby', tooltipId);
      }
    }
  }, [fieldId]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Help for ${fieldId}`}
      aria-describedby={`field-tooltip-${fieldId}`}
    >
      {/* Icon container */}
      <div
        className={`flex items-center justify-center p-1 rounded-lg cursor-help transition-all duration-200 ${
          isHovered || alwaysVisible ? 'bg-[var(--color-bg-secondary)] scale-105' : 'bg-transparent'
        }`}
      >
        <IconComponent
          className={`w-4 h-4 ${config.iconColor} transition-colors duration-200 ${
            isHovered || alwaysVisible ? 'opacity-100' : 'opacity-70'
          }`}
          aria-hidden="true"
        />
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {(isVisible || alwaysVisible) && (
          <motion.div
            ref={tooltipRef}
            id={`field-tooltip-${fieldId}`}
            initial={{
              opacity: 0,
              scale: 0.9,
              y: position === 'top' ? -5 : position === 'bottom' ? 5 : 0,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.9,
              y: position === 'top' ? -5 : position === 'bottom' ? 5 : 0,
            }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`fixed z-[20] ${config.bgColor} ${config.textColor} ${config.borderColor} border rounded-lg shadow-lg px-3 py-2 text-sm leading-relaxed pointer-events-none max-w-[280px]`}
            role="tooltip"
            aria-hidden={!(isVisible || alwaysVisible)}
          >
            <div className="flex items-start gap-2">
              <IconComponent className={`w-4 h-4 ${config.iconColor} flex-shrink-0 mt-0.5`} />
              <p className="flex-1">{content}</p>
            </div>

            {/* Arrow */}
            <div
              className={`absolute w-3 h-3 ${config.bgColor} ${config.borderColor} border-l border-t transform rotate-45`}
              style={{
                [position === 'top'
                  ? 'bottom'
                  : position === 'bottom'
                    ? 'top'
                    : position === 'left'
                      ? 'right'
                      : 'left']: '-6px',
                left: position === 'left' || position === 'right' ? '50%' : '50%',
                marginLeft: position === 'left' || position === 'right' ? '-6px' : '0',
                marginTop: position === 'top' || position === 'bottom' ? '0' : '-6px',
                borderRight: position === 'left' ? 'none' : undefined,
                borderBottom: position === 'top' ? 'none' : undefined,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Convenience component for info field tooltips
 */
export const InfoFieldTooltip: React.FC<Omit<FieldTooltipProps, 'severity'>> = (props) => (
  <FieldTooltip severity="info" {...props} />
);

/**
 * Convenience component for help field tooltips
 */
export const HelpFieldTooltip: React.FC<Omit<FieldTooltipProps, 'severity'>> = (props) => (
  <FieldTooltip severity="help" {...props} />
);

/**
 * Convenience component for warning field tooltips
 */
export const WarningFieldTooltip: React.FC<Omit<FieldTooltipProps, 'severity'>> = (props) => (
  <FieldTooltip severity="warning" {...props} />
);

/**
 * Convenience component for error field tooltips
 */
export const ErrorFieldTooltip: React.FC<Omit<FieldTooltipProps, 'severity'>> = (props) => (
  <FieldTooltip severity="error" {...props} />
);

/**
 * Convenience component for success field tooltips
 */
export const SuccessFieldTooltip: React.FC<Omit<FieldTooltipProps, 'severity'>> = (props) => (
  <FieldTooltip severity="success" {...props} />
);
