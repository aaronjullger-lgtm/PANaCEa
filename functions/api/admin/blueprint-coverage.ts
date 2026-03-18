import { Request } from '@cloudflare/workers-types';
import { requireAuth } from '../_shared/auth';
import { errorHandler } from '../_shared/error-handler';
import {
  analyzeBlueprintCoverage,
  getCriticalGapSystems,
  getAvailableExamTypes,
  setBlueprintTargets,
} from '../_shared/blueprintCoverageService';

/**
 * GET /api/admin/blueprint-coverage/:examType
 * Analyze blueprint coverage for a specific exam
 *
 * Query params:
 * - examType: PANCE, PANRE, etc. (required in URL)
 *
 * Response:
 * {
 *   examType: string
 *   totalQuestions: number
 *   totalApproved: number
 *   systemCoverage: [{system, targetPercent, actualPercent, gap, priority}, ...]
 *   gapsByPriority: {critical, high, medium, low}
 * }
 */
export async function onRequestGet(
  request: Request,
  context: { params: { examType: string } }
): Promise<Response> {
  try {
    // Auth optional for now (can be admin-only)
    const user = await requireAuth(request);

    const examType = context.params.examType.toUpperCase();

    const analysis = await analyzeBlueprintCoverage(examType);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return errorHandler(error);
  }
}

/**
 * GET /api/admin/blueprint-coverage
 * List available exam types
 */
export async function onRequest(request: Request): Promise<Response> {
  if (request.method === 'GET' && !request.url.includes('/blueprint-coverage/')) {
    try {
      const examTypes = await getAvailableExamTypes();

      return new Response(JSON.stringify({ examTypes }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return errorHandler(error);
    }
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * POST /api/admin/blueprint-coverage/:examType/targets
 * Set blueprint targets for an exam type
 *
 * Body:
 * {
 *   targets: {
 *     "Cardiology": 0.15,
 *     "Pulmonology": 0.10,
 *     ...
 *   }
 * }
 */
export async function onRequestPost(
  request: Request,
  context: { params: { examType: string } }
): Promise<Response> {
  try {
    await requireAuth(request, 'ADMIN');

    const body = (await request.json()) as { targets: Record<string, number> };
    const examType = context.params.examType.toUpperCase();

    await setBlueprintTargets(examType, body.targets);

    return new Response(
      JSON.stringify({ success: true, examType, targetCount: Object.keys(body.targets).length }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return errorHandler(error);
  }
}
