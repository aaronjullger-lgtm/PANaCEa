/**
 * OSCE Service
 * Handles persistence for Patient Encounter sessions
 */

import type { PatientEncounterCase, PatientQuestion } from '@/types/drill-modes';

export interface OSCESession {
  id: string;
  userId: string;
  caseId: string;
  status: string;
  messages: any[];
  startTime: string;
  updatedAt: string;
}

/**
 * Fetch a random patient encounter case
 */
export async function getRandomEncounterCase(): Promise<any | null> {
  try {
    // Note: Auth is handled by Clerk middleware/interceptor if configured, 
    // or we might need to pass the token explicitly if not using cookies.
    // Assuming standard fetch for now as per existing patterns.
    const response = await fetch('/api/osce/cases/random');
    
    if (!response.ok) {
      console.error('Failed to fetch case:', response.statusText);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching random case:', error);
    return null;
  }
}

/**
 * Create or get active session
 */
export async function startOSCESession(caseId: string): Promise<OSCESession | null> {
  try {
    const response = await fetch('/api/osce/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId })
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.session;
  } catch (error) {
    console.error('Error starting OSCE session:', error);
    return null;
  }
}

/**
 * Save chat history (append new messages)
 */
export async function saveOSCEChat(sessionId: string, messages: any[]): Promise<boolean> {
  try {
    const response = await fetch('/api/osce/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messages })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error saving OSCE chat:', error);
    return false;
  }
}

/**
 * Complete session
 */
export async function completeOSCESession(
  sessionId: string, 
  diagnosis: string, 
  treatmentPlan: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/osce/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, diagnosis, treatmentPlan })
    });
    
    return response.ok;
  } catch (error) {
    console.error('Error completing OSCE session:', error);
    return false;
  }
}

/**
 * Generate a unique session ID (fallback if API fails)
 */
export function generateSessionId(): string {
  return `osce-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate score for encounter session
 */
export function calculateEncounterScore(
  questions: PatientQuestion[],
  patientCase: PatientEncounterCase
): { efficiency: number; thoroughness: number; overall: number } {
  // Calculate thoroughness: percentage of essential questions asked
  const essentialAsked = questions.filter(q => q.relevance === 'essential').length;
  const totalEssential = patientCase.essentialQuestions?.length || 1;
  const thoroughness = Math.min(100, (essentialAsked / totalEssential) * 100);
  
  // Calculate efficiency: penalize for unnecessary questions
  const unnecessaryAsked = questions.filter(q => q.relevance === 'unnecessary').length;
  const totalQuestions = questions.length || 1;
  const efficiency = Math.max(0, 100 - (unnecessaryAsked / totalQuestions) * 50);
  
  // Overall score is weighted average
  const overall = (thoroughness * 0.6) + (efficiency * 0.4);
  
  return { efficiency, thoroughness, overall };
}
