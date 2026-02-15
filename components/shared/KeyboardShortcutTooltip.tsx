import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Keyboard,
  Command,
  Option,
  Control,
  Shift,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export interface KeyboardShortcutTooltipProps {
  /** Tooltip text content */
  content: string;
  /** Keyboard shortcut (e.g., "Ctrl+S", "⌘[", "Esc") */
  shortcut: string;
  /** Position relative to the element */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Whether to show the keyboard icon */
  showKeyboardIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessibility label for the icon */
  ariaLabel?: string;
  /** Callback when tooltip is shown */
  onShow?: () => void;
  /** Callback when tooltip is hidden */
  onHide?: () => void;
}

/**
 * Parses a keyboard shortcut string and returns an array of key components
 */
function parseShortcut(shortcut: string): Array<{ key: string; isModifier: boolean }> {
  const parts: Array<{ key: string; isModifier: boolean }> = [];
  const normalized = shortcut.replace(/\s+/g, ' ').trim();

  // Split by + or space
  const tokens = normalized.split(/[+\s]/).filter(Boolean);

  for (const token of tokens) {
    const lowerToken = token.toLowerCase();
    const isModifier = [
      'ctrl',
      'control',
      'cmd',
      'command',
      '⌘',
      'alt',
      'option',
      'opt',
      'shift',
      '⇧',
      'meta',
      'win',
      'super',
    ].includes(lowerToken);

    parts.push({ key: token, isModifier });
  }

  return parts;
}

/**
 * Renders a keyboard key with appropriate styling
 */
function renderKey(key: string, isModifier: boolean) {
  const keyClass = `inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded text-xs font-medium ${
    isModifier
      ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
  }`;

  // Special handling for common keys
  switch (key.toLowerCase()) {
    case 'ctrl':
    case 'control':
      return (
        <kbd key={key} className={keyClass}>
          <Control className="w-3 h-3" />
        </kbd>
      );
    case 'cmd':
    case 'command':
    case '⌘':
      return (
        <kbd key={key} className={keyClass}>
          <Command className="w-3 h-3" />
        </kbd>
      );
    case 'alt':
    case 'option':
    case 'opt':
      return (
        <kbd key={key} className={keyClass}>
          <Option className="w-3 h-3" />
        </kbd>
      );
    case 'shift':
    case '⇧':
      return (
        <kbd key={key} className={keyClass}>
          <Shift className="w-3 h-3" />
        </kbd>
      );
    case '↑':
    case 'up':
      return (
        <kbd key={key} className={keyClass}>
          <ArrowUp className="w-3 h-3" />
        </kbd>
      );
    case '↓':
    case 'down':
      return (
        <kbd key={key} className={keyClass}>
          <ArrowDown className="w-3 h-3" />
        </kbd>
      );
    case '←':
    case 'left':
      return (
        <kbd key={key} className={keyClass}>
          <ArrowLeft className="w-3 h-3" />
        </kbd>
      );
    case '→':
    case 'right':
      return (
        <kbd key={key} className={keyClass}>
          <ArrowRight className="w-3 h-3" />
        </kbd>
      );
    case 'esc':
    case 'escape':
      return (
        <kbd key={key} className={keyClass}>
          Esc
        </kbd>
      );
    case 'enter':
      return (
        <kbd key={key} className={keyClass}>
          ⏎
        </kbd>
      );
    case 'tab':
      return (
        <kbd key={key} className={keyClass}>
          Tab
        </kbd>
      );
    case 'space':
      return (
        <kbd key={key} className={keyClass}>
          Space
        </kbd>
      );
    case 'backspace':
      return (
        <kbd key={key} className={keyClass}>
          ⌫
        </kbd>
      );
    case 'delete':
      return (
        <kbd key={key} className={keyClass}>
          Del
        </kbd>
      );
    default:
      return (
        <kbd key={key} className={keyClass}>
          {key}
        </kbd>
      );
  }
}

/**
 * KeyboardShortcutTooltip Component
 *
 * A specialized tooltip component for showing keyboard shortcuts.
 * Renders keyboard keys with proper styling and icons for modifiers.
 */
export const KeyboardShortcutTooltip: React.FC<KeyboardShortcutTooltipProps> = ({
  content,
  shortcut,
  position = 'top',
  delay = 300,
  showKeyboardIcon = true,
  className = '',
  ariaLabel,
  onShow,
  onHide,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const shortcutParts = parseShortcut(shortcut);

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

  const defaultIcon = showKeyboardIcon ? (
    <Keyboard
      className={`w-5 h-5 text-[var(--color-text-muted)] transition-colors duration-200 ${
        isHovered ? 'opacity-100 text-[var(--color-text-primary)]' : 'opacity-80'
      }`}
      aria-hidden="true"
    />
  ) : null;

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
      aria-label={ariaLabel || `${content} (${shortcut})`}
    >
      {/* Icon container */}
      <div
        className={`flex items-center justify-center p-1.5 rounded-lg cursor-help transition-all duration-200 ${
          isHovered ? 'bg-[var(--color-bg-secondary)] scale-105' : 'bg-transparent'
        }`}
      >
        {defaultIcon}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
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
            className="fixed z-[9999] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg shadow-lg px-3 py-2 text-sm leading-relaxed pointer-events-none max-w-[280px]"
            role="tooltip"
            aria-hidden={!isVisible}
          >
            <div className="flex flex-col gap-2">
              {/* Description */}
              <p className="font-medium">{content}</p>

              {/* Keyboard shortcut */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-[var(--color-text-muted)] mr-1">Shortcut:</span>
                {shortcutParts.map((part, index) => (
                  <React.Fragment key={index}>
                    {renderKey(part.key, part.isModifier)}
                    {index < shortcutParts.length - 1 && (
                      <span className="text-[var(--color-text-muted)] mx-0.5">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Arrow */}
            <div
              className="absolute w-3 h-3 bg-[var(--color-bg-primary)] border-l border-t border-[var(--color-border)] transform rotate-45"
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
 * Convenience component for common keyboard shortcuts
 */
export const CommonShortcutTooltip: React.FC<Omit<KeyboardShortcutTooltipProps, 'shortcut'>> = ({
  content,
  ...props
}) => {
  // Map common actions to their default shortcuts
  const shortcutMap: Record<string, string> = {
    'Toggle sidebar': '[',
    'Command palette': 'Ctrl+K',
    'End session': 'Esc',
    'Flag question': 'F',
    'Show explanation': 'E',
    'Toggle stats': 'S',
    'Next question': 'Space',
    'Submit answer': 'Enter',
    'Increase font': 'Ctrl+↑',
    'Decrease font': 'Ctrl+↓',
    'Zoom in': 'Ctrl++',
    'Zoom out': 'Ctrl+-',
    'Reset zoom': 'Ctrl+0',
  };

  const shortcut = shortcutMap[content] || '';

  return <KeyboardShortcutTooltip content={content} shortcut={shortcut} {...props} />;
};
