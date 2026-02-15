/**
 * POST /api/admin/refinery/action
 *
 * Apply approve/reject action to a single refinery item (content draft, media, or staging question).
 * Security: Require approver or admin role.
 *
 * Body: { type, id, action, reason? }
 * For media approve: optional isClassicPortrayal, modality, correctDiagnosis, conditionId, licenseType.
 * On media approve: updates MediaAsset, copies file from raw-source-vault → public-assets, sets approvalStatus = 'approved'.
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import {
  refineryEndpoint,
  type AuthenticatedContext,
  type ValidatedContext,
} from '../../_shared/refineryMiddleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  type EdgePrismaClient,
} from '../../_shared/prisma-edge';
import { promoteToLive, discardStagingQuestion } from '../../_shared/staging-questions';

const RAW_VAULT_BUCKET = 'raw-source-vault';
const PUBLIC_ASSETS_BUCKET = 'public-assets';

const ActionBodySchema = z.object({
  type: z.enum(['content', 'media', 'question']),
  id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
  isClassicPortrayal: z.boolean().optional(),
  modality: z.string().max(64).optional(),
  correctDiagnosis: z.string().max(500).optional(),
  conditionId: z.string().min(1).optional(),
  licenseType: z.string().max(64).optional(),
});
type ActionBody = z.infer<typeof ActionBodySchema>;

interface RefineryEnv {
  DATABASE_URL: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

type ActionResult =
  | { data: { success: true; message: string } }
  | { status: number; error: string };

function buildMediaApproveUpdate(
  _media: { rawStoragePath: string | null },
  userId: string,
  payload?: {
    isClassicPortrayal?: boolean;
    modality?: string;
    correctDiagnosis?: string;
    conditionId?: string;
    licenseType?: string;
  }
): Record<string, unknown> {
  const now = new Date();
  const data: Record<string, unknown> = {
    approvalStatus: 'approved',
    approvedAt: now,
    approvedBy: userId,
    rejectionReason: null,
    updatedAt: now,
    provenanceStatus: 'verified',
  };
  if (payload?.isClassicPortrayal !== undefined)
    data.isClassicPortrayal = payload.isClassicPortrayal;
  if (payload?.modality != null) data.modality = payload.modality;
  if (payload?.correctDiagnosis != null) data.correctDiagnosis = payload.correctDiagnosis;
  if (payload?.conditionId != null) data.conditionId = payload.conditionId;
  if (payload?.licenseType != null) data.licenseType = payload.licenseType;
  return data;
}

async function copyRawToPublic(
  env: RefineryEnv,
  rawPath: string
): Promise<{ error?: ActionResult }> {
  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.storage
    .from(RAW_VAULT_BUCKET)
    .copy(rawPath, rawPath, { destinationBucket: PUBLIC_ASSETS_BUCKET });
  if (error) {
    console.error('Refinery media copy failed:', error);
    return { error: { status: 502, error: `Storage copy failed: ${error.message}` } };
  }
  return {};
}

async function applyContentAction(
  prisma: EdgePrismaClient,
  id: string,
  action: 'approve' | 'reject',
  userId: string
): Promise<ActionResult> {
  const content = await prisma.medicalContent.findUnique({ where: { id } });
  if (!content) return { status: 404, error: 'Content not found' };

  if (action === 'approve') {
    const contentJson = (content.content as Record<string, unknown>) ?? {};
    const existingRefinery =
      typeof contentJson._refinery === 'object' && contentJson._refinery !== null
        ? (contentJson._refinery as Record<string, unknown>)
        : {};
    const refinery = { ...existingRefinery, needsHumanReview: false };
    await prisma.medicalContent.update({
      where: { id },
      data: {
        status: 'published',
        content: { ...contentJson, _refinery: refinery },
        updatedAt: new Date(),
        updatedBy: userId,
      },
    });
    return { data: { success: true, message: 'Content published' } };
  }

  await prisma.medicalContent.update({
    where: { id },
    data: { status: 'archived', updatedAt: new Date(), updatedBy: userId },
  });
  return { data: { success: true, message: 'Content archived' } };
}

async function applyMediaAction(
  prisma: EdgePrismaClient,
  id: string,
  action: 'approve' | 'reject',
  userId: string,
  env: RefineryEnv,
  reason?: string,
  payload?: {
    isClassicPortrayal?: boolean;
    modality?: string;
    correctDiagnosis?: string;
    conditionId?: string;
    licenseType?: string;
  }
): Promise<ActionResult> {
  const media = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!media) return { status: 404, error: 'Media not found' };

  if (action === 'approve') {
    const updateData = buildMediaApproveUpdate(media, userId, payload);
    if (media.rawStoragePath && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      const copyResult = await copyRawToPublic(env, media.rawStoragePath);
      if (copyResult.error) return copyResult;
      updateData.storagePath = media.rawStoragePath;
    }
    await prisma.mediaAsset.update({
      where: { id },
      data: updateData as any,
    });
    return { data: { success: true, message: 'Media approved' } };
  }

  await prisma.mediaAsset.update({
    where: { id },
    data: {
      approvalStatus: 'rejected',
      rejectionReason: reason ?? 'Rejected from refinery',
    },
  });
  return { data: { success: true, message: 'Media rejected' } };
}

async function applyQuestionAction(
  prisma: EdgePrismaClient,
  id: string,
  action: 'approve' | 'reject'
): Promise<ActionResult> {
  const staging = await prisma.stagingQuestion.findUnique({ where: { id } });
  if (!staging) return { status: 404, error: 'Staging question not found' };

  if (action === 'approve') {
    if (staging.status === 'graded') {
      await promoteToLive(prisma, id);
    } else {
      await prisma.preGeneratedQuestion.create({
        data: {
          id: crypto.randomUUID(),
          questionType: 'mcq',
          system: staging.system,
          conditionId: null,
          difficulty: staging.difficulty,
          questionData: {
            vignette: staging.vignette,
            question: staging.question,
            options: staging.options,
            correctAnswer: staging.correctAnswer,
            explanation: staging.explanation,
            tags: staging.tags,
          },
          quality: 10,
        },
      });
    }
    await prisma.stagingQuestion.delete({ where: { id } });
    return { data: { success: true, message: 'Question approved and moved to live pool' } };
  }

  await discardStagingQuestion(prisma, id);
  return { data: { success: true, message: 'Question rejected' } };
}

export const onRequestOptions = async (context: { request: Request; env: unknown }) => {
  const { handleCorsPreflightSecure } = await import('../../_shared/cors');
  return handleCorsPreflightSecure(context.request, context.env as any);
};

export const onRequestPost = refineryEndpoint(
  ActionBodySchema,
  async (context: AuthenticatedContext & ValidatedContext<ActionBody>) => {
    const { env, validated } = context;
    const { type, id, action } = validated;
    const userId = context.auth.userId;
    let prisma: EdgePrismaClient | null = null;

    try {
      prisma = createEdgePrismaClient(env.DATABASE_URL);

      if (type === 'content') {
        return await applyContentAction(prisma, id, action, userId);
      }
      if (type === 'media') {
        const payload =
          validated.action === 'approve'
            ? {
                isClassicPortrayal: validated.isClassicPortrayal,
                modality: validated.modality,
                correctDiagnosis: validated.correctDiagnosis,
                conditionId: validated.conditionId,
                licenseType: validated.licenseType,
              }
            : undefined;
        return await applyMediaAction(
          prisma,
          id,
          action,
          userId,
          env as RefineryEnv,
          validated.reason,
          payload
        );
      }
      if (type === 'question') {
        return await applyQuestionAction(prisma, id, action);
      }

      return { status: 400, error: 'Invalid type' };
    } catch (error) {
      console.error('Refinery action error:', error);
      return { status: 500, error: 'Failed to apply action' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
