/**
 * Toast Zustand Store
 *
 * Manages toast notification state. The rendering layer (ToastContainer)
 * remains a React component — only the state is moved out of Context.
 *
 * Phase 3 migration: contexts/ToastContext.tsx → lib/stores/useToastStore.ts
 *
 * The imperative toast API (lib/toast.ts) wires directly into the store
 * on first import, eliminating the registerToast indirection.
 *
 * Usage:
 *   import { useToastStore } from '@/lib/stores/useToastStore';
 *
 *   const { success, error } = useToastStore();
 *   success('Saved!');
 */

import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const DEFAULT_DURATION = 4000;
const MAX_TOASTS = 5;

// Timer map lives outside Zustand (non-serializable, not state)
const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(id: string) {
  const timer = timerMap.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timerMap.delete(id);
  }
}

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  // Convenience methods
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  // Legacy backward-compatible method
  showToast: (options: {
    type?: ToastVariant;
    message: string;
    duration?: number;
  }) => string;
}

export const useToastStore = create<ToastState & ToastActions>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast: Toast = { ...toast, id };

    set((state) => {
      const updated = [...state.toasts, newToast];
      if (updated.length > MAX_TOASTS) {
        // Evict oldest and clear their timers
        const evicted = updated.slice(0, updated.length - MAX_TOASTS);
        evicted.forEach((t) => clearTimer(t.id));
        return { toasts: updated.slice(-MAX_TOASTS) };
      }
      return { toasts: updated };
    });

    // Auto-dismiss
    const duration = toast.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      const timer = setTimeout(() => {
        timerMap.delete(id);
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
      timerMap.set(id, timer);
    }

    return id;
  },

  removeToast: (id) => {
    clearTimer(id);
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  clearAllToasts: () => {
    // Clear all pending timers
    timerMap.forEach((timer) => clearTimeout(timer));
    timerMap.clear();
    set({ toasts: [] });
  },

  success: (message, duration) => get().addToast({ message, variant: 'success', duration }),
  error: (message, duration) => get().addToast({ message, variant: 'error', duration }),
  warning: (message, duration) => get().addToast({ message, variant: 'warning', duration }),
  info: (message, duration) => get().addToast({ message, variant: 'info', duration }),

  showToast: (options) => {
    const variant = options.type || 'info';
    return get().addToast({ message: options.message, variant, duration: options.duration });
  },
}));

/**
 * Backward-compatible hook alias.
 * Drop-in replacement for the old useToast() hook.
 */
export const useToast = useToastStore;
