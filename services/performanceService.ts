// services/performanceService.ts

import type { Question, PerformanceRecord, SessionSettings, SystemCode } from '../types';

const STORAGE_KEY = 'panceai_performance_v2';

// ---- In-memory cache to reduce localStorage reads ----
let cachedRecords: PerformanceRecord[] | null = null;
let cacheTimestamp: number = 0;
let cachedStorageValue: string | null = null; // Track localStorage value for cross-tab invalidation
const CACHE_TTL = 5000; // 5 seconds cache TTL

// ---- Low-level helpers ----

function loadAllRecords(): PerformanceRecord[] {
  if (typeof window === 'undefined') return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  const now = Date.now();

  // Check if cache is valid: not expired AND localStorage hasn't changed (cross-tab support)
  if (cachedRecords && now - cacheTimestamp < CACHE_TTL && raw === cachedStorageValue) {
    return cachedRecords;
  }

  // Cache miss or invalidated - reload from localStorage
  try {
    if (!raw) {
      cachedRecords = [];
      cacheTimestamp = now;
      cachedStorageValue = raw;
      return [];
    }
    const parsed = JSON.parse(raw) as PerformanceRecord[];
    if (!Array.isArray(parsed)) {
      cachedRecords = [];
      cacheTimestamp = now;
      cachedStorageValue = raw;
      return [];
    }
    cachedRecords = parsed;
    cacheTimestamp = now;
    cachedStorageValue = raw;
    return parsed;
  } catch {
    cachedRecords = [];
    cacheTimestamp = now;
    cachedStorageValue = raw;
    return [];
  }
}

function saveAllRecords(records: PerformanceRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(records);
    localStorage.setItem(STORAGE_KEY, serialized);
    // Update cache with new value
    cachedRecords = records;
    cacheTimestamp = Date.now();
    cachedStorageValue = serialized;

    // Dispatch event for hooks
    window.dispatchEvent(new Event('performance-updated'));
  } catch (err) {
    console.error('Failed to save performance records', err);
  }
}

// ---- Clear cache when needed ----
export function clearPerformanceCache() {
  cachedRecords = null;
  cacheTimestamp = 0;
}

// ---- Public: record a single question outcome ----

export function recordQuestionOutcome(
  question: Question,
  isCorrect: boolean,
  settings: SessionSettings
) {
  const now = Date.now();

  const record: PerformanceRecord = {
    timestamp: now,
    system: question.system ?? null,
    subcategory: question.subcategory ?? null,
    conditionId: question.conditionId,
    condition: question.condition,
    topic: question.topic,
    isCorrect,
    focus: settings.focus,
  };

  const all = loadAllRecords();
  all.push(record);
  saveAllRecords(all);
}

// ---- Aggregation types for the heatmap ----

export interface ConditionStats {
  system: SystemCode;
  subcategory: string;
  conditionId: string;
  condition: string;
  correct: number;
  total: number;
  percent: number; // 0–100
}

export interface SubcategoryStats {
  system: SystemCode;
  subcategory: string;
  correct: number;
  total: number;
  percent: number; // 0–100
  conditions: ConditionStats[];
}

export interface SystemStats {
  system: SystemCode;
  correct: number;
  total: number;
  percent: number; // 0–100
  subcategories: SubcategoryStats[];
}

// ---- Core: “PANCE-only ALL-topics” filtered hierarchy ----

export function getHierarchicalStats(): SystemStats[] {
  const all = loadAllRecords();

  // Only count ALL-topics sessions (all questions are now PANCE-level by default):
  //  - focus === "all"
  const filtered = all.filter((r) => r.focus === 'all' && r.system && r.system !== 'OTHER');

  // system → subcategory → condition → aggregate
  const systemMap = new Map<SystemCode, SystemStats>();

  for (const rec of filtered) {
    const system = rec.system as SystemCode;
    const subcategory = rec.subcategory ?? 'Uncategorized';
    const conditionKey = rec.conditionId || rec.condition;

    if (!systemMap.has(system)) {
      systemMap.set(system, {
        system,
        correct: 0,
        total: 0,
        percent: 0,
        subcategories: [],
      });
    }
    const sys = systemMap.get(system)!;
    sys.total += 1;
    if (rec.isCorrect) sys.correct += 1;

    // find or create subcategory
    let sub = sys.subcategories.find((s) => s.subcategory === subcategory);
    if (!sub) {
      sub = {
        system,
        subcategory,
        correct: 0,
        total: 0,
        percent: 0,
        conditions: [],
      };
      sys.subcategories.push(sub);
    }
    sub.total += 1;
    if (rec.isCorrect) sub.correct += 1;

    // find or create condition
    let cond = sub.conditions.find(
      (c) => c.conditionId === rec.conditionId && c.condition === rec.condition
    );
    if (!cond) {
      cond = {
        system,
        subcategory,
        conditionId: rec.conditionId,
        condition: rec.condition,
        correct: 0,
        total: 0,
        percent: 0,
      };
      sub.conditions.push(cond);
    }
    cond.total += 1;
    if (rec.isCorrect) cond.correct += 1;
  }

  // compute percentages
  const systems: SystemStats[] = [];

  for (const sys of systemMap.values()) {
    for (const sub of sys.subcategories) {
      for (const cond of sub.conditions) {
        cond.percent = cond.total > 0 ? (cond.correct / cond.total) * 100 : 0;
      }
      sub.percent = sub.total > 0 ? (sub.correct / sub.total) * 100 : 0;
    }
    sys.percent = sys.total > 0 ? (sys.correct / sys.total) * 100 : 0;
    systems.push(sys);
  }

  // optional: sort systems/subcategories/conditions consistently
  systems.sort((a, b) => a.system.localeCompare(b.system));
  for (const sys of systems) {
    sys.subcategories.sort((a, b) => a.subcategory.localeCompare(b.subcategory));
    for (const sub of sys.subcategories) {
      sub.conditions.sort((a, b) => a.condition.localeCompare(b.condition));
    }
  }

  return systems;
}
