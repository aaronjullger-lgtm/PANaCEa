import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';
import { isGuestModeActive } from '@/services/auth/guestAuth';

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
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [state, setState] = useState<State>({ data: null, isLoading: true, error: null });

  const fetchProfile = useCallback(async () => {
    if (!isLoaded || !isSignedIn || (typeof window !== 'undefined' && isGuestModeActive())) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const token = await getToken();
      const res = await fetch('/api/user/clinical-profile', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const safeMessages: Record<number, string> = {
          401: 'Your session has expired. Please sign in again.',
          403: 'You do not have permission to view this profile.',
          404: 'Clinical profile not found.',
          429: 'Too many requests. Please wait a moment and try again.',
        };
        const errorPayload = await res.json().catch(() => ({}));
        throw new Error(
          getApiEnvelopeError(
            errorPayload,
            safeMessages[res.status] ?? 'Unable to load your clinical profile. Please try again.'
          )
        );
      }
      setState({
        data: unwrapApiEnvelope<ClinicalProfileData | null>(await res.json()),
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      const isSafe = msg.length > 0 && msg.length < 200 && !msg.includes('prisma') && !msg.includes('Invalid');
      setState({
        data: null,
        isLoading: false,
        error: isSafe ? msg : 'Unable to load your clinical profile. Please try again.',
      });
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { ...state, refetch: fetchProfile };
}
