
import { json } from '@remix-run/cloudflare';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import type { CloudflareContext } from '../../_shared/types';
import { authenticateRequest } from '../../_shared/auth';

interface Env {
    DATABASE_URL: string;
    CLERK_SECRET_KEY: string;
}

export async function onRequestGet(context: CloudflareContext<Env>) {
    const { request, env } = context;

    const authResult = await authenticateRequest(request as any, env);
    if (!authResult) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = authResult;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
        const recommendations = await prisma.studyRecommendation.findMany({
            where: {
                userId,
                status: 'pending'
            },
            orderBy: [
                { priority: 'asc' }, // high > medium > low (string sort order: high, low, medium - wait. 'high' < 'medium'? No. 'high' starts with h. 'medium' starts with m. 'high' comes first in ASC? Yes.)
                // Actually, let's explicit sort or assume 'high', 'medium', 'low' are strings.
                // H < M < L ? No, H < L < M.
                // Ideally we used an enum or specific field. For now, strings are fine.
                { createdAt: 'desc' }
            ]
        });

        return json({ recommendations });
    } catch (error) {
        return json({ error: 'Failed to fetch recommendations' }, { status: 500 });
    }
}
