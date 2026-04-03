/**
 * useReviewForecast — Fetches 7-day review load forecast.
 *
 * Returns daily card counts, overdue count, and optional per-system
 * breakdowns. Powers the ReviewCalendar dashboard widget.
 *
 * @see functions/api/analytics/review-forecast.ts
 * @see components/dashboard/ReviewCalendar.tsx
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export interface ForecastDay {
  date: string;
  count: number;
  systems?: { system: string; count: number }[];
}

export interface ReviewForecastData {
  overdue: number;
  today: number;
  forecast: ForecastDay[];
  totalActive: number;
}

export function useReviewForecast() {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<ReviewForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    async function fetchForecast() {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) return;

        const endpoint = getApiEndpoint('/api/analytics/review-forecast');
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Review forecast fetch failed: ${response.status}`);
        }

        const json = await response.json();
        if (json?.data) {
          setData(json.data);
        }
      } catch (err) {
        console.warn('[useReviewForecast] Failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchForecast();
  }, [isSignedIn, getToken]);

  return { data, isLoading, error };
}
