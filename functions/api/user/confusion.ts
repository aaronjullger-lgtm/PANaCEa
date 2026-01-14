/**
 * User Confusion Tracking API
 *
 * POST /api/user/confusion    - Upsert a confusion pair when a user answers incorrectly
 * GET  /api/user/confusions   - Fetch a user's top confusion pairs
 */

import { authenticateRequest } from '../_shared/auth';
import { createEdgePrismaClient } from '../_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
}

interface ConfusionBody {
  correctConditionId?: string;
  selectedConditionId?: string;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const onRequestOptions = () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });

/**
 * Upsert a confusion pair for the authenticated user
 */
export async function onRequestPost(context: { request: Request; env: Env }) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const { request, env } = context;
    const auth = await authenticateRequest(request, env);
    if (!auth?.userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let payload: ConfusionBody;
    try {
      payload = await request.json();
    } catch (error) {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const { correctConditionId, selectedConditionId } = payload;
    if (!correctConditionId || !selectedConditionId) {
      return jsonResponse({ error: 'correctConditionId and selectedConditionId are required' }, 400);
    }
    if (correctConditionId === selectedConditionId) {
      return jsonResponse({ error: 'correctConditionId and selectedConditionId must differ' }, 400);
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Fetch condition metadata for compatibility fields
    const [correctContent, selectedContent] = await Promise.all([
      prisma.medicalContent.findUnique({
        where: { id: correctConditionId },
        select: { id: true, condition: true, conditionId: true },
      }),
      prisma.medicalContent.findUnique({
        where: { id: selectedConditionId },
        select: { id: true, condition: true, conditionId: true },
      }),
    ]);

    if (!correctContent || !selectedContent) {
      return jsonResponse({ error: 'One or more condition IDs are invalid' }, 404);
    }

    const pair = await prisma.confusionPair.upsert({
      where: {
        userId_correctConditionId_selectedConditionId: {
          userId: auth.userId,
          correctConditionId,
          selectedConditionId,
        },
      },
      create: {
        userId: auth.userId,
        correctConditionId,
        selectedConditionId,
        realCondition: correctContent.condition,
        mistakenFor: selectedContent.condition,
        realConditionId: correctContent.conditionId,
        mistakenForId: selectedContent.conditionId,
      },
      update: {
        count: { increment: 1 },
        realCondition: correctContent.condition,
        mistakenFor: selectedContent.condition,
        realConditionId: correctContent.conditionId,
        mistakenForId: selectedContent.conditionId,
      },
      include: {
        CorrectCondition: { select: { id: true, condition: true, system: true } },
        SelectedCondition: { select: { id: true, condition: true, system: true } },
      },
    });

    return jsonResponse({ success: true, pair });
  } catch (error) {
    console.error('Error tracking confusion:', error);
    return jsonResponse({ error: 'Failed to track confusion' }, 500);
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

/**
 * Fetch top confusion pairs for the authenticated user
 */
export async function onRequestGet(context: { request: Request; env: Env }) {
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const { request, env } = context;
    const auth = await authenticateRequest(request, env);
    if (!auth?.userId) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 25);

    prisma = createEdgePrismaClient(env.DATABASE_URL);

    const pairs = await prisma.confusionPair.findMany({
      where: { userId: auth.userId },
      include: {
        CorrectCondition: { select: { id: true, condition: true, system: true } },
        SelectedCondition: { select: { id: true, condition: true, system: true } },
      },
      orderBy: [
        { count: 'desc' },
        { lastOccurrence: 'desc' },
      ],
      take: limit,
    });

    const payload = pairs.map((pair) => ({
      id: pair.id,
      count: pair.count,
      correctConditionId: pair.correctConditionId ?? pair.CorrectCondition?.id ?? null,
      selectedConditionId: pair.selectedConditionId ?? pair.SelectedCondition?.id ?? null,
      correctCondition: pair.CorrectCondition?.condition ?? pair.realCondition,
      selectedCondition: pair.SelectedCondition?.condition ?? pair.mistakenFor,
      correctSystem: pair.CorrectCondition?.system ?? null,
      selectedSystem: pair.SelectedCondition?.system ?? null,
      lastOccurred: pair.lastOccurrence,
    }));

    return jsonResponse({
      success: true,
      pairs: payload,
      total: payload.length,
    });
  } catch (error) {
    console.error('Error fetching confusion pairs:', error);
    return jsonResponse({ error: 'Failed to fetch confusion pairs' }, 500);
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}
