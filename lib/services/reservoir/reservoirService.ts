/**
 * Reservoir Service — Core CRUD operations for the per-student question queue.
 *
 * Handles:
 *   - Atomic reservation of questions for a session (FOR UPDATE SKIP LOCKED)
 *   - Bulk insertion of new reservoir items
 *   - Marking items as consumed after a session
 *   - Maintenance: expiration sweeps, abandoned reservation release, hard-delete
 *   - Health checks: queue depth per user
 *
 * Concurrency strategy:
 *   Postgres row-level locking via SELECT ... FOR UPDATE SKIP LOCKED ensures
 *   two concurrent session requests for the same user get disjoint question sets
 *   without deadlocking.
 *
 * @module lib/services/reservoir/reservoirService
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RESERVOIR_POLICY,
  computeExpiry,
  type QuestionSource,
  type ReservoirItem,
} from './reservoirPolicy';
import { logger } from '../../logger';

const LOG_SCOPE = 'Reservoir';

// ─── Generic Prisma type ────────────────────────────────────────────────────

type PrismaClientLike = {
  studentReservoirItem: any;
  $queryRaw: any;
  $queryRawUnsafe: any;
  $transaction: any;
  $executeRawUnsafe: any;
  [key: string]: any;
};

// ─── Reserve (Session Start) ────────────────────────────────────────────────

export interface ReservedQuestion {
  id: string;
  questionId: string;
  questionSource: string;
  system: string | null;
  difficulty: string | null;
  questionOrder: string | null;
  taskCategory: string | null;
  isReview: boolean;
  priority: number;
}

/**
 * Atomically reserve questions from the reservoir for a session.
 *
 * Uses FOR UPDATE SKIP LOCKED so concurrent requests get disjoint sets.
 * Returns reserved items; the caller hydrates them into full question objects.
 */
export async function reserveFromReservoir(
  prisma: PrismaClientLike,
  userId: string,
  scope: string,
  count: number,
  sessionId: string
): Promise<ReservedQuestion[]> {
  // Use a raw transaction for FOR UPDATE SKIP LOCKED (not available in Prisma query API)
  const reserved: ReservedQuestion[] = await prisma.$transaction(async (tx: any) => {
    // Step 1: Select and lock available items
    const available: any[] = await tx.$queryRawUnsafe(`
      SELECT "id", "questionId", "questionSource", "system", "difficulty",
             "questionOrder", "taskCategory", "isReview", "priority"
      FROM "StudentReservoirItem"
      WHERE "userId" = $1
        AND "status" = 'queued'
        AND "scope" = $2
        AND "expiresAt" > NOW()
      ORDER BY "priority" DESC, "createdAt" ASC
      LIMIT $3
      FOR UPDATE SKIP LOCKED
    `, userId, scope, count);

    if (available.length === 0) return [];

    // Step 2: Mark as reserved
    const ids = available.map((r: any) => r.id);
    await tx.$executeRawUnsafe(`
      UPDATE "StudentReservoirItem"
      SET "status" = 'reserved', "reservedAt" = NOW(), "reservedBy" = $1
      WHERE "id" = ANY($2::text[])
    `, sessionId, ids);

    return available;
  });

  return reserved;
}

// ─── Consume (After Answer) ─────────────────────────────────────────────────

/**
 * Mark reservoir items as consumed after a student answers them.
 * Called from the session submission flow.
 */
export async function markConsumed(
  prisma: PrismaClientLike,
  sessionId: string,
  questionIds: string[]
): Promise<number> {
  if (questionIds.length === 0) return 0;

  const result = await prisma.studentReservoirItem.updateMany({
    where: {
      reservedBy: sessionId,
      questionId: { in: questionIds },
      status: 'reserved',
    },
    data: {
      status: 'consumed',
      consumedAt: new Date(),
    },
  });

  return result.count;
}

// ─── Bulk Insert ────────────────────────────────────────────────────────────

export interface InsertReservoirItemInput {
  userId: string;
  questionId: string;
  questionSource: QuestionSource;
  scope: string;
  priority: number;
  system: string | null;
  difficulty: string | null;
  questionOrder: string | null;
  taskCategory: string | null;
  isReview: boolean;
}

/**
 * Bulk insert items into the reservoir, skipping duplicates (ON CONFLICT DO NOTHING).
 * Returns the number of items actually inserted.
 */
export async function bulkInsertReservoirItems(
  prisma: PrismaClientLike,
  items: InsertReservoirItemInput[]
): Promise<number> {
  if (items.length === 0) return 0;

  // Check current reservoir size to respect MAX_RESERVOIR_SIZE
  const userId = items[0].userId;
  const scope = items[0].scope;
  const currentCount: number = await prisma.studentReservoirItem.count({
    where: { userId, scope, status: 'queued' },
  });

  const capacity = RESERVOIR_POLICY.MAX_RESERVOIR_SIZE - currentCount;
  if (capacity <= 0) return 0;

  const toInsert = items.slice(0, capacity);

  // Build VALUES for batch INSERT with ON CONFLICT DO NOTHING
  const values = toInsert.map((item) => {
    const id = uuidv4();
    const expiresAt = computeExpiry(item.isReview);
    return `('${id}', '${esc(item.userId)}', '${esc(item.questionId)}', '${esc(item.questionSource)}', '${esc(item.scope)}', 'queued', ${item.priority}, '${expiresAt.toISOString()}', NOW(), ${sqlStr(item.system)}, ${sqlStr(item.difficulty)}, ${sqlStr(item.questionOrder)}, ${sqlStr(item.taskCategory)}, ${item.isReview})`;
  });

  // Execute in batches of 50 to avoid query size limits
  let inserted = 0;
  for (let i = 0; i < values.length; i += 50) {
    const batch = values.slice(i, i + 50);
    const sql = `
      INSERT INTO "StudentReservoirItem"
        ("id", "userId", "questionId", "questionSource", "scope", "status", "priority", "expiresAt", "createdAt", "system", "difficulty", "questionOrder", "taskCategory", "isReview")
      VALUES ${batch.join(',\n')}
      ON CONFLICT ("userId", "questionId") DO NOTHING
    `;
    try {
      await prisma.$executeRawUnsafe(sql);
      inserted += batch.length; // Approximate — ON CONFLICT skips are not counted
    } catch (err: any) {
      // Log but don't fail the whole batch
      logger.error(LOG_SCOPE, `Batch insert error: ${err.message}`);
    }
  }

  return inserted;
}

// ─── Queue Depth ────────────────────────────────────────────────────────────

/**
 * Get the number of queued (available) items for a user+scope.
 */
export async function getQueueDepth(
  prisma: PrismaClientLike,
  userId: string,
  scope: string
): Promise<number> {
  return prisma.studentReservoirItem.count({
    where: {
      userId,
      scope,
      status: 'queued',
      expiresAt: { gt: new Date() },
    },
  });
}

/**
 * Check if a user's reservoir needs a refill.
 */
export async function needsRefill(
  prisma: PrismaClientLike,
  userId: string,
  scope: string
): Promise<{ needed: boolean; currentDepth: number; deficit: number }> {
  const depth = await getQueueDepth(prisma, userId, scope);
  const deficit = Math.max(0, RESERVOIR_POLICY.HIGH_WATER_MARK - depth);
  return {
    needed: depth < RESERVOIR_POLICY.LOW_WATER_MARK,
    currentDepth: depth,
    deficit,
  };
}

// ─── Maintenance ────────────────────────────────────────────────────────────

export interface MaintenanceResult {
  expired: number;
  released: number;
  deleted: number;
}

/**
 * Run periodic maintenance:
 *   1. Expire stale queued items past TTL
 *   2. Release abandoned reservations
 *   3. Hard-delete old consumed/expired/failed items
 */
export async function runMaintenance(
  prisma: PrismaClientLike
): Promise<MaintenanceResult> {
  const now = new Date();

  // 1. Expire stale queued items
  const expired = await prisma.studentReservoirItem.updateMany({
    where: {
      status: 'queued',
      expiresAt: { lt: now },
    },
    data: { status: 'expired' },
  });

  // 2. Release abandoned reservations
  const abandonedCutoff = new Date(
    now.getTime() - RESERVOIR_POLICY.RESERVATION_TIMEOUT_MINUTES * 60_000
  );
  const released = await prisma.studentReservoirItem.updateMany({
    where: {
      status: 'reserved',
      reservedAt: { lt: abandonedCutoff },
    },
    data: {
      status: 'queued',
      reservedAt: null,
      reservedBy: null,
    },
  });

  // 3. Hard-delete old terminal items
  const retentionCutoff = new Date(
    now.getTime() - RESERVOIR_POLICY.RETENTION_DAYS * 86400_000
  );
  const deleted = await prisma.studentReservoirItem.deleteMany({
    where: {
      status: { in: ['consumed', 'expired', 'failed'] },
      createdAt: { lt: retentionCutoff },
    },
  });

  return {
    expired: expired.count,
    released: released.count,
    deleted: deleted.count,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Escape single quotes for raw SQL */
function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** Convert nullable string to SQL literal */
function sqlStr(s: string | null): string {
  return s ? `'${esc(s)}'` : 'NULL';
}
