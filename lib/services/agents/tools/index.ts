/**
 * PANaCEa Agent Tool Registry — default exports
 *
 * Re-exports every built-in tool and provides a convenience factory that
 * returns a fully populated `ToolRegistry`.
 *
 * Tool catalog (10 tools, all read-only):
 *   Student-facing: clinical_library_search, user_progress_summary, fsrs_due_count
 *   Content quality: content_health_audit, question_quality_check, condition_verify
 *   System health:  blueprint_coverage_check, drill_coverage_check
 *   Infrastructure: database_integrity_check, fsrs_calibration_status
 */

import { ToolRegistry } from '../toolRegistry';
import { clinicalLibrarySearchTool } from './clinicalLibrarySearch';
import { userProgressSummaryTool } from './userProgressSummary';
import { fsrsDueCountTool } from './fsrsDueCount';
import { blueprintCoverageCheckTool } from './blueprintCoverageCheck';
import { contentHealthAuditTool } from './contentHealthAudit';
import { questionQualityCheckTool } from './questionQualityCheck';
import { conditionVerifyTool } from './conditionVerify';
import { databaseIntegrityCheckTool } from './databaseIntegrityCheck';
import { fsrsCalibrationStatusTool } from './fsrsCalibrationStatus';
import { drillCoverageCheckTool } from './drillCoverageCheck';

export { clinicalLibrarySearchTool } from './clinicalLibrarySearch';
export { userProgressSummaryTool } from './userProgressSummary';
export { fsrsDueCountTool } from './fsrsDueCount';
export { blueprintCoverageCheckTool } from './blueprintCoverageCheck';
export { contentHealthAuditTool } from './contentHealthAudit';
export { questionQualityCheckTool } from './questionQualityCheck';
export { conditionVerifyTool } from './conditionVerify';
export { databaseIntegrityCheckTool } from './databaseIntegrityCheck';
export { fsrsCalibrationStatusTool } from './fsrsCalibrationStatus';
export { drillCoverageCheckTool } from './drillCoverageCheck';

/**
 * Agent-specific tool sets. Use these to restrict agent capabilities
 * to just the tools relevant for a specific domain.
 */

/** Tools for the Clinical Study Agent (student-facing chat). */
export const CLINICAL_TOOLS = [
  clinicalLibrarySearchTool,
  userProgressSummaryTool,
  fsrsDueCountTool,
];

/** Tools for the Content Quality & Verification domain. */
export const QUALITY_TOOLS = [
  contentHealthAuditTool,
  questionQualityCheckTool,
  conditionVerifyTool,
];

/** Tools for the Coverage & Analytics domain. */
export const COVERAGE_TOOLS = [
  blueprintCoverageCheckTool,
  drillCoverageCheckTool,
];

/** Tools for the Infrastructure & Health domain. */
export const INFRA_TOOLS = [
  databaseIntegrityCheckTool,
  fsrsCalibrationStatusTool,
];

/** All 10 tools combined. */
const ALL_TOOLS = [
  ...CLINICAL_TOOLS,
  ...QUALITY_TOOLS,
  ...COVERAGE_TOOLS,
  ...INFRA_TOOLS,
];

/**
 * Build the default PANaCEa tool registry with all 10 tools.
 * Use the tool-set constants (CLINICAL_TOOLS, QUALITY_TOOLS, etc.)
 * to build restricted registries for specific agent domains.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  return new ToolRegistry(ALL_TOOLS);
}

/**
 * Build a registry restricted to clinical study tools (student-facing).
 */
export function createClinicalToolRegistry(): ToolRegistry {
  return new ToolRegistry(CLINICAL_TOOLS);
}

/**
 * Build a registry for content quality verification agents.
 */
export function createQualityToolRegistry(): ToolRegistry {
  return new ToolRegistry(QUALITY_TOOLS);
}

/**
 * Build a registry for infrastructure health agents.
 */
export function createInfraToolRegistry(): ToolRegistry {
  return new ToolRegistry(INFRA_TOOLS);
}

/**
 * Names of every built-in tool. Useful as a default `allowedTools`
 * value when you trust the full default set.
 */
export const DEFAULT_TOOL_NAMES = [
  'clinical_library_search',
  'user_progress_summary',
  'fsrs_due_count',
  'blueprint_coverage_check',
  'content_health_audit',
  'question_quality_check',
  'condition_verify',
  'database_integrity_check',
  'fsrs_calibration_status',
  'drill_coverage_check',
] as const;
