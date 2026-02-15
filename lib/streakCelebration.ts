/**
 * Streak celebration – confetti and optional micro-interaction when user completes daily target.
 * Uses canvas-confetti for particle effect; call from session end or dashboard when streak increments.
 */

import confetti from 'canvas-confetti';

const DEFAULT_DURATION = 2500;
const DEFAULT_COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316']; // brand blue, green, amber, orange

/**
 * Fire a short confetti burst for streak / daily target completion.
 * Call when: user completes daily target, streak increments, or milestone (e.g. 7-day streak).
 */
export function fireStreakCelebration(options?: {
  /** Number of confetti bursts (default 2) */
  count?: number;
  /** Spread in degrees (default 55) */
  spread?: number;
  /** Origin: 'center' | 'left' | 'right' (default 'center') */
  origin?: 'center' | 'left' | 'right';
  /** Custom colors (default: brand palette) */
  colors?: string[];
}): void {
  const { count = 2, spread = 55, origin = 'center', colors = DEFAULT_COLORS } = options ?? {};

  let originX = 0.5;
  if (origin === 'left') originX = 0.2;
  else if (origin === 'right') originX = 0.8;
  const originY = 0.6;

  const fire = (): void => {
    confetti({
      particleCount: 80,
      spread,
      origin: { x: originX, y: originY },
      colors,
      ticks: 120,
      gravity: 0.8,
      scalar: 1.1,
    });
  };

  fire();
  const t2 = setTimeout(() => {
    fire();
  }, 200);
  const t3 = count > 2 ? setTimeout(() => fire(), 400) : null;
  setTimeout(() => {
    clearTimeout(t2);
    if (t3) clearTimeout(t3);
  }, DEFAULT_DURATION);
}

/**
 * Fire a single "ring snap" style burst (smaller, centered).
 * Use for quick feedback (e.g. daily target just hit).
 */
export function fireStreakMicroCelebration(): void {
  confetti({
    particleCount: 40,
    spread: 60,
    origin: { x: 0.5, y: 0.6 },
    colors: DEFAULT_COLORS,
    ticks: 80,
    gravity: 1,
    scalar: 0.9,
  });
}
