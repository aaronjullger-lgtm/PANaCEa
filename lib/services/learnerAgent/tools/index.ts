/**
 * Learner Agent tools — typed wrappers over deterministic learner services.
 */

import { z } from 'zod';
import { defineTool, ToolRegistry } from '@/lib/services/agents/toolRegistry';
import type { ToolExecutionContext } from '@/lib/services/agents/types';
import {
  getLearnerContext,
  getDueLearningItems,
  getNextBestAction,
  getUpcomingAssignments,
  getProgressSummary,
  retrieveGroundedContent,
  startStudySession,
  completeStudySession,
} from '@/lib/services/learner';
import type { PrismaClient } from '@prisma/client';

function requirePrisma(ctx: ToolExecutionContext): PrismaClient {
  if (!ctx.prisma) throw new Error('Prisma client required');
  return ctx.prisma as PrismaClient;
}

export const getLearnerContextTool = defineTool({
  name: 'get_learner_context',
  description:
    'Load verified learner profile, rotation, daily allocation, and due counts. Call before recommending anything.',
  inputSchema: z.object({}),
  parametersJsonSchema: { type: 'object', properties: {}, required: [] },
  category: 'read',
  costHint: 'cheap',
  timeoutMs: 6000,
  execute: async (_input, ctx) => {
    const prisma = requirePrisma(ctx);
    return getLearnerContext(prisma, ctx.userId);
  },
});

export const getNextBestActionTool = defineTool({
  name: 'get_next_best_action',
  description:
    'Return the deterministic next-best study action for this learner. You must explain this result — do not invent a different action.',
  inputSchema: z.object({
    available_minutes: z.number().int().min(5).max(240).optional(),
    stated_objective: z.string().max(200).optional(),
  }),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      available_minutes: { type: 'integer', description: 'Minutes available today' },
      stated_objective: { type: 'string', description: 'Learner-stated goal' },
    },
    required: [],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 8000,
  execute: async (input, ctx) => {
    const prisma = requirePrisma(ctx);
    return getNextBestAction(prisma, {
      userId: ctx.userId,
      availableMinutes: input.available_minutes,
      statedObjective: input.stated_objective,
    });
  },
});

export const getDueLearningItemsTool = defineTool({
  name: 'get_due_learning_items',
  description: 'List FSRS-overdue and plan tasks due now. Read-only.',
  inputSchema: z.object({}),
  parametersJsonSchema: { type: 'object', properties: {}, required: [] },
  category: 'read',
  costHint: 'cheap',
  timeoutMs: 6000,
  execute: async (_input, ctx) => {
    const prisma = requirePrisma(ctx);
    return getDueLearningItems(prisma, ctx.userId);
  },
});

export const getUpcomingAssignmentsTool = defineTool({
  name: 'get_upcoming_assignments',
  description: 'List study plan tasks and items with due dates from canonical data only.',
  inputSchema: z.object({
    horizon_days: z.number().int().min(1).max(30).optional(),
  }),
  parametersJsonSchema: {
    type: 'object',
    properties: { horizon_days: { type: 'integer' } },
    required: [],
  },
  category: 'read',
  costHint: 'cheap',
  timeoutMs: 6000,
  execute: async (input, ctx) => {
    const prisma = requirePrisma(ctx);
    return getUpcomingAssignments(prisma, ctx.userId, new Date(), input.horizon_days ?? 7);
  },
});

export const getProgressSummaryTool = defineTool({
  name: 'get_progress_summary',
  description: 'Aggregate progress, due counts, and today plan status.',
  inputSchema: z.object({}),
  parametersJsonSchema: { type: 'object', properties: {}, required: [] },
  category: 'read',
  costHint: 'cheap',
  timeoutMs: 6000,
  execute: async (_input, ctx) => {
    const prisma = requirePrisma(ctx);
    return getProgressSummary(prisma, ctx.userId);
  },
});

export const retrieveGroundedContentTool = defineTool({
  name: 'retrieve_grounded_content',
  description: 'Search approved clinical content for grounded explanations. Cite results.',
  inputSchema: z.object({
    query: z.string().min(1).max(200),
    system: z.string().max(64).optional(),
    condition_id: z.string().max(128).optional(),
  }),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      system: { type: 'string' },
      condition_id: { type: 'string' },
    },
    required: ['query'],
  },
  category: 'read',
  costHint: 'medium',
  timeoutMs: 8000,
  execute: async (input, ctx) => {
    const prisma = requirePrisma(ctx);
    return retrieveGroundedContent(prisma, input.query, {
      system: input.system,
      conditionId: input.condition_id,
    });
  },
});

export const startStudySessionTool = defineTool({
  name: 'start_study_session',
  description: 'Start a learner agent study session with deterministic recommended action. Writes session row only.',
  inputSchema: z.object({
    objective: z.string().min(1).max(300),
  }),
  parametersJsonSchema: {
    type: 'object',
    properties: { objective: { type: 'string' } },
    required: ['objective'],
  },
  category: 'write',
  costHint: 'medium',
  timeoutMs: 8000,
  execute: async (input, ctx) => {
    const prisma = requirePrisma(ctx);
    return startStudySession(prisma, ctx.userId, input.objective);
  },
});

export const completeStudySessionTool = defineTool({
  name: 'complete_study_session',
  description: 'Complete a study session and fetch next deterministic action.',
  inputSchema: z.object({
    session_id: z.string().min(1).max(128),
    questions_answered: z.number().int().min(0).max(500),
    accuracy: z.number().min(0).max(1),
    duration_minutes: z.number().int().min(0).max(24 * 60),
  }),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      questions_answered: { type: 'integer' },
      accuracy: { type: 'number' },
      duration_minutes: { type: 'integer' },
    },
    required: ['session_id', 'questions_answered', 'accuracy', 'duration_minutes'],
  },
  category: 'write',
  costHint: 'medium',
  timeoutMs: 8000,
  execute: async (input, ctx) => {
    const prisma = requirePrisma(ctx);
    return completeStudySession(prisma, ctx.userId, {
      sessionId: input.session_id,
      questionsAnswered: input.questions_answered,
      accuracy: input.accuracy,
      durationMinutes: input.duration_minutes,
    });
  },
});

export const LEARNER_AGENT_TOOL_NAMES = [
  'get_learner_context',
  'get_next_best_action',
  'get_due_learning_items',
  'get_upcoming_assignments',
  'get_progress_summary',
  'retrieve_grounded_content',
  'start_study_session',
  'complete_study_session',
] as const;

export function createLearnerAgentToolRegistry() {
  return new ToolRegistry([
    getLearnerContextTool,
    getNextBestActionTool,
    getDueLearningItemsTool,
    getUpcomingAssignmentsTool,
    getProgressSummaryTool,
    retrieveGroundedContentTool,
    startStudySessionTool,
    completeStudySessionTool,
  ]);
}
