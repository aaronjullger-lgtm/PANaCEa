import { afterEach, describe, expect, it } from 'vitest';
import { useToastStore } from './useToastStore';

describe('useToastStore system-state behavior', () => {
  afterEach(() => {
    useToastStore.getState().clearAllToasts();
  });

  it('deduplicates repeated alert messages', () => {
    const firstId = useToastStore.getState().addToast({
      id: 'recommendations-error',
      message: 'Recommendations unavailable. Your progress is safe.',
      variant: 'warning',
      duration: 0,
    });
    const secondId = useToastStore.getState().addToast({
      id: 'recommendations-error',
      message: 'Recommendations unavailable. Your progress is safe.',
      variant: 'warning',
      duration: 0,
    });

    expect(secondId).toBe(firstId);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('keeps only one competing warning or error visible', () => {
    useToastStore.getState().addToast({
      message: 'Recommendations unavailable. Your progress is safe.',
      variant: 'warning',
      duration: 0,
    });
    useToastStore.getState().addToast({
      message: 'Study plan unavailable. Your progress is safe.',
      variant: 'error',
      duration: 0,
    });

    const alerts = useToastStore
      .getState()
      .toasts.filter((toast) => toast.variant === 'warning' || toast.variant === 'error');

    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.message).toBe('Study plan unavailable. Your progress is safe.');
  });

  it('caps total visible toasts to three', () => {
    useToastStore.getState().addToast({ message: 'Saved one', variant: 'success', duration: 0 });
    useToastStore.getState().addToast({ message: 'Saved two', variant: 'success', duration: 0 });
    useToastStore.getState().addToast({ message: 'Saved three', variant: 'success', duration: 0 });
    useToastStore.getState().addToast({ message: 'Saved four', variant: 'success', duration: 0 });

    expect(useToastStore.getState().toasts).toHaveLength(3);
    expect(useToastStore.getState().toasts.map((toast) => toast.message)).toEqual([
      'Saved two',
      'Saved three',
      'Saved four',
    ]);
  });
});
