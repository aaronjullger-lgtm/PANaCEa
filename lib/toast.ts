/**
 * Imperative Toast API
 *
 * Call toast from anywhere—services, API handlers, callbacks, non-React code.
 * Now wires directly into the Zustand store (no registerToast needed).
 *
 * Phase 3: Simplified — store is always available, no mount timing issues.
 *
 * @example
 * import { toast } from '@/lib/toast';
 *
 * // Auto-save feedback
 * toast.success('Changes saved');
 *
 * // API error handler
 * toast.error('Failed to sync. Retrying...');
 *
 * // With action
 * toast.error('Sync failed', { action: { label: 'Retry', onClick: retry } });
 */

import { useToastStore } from '@/lib/stores/useToastStore';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Dedupe key – if a toast with this id is already visible, skip */
  id?: string;
  /** Duration in ms; 0 = no auto-dismiss */
  duration?: number;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastApi {
  success: (message: string, options?: ToastOptions | number) => string;
  error: (message: string, options?: ToastOptions | number) => string;
  warning: (message: string, options?: ToastOptions | number) => string;
  info: (message: string, options?: ToastOptions | number) => string;
  /** Low-level: add toast with full options */
  add: (message: string, variant: ToastVariant, options?: ToastOptions) => string;
}

function normalizeOptions(opts?: ToastOptions | number): {
  duration?: number;
  action?: ToastOptions['action'];
} {
  if (opts == null) return {};
  if (typeof opts === 'number') return { duration: opts };
  return opts;
}

function add(variant: ToastVariant, message: string, options?: ToastOptions): string {
  const { duration, action } = normalizeOptions(options) ?? {};
  return useToastStore.getState().addToast({ message, variant, duration, action });
}

const toast: ToastApi = {
  success: (message, opts) => add('success', message, normalizeOptions(opts)),
  error: (message, opts) => add('error', message, normalizeOptions(opts)),
  warning: (message, opts) => add('warning', message, normalizeOptions(opts)),
  info: (message, opts) => add('info', message, normalizeOptions(opts)),
  add: (message, variant, opts) => add(variant, message, opts),
};

/**
 * @deprecated No longer needed — store is always available.
 * Kept for backward compatibility with ToastContext.tsx during migration.
 */
export function registerToast(_fn: any): () => void {
  return () => {};
}

export { toast };
