/**
 * Imperative Toast API
 *
 * Call toast from anywhere—services, API handlers, callbacks, non-React code.
 * Wires into ToastProvider when mounted; safe no-op if called before mount.
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

type AddToastFn = (toast: {
  message: string;
  variant: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}) => string;

let impl: AddToastFn | null = null;

/**
 * Register the toast implementation (called by ToastProvider on mount).
 * @internal
 */
export function registerToast(fn: AddToastFn): () => void {
  impl = fn;
  return () => {
    impl = null;
  };
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
  if (impl) {
    const { duration, action } = normalizeOptions(options) ?? {};
    return impl({ message, variant, duration, action });
  }
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.warn(`[toast] ToastProvider not mounted. "${variant}": ${message}`);
  }
  return '';
}

const toast: ToastApi = {
  success: (message, opts) => add('success', message, normalizeOptions(opts)),
  error: (message, opts) => add('error', message, normalizeOptions(opts)),
  warning: (message, opts) => add('warning', message, normalizeOptions(opts)),
  info: (message, opts) => add('info', message, normalizeOptions(opts)),
  add: (message, variant, opts) => add(variant, message, opts),
};

export { toast };
