/**
 * Role-Based Access Control utilities for API endpoints
 *
 * Role Hierarchy (Phase 3 - Professional CMS Workflow):
 * - user: Regular learners (no CMS access)
 * - viewer: Audit-only access to CMS (read only)
 * - editor: Can create and edit content
 * - approver: Senior MD/PA who can approve content
 * - admin: Full admin access
 * - superadmin: Complete system access
 */

export type UserRole = 'user' | 'viewer' | 'editor' | 'approver' | 'admin' | 'superadmin';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  viewer: 2,
  editor: 3,
  approver: 4,
  admin: 5,
  superadmin: 6,
};

/**
 * Check if user has admin privileges (admin or higher)
 */
export function isAdmin(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin;
}

/**
 * Check if user can view CMS (viewer or higher)
 */
export function canViewCMS(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.viewer;
}

/**
 * Check if user can edit content (editor or higher)
 */
export function canEditContent(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.editor;
}

/**
 * Check if user can approve content (approver or higher)
 */
export function canApproveContent(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.approver;
}

/**
 * Check if user can publish content (admin or higher)
 */
export function canPublishContent(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.admin;
}

/**
 * Check if user can manage roles (superadmin only)
 */
export function canManageRoles(role: UserRole): boolean {
  return role === 'superadmin';
}

/**
 * Check if user has at least the required role level
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Validate role string
 */
export function isValidRole(role: string): role is UserRole {
  return ['user', 'viewer', 'editor', 'approver', 'admin', 'superadmin'].includes(role);
}

/**
 * Get allowed content operations for a role
 */
export function getAllowedOperations(role: UserRole): {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canSaveDraft: boolean;
  canSubmitReview: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
} {
  return {
    canView: canViewCMS(role),
    canCreate: canEditContent(role),
    canEdit: canEditContent(role),
    canSaveDraft: canEditContent(role),
    canSubmitReview: canEditContent(role),
    canApprove: canApproveContent(role),
    canPublish: canPublishContent(role),
    canArchive: canPublishContent(role),
    canRestore: isAdmin(role),
  };
}
