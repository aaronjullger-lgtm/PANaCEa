
import { json } from '@remix-run/cloudflare';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { generateRecommendations } from '../../../../lib/recommendationEngine';
import type { CloudflareContext } from '../../_shared/types';
import { authenticateRequest } from '../../_shared/auth';

interface Env {
    DATABASE_URL: string;
    CLERK_SECRET_KEY: string;
}

export async function onRequestPost(context: CloudflareContext<Env>) {
    const { request, env } = context;

    // Authenticate (using shared auth helper if available or mock/basic)
    const authResult = await authenticateRequest(request as any, env);
    if (!authResult) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId; // Assuming authResult has userId

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
        const recommendations = await generateRecommendations(userId, prisma);
        return json({ success: true, count: recommendations.length, recommendations });
    } catch (error) {
        console.error('Recommendation generation failed:', error);
        return json({ error: 'Failed to generate recommendations', details: String(error) }, { status: 500 });
    } finally {
        // Edge client might not need explicit disconnect, but good practice if supported
        // (Our shared client might handle it)
    }
}
