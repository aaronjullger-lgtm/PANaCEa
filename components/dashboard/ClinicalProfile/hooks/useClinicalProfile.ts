import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export interface ClinicalProfileData {
  overall: { accuracy: number; totalQuestions: number; avgTimeMs: number | null };
  systemBreakdown: Array<{
    system: string;
    total: number;
    correct: number;
    accuracy: number;
    avgTimeMs: number | null;
  }>;
  strengths: string[];
  weaknesses: string[];
  patterns: { rushedSystems: string[]; overthinkingSystems: string[] };
  diagnosisBias: Array<{ condition: string; count: number }>;
  studyPatterns: { peakHours: number[]; avgSessionLength?: number | null };
}

interface State {
  data: ClinicalProfileData | null;
  isLoading: boolean;
  error: string | null;
}

export function useClinicalProfile() {
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ data: null, isLoading: true, error: null });

  const fetchProfile = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const token = await getToken();
      const res = await fetch('/api/user/clinical-profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to load profile');
      }
      const payload = (await res.json()) as { data?: ClinicalProfileData };
      setState({ data: payload.data ?? null, isLoading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load profile',
      });
    }
  }, [getToken]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { ...state, refetch: fetchProfile };
}
