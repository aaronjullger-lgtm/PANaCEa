/**
 * Photo Drill Batch API (deprecated: use GET /api/drills/media)
 *
 * Returns the same photo drill cases as GET /api/drills/media for backward compatibility.
 * Query params: modality ('ecg' | 'derm' | 'radiology'), count (default 10).
 *
 * GET /api/drill/photo-batch?modality=ecg&count=10
 *
 * @deprecated Use GET /api/drills/media?modality=ecg&count=10 instead.
 * @module functions/api/drill/photo-batch
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getMediaDrillCases } from '../../../services/drill/mediaDrillCases';
import type { DrillModality } from '../../../lib/mediaTypes';

/** Query accepts 'ecg' | 'derm' | 'radiology'; mapped to DrillModality (radiology -> xray) */
const MODALITY_ALIAS: Record<string, DrillModality> = {
  ecg: 'ecg',
  derm: 'derm',
  radiology: 'xray',
  imaging: 'xray',
  xray: 'xray',
};

export async function onRequestGet(context: any) {
  const { request, env } = context;
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const url = new URL(request.url);
    const modalityParam = url.searchParams.get('modality');
    const count = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('count') || '10', 10) || 10)
    );

    let modality: DrillModality | null = null;
    if (modalityParam) {
      const normalized = modalityParam.toLowerCase();
      modality = MODALITY_ALIAS[normalized] ?? null;
    }

    const photoCases = await getMediaDrillCases(prisma, {
      modality,
      count,
    });

    return new Response(JSON.stringify({ data: photoCases }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Photo Batch] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch photo drill batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
}
