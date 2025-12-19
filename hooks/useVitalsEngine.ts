import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface VitalsState {
  hr: number[];
  sbp: number[];
  dbp: number[];
  rr: number[];
  o2: number[];
  lastUpdated: number;
}

interface ParsedVitals {
  hr: number;
  sbp: number;
  dbp: number;
  rr: number;
  o2: number;
}

const HISTORY_LIMIT = 40;

const DEFAULT_VITALS: ParsedVitals = {
  hr: 82,
  sbp: 122,
  dbp: 76,
  rr: 16,
  o2: 98,
};

function parseBp(value: any): { sbp: number; dbp: number } {
  if (typeof value === 'string') {
    const match = value.match(/(\d+)[^0-9]+(\d+)/);
    if (match) {
      return { sbp: parseInt(match[1], 10), dbp: parseInt(match[2], 10) };
    }
  }

  if (value && typeof value === 'object' && typeof value.sbp === 'number' && typeof value.dbp === 'number') {
    return { sbp: value.sbp, dbp: value.dbp };
  }

  return { sbp: DEFAULT_VITALS.sbp, dbp: DEFAULT_VITALS.dbp };
}

function parseInitialVitals(initial: any): ParsedVitals {
  if (!initial) return DEFAULT_VITALS;

  const bp = parseBp(initial.bp ?? initial.bloodPressure);

  return {
    hr: typeof initial.hr === 'number' ? initial.hr : DEFAULT_VITALS.hr,
    sbp: bp.sbp,
    dbp: bp.dbp,
    rr: typeof initial.rr === 'number' ? initial.rr : DEFAULT_VITALS.rr,
    o2: typeof initial.o2 === 'number'
      ? initial.o2
      : typeof initial.o2sat === 'number'
        ? initial.o2sat
        : DEFAULT_VITALS.o2,
  };
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function appendWithLimit(series: number[], next: number): number[] {
  const updated = [...series, next];
  if (updated.length > HISTORY_LIMIT) {
    updated.shift();
  }
  return updated;
}

function getPathologyDeltas(pathology: string) {
  const key = (pathology || '').toLowerCase();

  if (key.includes('sepsis') || key.includes('septic')) {
    return { hr: [3, 6], sbp: [-3, -1], dbp: [-2, -1], rr: [1, 2], o2: [-1, 0] };
  }
  if (key.includes('shock')) {
    return { hr: [2, 5], sbp: [-4, -2], dbp: [-3, -1], rr: [1, 2], o2: [-1, 0] };
  }
  if (key.includes('asthma') || key.includes('copd')) {
    return { hr: [1, 2], sbp: [-1, 0], dbp: [-1, 0], rr: [2, 4], o2: [-2, -1] };
  }
  if (key.includes('pneumonia')) {
    return { hr: [1, 2], sbp: [-1, 0], dbp: [-1, 0], rr: [1, 2], o2: [-2, -1] };
  }
  if (key.includes('mi') || key.includes('infarct')) {
    return { hr: [1, 3], sbp: [-2, 0], dbp: [-2, 0], rr: [0, 1], o2: [-1, 0] };
  }
  if (key.includes('pe ') || key.endsWith(' pe') || key === 'pe' || key.includes('embol')) {
    return { hr: [2, 4], sbp: [-2, -1], dbp: [-2, -1], rr: [2, 3], o2: [-3, -1] };
  }

  // Mild drift for stable / unknown
  return { hr: [-0.5, 0.5], sbp: [-1, 1], dbp: [-1, 1], rr: [-0.5, 0.5], o2: [-0.5, 0.5] };
}

export function useVitalsEngine(initialVitals: any, pathology: string) {
  const parsed = useMemo(() => parseInitialVitals(initialVitals), [initialVitals]);
  const [vitals, setVitals] = useState<VitalsState>(() => ({
    hr: [parsed.hr],
    sbp: [parsed.sbp],
    dbp: [parsed.dbp],
    rr: [parsed.rr],
    o2: [parsed.o2],
    lastUpdated: Date.now(),
  }));

  const tickRef = useRef(0);

  useEffect(() => {
    const next = parseInitialVitals(initialVitals);
    tickRef.current = 0;
    setVitals({
      hr: [next.hr],
      sbp: [next.sbp],
      dbp: [next.dbp],
      rr: [next.rr],
      o2: [next.o2],
      lastUpdated: Date.now(),
    });
  }, [initialVitals, pathology]);

  const applyDrift = useCallback(() => {
    const deltas = getPathologyDeltas(pathology);

    setVitals(prev => {
      const lastHr = prev.hr[prev.hr.length - 1];
      const lastSbp = prev.sbp[prev.sbp.length - 1];
      const lastDbp = prev.dbp[prev.dbp.length - 1];
      const lastRr = prev.rr[prev.rr.length - 1];
      const lastO2 = prev.o2[prev.o2.length - 1];

      const nextHr = clamp(lastHr + randomBetween(deltas.hr[0], deltas.hr[1]), 35, 180);
      const nextSbp = clamp(lastSbp + randomBetween(deltas.sbp[0], deltas.sbp[1]), 70, 200);
      const nextDbp = clamp(lastDbp + randomBetween(deltas.dbp[0], deltas.dbp[1]), 40, 140);
      const nextRr = clamp(lastRr + randomBetween(deltas.rr[0], deltas.rr[1]), 6, 40);
      const nextO2 = clamp(lastO2 + randomBetween(deltas.o2[0], deltas.o2[1]), 70, 100);

      return {
        hr: appendWithLimit(prev.hr, nextHr),
        sbp: appendWithLimit(prev.sbp, nextSbp),
        dbp: appendWithLimit(prev.dbp, nextDbp),
        rr: appendWithLimit(prev.rr, nextRr),
        o2: appendWithLimit(prev.o2, nextO2),
        lastUpdated: Date.now(),
      };
    });
  }, [pathology]);

  const nudgeNoise = useCallback(() => {
    setVitals(prev => {
      const lastHr = prev.hr[prev.hr.length - 1];
      const lastSbp = prev.sbp[prev.sbp.length - 1];
      const lastDbp = prev.dbp[prev.dbp.length - 1];
      const lastRr = prev.rr[prev.rr.length - 1];
      const lastO2 = prev.o2[prev.o2.length - 1];

      const nextHr = clamp(lastHr + randomBetween(-1, 1), 35, 180);
      const nextSbp = clamp(lastSbp + randomBetween(-1, 1), 70, 200);
      const nextDbp = clamp(lastDbp + randomBetween(-1, 1), 40, 140);
      const nextRr = clamp(lastRr + randomBetween(-0.5, 0.5), 6, 40);
      const nextO2 = clamp(lastO2 + randomBetween(-0.3, 0.3), 70, 100);

      return {
        hr: appendWithLimit(prev.hr, nextHr),
        sbp: appendWithLimit(prev.sbp, nextSbp),
        dbp: appendWithLimit(prev.dbp, nextDbp),
        rr: appendWithLimit(prev.rr, nextRr),
        o2: appendWithLimit(prev.o2, nextO2),
        lastUpdated: Date.now(),
      };
    });
  }, []);

  const registerTick = useCallback(() => {
    tickRef.current += 1;
    if (tickRef.current % 5 === 0) {
      applyDrift();
    } else {
      nudgeNoise();
    }
  }, [applyDrift, nudgeNoise]);

  const applyIntervention = useCallback((action: string) => {
    if (!action) return;
    const text = action.toLowerCase();

    const giveFluids = /fluid|bolus|saline|lactated|ringer|ivf/.test(text);
    const giveOxygen = /oxygen|o2|nasal cannula|non[-\s]?rebreather|mask/.test(text);

    setVitals(prev => {
      const lastHr = prev.hr[prev.hr.length - 1];
      const lastSbp = prev.sbp[prev.sbp.length - 1];
      const lastDbp = prev.dbp[prev.dbp.length - 1];
      const lastRr = prev.rr[prev.rr.length - 1];
      const lastO2 = prev.o2[prev.o2.length - 1];

      const nextSbp = giveFluids ? lastSbp + 10 : lastSbp;
      const nextDbp = giveFluids ? lastDbp + 5 : lastDbp;
      const nextHr = giveFluids ? lastHr - 3 : lastHr;
      const nextO2 = giveOxygen ? Math.max(lastO2, 98) : lastO2;
      const nextRr = giveOxygen ? Math.max(10, lastRr - 1) : lastRr;

      return {
        hr: appendWithLimit(prev.hr, clamp(nextHr, 35, 180)),
        sbp: appendWithLimit(prev.sbp, clamp(nextSbp, 70, 200)),
        dbp: appendWithLimit(prev.dbp, clamp(nextDbp, 40, 140)),
        rr: appendWithLimit(prev.rr, clamp(nextRr, 6, 40)),
        o2: appendWithLimit(prev.o2, clamp(nextO2, 70, 100)),
        lastUpdated: Date.now(),
      };
    });
  }, []);

  const currentVitals = useMemo(() => ({
    hr: vitals.hr[vitals.hr.length - 1],
    sbp: vitals.sbp[vitals.sbp.length - 1],
    dbp: vitals.dbp[vitals.dbp.length - 1],
    rr: vitals.rr[vitals.rr.length - 1],
    o2: vitals.o2[vitals.o2.length - 1],
  }), [vitals]);

  return {
    currentVitals,
    history: vitals,
    registerTick,
    applyIntervention,
  };
}
