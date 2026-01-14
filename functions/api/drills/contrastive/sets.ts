import { createErrorResponse, createSuccessResponse, handleCorsOptions } from '../../_shared/auth';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const url = new URL(request.url);
    const symptom = url.searchParams.get('symptom');
    const system = url.searchParams.get('system');
    const highYield = url.searchParams.get('highYield') === 'true';

    const where: any = {};
    if (symptom) where.symptom = symptom;
    if (system) where.system = system;
    if (highYield) where.highYield = highYield;

    const sets = await prisma.contrastiveSet.findMany({
      where,
      orderBy: { symptom: 'asc' },
    });

    return createSuccessResponse({ sets, total: sets.length });
  } catch (error) {
    console.error('[contrastive/sets] Failed to fetch sets', error);
    return createErrorResponse('Failed to fetch contrastive sets', 500);
  } finally {
    await safePrismaDisconnect(prisma as any);
  }
};
