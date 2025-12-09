/**
 * Audit Logger Service
 * 
 * Handles immutable audit logging for all content changes
 * Required for Phase 3: Every 'Save', 'Approve', or 'Publish' action must log:
 * [Timestamp] [User_ID] [Field_Changed] [Old_Value] -> [New_Value]
 */

import type { UserRole } from '../../../functions/api/_shared/rbac';

// Generic Prisma client type that works with both standard and edge clients
type PrismaClientLike = {
  contentAuditLog: any;
  [key: string]: any;
};

export interface AuditLogData {
  contentId: string;
  conditionId: string;
  version: number;
  changeType: 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'approve' | 'reject';
  changeDescription?: string;
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  changedBy: string;
  changedByRole: UserRole;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 * This is an append-only operation for compliance
 */
export async function createAuditLog(
  prisma: PrismaClientLike,
  data: AuditLogData
): Promise<void> {
  await prisma.contentAuditLog.create({
    data: {
      contentId: data.contentId,
      conditionId: data.conditionId,
      version: data.version,
      changeType: data.changeType,
      changeDescription: data.changeDescription,
      changedFields: data.changedFields || [],
      oldValues: data.oldValues || {},
      newValues: data.newValues || {},
      changedBy: data.changedBy,
      changedByRole: data.changedByRole,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    },
  });
}

/**
 * Get audit log for a specific content item
 */
export async function getAuditLog(
  prisma: PrismaClientLike,
  contentId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<any[]> {
  return prisma.contentAuditLog.findMany({
    where: { contentId },
    orderBy: { changedAt: 'desc' },
    take: options?.limit,
    skip: options?.offset,
  });
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(
  prisma: PrismaClientLike,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<any[]> {
  return prisma.contentAuditLog.findMany({
    where: { changedBy: userId },
    orderBy: { changedAt: 'desc' },
    take: options?.limit,
    skip: options?.offset,
  });
}

/**
 * Compare two content versions and generate field-level changes
 */
export function detectChangedFields(
  oldContent: Record<string, any>,
  newContent: Record<string, any>
): {
  changedFields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
} {
  const changedFields: string[] = [];
  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};

  // Get all unique keys from both objects
  const allKeys = new Set([
    ...Object.keys(oldContent),
    ...Object.keys(newContent),
  ]);

  for (const key of allKeys) {
    const oldValue = oldContent[key];
    const newValue = newContent[key];

    // Deep comparison for objects and arrays
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedFields.push(key);
      oldValues[key] = oldValue;
      newValues[key] = newValue;
    }
  }

  return { changedFields, oldValues, newValues };
}

/**
 * Format audit log entry for display
 */
export function formatAuditLogEntry(entry: any): string {
  const timestamp = new Date(entry.changedAt).toISOString();
  const fields = entry.changedFields?.join(', ') || 'N/A';
  
  let message = `[${timestamp}] [${entry.changedBy}] [${entry.changeType.toUpperCase()}]`;
  
  if (entry.changedFields && entry.changedFields.length > 0) {
    message += ` Modified fields: ${fields}`;
  }
  
  if (entry.changeDescription) {
    message += ` - ${entry.changeDescription}`;
  }
  
  return message;
}

/**
 * Export audit logs to CSV format
 */
export function exportAuditLogsToCsv(logs: any[]): string {
  const headers = [
    'Timestamp',
    'User ID',
    'Role',
    'Change Type',
    'Condition ID',
    'Version',
    'Changed Fields',
    'Description',
    'IP Address',
  ];

  const rows = logs.map((log) => [
    new Date(log.changedAt).toISOString(),
    log.changedBy,
    log.changedByRole,
    log.changeType,
    log.conditionId,
    log.version.toString(),
    (log.changedFields || []).join('; '),
    log.changeDescription || '',
    log.ipAddress || '',
  ]);

  return [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');
}
