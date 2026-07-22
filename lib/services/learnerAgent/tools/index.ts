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
  recordAttempt,
  assertSessionOwnedByUser,
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
  category: 'compute',
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

export const recordAttemptTool = defineTool({
  name: 'record_attempt',
  description:
    'Record a question attempt through the canonical drill review pipeline (FSRS, ReviewLog, telemetry). Requires idempotency_key.',
  inputSchema: z.object({
    question_id: z.string().min(1).max(128),
    selected_answer: z.union([z.string(), z.number()]),
    time_spent_ms: z.number().int().min(0).max(3_600_000),
    idempotency_key: z.string().min(8).max(128),
    study_session_id: z.string().min(1).max(128).optional(),
    session_type: z.enum(['main', 'drill', 'targeted', 'cram', 'rapid_recall']).optional(),
  }),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      question_id: { type: 'string' },
      selected_answer: { type: 'string' },
      time_spent_ms: { type: 'integer' },
      idempotency_key: { type: 'string' },
      study_session_id: { type: 'string' },
      session_type: { type: 'string' },
    },
    required: ['question_id', 'selected_answer', 'time_spent_ms', 'idempotency_key'],
  },
  category: 'canonical_write',
  costHint: 'expensive',
  timeoutMs: 12_000,
  execute: async (input, ctx) => {
    const prisma = requirePrisma(ctx);
    if (input.study_session_id) {
      await assertSessionOwnedByUser(prisma, ctx.userId, input.study_session_id);
    }
    return recordAttempt(prisma, ctx.userId, {
      questionId: input.question_id,
      selectedAnswer: input.selected_answer,
      timeSpentMs: input.time_spent_ms,
      idempotencyKey: input.idempotency_key,
      studySessionId: input.study_session_id,
      sessionType: input.session_type,
      telemetry: { learner_agent_tool: true },
    });
  },
});

export const completeStudySessionTool = defineTool({
  name: 'complete_study_session',
  description:
    'Complete a study session. Stats are aggregated from canonical QuestionAttempt rows when available.',
  inputSchema: z.object({
    session_id: z.string().min(1).max(128),
  }),
  parametersJsonSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
    },
    required: ['session_id'],
  },
  category: 'write',
  costHint: 'medium',
  timeoutMs: 8000,
  execute: async (input, ctx) => {
    const prisma = requirePrisma(ctx);
    return completeStudySession(prisma, ctx.userId, {
      sessionId: input.session_id,
      questionsAnswered: 0,
      accuracy: 0,
      durationMinutes: 0,
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
  'record_attempt',
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
    recordAttemptTool,
    completeStudySessionTool,
  ]);
}
