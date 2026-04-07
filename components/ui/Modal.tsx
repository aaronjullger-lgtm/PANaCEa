/**
 * Modal Primitive
 *
 * Reusable modal dialog with consistent overlay, animation, focus management,
 * and keyboard handling. Replaces scattered inline modal implementations.
 *
 * Features:
 * - Backdrop blur + overlay click to dismiss
 * - Escape key dismissal
 * - Focus trap via accessibilityUtils
 * - Smooth spring animations (respects prefers-reduced-motion)
 * - Responsive max-width sizing
 * - Scroll lock when open
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFocusTrap } from '@/lib/utils/accessibilityUtils';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Optional title for the header */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Max-width size preset */
  size?: ModalSize;
  /** Whether clicking the backdrop closes the modal */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean;
  /** Whether to show the close button in the header */
  showCloseButton?: boolean;
  /** Additional className for the modal container */
  className?: string;
  /** Additional className for the modal content area */
  contentClassName?: string;
  /** ARIA label override (defaults to title) */
  ariaLabel?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[calc(100vw-2rem)]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  contentClassName = '',
  ariaLabel,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap — keeps Tab / Shift+Tab within the modal and restores focus on close
  useFocusTrap(modalRef as React.RefObject<HTMLElement>, isOpen);

  // Escape key handler
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [isOpen]);

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop) onClose();
  }, [closeOnBackdrop, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
          className="fixed inset-0 z-50 bg-[var(--color-overlay)] backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            initial={prefersReducedMotion ? false : { scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.95, opacity: 0, y: 10 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 25, stiffness: 300 }
            }
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || title || 'Modal dialog'}
            className={`
              w-full ${sizeClasses[size]}
              bg-[var(--color-bg-primary)] rounded-2xl
              shadow-[0_18px_42px_var(--color-shadow-soft)]
              border border-[var(--color-border)]
              overflow-hidden
              focus:outline-none
              ${className}
            `}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{title}</h2>
                  )}
                  {subtitle && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5 text-[var(--color-text-muted)]" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className={`${contentClassName}`}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * ModalActions - Standardized footer for modal action buttons
 */
interface ModalActionsProps {
  children: React.ReactNode;
  className?: string;
}

export const ModalActions: React.FC<ModalActionsProps> = ({ children, className = '' }) => (
  <div className={`flex gap-3 p-5 border-t border-[var(--color-border)] ${className}`}>
    {children}
  </div>
);

export type { ModalProps, ModalSize };
