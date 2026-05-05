/**
 * useFSRSOptimizationCheck - Automated FSRS Tuning Engine Trigger
 *
 * On sign-in: Checks PersonalizedFSRSParams.lastOptimizedAt. If > 24 hours
 * (or never optimized) and user has enough reviews, triggers optimization
 * in the background so the algorithm adapts to the user's memory strength.
 *
 * @see docs - Automated FSRS Tuning Engine
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient, createUserClient } from '@/lib/sdk';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY = 'panceai_fsrs_last_check';

function getLastCheckTime(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number.parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

function setLastCheckTime(): void {
  try {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    // Ignore
  }
}

/**
 * Triggers FSRS optimization on sign-in when eligible.
 * Call once from App or a top-level provider when user is signed in.
 */
export function useFSRSOptimizationCheck(): void {
  const { getToken, isSignedIn } = useAuth();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!isSignedIn) return;

    const run = async () => {
      const now = Date.now();
      const lastCheck = getLastCheckTime();
      if (now - lastCheck < CHECK_INTERVAL_MS) return;

      // Avoid duplicate triggers in strict mode / rapid remounts
      if (hasTriggered.current) return;
      hasTriggered.current = true;
      setLastCheckTime();

      try {
        const api = createApiClient(getToken);
        const user = createUserClient(api);

        const data = await user.getFSRSParams();
        const canOptimize = data?.canOptimize === true;
        const lastOptimizedAt = data?.params?.lastOptimizedAt ?? data?.params?.optimizedAt;

        if (!canOptimize) return;

        const hoursSinceOptimization = lastOptimizedAt
          ? (now - new Date(lastOptimizedAt).getTime()) / (60 * 60 * 1000)
          : Infinity;

        if (hoursSinceOptimization < 24) return;

        // Fire-and-forget: trigger optimization in background
        api.post('/api/user/fsrs-params', {}).catch(() => {
          // Silently ignore - optimizer will run on next sign-in or via cron
        });
      } catch {
        // Silently ignore
      }
    };

    run();
  }, [isSignedIn, getToken]);
}
