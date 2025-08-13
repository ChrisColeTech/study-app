// =======================================================
// USER DOMAIN TYPES - STUDY APP V3 BACKEND
// =======================================================
// This file contains user-specific types for API requests/responses
// and business operations. Core User entity is defined in domain.types.ts

import { User, UserPreferences, EntityMetadata } from './domain.types';

// =======================================================
// USER API REQUEST/RESPONSE TYPES
// =======================================================

/**
 * Request payload for creating a new user
 */
export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * Standardized user response format for API endpoints
 * Note: Excludes sensitive fields like passwordHash and internal metadata
 */
export interface UserResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences: UserPreferences;
  profileCompleteness: number; // percentage
  lastLoginAt?: string;
}

/**
 * Request payload for updating user information
 */
export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  preferences?: Partial<UserPreferences>;
  isActive?: boolean;
}

/**
 * User validation rules for form validation and business logic
 */
export interface UserValidationRules {
  email: {
    required: boolean;
    format: 'email';
    maxLength: number;
  };
  firstName: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  lastName: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  password: {
    required: boolean;
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
  };
}

// =======================================================
// USER BUSINESS OPERATION TYPES
// =======================================================

/**
 * User context information for authenticated operations
 */
export interface UserContext {
  userId: string;
  email: string;
  fullName: string;
  isActive: boolean;
  lastActiveAt: string;
  sessionContext?: {
    sessionId: string;
    loginAt: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

/**
 * User activity tracking for analytics and monitoring
 */
export interface UserActivity extends EntityMetadata {
  userId: string;
  activityType: 'login' | 'logout' | 'session_start' | 'session_complete' | 'goal_created' | 'preference_updated';
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extended user preferences for profile management
 * Consolidates preferences from different domains
 */
export interface ExtendedUserPreferences extends UserPreferences {
  defaultProvider?: string;
  studyReminderEmail?: boolean;
  progressEmailFrequency?: 'daily' | 'weekly' | 'monthly' | 'never';
  theme?: 'light' | 'dark' | 'auto';
  language?: 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
  timezone?: string;
}

// =======================================================
// BACKWARD COMPATIBILITY
// =======================================================
// Re-export core User types for convenience and maintain existing imports

export type { User, UserPreferences } from './domain.types';