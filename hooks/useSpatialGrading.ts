/**
 * useSpatialGrading
 *
 * Hook to grade a student's drawn bounding box against the pathology via /api/vision/grade-spatial.
 * Use with SpatialAnswerCanvas for ECG/X-ray draw-to-identify flows.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import type { BoundingBox } from '@/components/drill/SpatialAnswerCanvas';

export interface SpatialGradingResult {
  isCorrect: boolean;
  overlapRatio: number;
  correctBox?: [number, number, number, number];
}

export interface UseSpatialGradingOptions {
  imageBase64: string;
  userBox: BoundingBox;
  mediaAssetId?: string;
  pathology?: string;
}

/**
 * Fetch an image URL and return as base64 (works for same-origin and CORS-enabled URLs).
 */
export async function imageUrlToBase64(url: string): Promise<string> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 ?? '');
    };
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a loaded HTMLImageElement to base64 via canvas.
 * Use when the image is already displayed (avoids re-fetch, works with crossOrigin).
 */
export function imageElementToBase64(img: HTMLImageElement, format = 'image/png'): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL(format);
  return dataUrl.includes(',') ? (dataUrl.split(',')[1] ?? '') : dataUrl;
}

export function useSpatialGrading() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpatialGradingResult | null>(null);

  const grade = useCallback(
    async (options: UseSpatialGradingOptions) => {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const token = await getToken();
        if (!token) {
          setError('Not authenticated');
          return null;
        }

        const url = getApiEndpoint('/api/vision/grade-spatial');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            body: {
              imageBase64: options.imageBase64,
              mimeType: 'image/png',
              userBox: options.userBox,
              mediaAssetId: options.mediaAssetId,
              pathology: options.pathology,
            },
          }),
        });

        const json = (await res.json()) as {
          data?: SpatialGradingResult;
          error?: string;
        };

        if (!res.ok) {
          setError(json?.error ?? 'Grading failed');
          return null;
        }

        const data = json?.data;
        if (!data) {
          setError('Invalid response');
          return null;
        }

        setResult(data);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { grade, loading, error, result, reset };
}
