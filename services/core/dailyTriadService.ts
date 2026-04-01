export type DailyTriadType = 'gold_standard' | 'clinical_pearl';

export interface DailyTriad {
  conditionId: string;
  condition: string;
  system: string;
  subcategory: string | null;
  type: DailyTriadType;
  highlight: string;
  buzzwords: string[];
  panceYield: number | null;
  updatedAt: string;
  source: 'database';
}

export async function fetchDailyTriad(signal?: AbortSignal): Promise<DailyTriad> {
  const response = await fetch('/api/dashboard/daily-triad', { signal });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || 'Failed to load Daily Triad');
  }

  const payload = await response.json() as { data: DailyTriad };
  return payload.data as DailyTriad;
}
