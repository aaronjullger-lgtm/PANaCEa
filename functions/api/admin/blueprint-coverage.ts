/**
 * API: Blueprint Coverage Analysis
 *
 * GET  /api/admin/blueprint-coverage          — list available exam types
 * GET  /api/admin/blueprint-coverage/:examType — analyze coverage for an exam
 * POST /api/admin/blueprint-coverage/:examType/targets — set blueprint targets
 *
 * All endpoints require admin role via adminEndpoint middleware.
 */

import { z } from 'zod';
import { adminEndpoint, withCors } from '../_shared/middleware';
import {
  analyzeBlueprintCoverage,
  getAvailableExamTypes,
  setBlueprintTargets,
} from '../_shared/blueprintCoverageService';
import { createEndpointLogger } from '../_shared/secureLogger';
import { auditLog } from '../_shared/auditLog';

const logger = createEndpointLogger('/api/admin/blueprint-coverage');

// Schemas
const GetExamTypeSchema = z.object({
  params: z.object({ examType: z.string().min(1) }).optional(),
});

const ListSchema = z.object({});

const SetTargetsSchema = z.object({
  params: z.object({ examType: z.string().min(1) }).optional(),
  body: z.object({
    targets: z.record(z.string(), z.number().min(0).max(1)),
  }),
});

export const onRequestOptions = withCors();

/**
 * GET /api/admin/blueprint-coverage
 * List available exam types
 */
export const onRequest = adminEndpoint(ListSchema, async () => {
  const examTypes = await getAvailableExamTypes();
  return { data: { examTypes } };
});

/**
 * GET /api/admin/blueprint-coverage/:examType
 * Analyze blueprint coverage for a specific exam
 */
export const onRequestGet = adminEndpoint(GetExamTypeSchema, async (context) => {
  // @ts-expect-error — Cloudflare Pages Function provides params via filesystem routing
  const examType = (context.params?.examType ?? '').toString().toUpperCase();

  if (!examType) {
    return { status: 400, data: { error: 'examType path parameter is required' } };
  }

  const analysis = await analyzeBlueprintCoverage(examType);
  logger.info('Blueprint coverage analyzed', { examType, totalQuestions: analysis.totalQuestions });
  return { data: analysis };
});

/**
 * POST /api/admin/blueprint-coverage/:examType/targets
 * Set blueprint targets for an exam type
 */
export const onRequestPost = adminEndpoint(SetTargetsSchema, async (context) => {
  const { validated } = context;
  // @ts-expect-error — Cloudflare Pages Function provides params via filesystem routing
  const examType = (context.params?.examType ?? '').toString().toUpperCase();
  const targets = (validated as any).body?.targets ?? (validated as any).targets ?? {};

  if (!examType) {
    return { status: 400, data: { error: 'examType path parameter is required' } };
  }

  await setBlueprintTargets(examType, targets);
  logger.info('Blueprint targets updated', { examType, targetCount: Object.keys(targets).length });
  auditLog('admin_blueprint_set_targets', {
    userId: (context as any).auth?.userId,
    examType,
    targetCount: Object.keys(targets).length,
  });

  return {
    data: { success: true, examType, targetCount: Object.keys(targets).length },
  };
});
