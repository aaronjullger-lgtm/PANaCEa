import type {
  StudyAttemptRecord,
  StudySessionHistoryRecord,
  StudySessionProgressRecord,
  StudySessionRuntime,
  StudySessionSummaryRecord,
} from './sessionRuntime';

const STORAGE_KEYS = {
  activeSession: 'panacea.study.active-session.v1',
  activeProgress: 'panacea.study.active-progress.v1',
  recentAttempts: 'panacea.study.recent-attempts.v1',
  recentSummaries: 'panacea.study.recent-summaries.v1',
  sessionHistory: 'panacea.study.session-history.v1',
} as const;

const ACTIVE_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 48;
const MAX_RECENT_ATTEMPTS = 250;
const MAX_RECENT_SUMMARIES = 12;
const MAX_SESSION_HISTORY = 12;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal; persistence is a UX enhancement, not source of truth.
  }
}

export function loadPersistedActiveStudySession(): StudySessionRuntime | null {
  const persisted = readJson<StudySessionRuntime | null>(STORAGE_KEYS.activeSession, null);
  if (!persisted) return null;

  if (Date.now() - persisted.updatedAt > ACTIVE_SESSION_MAX_AGE_MS) {
    clearPersistedActiveStudySession();
    return null;
  }

  return persisted;
}

export function savePersistedActiveStudySession(session: StudySessionRuntime | null): void {
  if (!session) {
    clearPersistedActiveStudySession();
    return;
  }

  writeJson(STORAGE_KEYS.activeSession, session);
}

export function loadPersistedActiveStudyProgress(): StudySessionProgressRecord | null {
  const persisted = readJson<StudySessionProgressRecord | null>(STORAGE_KEYS.activeProgress, null);
  if (!persisted) return null;

  if (Date.now() - persisted.lastActiveAt > ACTIVE_SESSION_MAX_AGE_MS) {
    clearPersistedActiveStudyProgress();
    return null;
  }

  return persisted;
}

export function savePersistedActiveStudyProgress(progress: StudySessionProgressRecord | null): void {
  if (!progress) {
    clearPersistedActiveStudyProgress();
    return;
  }

  writeJson(STORAGE_KEYS.activeProgress, progress);
}

export function clearPersistedActiveStudySession(): void {
  if (!canUseStorage()) return;

  try {
    localStorage.removeItem(STORAGE_KEYS.activeSession);
  } catch {
    // Ignore.
  }
}

export function clearPersistedActiveStudyProgress(): void {
  if (!canUseStorage()) return;

  try {
    localStorage.removeItem(STORAGE_KEYS.activeProgress);
  } catch {
    // Ignore.
  }
}

export function loadPersistedStudyAttempts(): StudyAttemptRecord[] {
  return readJson<StudyAttemptRecord[]>(STORAGE_KEYS.recentAttempts, []);
}

export function savePersistedStudyAttempts(attempts: StudyAttemptRecord[]): void {
  writeJson(STORAGE_KEYS.recentAttempts, attempts.slice(0, MAX_RECENT_ATTEMPTS));
}

export function loadPersistedStudySummaries(): StudySessionSummaryRecord[] {
  return readJson<StudySessionSummaryRecord[]>(STORAGE_KEYS.recentSummaries, []);
}

export function savePersistedStudySummaries(summaries: StudySessionSummaryRecord[]): void {
  writeJson(STORAGE_KEYS.recentSummaries, summaries.slice(0, MAX_RECENT_SUMMARIES));
}

export function loadPersistedStudyHistory(): StudySessionHistoryRecord[] {
  return readJson<StudySessionHistoryRecord[]>(STORAGE_KEYS.sessionHistory, []);
}

export function savePersistedStudyHistory(history: StudySessionHistoryRecord[]): void {
  writeJson(STORAGE_KEYS.sessionHistory, history.slice(0, MAX_SESSION_HISTORY));
}
