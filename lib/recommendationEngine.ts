
export interface RecommendationContext {
    userId: string;
}

// Accept prisma client as an argument for Edge compatibility
// (We use 'any' for the client type to avoid deep import issues with @prisma/client vs edge client)
export async function generateRecommendations(userId: string, prisma: any) {
    const recommendations = [];

    // 1. Analyze Weak Areas (UserTopicProgress)
    // Look for topics with low stability or in 'Relearning' state (3)
    const weakTopics = await prisma.userTopicProgress.findMany({
        where: {
            userId,
            OR: [
                { stability: { lt: 0.6 } }, // Low stability
                { state: 3 } // Relearning
            ]
        },
        take: 3,
        orderBy: { stability: 'asc' }
    });

    for (const topic of weakTopics) {
        // Resolve condition name
        const content = await prisma.medicalContent.findUnique({
            where: { id: topic.conditionId },
            select: { condition: true }
        });

        const conditionName = content?.condition || "Unknown Condition";

        recommendations.push({
            userId,
            type: 'review',
            topic: conditionName,
            reason: 'Low stability detected',
            priority: 'high',
            status: 'pending',
            data: { conditionId: topic.conditionId, taskType: topic.taskType }
        });
    }

    // 2. Analyze SRS Due Items
    const dueItems = await prisma.userTopicProgress.findMany({
        where: {
            userId,
            nextReviewDate: { lte: new Date() }
        },
        take: 5
    });

    if (dueItems.length > 0) {
        recommendations.push({
            userId,
            type: 'drill_session',
            topic: 'Spaced Repetition Review',
            reason: `${dueItems.length} items due for review`,
            priority: 'medium',
            status: 'pending',
            data: { count: dueItems.length }
        });
    }

    // 3. Save Recommendations to Database
    const existingRecs = await prisma.studyRecommendation.findMany({
        where: {
            userId,
            status: 'pending'
        }
    });

    const uniqueRecs = recommendations.filter(newRec =>
        !existingRecs.some((existing: any) =>
            existing.topic === newRec.topic &&
            existing.type === newRec.type
        )
    );

    if (uniqueRecs.length > 0) {
        await prisma.studyRecommendation.createMany({
            data: uniqueRecs
        });
    }

    return uniqueRecs;
}
