/**
 * usePhysiology.ts
 * Sprint 10 Task 1 & 2: Physiology Engine with Jitter + Stress Response
 * 
 * A lightweight hook that provides:
 * 1. Base vital signs with realistic ±3bpm jitter (every second)
 * 2. Stress response triggered by sensitive question keywords
 * 3. Gradual return to baseline after stress event
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Sensitive keywords that trigger stress response (emergency/critical diagnoses)
const STRESS_KEYWORDS = [
  // Emergency conditions
  'emergency', 'stat', 'critical', 'code blue', 'arrest', 'resuscitate',
  // Life-threatening diagnoses
  'myocardial infarction', 'mi', 'heart attack', 'stroke', 'cva',
  'pulmonary embolism', 'pe', 'sepsis', 'septic', 'anaphylaxis',
  'tension pneumothorax', 'aortic dissection', 'hemorrhage', 'shock',
  'meningitis', 'encephalitis', 'intubation', 'ventilator',
  // Cancer/terminal
  'malignant', 'metastatic', 'terminal', 'prognosis poor',
  // Pediatric emergency
  'child abuse', 'pediatric emergency', 'neonatal', 'apgar',
  // Psychiatric emergency
  'suicide', 'suicidal', 'overdose', 'toxicity',
  // Other high-stakes
  'ectopic pregnancy', 'placental abruption', 'eclampsia',
  'diabetic ketoacidosis', 'dka', 'status epilepticus',
];

export interface PhysiologyState {
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  respiratoryRate: number;
  oxygenSat: number;
  isStressed: boolean;
  stressLevel: number; // 0-1 intensity
}

export interface UsePhysiologyOptions {
  baseHeartRate?: number;
  baseSystolic?: number;
  baseDiastolic?: number;
  baseRR?: number;
  baseO2?: number;
  jitterRange?: number; // ±bpm for HR jitter
  updateIntervalMs?: number;
  enabled?: boolean;
}

export interface UsePhysiologyReturn {
  vitals: PhysiologyState;
  triggerStressResponse: (intensity?: number) => void;
  checkTextForStress: (text: string) => boolean;
  resetToBaseline: () => void;
}

/**
 * Generates random jitter within ±range
 */
function jitter(range: number): number {
  return Math.round((Math.random() * 2 - 1) * range);
}

/**
 * Clamps a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Check if text contains stress-triggering keywords
 */
export function detectStressKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return STRESS_KEYWORDS.some((keyword) => lowerText.includes(keyword));
}

export function usePhysiology(options: UsePhysiologyOptions = {}): UsePhysiologyReturn {
  const {
    baseHeartRate = 80,
    baseSystolic = 120,
    baseDiastolic = 80,
    baseRR = 16,
    baseO2 = 98,
    jitterRange = 3, // ±3bpm as specified
    updateIntervalMs = 1000, // Every second
    enabled = true,
  } = options;

  const [vitals, setVitals] = useState<PhysiologyState>({
    heartRate: baseHeartRate,
    systolicBP: baseSystolic,
    diastolicBP: baseDiastolic,
    respiratoryRate: baseRR,
    oxygenSat: baseO2,
    isStressed: false,
    stressLevel: 0,
  });

  // Refs for stress decay
  const stressLevelRef = useRef(0);
  const stressDecayTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Apply jitter to vitals and decay stress level
   */
  const tick = useCallback(() => {
    setVitals((_prev) => {
      // Decay stress level gradually
      const newStressLevel = Math.max(0, stressLevelRef.current - 0.05);
      stressLevelRef.current = newStressLevel;

      // Calculate stress-adjusted baselines
      // Stress increases HR by up to 30bpm, SBP by up to 25mmHg
      const stressHRBoost = Math.round(newStressLevel * 30);
      const stressSBPBoost = Math.round(newStressLevel * 25);
      const stressDBPBoost = Math.round(newStressLevel * 10);
      const stressRRBoost = Math.round(newStressLevel * 4);

      // Apply jitter to stress-adjusted values
      const newHR = clamp(
        baseHeartRate + stressHRBoost + jitter(jitterRange),
        50, 180
      );
      const newSBP = clamp(
        baseSystolic + stressSBPBoost + jitter(2),
        80, 200
      );
      const newDBP = clamp(
        baseDiastolic + stressDBPBoost + jitter(2),
        50, 120
      );
      const newRR = clamp(
        baseRR + stressRRBoost + jitter(1),
        10, 30
      );
      const newO2 = clamp(
        baseO2 + jitter(1),
        88, 100
      );

      return {
        heartRate: newHR,
        systolicBP: newSBP,
        diastolicBP: newDBP,
        respiratoryRate: newRR,
        oxygenSat: newO2,
        isStressed: newStressLevel > 0.1,
        stressLevel: newStressLevel,
      };
    });
  }, [baseHeartRate, baseSystolic, baseDiastolic, baseRR, baseO2, jitterRange]);

  /**
   * Trigger a stress response (e.g., when a sensitive question is detected)
   * Intensity: 0-1 scale (default 0.7 for moderate stress)
   */
  const triggerStressResponse = useCallback((intensity = 0.7) => {
    stressLevelRef.current = clamp(intensity, 0, 1);
    
    // Immediate visual spike
    setVitals((current) => ({
      ...current,
      isStressed: true,
      stressLevel: stressLevelRef.current,
      // Immediate jump in HR
      heartRate: clamp(current.heartRate + Math.round(intensity * 15), 50, 180),
    }));
  }, []);

  /**
   * Check text for stress keywords and trigger response if found
   * Returns true if stress was triggered
   */
  const checkTextForStress = useCallback((text: string): boolean => {
    if (detectStressKeywords(text)) {
      triggerStressResponse(0.6); // Moderate stress for question detection
      return true;
    }
    return false;
  }, [triggerStressResponse]);

  /**
   * Reset vitals to baseline immediately
   */
  const resetToBaseline = useCallback(() => {
    stressLevelRef.current = 0;
    setVitals({
      heartRate: baseHeartRate,
      systolicBP: baseSystolic,
      diastolicBP: baseDiastolic,
      respiratoryRate: baseRR,
      oxygenSat: baseO2,
      isStressed: false,
      stressLevel: 0,
    });
  }, [baseHeartRate, baseSystolic, baseDiastolic, baseRR, baseO2]);

  // Main tick interval
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(tick, updateIntervalMs);
    return () => clearInterval(intervalId);
  }, [enabled, tick, updateIntervalMs]);

  // Cleanup - capture ref value at effect time
  useEffect(() => {
    const decayTimer = stressDecayTimerRef.current;
    return () => {
      if (decayTimer) {
        clearTimeout(decayTimer);
      }
    };
  }, []);

  return {
    vitals,
    triggerStressResponse,
    checkTextForStress,
    resetToBaseline,
  };
}

export default usePhysiology;
