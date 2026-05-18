/**
 * useStreakAutoFreeze — Calls the auto-freeze endpoint on app mount.
 *
 * If a streak freeze was applied, triggers a toast notification.
 * Only runs once per app session (uses a ref guard).
 *
 * @see functions/api/streaks/auto-freeze.ts
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

export interface AutoFreezeResult {
  freezesApplied: number;
  remainingFreezes: number;
  frozenDates?: string[];
  streakAlreadyBroken?: boolean;
}

export function useStreakAutoFreeze() {
  const { getToken, isSignedIn } = useAuth();
  const hasRun = useRef(false);
  const [result, setResult] = useState<AutoFreezeResult | null>(null);

  useEffect(() => {
    if (!isSignedIn || hasRun.current) return;
    hasRun.current = true;

    async function checkAutoFreeze() {
      try {
        const token = await getToken();
        if (!token) return;

        const endpoint = getApiEndpoint('/api/streaks/auto-freeze');
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;
        setResult(unwrapApiEnvelope<AutoFreezeResult>(await response.json()));
      } catch (error) {
        // Auto-freeze is non-critical — fail silently
        console.warn('[useStreakAutoFreeze] Failed:', error);
      }
    }

    checkAutoFreeze();
  }, [isSignedIn, getToken]);

  return result;
}
