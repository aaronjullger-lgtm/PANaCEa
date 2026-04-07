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
  | 'admin_content_create'
  | 'admin_content_update'
  | 'admin_content_delete'
  | 'admin_content_transition'
  | 'admin_content_list'
  | 'admin_audit_log_access'
  | 'admin_branch_merge'
  | 'admin_generate_draft'
  | 'admin_health_report_access'
  | 'admin_staging_list'
  | 'admin_staging_approve'
  | 'admin_staging_reject'
  | 'admin_staging_update'
  | 'admin_staging_run_critic'
  | 'admin_media_update'
  | 'admin_media_delete'
  | 'admin_condition_parent_update'
  | 'admin_generate_question'
  | 'admin_knowledge_ingest'
  | 'admin_blueprint_set_targets'
  | 'admin_question_review'
  | 'admin_refinery_action'
  | 'admin_curated_passage_upsert'
  | 'admin_curated_passage_delete'
  | 'admin_system_mapping_create'
  | 'admin_system_mapping_update'
  | 'admin_system_mapping_delete'
  | 'admin_taxonomy_create'
  | 'admin_taxonomy_update'
  | 'admin_taxonomy_delete'
  | 'admin_enrich_condition'
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
