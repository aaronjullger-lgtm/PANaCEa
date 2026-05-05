/**
 * React hook for the legacy SRS route surface.
 * The backend now serves this from canonical FSRS progress tables; legacy
 * SRSItem uploads are not written back to the database.
 */

import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

export interface SRSItem {
  id: string;
  source?: 'card' | 'user_topic_progress' | 'user_progress' | 'legacy_srs_item';
  questionId?: string | null;
  conditionId?: string;
  taskType?: string | null;
  progressContext?: string;
  interval?: number;
  dueDate: Date;
  difficulty?: number | null;
  easiness?: number;
  repetition?: number;
  fsrsStability?: number | null;
  fsrsDifficulty?: number | null;
  fsrsState?: number | null;
  stability?: number | null;
  state?: number | null;
  overdueDays?: number;
  priority?: number;
}

interface UseSRSItemsResult {
  dueItems: SRSItem[];
  dueCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<unknown>;
  syncToCloud: () => Promise<void>;
  isOnline: boolean;
}

async function fetchDueFromApi(token: string | null): Promise<{ items: SRSItem[]; totalDue: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/srs/due', {
    method: 'GET',
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(
      getApiEnvelopeError(errorPayload, `Failed to fetch due items: ${response.status}`)
    );
  }

  const data = unwrapApiEnvelope<{
    items?: Array<{ dueDate: string; [k: string]: unknown }>;
    totalDue?: number;
  }>(await response.json());
  const rawItems = data.items ?? [];
  const items: SRSItem[] = rawItems.map((item: { dueDate: string; [k: string]: unknown }) => ({
    ...item,
    dueDate: new Date(item.dueDate),
  })) as SRSItem[];

  return { items, totalDue: data.totalDue ?? items.length };
}

export function useSRSItems(): UseSRSItemsResult {
  const { isSignedIn, user, getToken } = useAuth();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
    isFetched,
  } = useQuery({
    queryKey: ['srs', 'due', isSignedIn ? user?.id : null],
    queryFn: async () => {
      const token = await getToken();
      if (!token) {
        return { items: [], totalDue: 0 };
      }
      return fetchDueFromApi(token);
    },
    enabled: !!isSignedIn && !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // When coming back online, refetch due items so cache is updated after offline queue flush
  useEffect(() => {
    if (!isSignedIn) return;

    const onOnline = () => {
      refetch();
    };

    globalThis.addEventListener?.('online', onOnline);
    return () => globalThis.removeEventListener?.('online', onOnline);
  }, [isSignedIn, refetch]);

  const dueItems = data?.items ?? [];
  const dueCount = data?.totalDue ?? 0;
  const loading = Boolean(isSignedIn && isLoading && !isFetched);
  let errorMessage: string | null = null;
  if (queryError instanceof Error) {
    errorMessage = queryError.message;
  } else if (queryError) {
    errorMessage = 'Failed to load SRS items';
  }

  const syncToCloud = async () => {
    if (!isSignedIn || !user) return;

    try {
      // Legacy localStorage SRSItem uploads are retired. Canonical FSRS writes
      // happen at review submission time; this compatibility hook now refreshes
      // the canonical due queue instead of creating deprecated scheduler rows.
      await refetch();
    } catch (err) {
      console.error('[useSRSItems] Sync error:', err);
      toast.error('Review queue refresh failed. Your latest submissions remain saved on the server.');
    }
  };

  return {
    dueItems,
    dueCount,
    loading,
    error: errorMessage,
    refetch,
    syncToCloud,
    isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  };
}
