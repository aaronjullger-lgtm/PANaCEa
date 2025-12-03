/**
 * Type definitions for the Admin CMS
 * Handles medical content management, version control, and audit logging
 */

import type { SystemCode } from '../types';

/**
 * Content publication status
 */
export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';

/**
 * User role for RBAC
 */
export type AdminRole = 'admin' | 'superadmin';

/**
 * Content change type for audit log
 */
export type ChangeType = 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'approve' | 'reject';

/**
 * Represents a single piece of medical content (condition, drug, etc.)
 */
export interface MedicalContent {
  id: string;
  conditionId: string; // e.g., "CV__ecg__atrial_fibrillation"
  system: SystemCode;
  subcategory: string;
  condition: string;
  
  // Content sections (matches structure in conditionContent.json)
  overview?: string;
  etiologyPathophysiology?: string;
  epidemiology?: string;
  riskFactors?: string[];
  clinicalPresentation?: string;
  symptoms?: string[];
  examFindings?: string[];
  diagnostics?: {
    notes?: string;
    imaging?: string[];
    labs?: string[];
  };
  treatment?: string[];
  management?: string[];
  complications?: string[];
  prognosis?: string;
  basicScienceLinks?: Array<{
    title: string;
    conceptId: string;
  }>;
  
  // Media assets
  mediaIds?: string[];
  
  // Metadata
  status: ContentStatus;
  version: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  publishedAt?: Date;
  publishedBy?: string;
  approvedAt?: Date;
  approvedBy?: string;
}

/**
 * Represents a historical version of content
 */
export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  content: Partial<MedicalContent>;
  changeType: ChangeType;
  changeDescription?: string;
  changedBy: string;
  changedAt: Date;
}

/**
 * Audit log entry for tracking all content changes
 */
export interface AuditLogEntry {
  id: string;
  contentId: string;
  conditionId: string;
  version: number;
  changeType: ChangeType;
  changeDescription: string;
  changedFields?: string[];
  changedBy: string;
  changedByRole: AdminRole;
  changedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Content diff for comparing versions
 */
export interface ContentDiff {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}

/**
 * Filter options for content list
 */
export interface ContentFilter {
  system?: SystemCode;
  subcategory?: string;
  status?: ContentStatus;
  createdBy?: string;
  searchQuery?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Sort options for content list
 */
export interface ContentSort {
  field: 'condition' | 'system' | 'updatedAt' | 'status' | 'version';
  direction: 'asc' | 'desc';
}

/**
 * Pagination options
 */
export interface Pagination {
  page: number;
  perPage: number;
  total: number;
}

/**
 * Content list response
 */
export interface ContentListResponse {
  content: MedicalContent[];
  pagination: Pagination;
}

/**
 * Media asset for conditions
 */
export interface MediaAsset {
  id: string;
  filename: string;
  type: 'ekg' | 'imaging' | 'labs' | 'diagram' | 'photo' | 'other';
  url: string;
  tags: string[];
  conditionIds: string[];
  uploadedBy: string;
  uploadedAt: Date;
  confidence?: number; // AI matching confidence
}

/**
 * Content validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}

/**
 * Content health check result (for nightly audits)
 */
export interface ContentHealthReport {
  timestamp: Date;
  totalContent: number;
  issues: ContentHealthIssue[];
  summary: {
    missingExplanations: number;
    brokenMediaLinks: number;
    invalidFields: number;
    outdatedContent: number;
  };
}

export interface ContentHealthIssue {
  contentId: string;
  condition: string;
  issueType: 'missing_explanation' | 'broken_media' | 'invalid_field' | 'outdated';
  description: string;
  severity: 'high' | 'medium' | 'low';
}
