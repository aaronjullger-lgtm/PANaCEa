/**
 * Confusion Mapping Service
 *
 * Tracks which incorrect answers users choose and maps confusion patterns
 * between medical conditions. Generates DDx comparison tables for commonly
 * confused condition pairs.
 */

import { StorageKeys } from '../storage/storageRegistry';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ConfusionRecord {
  id: string;
  userId: string;
  realConditionId: string;
  mistakenConditionId: string;
  times: number;
  lastUpdated: Date;
}

export interface ConfusionGraphEdge {
  from: string;
  to: string;
  weight: number;
  normalizedWeight: number;
}

export interface DDxComparison {
  conditionA: string;
  conditionB: string;
  similarities: string[];
  differences: {
    A: string[];
    B: string[];
  };
  buzzwords: {
    A: string[];
    B: string[];
  };
  diagnostic: {
    A: string[];
    B: string[];
  };
  treatments: {
    A: string[];
    B: string[];
  };
  keyDifferentiators?: {
    A?: string[] | null;
    B?: string[] | null;
  };
  triad?: string[] | null;
}

export interface TopConfusion {
  conditionId: string;
  conditionName: string;
  times: number;
  normalizedScore: number;
}

// ============================================================================
// Constants
// ============================================================================

const CONFUSION_STORAGE_KEY = StorageKeys.CONFUSION_MAP;
const CONFUSION_VERSION = 'v1';
const MINIMUM_DISPLAY_THRESHOLD = 0.2; // Normalized weight threshold for displaying

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a condition ID into a human-readable name
 * Converts snake_case or kebab-case to Title Case
 */
function formatConditionName(conditionId: string): string {
  return conditionId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Load confusion records from localStorage
 */
function loadConfusionRecords(): Map<string, ConfusionRecord> {
  try {
    const stored = localStorage.getItem(CONFUSION_STORAGE_KEY);
    if (!stored) return new Map();

    const data = JSON.parse(stored);
    if (data.version !== CONFUSION_VERSION) {
      console.log('[ConfusionMap] Version mismatch, clearing old data');
      return new Map();
    }

    const records = new Map<string, ConfusionRecord>();
    for (const record of data.records) {
      const key = `${record.userId}_${record.realConditionId}_${record.mistakenConditionId}`;
      records.set(key, {
        ...record,
        lastUpdated: new Date(record.lastUpdated),
      });
    }
    return records;
  } catch (error) {
    console.error('[ConfusionMap] Failed to load records:', error);
    return new Map();
  }
}

/**
 * Save confusion records to localStorage
 */
function saveConfusionRecords(records: Map<string, ConfusionRecord>): void {
  try {
    const data = {
      version: CONFUSION_VERSION,
      records: Array.from(records.values()),
    };
    localStorage.setItem(CONFUSION_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[ConfusionMap] Failed to save records:', error);
  }
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Record a confusion event when user selects wrong answer
 *
 * @param userId - User identifier
 * @param realConditionId - The correct answer condition
 * @param mistakenConditionId - The wrong answer the user selected
 */
export function recordConfusion(
  userId: string,
  realConditionId: string,
  mistakenConditionId: string
): void {
  if (realConditionId === mistakenConditionId) return;

  const records = loadConfusionRecords();
  const key = `${userId}_${realConditionId}_${mistakenConditionId}`;

  const existing = records.get(key);
  if (existing) {
    existing.times += 1;
    existing.lastUpdated = new Date();
  } else {
    records.set(key, {
      id: key,
      userId,
      realConditionId,
      mistakenConditionId,
      times: 1,
      lastUpdated: new Date(),
    });
  }

  saveConfusionRecords(records);
}

/**
 * Get top confusions for a specific condition
 *
 * @param userId - User identifier
 * @param conditionId - The condition to analyze
 * @param limit - Maximum number of results
 * @returns Array of conditions most commonly confused with this one
 */
export function getTopConfusionsForCondition(
  userId: string,
  conditionId: string,
  limit: number = 5
): TopConfusion[] {
  const records = loadConfusionRecords();
  const confusions: Map<string, number> = new Map();
  let maxTimes = 0;

  // Aggregate confusions where this condition was either real or mistaken
  for (const record of records.values()) {
    if (record.userId !== userId) continue;

    if (record.realConditionId === conditionId) {
      const current = confusions.get(record.mistakenConditionId) || 0;
      confusions.set(record.mistakenConditionId, current + record.times);
      maxTimes = Math.max(maxTimes, current + record.times);
    }

    if (record.mistakenConditionId === conditionId) {
      const current = confusions.get(record.realConditionId) || 0;
      confusions.set(record.realConditionId, current + record.times);
      maxTimes = Math.max(maxTimes, current + record.times);
    }
  }

  // Convert to array and normalize
  const results: TopConfusion[] = [];
  for (const [confusedId, times] of confusions.entries()) {
    results.push({
      conditionId: confusedId,
      conditionName: formatConditionName(confusedId),
      times,
      normalizedScore: maxTimes > 0 ? times / maxTimes : 0,
    });
  }

  // Sort by times (descending) and return top N
  return results.sort((a, b) => b.times - a.times).slice(0, limit);
}

/**
 * Build a confusion graph for visualization or analysis
 *
 * @param userId - User identifier
 * @returns Adjacency list representation of confusion graph
 */
export function buildConfusionGraph(userId: string): Map<string, Map<string, number>> {
  const records = loadConfusionRecords();
  const graph: Map<string, Map<string, number>> = new Map();

  for (const record of records.values()) {
    if (record.userId !== userId) continue;

    // Add edge from real to mistaken
    if (!graph.has(record.realConditionId)) {
      graph.set(record.realConditionId, new Map());
    }
    const edges = graph.get(record.realConditionId)!;
    edges.set(record.mistakenConditionId, record.times);
  }

  return graph;
}

/**
 * Get all confusion edges with normalized weights
 * Useful for visualization
 */
export function getConfusionEdges(userId: string): ConfusionGraphEdge[] {
  const records = loadConfusionRecords();
  const edges: ConfusionGraphEdge[] = [];
  let maxWeight = 0;

  // First pass: collect edges and find max weight
  for (const record of records.values()) {
    if (record.userId !== userId) continue;
    maxWeight = Math.max(maxWeight, record.times);
  }

  // Second pass: create normalized edges
  for (const record of records.values()) {
    if (record.userId !== userId) continue;

    const normalizedWeight = maxWeight > 0 ? record.times / maxWeight : 0;

    // Only include edges above threshold
    if (normalizedWeight >= MINIMUM_DISPLAY_THRESHOLD) {
      edges.push({
        from: record.realConditionId,
        to: record.mistakenConditionId,
        weight: record.times,
        normalizedWeight,
      });
    }
  }

  return edges.sort((a, b) => b.weight - a.weight);
}

/**
 * Get pairs of conditions that are frequently confused
 */
export function getConfusionPairs(
  userId: string,
  limit: number = 10
): Array<{ conditionA: string; conditionB: string; totalConfusions: number }> {
  const records = loadConfusionRecords();
  const pairCounts: Map<string, number> = new Map();

  for (const record of records.values()) {
    if (record.userId !== userId) continue;

    // Create canonical pair key (alphabetically sorted)
    const pair = [record.realConditionId, record.mistakenConditionId].sort();
    const pairKey = pair.join('|');

    const current = pairCounts.get(pairKey) || 0;
    pairCounts.set(pairKey, current + record.times);
  }

  // Convert to array and sort
  const pairs = Array.from(pairCounts.entries())
    .map(([key, count]) => {
      const [a, b] = key.split('|');
      return { conditionA: a ?? '', conditionB: b ?? '', totalConfusions: count };
    })
    .filter((p) => p.conditionA !== '' && p.conditionB !== '')
    .sort((a, b) => b.totalConfusions - a.totalConfusions)
    .slice(0, limit);

  return pairs;
}

/**
 * Check if two conditions form a confusion pair for a user
 */
export function isConfusionPair(
  userId: string,
  conditionA: string,
  conditionB: string,
  threshold: number = 2
): boolean {
  const records = loadConfusionRecords();

  const keyAB = `${userId}_${conditionA}_${conditionB}`;
  const keyBA = `${userId}_${conditionB}_${conditionA}`;

  const recordAB = records.get(keyAB);
  const recordBA = records.get(keyBA);

  const totalConfusions = (recordAB?.times || 0) + (recordBA?.times || 0);
  return totalConfusions >= threshold;
}

/**
 * Clear confusion data for a user
 */
export function clearConfusionData(userId: string): void {
  const records = loadConfusionRecords();

  for (const [key, record] of records.entries()) {
    if (record.userId === userId) {
      records.delete(key);
    }
  }

  saveConfusionRecords(records);
}

/**
 * Get confusion statistics for dashboard
 */
export function getConfusionStats(userId: string): {
  totalConfusions: number;
  uniquePairs: number;
  mostConfusedCondition: string | null;
  mostConfusedCount: number;
} {
  const records = loadConfusionRecords();
  const conditionCounts: Map<string, number> = new Map();
  const seenPairs = new Set<string>();
  let totalConfusions = 0;

  for (const record of records.values()) {
    if (record.userId !== userId) continue;

    totalConfusions += record.times;

    // Track unique pairs
    const pair = [record.realConditionId, record.mistakenConditionId].sort().join('|');
    seenPairs.add(pair);

    // Track per-condition confusion count
    const realCount = conditionCounts.get(record.realConditionId) || 0;
    conditionCounts.set(record.realConditionId, realCount + record.times);
  }

  // Find most confused condition
  let mostConfusedCondition: string | null = null;
  let mostConfusedCount = 0;

  for (const [condition, count] of conditionCounts.entries()) {
    if (count > mostConfusedCount) {
      mostConfusedCondition = condition;
      mostConfusedCount = count;
    }
  }

  return {
    totalConfusions,
    uniquePairs: seenPairs.size,
    mostConfusedCondition,
    mostConfusedCount,
  };
}
