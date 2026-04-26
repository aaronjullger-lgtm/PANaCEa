import type { EdgePrismaClient } from './prisma-edge';

export type SubmissionIdempotencyBeginResult =
  | { state: 'started'; id: string }
  | { state: 'completed'; response: Record<string, unknown> }
  | { state: 'in_progress'; retryAfterSeconds: number };

const DEFAULT_TTL_DAYS = 7;
const PROCESSING_STALE_MS = 2 * 60 * 1000;
const RETRY_AFTER_SECONDS = 5;

function isUniqueConstraintError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate?.code === 'P2002' ||
    /unique|constraint|duplicate/i.test(candidate?.message ?? '')
  );
}

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

function expiresAt(days = DEFAULT_TTL_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function readExisting(
  prisma: EdgePrismaClient,
  userId: string,
  endpoint: string,
  idempotencyKey: string,
) {
  return (prisma as any).submissionIdempotency.findUnique({
    where: {
      userId_endpoint_idempotencyKey: {
        userId,
        endpoint,
        idempotencyKey,
      },
    },
  });
}

/**
 * Durable idempotency guard for study-loop mutation endpoints.
 *
 * KV cache remains useful for fast retries, but this table-backed ledger is the
 * production source of truth: only the request that creates or reclaims the row
 * may enter the write pipeline.
 */
export async function beginSubmissionIdempotency(
  prisma: EdgePrismaClient,
  options: {
    userId: string;
    endpoint: string;
    idempotencyKey?: string | null;
  },
): Promise<SubmissionIdempotencyBeginResult | null> {
  const { userId, endpoint, idempotencyKey } = options;
  if (!idempotencyKey) return null;

  try {
    const created = await (prisma as any).submissionIdempotency.create({
      data: {
        userId,
        endpoint,
        idempotencyKey,
        status: 'processing',
        expiresAt: expiresAt(),
      },
      select: { id: true },
    });
    return { state: 'started', id: created.id };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

  const existing = await readExisting(prisma, userId, endpoint, idempotencyKey);
  if (!existing) {
    const created = await (prisma as any).submissionIdempotency.create({
      data: {
        userId,
        endpoint,
        idempotencyKey,
        status: 'processing',
        expiresAt: expiresAt(),
      },
      select: { id: true },
    });
    return { state: 'started', id: created.id };
  }

  if (existing.status === 'completed' && existing.responseJson != null) {
    return { state: 'completed', response: toJsonRecord(existing.responseJson) };
  }

  const updatedAt = existing.updatedAt instanceof Date
    ? existing.updatedAt
    : new Date(existing.updatedAt);
  const isStale = Date.now() - updatedAt.getTime() > PROCESSING_STALE_MS;

  if (!isStale && existing.status === 'processing') {
    return { state: 'in_progress', retryAfterSeconds: RETRY_AFTER_SECONDS };
  }

  const reclaimed = await (prisma as any).submissionIdempotency.update({
    where: {
      userId_endpoint_idempotencyKey: {
        userId,
        endpoint,
        idempotencyKey,
      },
    },
    data: {
      status: 'processing',
      errorCode: null,
      responseJson: null,
      expiresAt: expiresAt(),
    },
    select: { id: true },
  });

  return { state: 'started', id: reclaimed.id };
}

export async function completeSubmissionIdempotency(
  prisma: EdgePrismaClient,
  id: string | null | undefined,
  response: Record<string, unknown>,
): Promise<void> {
  if (!id) return;

  await (prisma as any).submissionIdempotency.update({
    where: { id },
    data: {
      status: 'completed',
      responseJson: JSON.parse(JSON.stringify(response)),
      errorCode: null,
    },
  });
}

export async function failSubmissionIdempotency(
  prisma: EdgePrismaClient,
  id: string | null | undefined,
  errorCode: string,
): Promise<void> {
  if (!id) return;

  await (prisma as any).submissionIdempotency.update({
    where: { id },
    data: {
      status: 'failed',
      errorCode,
    },
  });
}
