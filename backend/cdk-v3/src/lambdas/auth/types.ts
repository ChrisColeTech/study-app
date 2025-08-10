// Auth-specific types for Study App V3

export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  loginAttempts?: number;
  lockedUntil?: string;
  profilePicture?: string;
  timezone?: string;
  language?: string;
  refreshTokens?: RefreshTokenInfo[];
  blacklistedTokens?: BlacklistedToken[];
}

export interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  profilePicture?: string;
  timezone?: string;
  language?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  timezone?: string;
  language?: string;
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface VerifyTokenRequest {
  token: string;
}

export interface LogoutRequest {
  logoutAll?: boolean; // If true, logout from all devices
}

export interface LogoutResponse {
  message: string;
  loggedOutTokens?: number; // Number of tokens that were revoked
}

export interface RefreshTokenInfo {
  tokenId: string;
  hashedToken: string;
  expiresAt: string;
  createdAt: string;
  isRevoked: boolean;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshTokenResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: string[] | any;
  };
  message?: string;
  timestamp: string;
}

export interface ValidationErrorInfo {
  message: string;
  code: string;
  details?: string[];
}

// DynamoDB item interfaces
export interface DynamoDBUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  loginAttempts?: number;
  lockedUntil?: string;
  profilePicture?: string;
  timezone?: string;
  language?: string;
  refreshTokens?: RefreshTokenInfo[];
  blacklistedTokens?: BlacklistedToken[];
  GSI1PK?: string; // For email index
  GSI1SK?: string; // For email index
}

// Security and rate limiting types
export interface LoginAttempt {
  email: string;
  ipAddress: string;
  timestamp: string;
  success: boolean;
  userAgent?: string;
}

export interface RateLimitInfo {
  attempts: number;
  resetTime: number;
  isBlocked: boolean;
}

// Blacklisted token info for access token revocation
export interface BlacklistedToken {
  tokenId: string; // Unique identifier from JWT
  userId: string;
  expiresAt: string; // When the token naturally expires
  blacklistedAt: string; // When it was blacklisted
  reason?: string; // Reason for blacklisting (logout, security, etc.)
}

// Configuration types
export interface AuthConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  bcryptSaltRounds: number;
  maxLoginAttempts: number;
  lockoutDuration: number; // in minutes
  rateLimitWindow: number; // in minutes
  rateLimitMaxRequests: number;
  maxBlacklistedTokens?: number; // Max blacklisted tokens to keep in memory per user
}

// Error types
export class AuthError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ValidationRequestError extends Error {
  public readonly code: string;
  public readonly details: string[];
  public readonly statusCode: number;

  constructor(message: string, details: string[], code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationRequestError';
    this.code = code;
    this.details = details;
    this.statusCode = 400;
  }
}

export class UserNotFoundError extends AuthError {
  constructor(email?: string) {
    super(
      email ? `User with email ${email} not found` : 'User not found',
      'USER_NOT_FOUND',
      404
    );
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }
}

export class UserExistsError extends AuthError {
  constructor(email: string) {
    super(`User with email ${email} already exists`, 'USER_EXISTS', 409);
  }
}

export class AccountLockedError extends AuthError {
  constructor(lockedUntil?: string) {
    super(
      lockedUntil 
        ? `Account is locked until ${new Date(lockedUntil).toISOString()}`
        : 'Account is locked due to too many failed login attempts',
      'ACCOUNT_LOCKED',
      423
    );
  }
}

export class AccountInactiveError extends AuthError {
  constructor() {
    super('Account is not active. Please contact support.', 'ACCOUNT_INACTIVE', 403);
  }
}

export class RateLimitExceededError extends AuthError {
  constructor(resetTime: number) {
    super(
      `Rate limit exceeded. Try again after ${new Date(resetTime).toISOString()}`,
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }
}

export class InvalidRefreshTokenError extends AuthError {
  constructor() {
    super('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
  }
}

export class ExpiredRefreshTokenError extends AuthError {
  constructor() {
    super('Refresh token has expired', 'EXPIRED_REFRESH_TOKEN', 401);
  }
}

export class RevokedRefreshTokenError extends AuthError {
  constructor() {
    super('Refresh token has been revoked', 'REVOKED_REFRESH_TOKEN', 401);
  }
}

export class InvalidAccessTokenError extends AuthError {
  constructor() {
    super('Invalid access token', 'INVALID_ACCESS_TOKEN', 401);
  }
}

export class BlacklistedTokenError extends AuthError {
  constructor() {
    super('Token has been revoked', 'TOKEN_BLACKLISTED', 401);
  }
}

export class MissingAuthorizationError extends AuthError {
  constructor() {
    super('Authorization header is required', 'MISSING_AUTHORIZATION', 401);
  }
}