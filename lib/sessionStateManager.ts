/**
 * Session State Manager
 * 2026 PA Student Optimization - Quick Resume for interrupted study sessions
 * 
 * Manages saving and restoring session state for PA students who get interrupted frequently
 * (between patients, during rounds, emergency calls, etc.)
 */

import type { Question, PerformanceRecord, SessionSettings } from '@/types';

const SESSION_STATE_KEY = 'panacea_session_state';
const SESSION_TIMESTAMP_KEY = 'panacea_session_timestamp';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface SavedSessionState {
  queue: Question[];
  currentQuestionIndex: number;
  questionNumber: number;
  performanceData: PerformanceRecord[];
  sessionSettings: SessionSettings;
  timestamp: number;
  sessionDurationMs: number;
}

/**
 * Save current session state to localStorage
 */
export function saveSessionState(state: SavedSessionState): boolean {
  try {
    if (typeof window === 'undefined') return false;
    
    const stateWithTimestamp = {
      ...state,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(SESSION_STATE_KEY, JSON.stringify(stateWithTimestamp));
    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    
    console.log('[SessionStateManager] Session saved:', {
      questionsInQueue: state.queue.length,
      currentQuestion: state.currentQuestionIndex,
      performanceRecords: state.performanceData.length,
    });
    
    return true;
  } catch (error) {
    console.error('[SessionStateManager] Failed to save session:', error);
    return false;
  }
}

/**
 * Load saved session state from localStorage
 * Returns null if no valid saved session exists or if session is expired
 */
export function loadSessionState(): SavedSessionState | null {
  try {
    if (typeof window === 'undefined') return null;
    
    const savedState = localStorage.getItem(SESSION_STATE_KEY);
    const savedTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    
    if (!savedState || !savedTimestamp) return null;
    
    const timestamp = parseInt(savedTimestamp, 10);
    const now = Date.now();
    
    // Check if session is expired
    if (now - timestamp > SESSION_EXPIRY_MS) {
      console.log('[SessionStateManager] Saved session expired, clearing');
      clearSessionState();
      return null;
    }
    
    const state = JSON.parse(savedState) as SavedSessionState;
    
    // Validate state has required fields
    if (!state.queue || !state.sessionSettings || !Array.isArray(state.performanceData)) {
      console.warn('[SessionStateManager] Invalid saved state, clearing');
      clearSessionState();
      return null;
    }
    
    console.log('[SessionStateManager] Session loaded:', {
      questionsInQueue: state.queue.length,
      currentQuestion: state.currentQuestionIndex,
      performanceRecords: state.performanceData.length,
      savedAt: new Date(state.timestamp).toLocaleString(),
    });
    
    return state;
  } catch (error) {
    console.error('[SessionStateManager] Failed to load session:', error);
    clearSessionState();
    return null;
  }
}

/**
 * Clear saved session state
 */
export function clearSessionState(): void {
  try {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(SESSION_STATE_KEY);
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
    
    console.log('[SessionStateManager] Session state cleared');
  } catch (error) {
    console.error('[SessionStateManager] Failed to clear session:', error);
  }
}

/**
 * Check if there's a valid saved session
 */
export function hasSavedSession(): boolean {
  if (typeof window === 'undefined') return false;
  
  const savedTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  if (!savedTimestamp) return false;
  
  const timestamp = parseInt(savedTimestamp, 10);
  const now = Date.now();
  
  return now - timestamp < SESSION_EXPIRY_MS;
}

/**
 * Get time elapsed since session was saved
 */
export function getSessionAge(): number | null {
  if (typeof window === 'undefined') return null;
  
  const savedTimestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);
  if (!savedTimestamp) return null;
  
  const timestamp = parseInt(savedTimestamp, 10);
  return Date.now() - timestamp;
}

/**
 * Format session age for display
 */
export function formatSessionAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}
