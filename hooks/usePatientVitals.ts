/**
 * usePatientVitals - Listens to PatientEncounterSession and animates vitals when they change.
 *
 * For the Living Patient Encounter: vitals are driven by the backend physiology engine.
 * When interventions are applied via /api/osce/intervene, the hook receives updated vitals
 * and animates the transition for visual feedback (e.g. decompensation, Code Blue).
 *
 * Use with PatientEncounterMode when sessionId is available (OSCE session in progress).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

export interface VitalsDisplay {
  hr: number;
  sbp: number;
  dbp: number;
  rr: number;
  o2: number;
  bp: string; // "120/80" format for display
}

export interface VitalsHistory {
  hr: number[];
  sbp: number[];
  dbp: number[];
  rr: number[];
  o2: number[];
  lastUpdated: number;
}

const HISTORY_LIMIT = 40;

export const DEFAULT_VITALS: VitalsDisplay = {
  hr: 82,
  sbp: 122,
  dbp: 76,
  rr: 16,
  o2: 98,
  bp: '122/76',
};

function parseBp(value: unknown): { sbp: number; dbp: number } {
  if (typeof value === 'string') {
    const match = value.match(/(\d+)[^0-9]+(\d+)/);
    if (match?.[1] && match?.[2]) {
      return { sbp: parseInt(match[1], 10), dbp: parseInt(match[2], 10) };
    }
  }
  if (
    value &&
    typeof value === 'object' &&
    'sbp' in value &&
    'dbp' in value &&
    typeof (value as Record<string, unknown>).sbp === 'number' &&
    typeof (value as Record<string, unknown>).dbp === 'number'
  ) {
    const v = value as { sbp: number; dbp: number };
    return { sbp: v.sbp, dbp: v.dbp };
  }
  return { sbp: DEFAULT_VITALS.sbp, dbp: DEFAULT_VITALS.dbp };
}

function parseVitalsFromSession(physicalFindings: unknown): VitalsDisplay {
  if (!physicalFindings || typeof physicalFindings !== 'object') {
    return DEFAULT_VITALS;
  }
  const v = physicalFindings as Record<string, unknown>;
  const bp = parseBp(v.bp ?? v.bloodPressure);
  const hr =
    typeof v.hr === 'number'
      ? v.hr
      : typeof v.heartRate === 'number'
        ? v.heartRate
        : DEFAULT_VITALS.hr;
  const rr =
    typeof v.rr === 'number'
      ? v.rr
      : typeof v.respiratoryRate === 'number'
        ? v.respiratoryRate
        : DEFAULT_VITALS.rr;
  const o2 =
    typeof v.o2 === 'number' ? v.o2 : typeof v.o2Sat === 'number' ? v.o2Sat : DEFAULT_VITALS.o2;

  return {
    hr,
    sbp: bp.sbp,
    dbp: bp.dbp,
    rr,
    o2,
    bp: `${bp.sbp}/${bp.dbp}`,
  };
}

function appendWithLimit(series: number[], next: number): number[] {
  const updated = [...series, next];
  if (updated.length > HISTORY_LIMIT) updated.shift();
  return updated;
}

export interface UsePatientVitalsOptions {
  sessionId: string | null;
  initialVitals?: unknown;
  physicalFindings?: unknown;
}

export interface UsePatientVitalsResult {
  currentVitals: VitalsDisplay;
  history: VitalsHistory;
  /** Apply intervention via API; updates vitals from response. Returns success + isEmergency. */
  applyIntervention: (
    interventionId: string,
    getToken: () => Promise<string | null>
  ) => Promise<{ success: boolean; isEmergency?: boolean; error?: string }>;
  /** Manually set vitals (e.g. when session loads with physicalFindings) */
  setVitalsFromSession: (physicalFindings: unknown) => void;
  /** Whether the last intervention request is in flight */
  isApplyingIntervention: boolean;
}

export function usePatientVitals(options: UsePatientVitalsOptions): UsePatientVitalsResult {
  const { sessionId, initialVitals, physicalFindings } = options;

  const parsedInitial = useMemo(
    () => parseVitalsFromSession(physicalFindings ?? initialVitals),
    [initialVitals, physicalFindings]
  );

  const [history, setHistory] = useState<VitalsHistory>(() => ({
    hr: [parsedInitial.hr],
    sbp: [parsedInitial.sbp],
    dbp: [parsedInitial.dbp],
    rr: [parsedInitial.rr],
    o2: [parsedInitial.o2],
    lastUpdated: Date.now(),
  }));

  const [isApplyingIntervention, setIsApplyingIntervention] = useState(false);
  const prevVitalsRef = useRef<VitalsDisplay>(parsedInitial);

  const currentVitals = useMemo(
    () => ({
      hr: history.hr[history.hr.length - 1] ?? DEFAULT_VITALS.hr,
      sbp: history.sbp[history.sbp.length - 1] ?? DEFAULT_VITALS.sbp,
      dbp: history.dbp[history.dbp.length - 1] ?? DEFAULT_VITALS.dbp,
      rr: history.rr[history.rr.length - 1] ?? DEFAULT_VITALS.rr,
      o2: history.o2[history.o2.length - 1] ?? DEFAULT_VITALS.o2,
      bp: `${history.sbp[history.sbp.length - 1] ?? 120}/${history.dbp[history.dbp.length - 1] ?? 80}`,
    }),
    [history]
  );

  const setVitalsFromSession = useCallback((physicalFindings: unknown) => {
    const parsed = parseVitalsFromSession(physicalFindings);
    setHistory((prev) => ({
      hr: appendWithLimit(prev.hr, parsed.hr),
      sbp: appendWithLimit(prev.sbp, parsed.sbp),
      dbp: appendWithLimit(prev.dbp, parsed.dbp),
      rr: appendWithLimit(prev.rr, parsed.rr),
      o2: appendWithLimit(prev.o2, parsed.o2),
      lastUpdated: Date.now(),
    }));
    prevVitalsRef.current = parsed;
  }, []);

  // Sync when physicalFindings or initialVitals change (e.g. session loaded)
  useEffect(() => {
    const parsed = parseVitalsFromSession(physicalFindings ?? initialVitals);
    setHistory((prev) => ({
      hr: appendWithLimit(prev.hr, parsed.hr),
      sbp: appendWithLimit(prev.sbp, parsed.sbp),
      dbp: appendWithLimit(prev.dbp, parsed.dbp),
      rr: appendWithLimit(prev.rr, parsed.rr),
      o2: appendWithLimit(prev.o2, parsed.o2),
      lastUpdated: Date.now(),
    }));
    prevVitalsRef.current = parsed;
  }, [physicalFindings, initialVitals]);

  const applyIntervention = useCallback(
    async (
      interventionId: string,
      getToken: () => Promise<string | null>
    ): Promise<{ success: boolean; isEmergency?: boolean; error?: string }> => {
      if (!sessionId) {
        return { success: false, error: 'No session' };
      }

      setIsApplyingIntervention(true);
      try {
        const token = await getToken();
        const res = await fetch('/api/osce/intervene', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            body: { sessionId, interventionId },
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          return {
            success: false,
            error: getApiEnvelopeError(json, 'Intervention failed'),
          };
        }

        const data = unwrapApiEnvelope<{ vitals?: VitalsDisplay; isEmergency?: boolean }>(json);
        const vitals = data?.vitals;
        const isEmergency = data?.isEmergency ?? false;

        if (vitals) {
          setVitalsFromSession(vitals);
        }

        return { success: true, isEmergency };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error';
        return { success: false, error: message };
      } finally {
        setIsApplyingIntervention(false);
      }
    },
    [sessionId, setVitalsFromSession]
  );

  return {
    currentVitals,
    history,
    applyIntervention,
    setVitalsFromSession,
    isApplyingIntervention,
  };
}
