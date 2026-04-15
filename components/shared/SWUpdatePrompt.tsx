/**
 * Service Worker Update Prompt
 *
 * Shows a non-intrusive toast when a new version of the app is available.
 * The user can choose when to reload — prevents mid-session disruption.
 *
 * Works with vite-plugin-pwa registerType: 'prompt'.
 */

import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

// Check for updates every 60 seconds
const UPDATE_CHECK_INTERVAL = 60 * 1000;

export function SWUpdatePrompt() {
  const hasPrompted = useRef(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, UPDATE_CHECK_INTERVAL);
      }
    },
    onRegisterError(error: unknown) {
      console.error('[SW] Registration error:', error);
    },
  });

  useEffect(() => {
    if (needRefresh && !hasPrompted.current) {
      hasPrompted.current = true;

      toast('A new version is available', {
        description: 'Reload to get the latest features and fixes.',
        duration: Infinity,
        action: {
          label: 'Update now',
          onClick: () => updateServiceWorker(true),
        },
        onDismiss: () => {
          // User dismissed — they can reload later
          hasPrompted.current = false;
        },
      });
    }
  }, [needRefresh, updateServiceWorker]);

  return null; // Renders nothing — uses toast for UI
}

export default SWUpdatePrompt;
