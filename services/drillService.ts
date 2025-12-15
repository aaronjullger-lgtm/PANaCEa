import { PerformanceRecord } from '../types';

/**
 * Submit a drill result to the backend for persistence.
 * Maps drill-specific data to the generic PerformanceRecord format.
 */
export async function submitDrillResult(
  drillType: 'fluid' | 'antibiotic' | 'radiology' | 'ecg' | 'derm' | 'grand_rounds',
  caseId: string,
  isCorrect: boolean,
  details: { title?: string; category?: string }
) {
  const systemMap: Record<string, any> = {
    'fluid': 'RENAL',
    'antibiotic': 'ID',
    'radiology': null, // Depends on body part, but null is safe
    'ecg': 'CV',
    'derm': 'DERM',
    'grand_rounds': null // Varies per question
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
    // Use the sync endpoint to save the record
    // We wrap it in an array as the endpoint expects a batch
    // Note: The backend handles deduplication based on timestamp
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ performanceRecords: [record] }) // Fixed key name
    });

    if (!response.ok) {
      console.warn('Failed to sync drill result:', await response.text());
    }
  } catch (error) {
    console.error('Error submitting drill result:', error);
  }
}
