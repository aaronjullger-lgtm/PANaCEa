/**
 * Structured audit logging for sensitive operations (admin, question pipeline, etc.)
 *
 * Use this in admin and high-impact endpoints so security-relevant actions
 * are logged with action type and redacted metadata. Logs go to the same
 * secure logger (redaction, no secrets). For content-specific audit trail
 * (create/update/delete content), use lib/services/cms/auditLogger and
 * ContentAuditLog in the database.
 *
 * Usage:
 *   import { auditLog } from '../_shared/auditLog';
 *   auditLog('admin_media_approve', { mediaId: id, userId: ctx.userId });
 */

import { logger } from './secureLogger';

export type AuditAction =
  | 'admin_media_approve'
  | 'admin_media_reject'
  | 'admin_question_resolve_flag'
  | 'admin_content_publish'
  | 'admin_branch_merge'
  | 'admin_generate_draft'
  | 'question_flag_create'
  | 'question_seed_assemble'
  | 'question_staging_process'
  | string;

/**
 * Log a security-relevant or audit-worthy action with redacted metadata.
 * Uses the secure logger so secrets and PII are redacted.
 */
export function auditLog(action: AuditAction, metadata?: Record<string, unknown>): void {
  logger.security(`audit:${action}`, {
    action,
    ...metadata,
  });
}
