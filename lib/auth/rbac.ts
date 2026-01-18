/**
 * Role-Based Access Control (RBAC) utilities for PANaCEa
 * Defines roles, permissions, and access control functions
 */

export type UserRole = 'user' | 'admin' | 'superadmin';

export const ROLES: Record<string, UserRole> = {
  USER: 'user',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
};

/**
 * Role hierarchy for permission inheritance
 * Higher roles inherit permissions from lower roles
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 0,
  admin: 1,
  superadmin: 2,
};

/**
 * Checks if a user has a specific role or higher
 * @param userRole - The user's role
 * @param requiredRole - The minimum required role
 * @returns True if user meets role requirement
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Checks if a user can access admin features
 * @param userRole - The user's role
 * @returns True if user is admin or superadmin
 */
export function isAdmin(userRole: UserRole): boolean {
  return hasRole(userRole, ROLES.ADMIN);
}

/**
 * Checks if a user can manage other users' roles
 * @param userRole - The user's role
 * @returns True if user is superadmin
 */
export function canManageRoles(userRole: UserRole): boolean {
  return userRole === ROLES.SUPERADMIN;
}

/**
 * Checks if a user can modify a target user's role
 * @param actorRole - The role of the user performing the action
 * @param targetRole - The role of the user being modified
 * @returns True if actor can modify target
 */
export function canModifyUserRole(actorRole: UserRole, targetRole: UserRole): boolean {
  // Only superadmins can modify roles
  if (!canManageRoles(actorRole)) return false;

  // Superadmins can modify any role except other superadmins
  // (prevents accidental lockout)
  return targetRole !== ROLES.SUPERADMIN || actorRole === ROLES.SUPERADMIN;
}

/**
 * Gets display name for a role
 * @param role - User role
 * @returns Human-readable role name
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    user: 'User',
    admin: 'Administrator',
    superadmin: 'Super Administrator',
  };
  return names[role] || 'Unknown';
}

/**
 * Gets list of roles a user can assign to others
 * @param userRole - The user's role
 * @returns Array of assignable roles
 */
export function getAssignableRoles(userRole: UserRole): UserRole[] {
  if (!canManageRoles(userRole)) return [];

  // Superadmins can assign user and admin roles
  // (cannot create other superadmins through UI for security)
  return [ROLES.USER, ROLES.ADMIN];
}

/**
 * Validates if a role string is a valid UserRole
 * @param role - Role string to validate
 * @returns True if valid role
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(ROLES).includes(role as UserRole);
}
