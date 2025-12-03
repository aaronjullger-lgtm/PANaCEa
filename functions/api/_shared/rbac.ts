/**
 * Role-Based Access Control utilities for API endpoints
 */

export type UserRole = 'user' | 'admin' | 'superadmin';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  superadmin: 3,
};

/**
 * Check if user has admin privileges (admin or higher)
 */
export function isAdmin(role: UserRole): boolean {
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
  return ['user', 'admin', 'superadmin'].includes(role);
}
