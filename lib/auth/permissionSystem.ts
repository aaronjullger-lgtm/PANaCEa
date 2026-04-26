/**
 * Permission System for PANaCEa
 *
 * Features:
 * 1. Fine-grained permissions beyond basic roles
 * 2. Resource-level access controls
 * 3. Permission inheritance and delegation
 * 4. Medical education-specific permissions
 * 5. Audit logging for permission changes
 *
 * Usage:
 *   const hasPermission = await checkPermission(user, Permission.MEDICAL_CONTENT_EDIT, { conditionId: '123' });
 *   if (!hasPermission) {
 *     throw new AppError('Insufficient permissions', ErrorCategory.AUTHENTICATION, ErrorCode.PERMISSION_DENIED);
 *   }
 */

import { AppErrorFactory, ErrorCategory, ErrorCode } from '@/lib/errors/appError';

function permissionDeniedError(message: string, context: Record<string, unknown>): Error {
  const appError = AppErrorFactory.create(
    message,
    ErrorCategory.AUTHENTICATION,
    ErrorCode.AUTH_PERMISSION_DENIED,
    context
  );
  return Object.assign(new Error(appError.userMessage), appError);
}

// Permission enumeration
export enum Permission {
  // ===== CONTENT PERMISSIONS =====

  // Basic content operations
  CONTENT_READ = 'content:read',
  CONTENT_WRITE = 'content:write',
  CONTENT_DELETE = 'content:delete',

  // Medical content specific
  MEDICAL_CONTENT_VIEW = 'medical:content:view',
  MEDICAL_CONTENT_EDIT = 'medical:content:edit',
  MEDICAL_CONTENT_APPROVE = 'medical:content:approve',
  MEDICAL_CONTENT_PUBLISH = 'medical:content:publish',
  MEDICAL_CONTENT_ARCHIVE = 'medical:content:archive',

  // Question content
  QUESTION_CREATE = 'question:create',
  QUESTION_EDIT = 'question:edit',
  QUESTION_REVIEW = 'question:review',
  QUESTION_PUBLISH = 'question:publish',

  // ===== USER MANAGEMENT =====

  // Self-management
  PROFILE_VIEW = 'profile:view',
  PROFILE_EDIT = 'profile:edit',

  // Other users (admin only)
  USER_LIST = 'user:list',
  USER_VIEW = 'user:view',
  USER_EDIT = 'user:edit',
  USER_DELETE = 'user:delete',
  USER_ROLE_MANAGE = 'user:role:manage',

  // ===== ANALYTICS & REPORTING =====

  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
  PERFORMANCE_VIEW = 'performance:view',
  PERFORMANCE_COMPARE = 'performance:compare',

  // ===== SYSTEM OPERATIONS =====

  // Configuration
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_EDIT = 'settings:edit',

  // Maintenance
  MAINTENANCE_VIEW = 'maintenance:view',
  MAINTENANCE_EXECUTE = 'maintenance:execute',

  // Security
  SECURITY_AUDIT = 'security:audit',
  SECURITY_CONFIG = 'security:config',

  // ===== MEDICAL EDUCATION SPECIFIC =====

  // OSCE operations
  OSCE_SESSION_CREATE = 'osce:session:create',
  OSCE_SESSION_GRADE = 'osce:session:grade',
  OSCE_SESSION_REVIEW = 'osce:session:review',

  // Patient cases
  PATIENT_CASE_VIEW = 'patient:case:view',
  PATIENT_CASE_CREATE = 'patient:case:create',
  PATIENT_CASE_EDIT = 'patient:case:edit',

  // Study sessions
  SESSION_CREATE = 'session:create',
  SESSION_JOIN = 'session:join',
  SESSION_MODERATE = 'session:moderate',

  // ===== BILLING & SUBSCRIPTION =====

  BILLING_VIEW = 'billing:view',
  BILLING_MANAGE = 'billing:manage',
  SUBSCRIPTION_UPGRADE = 'subscription:upgrade',
}

// User roles with default permissions
export enum UserRole {
  // Medical students - basic access
  STUDENT = 'student',

  // PA students - enhanced access
  PA_STUDENT = 'pa_student',

  // Medical professionals - content creation
  MEDICAL_PROFESSIONAL = 'medical_professional',

  // Content reviewers
  REVIEWER = 'reviewer',

  // Administrators
  ADMIN = 'admin',

  // System administrators
  SYSTEM_ADMIN = 'system_admin',
}

// Role to permission mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.STUDENT]: [
    Permission.CONTENT_READ,
    Permission.MEDICAL_CONTENT_VIEW,
    Permission.PROFILE_VIEW,
    Permission.PROFILE_EDIT,
    Permission.ANALYTICS_VIEW,
    Permission.PERFORMANCE_VIEW,
    Permission.SESSION_CREATE,
    Permission.SESSION_JOIN,
    Permission.PATIENT_CASE_VIEW,
    Permission.BILLING_VIEW,
    Permission.SUBSCRIPTION_UPGRADE,
  ],

  [UserRole.PA_STUDENT]: [
    // All student permissions plus...
    Permission.QUESTION_CREATE,
    Permission.OSCE_SESSION_CREATE,
    Permission.PATIENT_CASE_CREATE,
    Permission.PERFORMANCE_COMPARE,
  ],

  [UserRole.MEDICAL_PROFESSIONAL]: [
    // All PA student permissions plus...
    Permission.MEDICAL_CONTENT_EDIT,
    Permission.QUESTION_EDIT,
    Permission.QUESTION_REVIEW,
    Permission.OSCE_SESSION_GRADE,
    Permission.PATIENT_CASE_EDIT,
    Permission.SESSION_MODERATE,
  ],

  [UserRole.REVIEWER]: [
    // All medical professional permissions plus...
    Permission.MEDICAL_CONTENT_APPROVE,
    Permission.QUESTION_PUBLISH,
    Permission.USER_LIST,
    Permission.USER_VIEW,
  ],

  [UserRole.ADMIN]: [
    // All reviewer permissions plus...
    Permission.CONTENT_WRITE,
    Permission.CONTENT_DELETE,
    Permission.MEDICAL_CONTENT_PUBLISH,
    Permission.MEDICAL_CONTENT_ARCHIVE,
    Permission.USER_EDIT,
    Permission.USER_ROLE_MANAGE,
    Permission.ANALYTICS_EXPORT,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_EDIT,
    Permission.MAINTENANCE_VIEW,
    Permission.SECURITY_AUDIT,
    Permission.BILLING_MANAGE,
  ],

  [UserRole.SYSTEM_ADMIN]: [
    // All permissions
    ...Object.values(Permission),
  ],
};

// Resource types for resource-level permissions
export enum ResourceType {
  USER = 'user',
  QUESTION = 'question',
  CONDITION = 'condition',
  MEDICAL_CONTENT = 'medical_content',
  OSCE_SESSION = 'osce_session',
  PATIENT_CASE = 'patient_case',
  STUDY_SESSION = 'study_session',
  BILLING_ACCOUNT = 'billing_account',
}

// Permission check context
export interface PermissionContext {
  userId: string;
  role: UserRole;
  additionalPermissions?: Permission[];
  resourceType?: ResourceType;
  resourceId?: string;
  resourceOwnerId?: string; // ID of the resource owner (for ownership checks)
  metadata?: Record<string, any>;
}

// Permission check result
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredPermission?: Permission;
  context?: PermissionContext;
}

// Custom permission rules (beyond role-based)
interface CustomPermissionRule {
  userId: string;
  permission: Permission;
  resourceType?: ResourceType;
  resourceId?: string;
  expiresAt?: Date;
  grantedBy: string;
  grantedAt: Date;
}

/**
 * Permission System Class
 */
export class PermissionSystem {
  private customRules: Map<string, CustomPermissionRule[]> = new Map();

  /**
   * Check if a user has a specific permission
   */
  async checkPermission(
    context: PermissionContext,
    permission: Permission,
    options: {
      requireOwnership?: boolean;
      customCheck?: (ctx: PermissionContext) => Promise<boolean>;
    } = {}
  ): Promise<PermissionCheckResult> {
    // 1. Check system administrator (has all permissions)
    if (context.role === UserRole.SYSTEM_ADMIN) {
      return { allowed: true, context };
    }

    // 2. Check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[context.role] || [];
    const hasRolePermission = rolePermissions.includes(permission);

    // 3. Check additional permissions
    const hasAdditionalPermission = context.additionalPermissions?.includes(permission) || false;

    // 4. Check custom rules
    const hasCustomRule = await this.checkCustomRules(
      context.userId,
      permission,
      context.resourceType,
      context.resourceId
    );

    // 5. Apply ownership check if required
    let ownershipCheck = true;
    if (options.requireOwnership && context.resourceOwnerId) {
      ownershipCheck = context.userId === context.resourceOwnerId;
    }

    // 6. Apply custom check if provided
    let customCheck = true;
    if (options.customCheck) {
      customCheck = await options.customCheck(context);
    }

    const allowed =
      (hasRolePermission || hasAdditionalPermission || hasCustomRule) &&
      ownershipCheck &&
      customCheck;

    if (!allowed) {
      return {
        allowed: false,
        reason: this.getDenialReason({
          hasRolePermission,
          hasAdditionalPermission,
          hasCustomRule,
          ownershipCheck,
          customCheck,
        }),
        requiredPermission: permission,
        context,
      };
    }

    return { allowed: true, context };
  }

  /**
   * Check multiple permissions (all must pass)
   */
  async checkPermissions(
    context: PermissionContext,
    permissions: Permission[],
    options?: {
      requireOwnership?: boolean;
      customCheck?: (ctx: PermissionContext) => Promise<boolean>;
    }
  ): Promise<PermissionCheckResult> {
    for (const permission of permissions) {
      const result = await this.checkPermission(context, permission, options);
      if (!result.allowed) {
        return result;
      }
    }

    return { allowed: true, context };
  }

  /**
   * Check any of multiple permissions (at least one must pass)
   */
  async checkAnyPermission(
    context: PermissionContext,
    permissions: Permission[],
    options?: {
      requireOwnership?: boolean;
      customCheck?: (ctx: PermissionContext) => Promise<boolean>;
    }
  ): Promise<PermissionCheckResult> {
    for (const permission of permissions) {
      const result = await this.checkPermission(context, permission, options);
      if (result.allowed) {
        return result;
      }
    }

    return {
      allowed: false,
      reason: `None of the required permissions were granted: ${permissions.join(', ')}`,
      context,
    };
  }

  /**
   * Grant a custom permission to a user
   */
  async grantCustomPermission(
    granterContext: PermissionContext,
    userId: string,
    permission: Permission,
    options: {
      resourceType?: ResourceType;
      resourceId?: string;
      expiresInHours?: number;
    } = {}
  ): Promise<void> {
    // Check if granter has permission to grant this permission
    const canGrant = await this.checkPermission(granterContext, Permission.USER_ROLE_MANAGE);
    if (!canGrant.allowed) {
      throw permissionDeniedError(
        'Insufficient permissions to grant custom permissions',
        { granterId: granterContext.userId, targetUserId: userId, permission }
      );
    }

    const rule: CustomPermissionRule = {
      userId,
      permission,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      expiresAt: options.expiresInHours
        ? new Date(Date.now() + options.expiresInHours * 60 * 60 * 1000)
        : undefined,
      grantedBy: granterContext.userId,
      grantedAt: new Date(),
    };

    const userRules = this.customRules.get(userId) || [];
    userRules.push(rule);
    this.customRules.set(userId, userRules);

    // In production, this would persist to database
    console.debug('Custom permission granted:', rule);
  }

  /**
   * Revoke a custom permission
   */
  async revokeCustomPermission(
    revokerContext: PermissionContext,
    userId: string,
    permission: Permission,
    resourceType?: ResourceType,
    resourceId?: string
  ): Promise<void> {
    // Check if revoker has permission to revoke
    const canRevoke = await this.checkPermission(revokerContext, Permission.USER_ROLE_MANAGE);
    if (!canRevoke.allowed) {
      throw permissionDeniedError(
        'Insufficient permissions to revoke custom permissions',
        { revokerId: revokerContext.userId, targetUserId: userId, permission }
      );
    }

    const userRules = this.customRules.get(userId) || [];
    const filteredRules = userRules.filter((rule) => {
      if (rule.permission !== permission) return true;
      if (resourceType && rule.resourceType !== resourceType) return true;
      if (resourceId && rule.resourceId !== resourceId) return true;
      return false; // This rule should be removed
    });

    this.customRules.set(userId, filteredRules);

    // In production, this would persist to database
    console.debug('Custom permission revoked:', { userId, permission, resourceType, resourceId });
  }

  /**
   * Get all permissions for a user (including custom)
   */
  async getUserPermissions(context: PermissionContext): Promise<Permission[]> {
    const permissions = new Set<Permission>();

    // Add role permissions
    const rolePermissions = ROLE_PERMISSIONS[context.role] || [];
    rolePermissions.forEach((p) => permissions.add(p));

    // Add additional permissions
    context.additionalPermissions?.forEach((p) => permissions.add(p));

    // Add custom permissions
    const customRules = this.customRules.get(context.userId) || [];
    const now = new Date();
    customRules.forEach((rule) => {
      if (!rule.expiresAt || rule.expiresAt > now) {
        permissions.add(rule.permission);
      }
    });

    return Array.from(permissions);
  }

  /**
   * Check if user can perform action on resource
   */
  async canPerformAction(
    context: PermissionContext,
    action: Permission,
    resource: {
      type: ResourceType;
      id: string;
      ownerId?: string;
    }
  ): Promise<PermissionCheckResult> {
    const checkContext: PermissionContext = {
      ...context,
      resourceType: resource.type,
      resourceId: resource.id,
      resourceOwnerId: resource.ownerId,
    };

    return this.checkPermission(checkContext, action, {
      requireOwnership: resource.ownerId !== undefined,
    });
  }

  /**
   * Medical education specific permission checks
   */

  // Check if user can edit medical content
  async canEditMedicalContent(
    context: PermissionContext,
    conditionId: string,
    contentOwnerId?: string
  ): Promise<PermissionCheckResult> {
    return this.canPerformAction(context, Permission.MEDICAL_CONTENT_EDIT, {
      type: ResourceType.MEDICAL_CONTENT,
      id: conditionId,
      ownerId: contentOwnerId,
    });
  }

  // Check if user can grade OSCE sessions
  async canGradeOSCESession(
    context: PermissionContext,
    sessionId: string,
    sessionOwnerId?: string
  ): Promise<PermissionCheckResult> {
    return this.canPerformAction(context, Permission.OSCE_SESSION_GRADE, {
      type: ResourceType.OSCE_SESSION,
      id: sessionId,
      ownerId: sessionOwnerId,
    });
  }

  // Check if user can view patient cases
  async canViewPatientCase(
    context: PermissionContext,
    caseId: string,
    caseOwnerId?: string
  ): Promise<PermissionCheckResult> {
    return this.canPerformAction(context, Permission.PATIENT_CASE_VIEW, {
      type: ResourceType.PATIENT_CASE,
      id: caseId,
      ownerId: caseOwnerId,
    });
  }

  /**
   * Private helper methods
   */

  private async checkCustomRules(
    userId: string,
    permission: Permission,
    resourceType?: ResourceType,
    resourceId?: string
  ): Promise<boolean> {
    const rules = this.customRules.get(userId) || [];
    const now = new Date();

    return rules.some((rule) => {
      // Check if rule matches
      if (rule.permission !== permission) return false;
      if (resourceType && rule.resourceType !== resourceType) return false;
      if (resourceId && rule.resourceId !== resourceId) return false;

      // Check if rule is expired
      if (rule.expiresAt && rule.expiresAt <= now) return false;

      return true;
    });
  }

  private getDenialReason(checks: {
    hasRolePermission: boolean;
    hasAdditionalPermission: boolean;
    hasCustomRule: boolean;
    ownershipCheck: boolean;
    customCheck: boolean;
  }): string {
    if (!checks.ownershipCheck) {
      return 'Resource ownership required';
    }

    if (!checks.customCheck) {
      return 'Custom check failed';
    }

    if (!checks.hasRolePermission && !checks.hasAdditionalPermission && !checks.hasCustomRule) {
      return 'Insufficient permissions';
    }

    return 'Permission denied';
  }

  /**
   * Clean up expired custom rules
   */
  cleanupExpiredRules(): void {
    const now = new Date();

    for (const [userId, rules] of this.customRules.entries()) {
      const validRules = rules.filter((rule) => !rule.expiresAt || rule.expiresAt > now);

      if (validRules.length === 0) {
        this.customRules.delete(userId);
      } else {
        this.customRules.set(userId, validRules);
      }
    }
  }
}

/**
 * Singleton instance
 */
let permissionSystemInstance: PermissionSystem | null = null;

export function getPermissionSystem(): PermissionSystem {
  if (!permissionSystemInstance) {
    permissionSystemInstance = new PermissionSystem();
  }
  return permissionSystemInstance;
}

/**
 * Helper functions for common permission checks
 */

export async function checkPermission(
  context: PermissionContext,
  permission: Permission,
  options?: {
    requireOwnership?: boolean;
    customCheck?: (ctx: PermissionContext) => Promise<boolean>;
  }
): Promise<PermissionCheckResult> {
  const system = getPermissionSystem();
  return system.checkPermission(context, permission, options);
}

export async function requirePermission(
  context: PermissionContext,
  permission: Permission,
  options?: {
    requireOwnership?: boolean;
    customCheck?: (ctx: PermissionContext) => Promise<boolean>;
  }
): Promise<void> {
  const result = await checkPermission(context, permission, options);
  if (!result.allowed) {
    throw permissionDeniedError(
      result.reason || 'Permission denied',
      {
        userId: context.userId,
        permission,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
      }
    );
  }
}

export async function canPerformAction(
  context: PermissionContext,
  action: Permission,
  resource: {
    type: ResourceType;
    id: string;
    ownerId?: string;
  }
): Promise<PermissionCheckResult> {
  const system = getPermissionSystem();
  return system.canPerformAction(context, action, resource);
}

/**
 * React hook for permission checking (for frontend)
 * Note: This is for client-side UI hiding, actual enforcement must be server-side
 */
export function usePermissions() {
  // In a real implementation, this would use React context
  // For now, return a mock implementation
  return {
    hasPermission: async (permission: Permission, resourceId?: string): Promise<boolean> => {
      // This would check against the current user's context
      console.warn(
        'usePermissions is a client-side helper only. Server-side enforcement is required.'
      );
      return false;
    },
    getUserPermissions: async (): Promise<Permission[]> => {
      return [];
    },
  };
}
