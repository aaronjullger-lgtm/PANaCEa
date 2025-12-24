/**
 * React hook for managing SRS items with database integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';

interface SRSItem {
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
  refetch: () => Promise<void>;
  syncToCloud: () => Promise<void>;
}

export function useSRSItems(): UseSRSItemsResult {
  const { user, isSignedIn } = useUser();
  const [dueItems, setDueItems] = useState<SRSItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDueItems = useCallback(async () => {
    if (!isSignedIn || !user) {
      setDueItems([]);
      setDueCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/srs/due', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch due items: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert date strings back to Date objects
      const items = data.items.map((item: any) => ({
        ...item,
        dueDate: new Date(item.dueDate),
      }));

      setDueItems(items);
      setDueCount(data.totalDue);
    } catch (err) {
      console.error('[useSRSItems] Error fetching due items:', err);
      setError(err instanceof Error ? err.message : 'Failed to load SRS items');
      setDueItems([]);
      setDueCount(0);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, user]);

  const syncToCloud = useCallback(async () => {
    if (!isSignedIn || !user) return;

    try {
      // Load items from localStorage
      const localData = localStorage.getItem('panceai_srs_items');
      if (!localData) return;

      const localItems = JSON.parse(localData);
      const itemsArray = Array.from(Object.values(localItems));

      const response = await fetch('/api/srs/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemsArray }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[useSRSItems] Sync complete:', result);

      // Refetch to get updated data
      await fetchDueItems();
    } catch (err) {
      console.error('[useSRSItems] Sync error:', err);
    }
  }, [isSignedIn, user, fetchDueItems]);

  // Fetch on mount and when user signs in
  useEffect(() => {
    fetchDueItems();
  }, [fetchDueItems]);

  // Auto-sync localStorage to cloud every 5 minutes
  useEffect(() => {
    if (!isSignedIn) return;

    const syncInterval = setInterval(() => {
      syncToCloud();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(syncInterval);
  }, [isSignedIn, syncToCloud]);

  return {
    dueItems,
    dueCount,
    loading,
    error,
    refetch: fetchDueItems,
    syncToCloud,
  };
}
