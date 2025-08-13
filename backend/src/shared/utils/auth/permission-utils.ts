/**
 * Permission and authorization utility functions
 * 
 * Single Responsibility: Access control and permission checking
 */

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];
}

export interface UserPermissions {
  userId: string;
  roles: string[];
  directPermissions: Permission[];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userPermissions: UserPermissions,
  resource: string,
  action: string,
  context?: Record<string, any>
): boolean {
  // Check direct permissions
  for (const permission of userPermissions.directPermissions) {
    if (matchesPermission(permission, resource, action, context)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if permission matches criteria
 */
function matchesPermission(
  permission: Permission,
  resource: string,
  action: string,
  context?: Record<string, any>
): boolean {
  // Check resource match (supports wildcards)
  if (!matchesPattern(permission.resource, resource)) {
    return false;
  }
  
  // Check action match (supports wildcards)
  if (!matchesPattern(permission.action, action)) {
    return false;
  }
  
  // Check conditions if present
  if (permission.conditions && context) {
    return evaluateConditions(permission.conditions, context);
  }
  
  return true;
}

/**
 * Check if pattern matches string (supports wildcards)
 */
function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (pattern === value) return true;
  
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
    .replace(/\\\*/g, '.*'); // Convert * to regex wildcard
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(value);
}

/**
 * Evaluate permission conditions
 */
function evaluateConditions(
  conditions: Record<string, any>,
  context: Record<string, any>
): boolean {
  for (const [key, expectedValue] of Object.entries(conditions)) {
    const actualValue = getNestedValue(context, key);
    
    if (!evaluateCondition(actualValue, expectedValue)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Evaluate single condition
 */
function evaluateCondition(actual: any, expected: any): boolean {
  if (typeof expected === 'object' && expected !== null) {
    if (expected.$eq !== undefined) return actual === expected.$eq;
    if (expected.$ne !== undefined) return actual !== expected.$ne;
    if (expected.$in !== undefined) return Array.isArray(expected.$in) && expected.$in.includes(actual);
    if (expected.$nin !== undefined) return Array.isArray(expected.$nin) && !expected.$nin.includes(actual);
    if (expected.$gt !== undefined) return actual > expected.$gt;
    if (expected.$gte !== undefined) return actual >= expected.$gte;
    if (expected.$lt !== undefined) return actual < expected.$lt;
    if (expected.$lte !== undefined) return actual <= expected.$lte;
    if (expected.$exists !== undefined) return (actual !== undefined) === expected.$exists;
  }
  
  return actual === expected;
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(userPermissions: UserPermissions, roles: string[]): boolean {
  return roles.some(role => userPermissions.roles.includes(role));
}

/**
 * Check if user has all specified roles
 */
export function hasAllRoles(userPermissions: UserPermissions, roles: string[]): boolean {
  return roles.every(role => userPermissions.roles.includes(role));
}

/**
 * Get all permissions for user (including inherited from roles)
 */
export function getAllUserPermissions(
  userPermissions: UserPermissions,
  roleDefinitions: Role[]
): Permission[] {
  const allPermissions = [...userPermissions.directPermissions];
  
  // Get permissions from roles
  for (const roleName of userPermissions.roles) {
    const role = roleDefinitions.find(r => r.name === roleName);
    if (role) {
      allPermissions.push(...getRolePermissions(role, roleDefinitions));
    }
  }
  
  return allPermissions;
}

/**
 * Get all permissions for a role (including inherited)
 */
function getRolePermissions(role: Role, roleDefinitions: Role[]): Permission[] {
  const permissions = [...role.permissions];
  
  // Add inherited permissions
  if (role.inherits) {
    for (const inheritedRoleName of role.inherits) {
      const inheritedRole = roleDefinitions.find(r => r.name === inheritedRoleName);
      if (inheritedRole) {
        permissions.push(...getRolePermissions(inheritedRole, roleDefinitions));
      }
    }
  }
  
  return permissions;
}

/**
 * Check if user can access resource
 */
export function canAccessResource(
  userPermissions: UserPermissions,
  resource: string,
  context?: Record<string, any>
): boolean {
  return hasPermission(userPermissions, resource, 'read', context) ||
         hasPermission(userPermissions, resource, '*', context);
}

/**
 * Check if user can modify resource
 */
export function canModifyResource(
  userPermissions: UserPermissions,
  resource: string,
  context?: Record<string, any>
): boolean {
  return hasPermission(userPermissions, resource, 'write', context) ||
         hasPermission(userPermissions, resource, 'update', context) ||
         hasPermission(userPermissions, resource, '*', context);
}

/**
 * Check if user can delete resource
 */
export function canDeleteResource(
  userPermissions: UserPermissions,
  resource: string,
  context?: Record<string, any>
): boolean {
  return hasPermission(userPermissions, resource, 'delete', context) ||
         hasPermission(userPermissions, resource, '*', context);
}

/**
 * Filter resources based on user permissions
 */
export function filterAuthorizedResources<T>(
  resources: T[],
  userPermissions: UserPermissions,
  resourceExtractor: (item: T) => string,
  action = 'read',
  contextExtractor?: (item: T) => Record<string, any>
): T[] {
  return resources.filter(resource => {
    const resourceName = resourceExtractor(resource);
    const context = contextExtractor ? contextExtractor(resource) : undefined;
    return hasPermission(userPermissions, resourceName, action, context);
  });
}

/**
 * Create permission object
 */
export function createPermission(
  resource: string,
  action: string,
  conditions?: Record<string, any>
): Permission {
  return {
    resource,
    action,
    ...(conditions && { conditions }),
  };
}

/**
 * Create role object
 */
export function createRole(
  name: string,
  permissions: Permission[],
  inherits?: string[]
): Role {
  return {
    name,
    permissions,
    ...(inherits && { inherits }),
  };
}

/**
 * Create user permissions object
 */
export function createUserPermissions(
  userId: string,
  roles: string[] = [],
  directPermissions: Permission[] = []
): UserPermissions {
  return {
    userId,
    roles,
    directPermissions,
  };
}

/**
 * Check if user owns resource (based on context)
 */
export function isResourceOwner(
  userPermissions: UserPermissions,
  context: Record<string, any>,
  ownerField = 'userId'
): boolean {
  const resourceOwnerId = getNestedValue(context, ownerField);
  return resourceOwnerId === userPermissions.userId;
}

/**
 * Common permission patterns
 */
export const PERMISSION_PATTERNS = {
  // Administrative permissions
  ADMIN_ALL: createPermission('*', '*'),
  ADMIN_USERS: createPermission('users', '*'),
  ADMIN_CONTENT: createPermission('content', '*'),
  
  // Read permissions
  READ_OWN_PROFILE: createPermission('users', 'read', { userId: '$userId' }),
  READ_PUBLIC_CONTENT: createPermission('content', 'read', { visibility: 'public' }),
  
  // Write permissions
  WRITE_OWN_PROFILE: createPermission('users', 'write', { userId: '$userId' }),
  CREATE_CONTENT: createPermission('content', 'create'),
  
  // Study-specific permissions
  ACCESS_QUESTIONS: createPermission('questions', 'read'),
  SUBMIT_ANSWERS: createPermission('sessions', 'update'),
  VIEW_ANALYTICS: createPermission('analytics', 'read'),
} as const;

/**
 * Common roles
 */
export const COMMON_ROLES = {
  ADMIN: createRole('admin', [PERMISSION_PATTERNS.ADMIN_ALL]),
  USER: createRole('user', [
    PERMISSION_PATTERNS.READ_OWN_PROFILE,
    PERMISSION_PATTERNS.WRITE_OWN_PROFILE,
    PERMISSION_PATTERNS.ACCESS_QUESTIONS,
    PERMISSION_PATTERNS.SUBMIT_ANSWERS,
    PERMISSION_PATTERNS.VIEW_ANALYTICS,
  ]),
  GUEST: createRole('guest', [
    PERMISSION_PATTERNS.READ_PUBLIC_CONTENT,
  ]),
} as const;