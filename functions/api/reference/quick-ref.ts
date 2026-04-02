/**
 * API: GET /api/reference/quick-ref?system=X&conditionId=Y
 *
 * Returns lightweight clinical reference data for in-session use.
 * Sprint 4B — April 2026
 */

import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { getQuickRef } from '../../../lib/services/clinicalQuickRefService';

export const onRequestGet: PagesFunction = async (context) => {
  let prisma;
  try {
    prisma = createEdgePrismaClient();
    const url = new URL(context.request.url);
    const system = url.searchParams.get('system') ?? undefined;
    const conditionId = url.searchParams.get('conditionId') ?? undefined;

    const data = await getQuickRef(prisma, { system, conditionId });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Quick reference lookup failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
};