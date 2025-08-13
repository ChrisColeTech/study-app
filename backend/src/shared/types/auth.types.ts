// Authentication and authorization types

export interface AuthUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  email: string;
  resetToken: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthContext {
  isAuthenticated: boolean;
  user?: AuthUser;
  token?: string;
  permissions: string[];
}

// Authorization permissions
export const PERMISSIONS = {
  // User management
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',

  // Session management
  SESSION_READ: 'session:read',
  SESSION_WRITE: 'session:write',
  SESSION_DELETE: 'session:delete',

  // Analytics
  ANALYTICS_READ: 'analytics:read',
  ANALYTICS_WRITE: 'analytics:write',

  // Goals
  GOALS_READ: 'goals:read',
  GOALS_WRITE: 'goals:write',
  GOALS_DELETE: 'goals:delete',

  // Admin
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// User roles
export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
