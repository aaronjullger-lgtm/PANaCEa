/**
 * useLowPowerMode - Detect when to reduce heavy animations (battery drain audit)
 *
 * When the device is in Low Power Mode or battery is low, we disable expensive
 * animations (heatmaps, radar charts, streak gradients) to preserve battery for
 * medical students on long shifts.
 *
 * Detection:
 * - navigator.getBattery() (where supported): low level or discharging + low → reduce
 * - prefers-reduced-motion: reduce (e.g. iOS Low Power Mode can set this)
 */

import { useState, useEffect, useRef } from 'react';

/** Minimal type for Battery Status API (support varies; not in all TS libs). */
interface BatteryLike {
  level: number;
  charging: boolean;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener?(type: string, listener: () => void): void;
}

const LOW_LEVEL_THRESHOLD = 0.2;
const DISCHARGING_LOW_THRESHOLD = 0.3;

export function useLowPowerMode(): boolean {
  const [reduceHeavyAnimations, setReduceHeavyAnimations] = useState(false);
  const batteryCleanupRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let reduce = false;

    const checkReducedMotion = () => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      return mq.matches;
    };

    reduce = checkReducedMotion();

    const handleReducedMotion = () => setReduceHeavyAnimations(checkReducedMotion());

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleReducedMotion);
    } else if ('addListener' in mediaQuery && typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleReducedMotion);
    }

    const cleanupReducedMotion = () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleReducedMotion);
      } else if ('removeListener' in mediaQuery && typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleReducedMotion);
      }
    };

    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if ('getBattery' in navigator && typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((battery: BatteryLike) => {
          if (!mountedRef.current) return;
          const update = () => {
            if (!mountedRef.current) return;
            const lowLevel = battery.level < LOW_LEVEL_THRESHOLD;
            const dischargingLow = !battery.charging && battery.level < DISCHARGING_LOW_THRESHOLD;
            setReduceHeavyAnimations(reduce || lowLevel || dischargingLow);
          };
          update();
          battery.addEventListener('levelchange', update);
          battery.addEventListener('chargingchange', update);
          batteryCleanupRef.current = () => {
            battery.removeEventListener?.('levelchange', update);
            battery.removeEventListener?.('chargingchange', update);
            batteryCleanupRef.current = null;
          };
        })
        .catch(() => setReduceHeavyAnimations(reduce));
    } else {
      setReduceHeavyAnimations(reduce);
    }

    return () => {
      mountedRef.current = false;
      cleanupReducedMotion();
      batteryCleanupRef.current?.();
      batteryCleanupRef.current = null;
    };
  }, []);

  return reduceHeavyAnimations;
}
