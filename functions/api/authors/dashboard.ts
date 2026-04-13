import {
  withMiddleware,
  withCors,
  withErrorHandling,
  withEnvCheck,
  withAuth,
  withRateLimit,
  withLogging,
  type AuthenticatedContext,
} from '../_shared/middleware';
import { prisma } from '../_shared/prisma-edge';

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
 */export const onRequestGet = withMiddleware(
  withCors(),
  withErrorHandling(),
  withEnvCheck(['DATABASE_URL', 'CLERK_SECRET_KEY']),
  withAuth(),
  withRateLimit({ requestsPerMinute: 30, endpointType: 'api', keyPrefix: 'author-dashboard' }),
  withLogging(),
  async (context: AuthenticatedContext) => {
    const clerkId = context.auth.userId;

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