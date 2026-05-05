import type { MappingAuditAction, PrismaClient } from '@prisma/client';

/**
 * Parameters for logging a mapping audit event.
 */
export interface AuditEventParams {
  /** The taxonomy code being mapped */
  taxonomyCode: string;
  /** The system code being assigned (or removed) */
  systemCode: string;
  /** Previous system code, if any (null for unmapped) */
  previousSystemCode?: string | null;
  /** Action type */
  action: MappingAuditAction;
  /** User ID (optional, will be filled by server) */
  userId?: string;
  /** Rationale for the change */
  rationale?: string;
}

/**
 * Logs a mapping audit event using the provided Prisma transaction.
 * This function is intended for server‑side use only (requires a DB transaction).
 */
export async function logAuditEventServer(
  prisma: PrismaClient,
  params: AuditEventParams
): Promise<void> {
  try {
    await prisma.mappingAuditLog.create({
      data: {
        taxonomyCode: params.taxonomyCode,
        systemCode: params.systemCode,
        previousSystemCode: params.previousSystemCode ?? null,
        action: params.action,
        userId: params.userId ?? null,
        rationale: params.rationale ?? null,
      },
    });
  } catch (error) {
    // Log error but don't throw – audit logging should not break the primary operation
    console.error('Failed to write mapping audit log:', error);
  }
}

/**
 * Client‑side stub that sends an audit event to the server via API.
 * Used by frontend components that cannot access Prisma directly.
 * Currently a no-op; in a production setting you would call an API endpoint.
 */
export async function logAuditEvent(params: Omit<AuditEventParams, 'userId'>): Promise<void> {
  // In a real implementation, you would call:
  //   fetch('/api/audit/mapping', { method: 'POST', body: JSON.stringify(params) })
  // For now, we simply log to console in development.
  if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    console.debug('[MappingAudit]', params);
  }
  // No‑op in production – server‑side logging is sufficient.
}

/**
 * Parameters for querying audit logs.
 */
export interface AuditLogQuery {
  taxonomyCode?: string;
  systemCode?: string;
  action?: MappingAuditAction;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Retrieves mapping audit logs with optional filtering and pagination.
 * Includes related taxonomy and user information.
 */
export async function getAuditLogs(
  prisma: PrismaClient,
  query: AuditLogQuery = {}
): Promise<{
  logs: any[]; // We'll define a proper type later
  total: number;
}> {
  const {
    taxonomyCode,
    systemCode,
    action,
    userId,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = query;

  const where: any = {};
  if (taxonomyCode) where.taxonomyCode = taxonomyCode;
  if (systemCode) where.systemCode = systemCode;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) where.timestamp.gte = startDate;
    if (endDate) where.timestamp.lte = endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.mappingAuditLog.findMany({
      where,
      include: {
        taxonomy: {
          select: {
            name: true,
            weight: true,
            isActive: true,
          },
        },
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.mappingAuditLog.count({ where }),
  ]);

  return { logs, total };
}
