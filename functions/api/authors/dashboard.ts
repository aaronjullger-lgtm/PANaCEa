import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

/**
 * GET /api/authors/me/dashboard
 * Get author's dashboard with metrics and pending submissions
 *
 * Returns:
 * - Questions created/approved/active statistics
 * - Average content health score
 * - Approval rate
 * - Recent submissions and their status
 * - Impact metrics (users studied, accuracy, exam correlation)
 * - Suggested content gaps to fill
 */
export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  z.object({}).passthrough(),
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const clerkId = context.auth.userId;

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId },
        select: { id: true },
      });
      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      // Get or create author profile
      let author = await prisma.contentAuthor.findUnique({
        where: { userId: user.id },
      });

      if (!author) {
        author = await prisma.contentAuthor.create({
          data: {
            userId: user.id,
            role: 'CONTRIBUTOR',
          },
        });
      }
      // Get submission stats
      const submissions = await prisma.questionSubmission.findMany({
        where: { contentAuthorId: author.id },
        select: {
          id: true,
          status: true,
          system: true,
          createdAt: true,
          approvedAt: true,
          question: true,
          reviewComments: true,
        },
      });

      const byStatus = {
        submitted: submissions.filter(s => s.status === 'submitted').length,
        inReview: submissions.filter(s => s.status === 'in-review').length,
        approved: submissions.filter(s => s.status === 'approved').length,
        rejected: submissions.filter(s => s.status === 'rejected').length,
        published: submissions.filter(s => s.status === 'published').length,
      };

      const approvalRate = submissions.length > 0
        ? ((byStatus.approved + byStatus.published) / submissions.length) * 100
        : 0;
      // Get published questions for this author
      const publishedQuestions = await prisma.question.findMany({
        where: {
          createdAt: {
            gte: author.createdAt,
          },
        },
        select: {
          id: true,
          contentHealthScore: true,
          qaStatus: true,
          lifecycleStatus: true,
          system: true,
        },
        take: 100,
      });

      // Calculate health metrics
      const healthScores = publishedQuestions
        .map(q => q.contentHealthScore || 0)
        .filter(score => score > 0);

      const avgHealthScore = healthScores.length > 0
        ? healthScores.reduce((a, b) => a + b) / healthScores.length
        : null;
      // Get recent high-impact submissions
      const recentSubmissions = submissions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map(s => ({
          id: s.id,
          title: s.question.substring(0, 80),
          system: s.system,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          approvedAt: s.approvedAt ? s.approvedAt.toISOString() : null,
          reviewComments: s.reviewComments || null,
        }));

      // Analyze content gaps
      const allSystems = await prisma.condition.findMany({
        distinct: ['system'],
        select: { system: true },
      });
      const gapAnalysis = await Promise.all(
        allSystems.map(async s => {
          const authorQuestions = publishedQuestions.filter(q => q.system === s.system).length;
          const totalQuestions = await prisma.question.count({
            where: {
              system: s.system,
              lifecycleStatus: 'ACTIVE',
              qaStatus: 'APPROVED',
            },
          });

          const target = await prisma.examBlueprintSystem.findUnique({
            where: {
              examType_system: {
                examType: 'PANCE',
                system: s.system,
              },
            },
          });

          const targetPercentage = target?.targetPercent || 10;
          const currentPercentage = totalQuestions > 0 ? (authorQuestions / totalQuestions) * 100 : 0;

          return {
            system: s.system,
            contributedQuestions: authorQuestions,
            gap: targetPercentage - currentPercentage,
            suggestionLevel: targetPercentage - currentPercentage > 5 ? 'critical' : targetPercentage - currentPercentage > 2 ? 'high' : 'medium',
          };
        })
      );
      // Filter to critical gaps
      const suggestedGaps = gapAnalysis
        .filter(g => g.gap > 2)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 5);

      return {
        status: 200,
        data: {
          author: {
            id: author.id,
            role: author.role,
            specialty: author.specialty,
            institution: author.institution,
            bio: author.bio,
          },

          statistics: {
            questionsCreated: author.questionsCreated,
            questionsApproved: author.questionsApproved,
            questionsActive: publishedQuestions.filter(
              q => q.lifecycleStatus === 'ACTIVE' && q.qaStatus === 'APPROVED'
            ).length,
            averageHealthScore: avgHealthScore ? parseFloat(avgHealthScore.toFixed(2)) : null,
            approvalRate: parseFloat(approvalRate.toFixed(1)),
            questionsDemoted: author.questionsDemoted,
          },
          submissions: {
            recent: recentSubmissions,
            byStatus,
            pendingReview: byStatus.submitted + byStatus.inReview,
            rejectionRate: submissions.length > 0 ? (byStatus.rejected / submissions.length) * 100 : 0,
          },

          impact: {
            usersStudied: null,
            averageAccuracyOnYourQuestions: null,
            correlationWithExamSuccess: null,
            source: 'not_available',
          },

          suggestedGaps,

          metadata: {
            memberSince: author.createdAt.toISOString(),
            lastSubmission: recentSubmissions[0]?.createdAt || null,
            nextReviewDeadline: null,
          },
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 30 }
);
