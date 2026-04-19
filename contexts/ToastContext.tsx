/**
 * ToastContext — Rendering Shell
 *
 * Phase 3: State moved to Zustand (lib/stores/useToastStore.ts).
 * This file now only provides:
 *   1. ToastProvider — renders the ToastContainer (no state management)
 *   2. useToast — re-exported from the Zustand store for backward compatibility
 *
 * All state management, timers, and convenience methods live in the store.
 * The imperative toast API (lib/toast.ts) wires directly into the store.
 */

import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, type Toast, type ToastVariant } from '@/lib/stores/useToastStore';
import { springs } from '@/config/appViews';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Re-export types and hook for backward compatibility
export type { Toast, ToastVariant };
export { useToastStore as useToast } from '@/lib/stores/useToastStore';

// Also re-export the full context type shape for consumers that typed against it
export type ToastContextType = ReturnType<typeof useToastStore>;

// ─── Visual constants ──────────────────────────────────────────────────────

const TOAST_ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES: Record<ToastVariant, string> = {
  success: 'bg-[var(--color-data-pass)]/8 text-[var(--color-text-primary)]',
  error:   'bg-[var(--color-data-fail)]/8 text-[var(--color-text-primary)]',
  warning: 'bg-[var(--color-data-provisional)]/8 text-[var(--color-text-primary)]',
  info:    'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-[var(--color-data-pass)]',
  error:   'text-[var(--color-data-fail)]',
  warning: 'text-[var(--color-data-provisional)]',
  info:    'text-[var(--color-accent)]',
};

// ─── Provider (rendering only) ─────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  // Read toasts + removeToast from the Zustand store
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
}

// ─── Toast Container ───────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Individual Toast ──────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = TOAST_ICONS[toast.variant];
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, y: 40, x: 16, scale: 0.92, filter: 'blur(4px)' }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, x: 0, scale: 1, filter: 'blur(0px)' }}
      exit={prefersReducedMotion ? { opacity: 0, transition: { duration: 0 } } : {
        opacity: 0,
        x: 80,
        scale: 0.95,
        filter: 'blur(2px)',
        transition: { duration: 0.2, ease: [0.32, 0, 0.67, 0] },
      }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.bouncy}
      className={`
        pointer-events-auto rounded-xl p-4 backdrop-blur-md
        ${TOAST_STYLES[toast.variant]}
      `}
      style={{
        boxShadow: '0 0 0 1px var(--color-glass-border, var(--color-border)), 0 8px 24px -4px rgba(0,0,0,0.15), 0 0 12px -2px rgba(196,183,138,0.06)',
      }}
      role="alert"
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${ICON_STYLES[toast.variant]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{toast.message}</p>
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
              className="mt-2 text-sm font-semibold underline hover:no-underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
