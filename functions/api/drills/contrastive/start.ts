
import { json } from '@remix-run/cloudflare';
import { prisma } from '../../../../lib/prisma';

export async function onRequestPost({ request }: any) {
    const body = await request.json();
    const { setId, symptom, userId } = body; // Assuming userId is passed or retrieved from context

    if (!userId) {
        return json({ error: 'User ID is required' }, { status: 400 });
    }

    let set;
    if (setId) {
        set = await prisma.contrastiveSet.findUnique({ where: { id: setId } });
    } else if (symptom) {
        set = await prisma.contrastiveSet.findFirst({ where: { symptom } });
    }

    if (!set) {
        return json({ error: 'Set not found' }, { status: 404 });
    }

    // Create an attempt record
    const attempt = await prisma.contrastiveDrillAttempt.create({
        data: {
            userId,
            setId: set.id,
            questionsAsked: 0,
            correctAnswers: 0,
            conditionsMissed: [],
        },
    });

    // We don't pre-generate questions in the DB, we will generate them on demand or return the structure.
    // The frontend needs to know which conditions are in the set to ask for questions.

    return json({
        drillId: attempt.id,
        set,
        // Return empty questions array, client will request generation
        questions: []
    });
}
