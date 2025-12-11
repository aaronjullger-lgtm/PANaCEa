/**
 * Content Management Service
 * 
 * Handles content lifecycle with state machine:
 * DRAFT -> PENDING_REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED
 */

import type { UserRole } from '../../../functions/api/_shared/rbac';
import { createAuditLog, detectChangedFields, type AuditLogData } from './auditLogger';

// Generic Prisma client type that works with both standard and edge clients
type PrismaClientLike = {
  medicalContent: any;
  contentVersion: any;
  contentAuditLog: any;
  $transaction?: any;
  [key: string]: any;
};

export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'archived';

export interface ContentData {
  conditionId: string;
  system: string;
  subcategory: string;
  condition: string;
  relatedSystems?: string[]; // NEW: Array for cross-system tagging
  content: Record<string, any>; // JSONB field with all content sections
}

export interface ContentTransitionOptions {
  userId: string;
  userRole: UserRole;
  ipAddress?: string;
  userAgent?: string;
  description?: string;
}

/**
 * Create new draft content
 */
export async function createDraft(
  prisma: PrismaClientLike,
  data: ContentData,
  options: ContentTransitionOptions
): Promise<any> {
  const content = await prisma.medicalContent.create({
    data: {
      conditionId: data.conditionId,
      system: data.system,
      subcategory: data.subcategory,
      condition: data.condition,
      relatedSystems: data.relatedSystems || [], // NEW: Persist relatedSystems array
      content: data.content,
      status: 'draft',
      version: 1,
      createdBy: options.userId,
      updatedBy: options.userId,
    },
  });

  // Create audit log
  await createAuditLog(prisma, {
    contentId: content.id,
    conditionId: content.conditionId,
    version: content.version,
    changeType: 'create',
    changeDescription: options.description || 'Created new draft',
    changedBy: options.userId,
    changedByRole: options.userRole,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    newValues: { status: 'draft', relatedSystems: data.relatedSystems, ...data.content },
  });

  return content;
}

/**
 * Update content (creates new version)
 */
export async function updateContent(
  prisma: PrismaClientLike,
  contentId: string,
  updates: Partial<ContentData>,
  options: ContentTransitionOptions
): Promise<any> {
  const existing = await prisma.medicalContent.findUnique({
    where: { id: contentId },
  });

  if (!existing) {
    throw new Error('Content not found');
  }

  // Detect what changed
  const oldContent = existing.content as Record<string, any>;
  const newContent = { ...oldContent, ...updates.content };
  const { changedFields, oldValues, newValues } = detectChangedFields(oldContent, newContent);

  // Update content
  const updated = await prisma.medicalContent.update({
    where: { id: contentId },
    data: {
      ...updates,
      content: newContent,
      version: existing.version + 1,
      updatedBy: options.userId,
    },
  });

  // Create version snapshot
  await prisma.contentVersion.create({
    data: {
      contentId: updated.id,
      version: updated.version,
      content: newContent,
      changeType: 'update',
      changeDescription: options.description,
      changedBy: options.userId,
    },
  });

  // Create audit log
  await createAuditLog(prisma, {
    contentId: updated.id,
    conditionId: updated.conditionId,
    version: updated.version,
    changeType: 'update',
    changeDescription: options.description || 'Content updated',
    changedFields,
    oldValues,
    newValues,
    changedBy: options.userId,
    changedByRole: options.userRole,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  });

  return updated;
}

/**
 * Transition content to a new status
 */
export async function transitionStatus(
  prisma: PrismaClientLike,
  contentId: string,
  newStatus: ContentStatus,
  options: ContentTransitionOptions
): Promise<any> {
  const content = await prisma.medicalContent.findUnique({
    where: { id: contentId },
  });

  if (!content) {
    throw new Error('Content not found');
  }

  // Validate state transition
  validateTransition(content.status as ContentStatus, newStatus);

  const updateData: any = {
    status: newStatus,
    version: content.version + 1,
    updatedBy: options.userId,
  };

  // Set special timestamps
  if (newStatus === 'approved') {
    updateData.approvedAt = new Date();
    updateData.approvedBy = options.userId;
  } else if (newStatus === 'published') {
    updateData.publishedAt = new Date();
    updateData.publishedBy = options.userId;
  }

  const updated = await prisma.medicalContent.update({
    where: { id: contentId },
    data: updateData,
  });

  // Create version snapshot
  await prisma.contentVersion.create({
    data: {
      contentId: updated.id,
      version: updated.version,
      content: content.content,
      changeType: getChangeType(newStatus),
      changeDescription: options.description || `Status changed to ${newStatus}`,
      changedBy: options.userId,
    },
  });

  // Create audit log
  await createAuditLog(prisma, {
    contentId: updated.id,
    conditionId: updated.conditionId,
    version: updated.version,
    changeType: getChangeType(newStatus),
    changeDescription: options.description || `Status changed from ${content.status} to ${newStatus}`,
    changedFields: ['status'],
    oldValues: { status: content.status },
    newValues: { status: newStatus },
    changedBy: options.userId,
    changedByRole: options.userRole,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  });

  return updated;
}

/**
 * Restore content to a previous version
 */
export async function restoreVersion(
  prisma: PrismaClientLike,
  contentId: string,
  versionNumber: number,
  options: ContentTransitionOptions
): Promise<any> {
  const version = await prisma.contentVersion.findFirst({
    where: {
      contentId,
      version: versionNumber,
    },
  });

  if (!version) {
    throw new Error('Version not found');
  }

  const current = await prisma.medicalContent.findUnique({
    where: { id: contentId },
  });

  if (!current) {
    throw new Error('Content not found');
  }

  // Update to the historical version's content
  const restored = await prisma.medicalContent.update({
    where: { id: contentId },
    data: {
      content: version.content,
      version: current.version + 1,
      updatedBy: options.userId,
      status: 'draft', // Restored content goes back to draft
    },
  });

  // Create audit log
  await createAuditLog(prisma, {
    contentId: restored.id,
    conditionId: restored.conditionId,
    version: restored.version,
    changeType: 'update',
    changeDescription: `Restored to version ${versionNumber}`,
    changedBy: options.userId,
    changedByRole: options.userRole,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
  });

  return restored;
}

/**
 * Validate state transition according to state machine rules
 */
function validateTransition(from: ContentStatus, to: ContentStatus): void {
  const allowedTransitions: Record<ContentStatus, ContentStatus[]> = {
    draft: ['pending_review', 'archived'],
    pending_review: ['draft', 'approved', 'archived'],
    approved: ['published', 'draft', 'archived'],
    published: ['archived', 'draft'],
    archived: ['draft'],
  };

  if (!allowedTransitions[from]?.includes(to)) {
    throw new Error(`Invalid transition from ${from} to ${to}`);
  }
}

/**
 * Get change type for audit log based on status
 */
function getChangeType(status: ContentStatus): 'publish' | 'unpublish' | 'approve' | 'reject' | 'update' {
  switch (status) {
    case 'published':
      return 'publish';
    case 'approved':
      return 'approve';
    case 'draft':
      return 'update';
    case 'archived':
      return 'unpublish';
    default:
      return 'update';
  }
}
