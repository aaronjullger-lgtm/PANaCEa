/**
 * useViewTransition – wrap navigation/state updates in View Transitions API when supported.
 * Enables shared element / morphing transitions (e.g. dashboard card → detail page).
 */

import { useCallback } from 'react';

type ViewTransitionCallback = () => void | Promise<void>;

type DocumentWithViewTransition = Document & {
  startViewTransition?(callback: ViewTransitionCallback): { ready: Promise<void>; finished: Promise<void> };
};

/**
 * Returns a function that runs the given callback, wrapped in document.startViewTransition when available.
 * Use for route changes or DOM updates that should animate (e.g. card expand, list → detail).
 */
export function useViewTransition(): (callback: ViewTransitionCallback) => Promise<void> {
  return useCallback(async (callback: ViewTransitionCallback) => {
    const doc = typeof document !== 'undefined' ? (document as unknown as DocumentWithViewTransition) : null;
    if (doc?.startViewTransition) {
      const transition = doc.startViewTransition(callback);
      await transition.ready;
      await transition.finished;
    } else {
      await callback();
    }
  }, []);
}

export default useViewTransition;
