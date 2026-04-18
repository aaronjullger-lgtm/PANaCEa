// functions/api/admin/generate-question.ts
// Taxonomy‑driven question generation endpoint

import { z } from 'zod';
import { adminAuthenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';
import { generateSingleQuestion, type ConditionData } from '../_shared/question-generator';
import { toGatewayContext } from '../../../lib/ai/aiGateway';

const GenerateQuestionSchema = z.object({
  taxonomyCode: z.string().min(2).max(10),
  subcategory: z.string().optional(),
  type: z.enum(['mcq', 'vignette', 'contrastive', 'simple']).default('vignette'),
  count: z.number().int().min(1).max(10).default(1),
});

export const onRequestOptions = withCors();

/**
 * POST /api/admin/generate-question
 * Generate one or more PANCE‑style questions based on taxonomy and subcategory.
 */
export const onRequestPost = adminAuthenticatedEndpoint(
  z.object({
    body: GenerateQuestionSchema,
  }),
  async (context) => {
    const { env, auth, validated } = context;
    const { body } = validated;
    const logger = createEndpointLogger('/api/admin/generate-question');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      // Check admin role
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { role: true, id: true },
      });

      if (user?.role !== 'ADMIN' && user?.role !== 'SUPERADMIN') {
        logger.warn('Non‑admin attempted to generate questions', {
          userId: auth.userId,
          role: user?.role,
        });
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Look up taxonomy
      const taxonomy = await prisma.medicalTaxonomy.findUnique({
        where: { code: body.taxonomyCode },
      });

      if (!taxonomy) {
        return new Response(
          JSON.stringify({ error: `Taxonomy code "${body.taxonomyCode}" not found` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Determine subcategory (if not provided, pick a random one from SystemMapping)
      let subcategory = body.subcategory;
      if (!subcategory) {
        const randomMapping = await prisma.systemMapping.findFirst({
          where: { taxonomyCode: body.taxonomyCode },
          select: { subcategory: true },
        });
        if (randomMapping) {
          subcategory = randomMapping.subcategory;
        } else {
          // Fallback to taxonomy name as subcategory
          subcategory = taxonomy.name;
        }
      }

      // Look for a MedicalContent record that matches the system/subcategory
      // to get richer condition data for generation.
      const conditionRecord = await prisma.medicalContent.findFirst({
        where: {
          system: body.taxonomyCode,
          subcategory: subcategory,
          status: 'published',
        },
        select: {
          condition: true,
          overview: true,
          etiology: true,
          symptoms: true,
          diagnostics: true,
          treatment: true,
        },
      });

      const conditionData: ConditionData = {
        condition: conditionRecord?.condition ?? subcategory,
        sections: {
          overview: conditionRecord?.overview ?? '',
          etiology: conditionRecord?.etiology ?? '',
          clinicalPresentation: conditionRecord?.symptoms ?? '',
          diagnostics: conditionRecord?.diagnostics ?? '',
          treatment: conditionRecord?.treatment ?? '',
        },
      };

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.error('GEMINI_API_KEY missing in environment');
        return new Response(
          JSON.stringify({ error: 'Content generation service unavailable' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const generatedQuestions = [];
      for (let i = 0; i < body.count; i++) {
        const question = await generateSingleQuestion(
          toGatewayContext(context),
          conditionData,
          body.type
        );
        if (question) {
          // Enrich with taxonomy metadata
          question.system = body.taxonomyCode;
          question.metadata = {
            taxonomyCode: body.taxonomyCode,
            subcategory,
            generatedAt: new Date().toISOString(),
            generatorUserId: auth.userId,
          };
          generatedQuestions.push(question);
        }
      }

      if (generatedQuestions.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Failed to generate any questions' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      logger.info('Questions generated', {
        count: generatedQuestions.length,
        taxonomyCode: body.taxonomyCode,
        subcategory,
        userId: auth.userId,
      });

      auditLog('admin_generate_question', {
        userId: auth.userId,
        taxonomyCode: body.taxonomyCode,
        subcategory,
        count: generatedQuestions.length,
        type: body.type,
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            questions: generatedQuestions,
            taxonomy: {
              code: taxonomy.code,
              name: taxonomy.name,
              weight: taxonomy.weight,
            },
            subcategory,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      logger.error('Failed to generate questions', { error, userId: auth.userId });
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
