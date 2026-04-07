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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`
        pointer-events-auto rounded-xl p-4
        ${TOAST_STYLES[toast.variant]}
      `}
      style={{ boxShadow: '0 0 0 1px var(--color-border), 0 4px 12px rgba(0,0,0,0.08)' }}
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
