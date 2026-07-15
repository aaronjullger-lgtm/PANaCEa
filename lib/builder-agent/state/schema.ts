import { z } from 'zod';
import { BUILDER_RUN_STATUSES } from './types';

export const IntakePayloadSchema = z.object({
  taskSource: z.enum(['idea', 'audit', 'bug', 'sentry', 'linear', 'github', 'manual']),
  sourceId: z.string().max(256).optional(),
  objective: z.string().min(1).max(8000),
  repository: z.string().max(256).optional(),
  baseBranch: z.string().max(128).optional(),
  requestingUser: z.string().min(1).max(256),
  workspaceId: z.string().max(64).optional(),
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const BuilderRunStatusSchema = z.enum(BUILDER_RUN_STATUSES);

export const ApprovalRequestSchema = z.object({
  approvalId: z.string().min(1).max(128),
  approved: z.boolean(),
  resolvedBy: z.string().min(1).max(256),
  reason: z.string().max(2000).optional(),
});

export const WebhookEnvelopeSchema = z.object({
  provider: z.enum(['github', 'linear', 'sentry']),
  deliveryId: z.string().min(1).max(256),
  eventType: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()),
});
