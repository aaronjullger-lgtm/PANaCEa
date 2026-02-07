/**
 * Session Storage Utilities
 * 
 * Manages last session state for "Resume" functionality and welcome-back cards.
 * Helps PA students quickly continue where they left off.
 */

import type { SessionSettings, SystemCode } from '@/types';

export interface LastSessionData {
  timestamp: number;
  settings: SessionSettings;
  questionsCompleted: number;
  questionsCorrect: number;
  accuracy: number;
  weakSystem?: SystemCode;
  weakSystemName?: string;
  duration: number; // milliseconds
}

const LAST_SESSION_KEY = 'panceai_last_session';
const MAX_SESSION_AGE_HOURS = 48; // Consider stale after 48 hours

/**
 * Save session data on completion
 */
export function saveLastSession(data: LastSessionData): void {
  try {
    localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[SessionStorage] Failed to save last session:', error);
  }
}

/**
 * Get last session data (null if none or stale)
 */
export function getLastSession(): LastSessionData | null {
  try {
    const stored = localStorage.getItem(LAST_SESSION_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored) as LastSessionData;
    
    // Check if stale
    const ageHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);
    if (ageHours > MAX_SESSION_AGE_HOURS) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('[SessionStorage] Failed to read last session:', error);
    return null;
  }
}

/**
 * Clear last session (e.g., after resuming)
 */
export function clearLastSession(): void {
  try {
    localStorage.removeItem(LAST_SESSION_KEY);
  } catch (error) {
    console.error('[SessionStorage] Failed to clear last session:', error);
  }
}

/**
 * Check if a session is resumable (exists and not stale)
 */
export function hasResumableSession(): boolean {
  return getLastSession() !== null;
}

/**
 * Format session duration for display (e.g., "12 min")
 */
export function formatSessionDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '< 1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

/**
 * Format relative time (e.g., "2 hours ago", "Yesterday")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / (60000 * 60));
  const diffDays = Math.floor(diffMs / (60000 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString();
}
