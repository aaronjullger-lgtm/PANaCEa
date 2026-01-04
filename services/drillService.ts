import { PerformanceRecord } from '../types';
import { getApiEndpoint, API_ENDPOINTS } from '../lib/utils/apiConfig';

const isTestEnv = typeof process !== 'undefined' && (process.env.VITEST || process.env.NODE_ENV === 'test');

/**
 * Submit a drill result to the backend for persistence.
 * Maps drill-specific data to the generic PerformanceRecord format.
 */
export async function submitDrillResult(
  drillType: 'fluid' | 'antibiotic' | 'radiology' | 'ecg' | 'derm' | 'grand_rounds' | 'condition' | 'pharm' | 'first_line' | 'system' | 'subcategory',
  caseId: string,
  isCorrect: boolean,
  details: { title?: string; category?: string },
  getToken?: () => Promise<string | null>
) {
  const systemMap: Record<string, any> = {
    'fluid': 'RENAL',
    'antibiotic': 'ID',
    'radiology': null,
    'ecg': 'CV',
    'derm': 'DERM',
    'grand_rounds': null,
    'condition': null,
    'pharm': null,
    'first_line': null,
    'system': details.category || null,
    'subcategory': details.category || null,
  };

  const record: PerformanceRecord = {
    timestamp: Date.now(),
    system: systemMap[drillType] || null,
    subcategory: details.category || drillType,
    conditionId: caseId,
    condition: details.title || `${drillType} Case`,
    topic: drillType,
    isCorrect,
    focus: null,
    difficulty: 'same'
  };

  // Update local storage for immediate UI reflection
  try {
    const STORAGE_KEY = "panceai_performance_v2";
    const existing = localStorage.getItem(STORAGE_KEY);
    const records: PerformanceRecord[] = existing ? JSON.parse(existing) : [];
    records.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    
    // Dispatch event so useUserStats hook updates
    window.dispatchEvent(new Event('performance-updated'));
  } catch (e) {
    console.error("Failed to update local storage", e);
  }

  try {
    if (isTestEnv) {
      return;
    }

    // Get auth token if provided
    const token = getToken ? await getToken() : null;
    
    // Build headers with auth if available
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Use the sync endpoint to save the record
    const response = await fetch(getApiEndpoint(API_ENDPOINTS.SYNC), {
      method: 'POST',
      headers,
      body: JSON.stringify({ performanceRecords: [record] })
    });

    if (!response.ok) {
      console.warn('Failed to sync drill result:', await response.text());
    }
  } catch (error) {
    console.error('Error submitting drill result:', error);
  }
}
