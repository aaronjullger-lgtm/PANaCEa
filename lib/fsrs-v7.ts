/**
 * PANaCEa FSRS v7-alpha — v7-ready extensions
 * See lib/fsrs.ts FSRS7_REFERENCE_DEFAULTS.
 */
import { FSRS, FSRSCard, FSRSState, FSRSParameters, FSRS7_REFERENCE_DEFAULTS, Rating, defaultParameters } from './fsrs';

export const V7_MIN_INTERVAL_DAYS = 10 / (24 * 60);
export const V7_CURVE_PARAM_COUNT = 8;
export const V7_CURVE_PARAM_OFFSET = 21;
export type FSRSAlgorithmVersion = '6' | '7-alpha';

export const V7_ALGORITHM_STATUS = {
  fractionalIntervals: 'canonical',
  shortTermStability: 'panacea-interpretation',
  forgettingCurve: 'placeholder',
} as const;

export const v7AlphaDefaultParameters: FSRSParameters & { version: FSRSAlgorithmVersion } = {
  request_retention: defaultParameters.request_retention,
  maximum_interval: defaultParameters.maximum_interval,
  w: [...defaultParameters.w.slice(0, 21), ...FSRS7_REFERENCE_DEFAULTS.w.slice(21)],
  version: '7-alpha',
};

export function extendV6ToV7(v6: FSRSParameters): FSRSParameters & { version: FSRSAlgorithmVersion } {
  if (v6.w.length !== 21) {
    throw new Error(`extendV6ToV7: expected 21-parameter v6 input, got ${v6.w.length}`);
  }
  const tail = FSRS7_REFERENCE_DEFAULTS.w.slice(21);
  return { ...v6, w: [...v6.w, ...tail], version: '7-alpha' };
}

export function isV7AlphaParams(w: number[] | null | undefined): boolean {
  if (!Array.isArray(w) || w.length !== 29) return false;
  for (let i = 0; i < 29; i++) {
    const v = w[i];
    if (v == null || !Number.isFinite(v)) return false;
  }
  return true;
}

export function computeRetrievabilityV7(
  elapsedDays: number,
  stability: number,
  params: FSRSParameters
): number {
  if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) return 1;
  if (!Number.isFinite(stability) || stability <= 0) return 0;
  if (params.w.length !== 29) {
    const factor = params.w[19] ?? 0.1597;
    const decay = -(params.w[20] ?? 2.27);
    return Math.max(0, Math.min(1, Math.pow(1 + (factor * elapsedDays) / stability, decay)));
  }
  const w = params.w;
  const factor = w[19]!;
  const decay = -w[20]!;
  const x = elapsedDays / stability;
  const baseR = Math.pow(1 + factor * x, decay);
  let correction = 1;
  for (let i = 0; i < V7_CURVE_PARAM_COUNT / 2; i++) {
    const amplitude = Math.max(0, w[V7_CURVE_PARAM_OFFSET + 2 * i]!);
    const rate = Math.max(0, w[V7_CURVE_PARAM_OFFSET + 2 * i + 1]!);
    if (amplitude === 0 || rate === 0) continue;
    correction *= 1 + amplitude * (1 - Math.exp(-rate * x));
  }
  const r = baseR / correction;
  return Math.max(0, Math.min(1, r));
}

export function invertRetrievabilityV7(
  stability: number,
  targetR: number,
  params: FSRSParameters
): number {
  if (!Number.isFinite(stability) || stability <= 0) return V7_MIN_INTERVAL_DAYS;
  if (!Number.isFinite(targetR) || targetR <= 0 || targetR >= 1) {
    if (targetR >= 1) return 0;
    return params.maximum_interval;
  }
  let lo = V7_MIN_INTERVAL_DAYS;
  let hi = params.maximum_interval;
  const rLo = computeRetrievabilityV7(lo, stability, params);
  const rHi = computeRetrievabilityV7(hi, stability, params);
  if (rLo <= targetR) return V7_MIN_INTERVAL_DAYS;
  if (rHi >= targetR) return params.maximum_interval;
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);
    const rMid = computeRetrievabilityV7(mid, stability, params);
    if (Math.abs(rMid - targetR) < 1e-7) return mid;
    if (rMid > targetR) lo = mid;
    else hi = mid;
    if (hi / lo < 1 + 1e-6) return mid;
  }
  return Math.sqrt(lo * hi);
}

export function v7ShortTermStability(
  stability: number,
  grade: number,
  elapsedDays: number,
  params: FSRSParameters
): number {
  const w = params.w;
  const w17 = w[17] ?? 0.5425;
  const w18 = w[18] ?? 0.0912;
  const w19 = w[19] ?? 0.1597;
  const v6Mult = Math.pow(stability, -w19) * Math.exp(w17 * (grade - 3 + w18));
  const v6Masked = grade >= Rating.Hard ? Math.max(v6Mult, 1.0) : v6Mult;
  const minInterval = V7_MIN_INTERVAL_DAYS;
  const fullBoostDay = 1.0;
  const boostScale =
    elapsedDays <= minInterval
      ? 0
      : elapsedDays >= fullBoostDay
        ? 1
        : (elapsedDays - minInterval) / (fullBoostDay - minInterval);
  const effectiveMult = boostScale * v6Masked + (1 - boostScale) * 1.0;
  return Math.min(Math.max(stability * effectiveMult, 0.01), 36500.0);
}

export class FSRSv7 {
  private inner: FSRS;
  private p: FSRSParameters & { version?: FSRSAlgorithmVersion };

  constructor(parameters: FSRSParameters = v7AlphaDefaultParameters) {
    this.inner = new FSRS({
      request_retention: parameters.request_retention,
      maximum_interval: parameters.maximum_interval,
      w: parameters.w.slice(0, 21),
    });
    this.p = parameters;
  }

  calculateRetrievability(card: FSRSCard, now: Date = new Date()): number {
    if (card.state === FSRSState.New) return 1;
    const elapsedDays = Math.max(0, (now.getTime() - card.last_review.getTime()) / 86400000);
    return computeRetrievabilityV7(elapsedDays, card.stability, this.p);
  }

  next(card: FSRSCard, now: Date, rating: Rating): { card: FSRSCard; due: Date } {
    const v6Result = this.inner.next(card, now, rating);
    if (v6Result.card.state === FSRSState.Review) {
      const v7Interval = invertRetrievabilityV7(
        v6Result.card.stability,
        this.p.request_retention,
        this.p
      );
      const clamped = Math.min(Math.max(v7Interval, V7_MIN_INTERVAL_DAYS), this.p.maximum_interval);
      v6Result.card.scheduled_days = clamped;
      // Recompute due date with the v7 fractional interval.
      const due = new Date(now.getTime() + clamped * 86400000);
      return { card: v6Result.card, due };
    } else if (
      v6Result.card.state === FSRSState.Learning ||
      v6Result.card.state === FSRSState.Relearning
    ) {
      const elapsedDays = Math.max(0, (now.getTime() - card.last_review.getTime()) / 86400000);
      if (card.state !== FSRSState.New && elapsedDays < 1.0) {
        v6Result.card.stability = v7ShortTermStability(card.stability, rating, elapsedDays, this.p);
      }
    }
    return v6Result;
  }

  static getVersion(): string {
    return '7-alpha-panacea';
  }

  getParameterSummary() {
    return {
      version: FSRSv7.getVersion(),
      paramCount: this.p.w.length,
      status: V7_ALGORITHM_STATUS,
    };
  }
}
