/**
 * Cloudflare Function: Get Contrastive Drill Batch
 * 
 * Returns a batch of DDx comparison questions from ContrastiveSet table
 * 
 * Endpoint: GET /api/drill/contrastive-batch
 * Query Params:
 * - system: Optional organ system filter
 * - difficulty: Optional difficulty filter
 * - count: Number of questions (default 10)
 * - personalized: Use user's confusion pairs (default false)
 * 
 * @module functions/api/drill/contrastive-batch
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { getContrastiveDrillBatch } from '../../../services/drill/contrastiveDrill.service';

export async function onRequestGet(context: any) {
  const { request, env } = context;

  try {
    // Authenticate
    const userId = await authenticateRequest(context);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse query params
    const url = new URL(request.url);
    const system = url.searchParams.get('system');
    const difficulty = url.searchParams.get('difficulty');
    const count = parseInt(url.searchParams.get('count') || '10', 10);
    const personalized = url.searchParams.get('personalized') === 'true';

    // Validate count
    if (count < 1 || count > 50) {
      return new Response(
        JSON.stringify({ error: 'Count must be between 1 and 50' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get drill batch
    const questions = await getContrastiveDrillBatch({
      userId: personalized ? userId : undefined,
      system: system || undefined,
      difficulty: difficulty as any,
      count,
    });

    return new Response(
      JSON.stringify(questions),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching contrastive drill batch:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch contrastive drill batch',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
