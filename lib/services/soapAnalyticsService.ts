// lib/services/soapAnalyticsService.ts
// Lightweight analytics tracking for SOAP Note grading sessions

import type { GradingResult } from './soapGradingService';
import { StorageKeys } from '../storage/storageRegistry';
import { logger } from '../logger';

const LOG_SCOPE = 'SOAPAnalytics';

interface SoapGradingEvent {
  caseId: string;
  totalScore: number;
  breakdown: GradingResult['breakdown'];
  timestamp: string; // ISO string
  userId?: string;
}

const STORAGE_KEY = StorageKeys.SOAP_GRADING_EVENTS;

function loadEvents(): SoapGradingEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Failed to load SOAP grading analytics from storage`, { error });
    return [];
  }
}

function saveEvents(events: SoapGradingEvent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Failed to save SOAP grading analytics to storage`, { error });
  }
}

/**
 * Store a single SOAP grading analytics event locally and attempt
 * to sync it to the backend analytics endpoint.
 */
export async function storeSoapGradingEvent(
  caseId: string,
  result: GradingResult,
  userId?: string
): Promise<void> {
  const event: SoapGradingEvent = {
    caseId,
    totalScore: result.totalScore,
    breakdown: result.breakdown,
    timestamp: new Date().toISOString(),
    userId,
  };

  // Persist locally for longitudinal analysis and offline support
  try {
    const existing = loadEvents();
    existing.push(event);
    // Keep only the last 500 records to avoid unbounded growth
    const trimmed = existing.slice(-500);
    saveEvents(trimmed);
  } catch (error) {
    logger.error(`[${LOG_SCOPE}] Failed to record SOAP grading analytics locally`, { error });
  }

  // Best-effort sync to backend (non-blocking for the UI caller)
  try {
    void fetch('/api/analytics/soap-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {
      // Swallow network/backend errors; data is already stored locally
    });
  } catch {
    // In very old environments, fetch may not exist; just rely on local storage
  }
}
