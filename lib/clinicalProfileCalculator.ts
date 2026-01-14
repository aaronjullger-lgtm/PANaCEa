export interface SystemStats {
  correct: number;
  total: number;
  avgTimeMs: number;
  accuracy?: number;
}

export interface DiagnosisBiasMap {
  [condition: string]: number;
}

export interface UserStatisticsShape {
  totalQuestions: number;
  correctAnswers: number;
  avgTimePerQuestion?: number | null;
  systemStats?: Record<string, SystemStats> | null;
  rushedSystems?: string[];
  overthinkingSystems?: string[];
  strongestSystems?: string[];
  weakestSystems?: string[];
  diagnosisBias?: DiagnosisBiasMap | null;
}

export interface AttemptPayload {
  system?: string | null;
  isCorrect: boolean;
  timeSpentMs?: number | null;
  selectedCondition?: string | null;
  correctCondition?: string | null;
  timestamp?: Date;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const avg = mean(values);
  const variance = mean(values.map(v => Math.pow(v - avg, 2)));
  return Math.sqrt(variance);
}

export function updateSystemStats(
  current: Record<string, SystemStats> | null | undefined,
  system: string,
  isCorrect: boolean,
  timeSpentMs: number | null | undefined
): Record<string, SystemStats> {
  const next = { ...(current || {}) } as Record<string, SystemStats>;
  const existing = next[system] || { correct: 0, total: 0, avgTimeMs: 0, accuracy: 0 };

  const totalBefore = existing.total;
  const correctBefore = existing.correct;
  const totalAfter = totalBefore + 1;
  const correctAfter = correctBefore + (isCorrect ? 1 : 0);

  const time = typeof timeSpentMs === 'number' && timeSpentMs > 0 ? timeSpentMs : null;
  const avgTimeMs = time !== null
    ? ((existing.avgTimeMs || 0) * totalBefore + time) / totalAfter
    : existing.avgTimeMs || 0;

  next[system] = {
    correct: correctAfter,
    total: totalAfter,
    avgTimeMs,
    accuracy: totalAfter > 0 ? correctAfter / totalAfter : 0,
  };

  return next;
}

export function calculateProfile(userStats: UserStatisticsShape) {
  const systemStats = (userStats.systemStats || {}) as Record<string, SystemStats>;
  const systemEntries = Object.entries(systemStats);

  // Calculate global timing
  const timingValues = systemEntries
    .map(([, stat]) => stat.avgTimeMs)
    .filter((v) => typeof v === 'number' && !Number.isNaN(v)) as number[];

  const globalAvgTime = mean(timingValues);
  const globalStdDev = standardDeviation(timingValues);

  const rushedSystems = systemEntries
    .filter(([, stat]) => typeof stat.avgTimeMs === 'number' && stat.avgTimeMs < globalAvgTime - globalStdDev)
    .map(([system]) => system);

  const overthinkingSystems = systemEntries
    .filter(([, stat]) => typeof stat.avgTimeMs === 'number' && stat.avgTimeMs > globalAvgTime + globalStdDev)
    .map(([system]) => system);

  const sortedByAccuracy = systemEntries
    .filter(([, stat]) => stat.total >= 5)
    .sort((a, b) => (b[1].accuracy || 0) - (a[1].accuracy || 0));

  const strongestSystems = sortedByAccuracy.slice(0, 3).map(([name]) => name);
  const weakestSystems = sortedByAccuracy.slice(-3).map(([name]) => name);

  return {
    strongestSystems,
    weakestSystems,
    rushedSystems,
    overthinkingSystems,
  };
}

export function computeUpdatedAverages(
  totalQuestions: number,
  avgTimePerQuestion: number | null | undefined,
  timeSpentMs: number | null | undefined
): number | null {
  if (typeof timeSpentMs !== 'number' || Number.isNaN(timeSpentMs)) {
    return avgTimePerQuestion ?? null;
  }

  if (totalQuestions <= 0) {
    return timeSpentMs;
  }

  const safeCurrent = typeof avgTimePerQuestion === 'number' ? avgTimePerQuestion : 0;
  const sum = safeCurrent * totalQuestions + timeSpentMs;
  return sum / (totalQuestions + 1);
}

export function updateDiagnosisBias(
  diagnosisBias: DiagnosisBiasMap | null | undefined,
  selectedCondition?: string | null,
  correctCondition?: string | null,
  isCorrect?: boolean
): DiagnosisBiasMap {
  if (isCorrect) return diagnosisBias || {};
  if (!selectedCondition) return diagnosisBias || {};

  const next = { ...(diagnosisBias || {}) } as DiagnosisBiasMap;
  // Avoid counting correct condition as bias
  if (!correctCondition || selectedCondition !== correctCondition) {
    next[selectedCondition] = (next[selectedCondition] || 0) + 1;
  }
  return next;
}

export function derivePeakHoursFromSessions(hours: number[]): number[] {
  if (!hours.length) return [];
  const counts = new Map<number, number>();
  hours.forEach((h) => {
    const hour = h % 24;
    counts.set(hour, (counts.get(hour) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => hour);
}
