/**
 * usePushNotifications — Manages Web Push subscription lifecycle.
 *
 * Handles permission requests, subscription creation, and server registration.
 * Progressive enhancement: silently no-ops on unsupported platforms.
 *
 * iOS note: Web Push works on iOS 16.4+ for Home Screen PWAs only.
 * This hook feature-detects support and reports availability.
 *
 * @see functions/api/push/subscribe.ts — server subscription store
 * @see public/sw.js — push event handler
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export type PushPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface PushNotificationState {
  /** Whether the browser supports push notifications */
  isSupported: boolean;
  /** Current permission state */
  permission: PushPermissionState;
  /** Whether the user is actively subscribed */
  isSubscribed: boolean;
  /** Loading state during subscribe/unsubscribe */
  isLoading: boolean;
  /** Error message if something went wrong */
  error: string | null;
}

/**
 * VAPID public key — must match the server's VAPID_PUBLIC_KEY env var.
 * This is the public half of the VAPID keypair; safe to embed in client code.
 * Generate with: npx web-push generate-vapid-keys
 */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/** Convert base64 VAPID key to Uint8Array for subscription options */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { getToken } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'unsupported',
    isSubscribed: false,
    isLoading: false,
    error: null,
  });

  // Check support and current status on mount
  useEffect(() => {
    async function checkStatus() {
      const isSupported =
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      if (!isSupported) {
        setState((s) => ({ ...s, isSupported: false, permission: 'unsupported' }));
        return;
      }

      const permission = Notification.permission as PushPermissionState;

      // Check if already subscribed
      let isSubscribed = false;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        isSubscribed = sub !== null;
      } catch {
        // SW not ready yet
      }

      setState((s) => ({ ...s, isSupported, permission, isSubscribed }));
    }

    checkStatus();
  }, []);

  /** Request push permission and subscribe */
  const subscribe = useCallback(async () => {
    if (!state.isSupported || !VAPID_PUBLIC_KEY) {
      setState((s) => ({
        ...s,
        error: !VAPID_PUBLIC_KEY
          ? 'Push notifications not configured (missing VAPID key)'
          : 'Push notifications not supported on this device',
      }));
      return false;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((s) => ({
          ...s,
          isLoading: false,
          permission: permission as PushPermissionState,
          error: permission === 'denied'
            ? 'Notifications were blocked. Enable them in your browser settings.'
            : null,
        }));
        return false;
      }

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Subscribe with VAPID key
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      const token = await getToken();
      const endpoint = getApiEndpoint('/api/push/subscribe');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Server rejected subscription: ${response.status}`);
      }

      setState((s) => ({
        ...s,
        isLoading: false,
        permission: 'granted',
        isSubscribed: true,
      }));
      return true;
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to subscribe',
      }));
      return false;
    }
  }, [state.isSupported, getToken]);

  /** Unsubscribe from push notifications */
  const unsubscribe = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        // Notify server
        const token = await getToken();
        const endpoint = getApiEndpoint('/api/push/subscribe');
        await fetch(endpoint, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        // Unsubscribe locally
        await subscription.unsubscribe();
      }

      setState((s) => ({
        ...s,
        isLoading: false,
        isSubscribed: false,
      }));
      return true;
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to unsubscribe',
      }));
      return false;
    }
  }, [getToken]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
