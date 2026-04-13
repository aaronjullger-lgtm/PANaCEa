/**
 * Admin API — A/B Experiment Management
 *
 * GET    /api/admin/ab-experiments          List all experiments
 * GET    /api/admin/ab-experiments/:id       Get single experiment
 * POST   /api/admin/ab-experiments          Create experiment
 * PUT    /api/admin/ab-experiments/:id       Update experiment
 * DELETE /api/admin/ab-experiments/:id       Delete experiment
 * GET    /api/admin/ab-experiments/:id/results  Analysis results
 *
 * All endpoints require admin role.
 */

import { z } from 'zod';
import {
  adminAuthenticatedEndpoint,
  withCors,
} from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';

const logger = createEndpointLogger('/api/admin/ab-experiments');

// ============================================================================
// Schemas
// ============================================================================

const VariantSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0),
  config: z.record(z.unknown()).optional(),
});

const CreateExperimentSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().max(2000).optional(),
    variants: z
      .array(VariantSchema)
      .min(2, 'At least 2 variants required'),
    trafficPercentage: z.number().min(1).max(100).default(100),
    targetLearnerStages: z.array(z.string()).default([]),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

const UpdateExperimentSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: z
      .enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'])
      .optional(),
    variants: z.array(VariantSchema).min(2).optional(),
    trafficPercentage: z.number().min(1).max(100).optional(),
    targetLearnerStages: z.array(z.string()).optional(),
    startDate: z.string().datetime().nullable().optional(),
    endDate: z.string().datetime().nullable().optional(),
  }),
});

const IdParamSchema = z.object({
  params: z.object({ id: z.string() }),
});

const QuerySchema = z.object({
  query: z.object({}).optional(),
});

const ResultsQuerySchema = z.object({
  params: z.object({ id: z.string() }),
  query: z.object({}).optional(),
});

// ============================================================================
// Handlers
// ============================================================================

export const onRequestOptions = withCors();

/**
 * GET: List all experiments (with optional status filter)
 */
export const onRequestGet = adminAuthenticatedEndpoint(
  z.object({
    params: z.object({}).optional(),
    query: z
      .object({
        status: z.string().optional(),
      })
      .optional(),
  }),
  async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const url = new URL(context.request.url);
      const status = url.searchParams.get('status');

      const where: any = {};
      if (status) {
        where.status = status.toUpperCase();
      }

      const experiments = await prisma.aBExperiment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return {
        data: {
          success: true,
          data: experiments,
          count: experiments.length,
        },
      };
    } catch (error) {
      logger.error('Failed to list experiments', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 500, error: 'Failed to list experiments' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * POST: Create a new experiment
 */
export const onRequestPost = adminAuthenticatedEndpoint(
  CreateExperimentSchema,
  async (context) => {
    const { env, auth, validated } = context;
    const { body } = validated as { body: z.infer<typeof CreateExperimentSchema>['body'] };
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const experiment = await prisma.aBExperiment.create({
        data: {
          name: body.name,
          description: body.description,
          variants: body.variants,
          trafficPercentage: body.trafficPercentage,
          targetLearnerStages: body.targetLearnerStages,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
          status: 'DRAFT',
        },
      });

      auditLog('ab_experiment_created', {
        clerkId: auth.userId,
        experimentId: experiment.id,
        experimentName: body.name,
      });

      logger.info('Experiment created', {
        userId: auth.userId,
        experimentId: experiment.id,
        name: body.name,
      });

      return { data: { success: true, data: experiment } };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return { status: 409, error: 'Experiment name already exists' };
      }
      logger.error('Failed to create experiment', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 500, error: 'Failed to create experiment' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * PUT: Update an experiment (requires :id param)
 * Cloudflare Pages Functions don't natively support path params in this way,
 * so the id is read from the URL path.
 */
export const onRequestPut = adminAuthenticatedEndpoint(
  UpdateExperimentSchema,
  async (context) => {
    const { env, auth, validated, request } = context;
    const { params, body } = validated as {
      params: z.infer<typeof UpdateExperimentSchema>['params'];
      body: z.infer<typeof UpdateExperimentSchema>['body'];
    };
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const experimentId = params?.id || new URL(request.url).pathname.split('/').pop();

      if (!experimentId) {
        return { status: 400, error: 'Experiment ID is required' };
      }

      // Build update data
      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.status !== undefined) data.status = body.status;
      if (body.variants !== undefined) data.variants = body.variants;
      if (body.trafficPercentage !== undefined)
        data.trafficPercentage = body.trafficPercentage;
      if (body.targetLearnerStages !== undefined)
        data.targetLearnerStages = body.targetLearnerStages;
      if (body.startDate !== undefined)
        data.startDate = body.startDate ? new Date(body.startDate) : null;
      if (body.endDate !== undefined)
        data.endDate = body.endDate ? new Date(body.endDate) : null;

      const experiment = await prisma.aBExperiment.update({
        where: { id: experimentId },
        data,
      });

      auditLog('ab_experiment_updated', {
        clerkId: auth.userId,
        experimentId,
        fields: Object.keys(data),
      });

      return { data: { success: true, data: experiment } };
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return { status: 404, error: 'Experiment not found' };
      }
      if (error?.code === 'P2002') {
        return { status: 409, error: 'Experiment name already exists' };
      }
      logger.error('Failed to update experiment', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 500, error: 'Failed to update experiment' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

/**
 * DELETE: Delete an experiment (requires :id param)
 */
export const onRequestDelete = adminAuthenticatedEndpoint(
  IdParamSchema,
  async (context) => {
    const { env, auth, validated, request } = context;
    const params = validated as { params: z.infer<typeof IdParamSchema>['params'] };
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const experimentId =
        params?.id || new URL(request.url).pathname.split('/').pop();

      if (!experimentId) {
        return { status: 400, error: 'Experiment ID is required' };
      }

      await prisma.aBExperiment.delete({
        where: { id: experimentId },
      });

      auditLog('ab_experiment_deleted', {
        clerkId: auth.userId,
        experimentId,
      });

      return { data: { success: true, message: 'Experiment deleted' } };
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return { status: 404, error: 'Experiment not found' };
      }
      logger.error('Failed to delete experiment', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { status: 500, error: 'Failed to delete experiment' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
