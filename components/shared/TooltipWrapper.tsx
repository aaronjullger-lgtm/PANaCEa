import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, HelpCircle, AlertCircle, CheckCircle, XCircle, ChevronRight } from 'lucide-react';

export type TooltipVariant = 'info' | 'help' | 'warning' | 'success' | 'error' | 'action';

export interface TooltipWrapperProps {
  /** The element to wrap with a tooltip */
  children: React.ReactElement;
  /** Tooltip text content */
  content: string;
  /** Tooltip variant (affects color and icon) */
  variant?: TooltipVariant;
  /** Position relative to the element */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Maximum width of tooltip */
  maxWidth?: number;
  /** Whether to show arrow pointer */
  showArrow?: boolean;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Accessibility label for the element */
  ariaLabel?: string;
  /** Whether the tooltip is interactive (can be clicked/hovered) */
  interactive?: boolean;
  /** Callback when tooltip is shown */
  onShow?: () => void;
  /** Callback when tooltip is hidden */
  onHide?: () => void;
}

const variantConfig = {
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
  action: {
    icon: ChevronRight,
    bgColor: 'bg-[var(--color-action-bg)]',
    textColor: 'text-[var(--color-action-text)]',
    borderColor: 'border-[var(--color-action-border)]',
    iconColor: 'text-[var(--color-action-icon)]',
  },
} as const;

/**
 * TooltipWrapper Component
 * 
 * A wrapper component that adds a tooltip to any child element.
 * Unlike IconTooltip, this component doesn't render its own icon - it wraps existing content.
 */
export const TooltipWrapper: React.FC<TooltipWrapperProps> = ({
  children,
  content,
  variant = 'info',
  position = 'top',
  delay = 300,
  maxWidth = 240,
  showArrow = true,
  className = '',
  ariaLabel,
  interactive = false,
  onShow,
  onHide,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      onShow?.();
    }, delay);
  };

  const hideTooltip = () => {
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

  // Clone the child element to add event handlers and ref
  const childWithProps = React.cloneElement(children, {
    ref: containerRef,
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      handleMouseEnter();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      children.props.onMouseLeave?.(e);
      handleMouseLeave();
    },
    onFocus: (e: React.FocusEvent) => {
      children.props.onFocus?.(e);
      handleFocus();
    },
    onBlur: (e: React.FocusEvent) => {
      children.props.onBlur?.(e);
      handleBlur();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      children.props.onKeyDown?.(e);
      handleKeyDown(e);
    },
    'aria-label': ariaLabel || children.props['aria-label'] || content,
    tabIndex: children.props.tabIndex ?? 0,
  });

  return (
    <div className={`relative inline-flex ${className}`}>
      {childWithProps}

      {/* Tooltip */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9, y: position === 'top' ? -5 : position === 'bottom' ? 5 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: position === 'top' ? -5 : position === 'bottom' ? 5 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`fixed z-[9999] ${config.bgColor} ${config.textColor} ${config.borderColor} border rounded-lg shadow-lg px-3 py-2 text-sm leading-relaxed pointer-events-none ${
              interactive ? 'pointer-events-auto' : ''
            }`}
            style={{ maxWidth: `${maxWidth}px` }}
            role="tooltip"
            aria-hidden={!isVisible}
          >
            <div className="flex items-start gap-2">
              <IconComponent className={`w-4 h-4 ${config.iconColor} flex-shrink-0 mt-0.5`} />
              <p className="flex-1">{content}</p>
            </div>

            {/* Arrow */}
            {showArrow && (
              <div
                className={`absolute w-3 h-3 ${config.bgColor} ${config.borderColor} border-l border-t transform rotate-45`}
                style={{
                  [position === 'top' ? 'bottom' : position === 'bottom' ? 'top' : position === 'left' ? 'right' : 'left']: '-6px',
                  left: position === 'left' || position === 'right' ? '50%' : '50%',
                  marginLeft: position === 'left' || position === 'right' ? '-6px' : '0',
                  marginTop: position === 'top' || position === 'bottom' ? '0' : '-6px',
                  borderRight: position === 'left' ? 'none' : undefined,
                  borderBottom: position === 'top' ? 'none' : undefined,
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Convenience component for info tooltips
 */
export const InfoTooltipWrapper: React.FC<Omit<TooltipWrapperProps, 'variant'>> = (props) => (
  <TooltipWrapper variant="info" {...props} />
);

/**
 * Convenience component for help tooltips
 */
export const HelpTooltipWrapper: React.FC<Omit<TooltipWrapperProps, 'variant'>> = (props) => (
  <TooltipWrapper variant="help" {...props} />
);

/**
 * Convenience component for warning tooltips
 */
export const WarningTooltipWrapper: React.FC<Omit<TooltipWrapperProps, 'variant'>> = (props) => (
  <TooltipWrapper variant="warning" {...props} />
);

/**
 * Convenience component for success tooltips
 */
export const SuccessTooltipWrapper: React.FC<Omit<TooltipWrapperProps, 'variant'>> = (props) => (
  <TooltipWrapper variant="success" {...props} />
);

/**
 * Convenience component for error tooltips
 */
export const ErrorTooltipWrapper: React.FC<Omit<TooltipWrapperProps, 'variant'>> = (props) => (
  <TooltipWrapper variant="error" {...props} />
);

/**
 * Convenience component for action tooltips
 */
export const ActionTooltipWrapper: React.FC<Omit<TooltipWrapperProps, 'variant'>> = (props) => (
  <TooltipWrapper variant="action" {...props} />
);