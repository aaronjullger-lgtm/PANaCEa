
import { json } from '@remix-run/cloudflare';
import { prisma } from '../../../../lib/prisma';

export async function onRequestPost({ request }: any) {
    const body = await request.json();
    const { drillId, selectedCondition, targetCondition, timeSpentMs } = body;

    const attempt = await prisma.contrastiveDrillAttempt.findUnique({ where: { id: drillId } });
    if (!attempt) return json({ error: 'Drill attempt not found' }, { status: 404 });

    const isCorrect = selectedCondition === targetCondition;

    // Update attempt stats
    await prisma.contrastiveDrillAttempt.update({
        where: { id: drillId },
        data: {
            questionsAsked: { increment: 1 },
            correctAnswers: { increment: isCorrect ? 1 : 0 },
            conditionsMissed: isCorrect ? undefined : { push: targetCondition }, // Track what they missed
            timeSpentMs: { increment: timeSpentMs || 0 }
        }
    });

    // Get comparisons
    // We need the set to get distinguishers
    const set = await prisma.contrastiveSet.findUnique({ where: { id: attempt.setId } });
    const distinguishers = set?.distinguishers as Record<string, string[]> || {};

    // simple comparison table logic
    const comparisonTable: Record<string, { differs: string }> = {};
    if (set) {
        // Logic to show why the selected (if wrong) was wrong vs target
        // This is simplified.
    }

    return json({
        isCorrect,
        correctCondition: targetCondition,
        distinguishers: distinguishers[targetCondition] || [],
        comparisonTable
    });
}
