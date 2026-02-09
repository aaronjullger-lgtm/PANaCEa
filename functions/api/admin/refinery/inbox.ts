/**
 * GET /api/admin/refinery/inbox
 *
 * Unified Refinery inbox: pending content drafts, media, and staging questions.
 * Security: Require approver or admin role.
 * Response: List of RefineryItem sorted by date (oldest first).
 */

import { z } from 'zod';
import {
  refineryEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../../_shared/prisma-edge';

const InboxQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});
type InboxQuery = z.infer<typeof InboxQuerySchema>;

type RefineryItem =
  | {
      type: 'content';
      id: string;
      timestamp: Date;
      data: Record<string, unknown> & { SourceMaterial?: Record<string, unknown> | null };
    }
  | { type: 'media'; id: string; timestamp: Date; data: Record<string, unknown> }
  | { type: 'question'; id: string; timestamp: Date; data: Record<string, unknown> };

function toItem(
  type: 'content' | 'media' | 'question',
  id: string,
  timestamp: Date,
  data: Record<string, unknown>
): RefineryItem {
  return { type, id, timestamp, data };
}

export const onRequestOptions = async (context: { request: Request; env: unknown }) => {
  const { handleCorsPreflightSecure } = await import('../../_shared/cors');
  return handleCorsPreflightSecure(context.request, context.env as any);
};

export const onRequestGet = refineryEndpoint(
  InboxQuerySchema,
  async (context: AuthenticatedContext & ValidatedContext<InboxQuery>) => {
    const { env, validated } = context;
    const limit = Math.min(validated.limit ?? 100, 200);
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);
      const items: RefineryItem[] = [];

      // 1) Content drafts: MedicalContent where status is 'draft' (or needsHumanReview in content JSON)
      const drafts = await prisma.medicalContent.findMany({
        where: {
          OR: [
            { status: 'draft' },
            {
              content: { path: ['_refinery', 'needsHumanReview'], equals: true },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      for (const mc of drafts) {
        const content = mc.content as Record<string, unknown> | null;
        const sourceMaterialId =
          content && typeof content._refinery === 'object' && content._refinery !== null
            ? (content._refinery as Record<string, unknown>).sourceMaterialId
            : undefined;
        let sourceMaterial: Record<string, unknown> | null = null;
        if (typeof sourceMaterialId === 'string') {
          const sm = await prisma.sourceMaterial.findUnique({
            where: { id: sourceMaterialId },
          });
          if (sm) sourceMaterial = sm as unknown as Record<string, unknown>;
        }
        const data = { ...mc, SourceMaterial: sourceMaterial } as Record<string, unknown> & {
          SourceMaterial?: Record<string, unknown> | null;
        };
        items.push(toItem('content', mc.id, mc.createdAt, data));
      }

      // 2) Media: MediaAsset where approvalStatus is 'pending'
      const pendingMedia = await prisma.mediaAsset.findMany({
        where: { approvalStatus: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: limit,
        include: { SourceMaterial: true },
      });

      for (const m of pendingMedia) {
        const data = {
          ...m,
          SourceMaterial: m.SourceMaterial ?? undefined,
        } as unknown as Record<string, unknown>;
        items.push(toItem('media', m.id, m.createdAt, data));
      }

      // 3) Staging questions: StagingQuestion where status is 'pending'
      const pendingQuestions = await prisma.stagingQuestion.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      for (const q of pendingQuestions) {
        const data = q as unknown as Record<string, unknown>;
        items.push(toItem('question', q.id, q.createdAt, data));
      }

      // Sort unified list by timestamp (oldest first)
      items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return {
        data: {
          items: items.slice(0, limit),
          total: items.length,
        },
      };
    } catch (error) {
      console.error('Refinery inbox error:', error);
      return { status: 500, error: 'Failed to fetch refinery inbox' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query' }
);
