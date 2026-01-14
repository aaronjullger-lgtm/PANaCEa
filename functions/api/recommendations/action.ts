
import { json } from '@remix-run/cloudflare';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import type { CloudflareContext } from '../../_shared/types';
import { authenticateRequest } from '../../_shared/auth';

interface Env {
    DATABASE_URL: string;
    CLERK_SECRET_KEY: string;
}

export async function onRequestPost(context: CloudflareContext<Env>) {
    const { request, env } = context;

    const authResult = await authenticateRequest(request as any, env);
    if (!authResult) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recommendationId, action } = await request.json() as { recommendationId: string, action: 'complete' | 'dismiss' };

    if (!recommendationId || !['complete', 'dismiss'].includes(action)) {
        return json({ error: 'Invalid request' }, { status: 400 });
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
        const updated = await prisma.studyRecommendation.update({
            where: {
                id: recommendationId,
                userId: authResult.userId // Security: ensure user owns the recommendation
            },
            data: {
                status: action === 'complete' ? 'completed' : 'dismissed',
                completedAt: action === 'complete' ? new Date() : null
            }
        });

        return json({ success: true, recommendation: updated });
    } catch (error) {
        return json({ error: 'Failed to update recommendation' }, { status: 500 });
    }
}
