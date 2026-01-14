/**
 * Custom hook for flagging questions and tracking flag status
 * Part of Task 42: Feedback Loop Closure
 */

import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

interface FlagQuestionData {
  userId: string;
  userEmail?: string;
  userFirstName?: string;
  questionId: string;
  questionText: string;
  correctAnswer?: string;
  topic?: string;
  system?: string;
  flagType: 'typo' | 'incorrect_answer' | 'unclear' | 'outdated' | 'other';
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface FlagResult {
  success: boolean;
  flagId?: string;
  message?: string;
  error?: string;
}

export function useQuestionFlag() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const flagQuestion = async (data: FlagQuestionData): Promise<FlagResult> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch('/api/questions/flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to flag question');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to flag question';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    flagQuestion,
    loading,
    error,
  };
}

/**
 * Hook for admin to manage question flags
 */
export function useQuestionFlags() {
  const [loading, setLoading] = useState(false);
  const [flags, setFlags] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  const fetchFlags = async (filters?: {
    status?: string;
    priority?: string;
  }): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);

      const token = await getToken();
      const response = await fetch(`/api/questions/flags?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch flags');
      }

      setFlags(result.flags || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch flags';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resolveFlag = async (
    flagId: string,
    reviewedBy: string,
    resolutionNote: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(`/api/questions/flag/${flagId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reviewedBy,
          resolutionNote,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resolve flag');
      }

      // Refresh flags list
      await fetchFlags();

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve flag';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    flags,
    loading,
    error,
    fetchFlags,
    resolveFlag,
  };
}
