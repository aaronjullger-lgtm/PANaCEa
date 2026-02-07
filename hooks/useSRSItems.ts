/**
 * React hook for managing SRS items with database integration.
 * Uses TanStack Query with IndexedDB persistence so due queue is available offline.
 * When offline, cached due items are shown; when back online, queue is flushed and cache refreshed.
 */

import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';

export interface SRSItem {
  id: string;
  questionId: string;
  interval: number;
  dueDate: Date;
  difficulty: number;
  easiness: number;
  repetition: number;
  fsrsStability?: number | null;
  fsrsDifficulty?: number | null;
  fsrsState?: number | null;
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

async function fetchDueFromApi(): Promise<{ items: SRSItem[]; totalDue: number }> {
  const response = await fetch('/api/srs/due', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch due items: ${response.status}`);
  }

  const data = (await response.json()) as { items?: Array<{ dueDate: string; [k: string]: unknown }>; totalDue?: number };
  const rawItems = data.items ?? [];
  const items: SRSItem[] = rawItems.map((item: { dueDate: string; [k: string]: unknown }) => ({
    ...item,
    dueDate: new Date(item.dueDate),
  })) as SRSItem[];

  return { items, totalDue: data.totalDue ?? items.length };
}

export function useSRSItems(): UseSRSItemsResult {
  const { user, isSignedIn } = useUser();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
    isFetched,
  } = useQuery({
    queryKey: ['srs', 'due', isSignedIn ? user?.id : null],
    queryFn: fetchDueFromApi,
    enabled: !!isSignedIn && !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: true,
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
      const localData = localStorage.getItem('panceai_srs_items');
      if (localData) {
        const localItems = JSON.parse(localData);
        const itemsArray = Array.from(Object.values(localItems));

        const response = await fetch('/api/srs/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ items: itemsArray }),
        });

        if (!response.ok) throw new Error(`Sync failed: ${response.status}`);

        await refetch();
      }
    } catch (err) {
      console.error('[useSRSItems] Sync error:', err);
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
