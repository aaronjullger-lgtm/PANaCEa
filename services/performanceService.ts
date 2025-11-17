// services/performanceService.ts
import type { Question, PerformanceRecord } from "../types";

const STORAGE_KEY = "pance-ai-performance-v1";

type StoredRecord = PerformanceRecord & {
  system?: Question["system"];
  subcategory?: Question["subcategory"];
  condition?: Question["condition"];
};

// ---- helpers to load/save localStorage ----

function loadAll(): StoredRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredRecord[];
  } catch {
    return [];
  }
}

function saveAll(records: StoredRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // best-effort only; fail silently if storage is full / blocked
    console.warn("Unable to save performance records");
  }
}

// ---- MAIN API: call this when a question is answered ----

export function savePerformanceRecord(
  question: Question,
  isCorrect: boolean
) {
  const records = loadAll();

  const record: StoredRecord = {
    timestamp: Date.now(),
    topic: question.topic,
    isCorrect,
    question: question.question,
    system: question.system,
    subcategory: question.subcategory,
    condition: question.condition,
  };

  records.push(record);
  saveAll(records);
}

// ---- Read APIs that the heatmap screen will use later ----

export function getAllPerformanceRecords(): StoredRecord[] {
  return loadAll();
}