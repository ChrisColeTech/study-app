// =======================================================
// CENTRALIZED TYPE EXPORTS FOR STUDY APP V3 BACKEND
// =======================================================
// This file provides a unified interface to all type definitions
// following standardized naming conventions and domain boundaries

// =======================================================
// CORE DOMAIN TYPES (Primary Entities)
// =======================================================
export type {
  // Primary domain entities
  User,
  UserPreferences,
  StudySession,
  SessionQuestion,
  Question,
  QuestionOption,
  Provider,
  Exam,
  Topic,
  UserProgress,
  Goal,
  
  // Common base types and enums
  DifficultyLevel,
  StatusType,
  EntityMetadata,
} from './domain.types';

// =======================================================
// API LAYER TYPES (Request/Response Patterns)
// =======================================================
export * from './api.types';

// =======================================================
// DOMAIN-SPECIFIC TYPES (By Business Domain)
// =======================================================

// Authentication Domain
export * from './auth.types';

// User Management Domain  
export * from './user.types';

// Session Management Domain
export * from './session.types';

// Provider/Certification Management Domain
export * from './provider.types';

// Exam Management Domain
export * from './exam.types';

// Topic Management Domain
export * from './topic.types';

// Question Management Domain
export * from './question.types';

// Analytics Domain
export * from './analytics.types';

// Goals Management Domain
export * from './goals.types';

// Health Monitoring Domain
export * from './health.types';

// User Profile Domain
export * from './profile.types';

// =======================================================
// REPOSITORY LAYER TYPES (Data Access Patterns)
// =======================================================
export * from './repository.types';

// =======================================================
// EXTERNAL TYPES (AWS Lambda, Third-party)
// =======================================================
export type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  APIGatewayProxyHandler,
} from 'aws-lambda';

// =======================================================
// TYPE ALIASES FOR BACKWARD COMPATIBILITY
// =======================================================
// These maintain compatibility while migrating to standardized names

/** @deprecated Use Provider instead */
export type { Provider as ExamProvider } from './domain.types';

/** @deprecated Use DifficultyLevel instead */
export type { DifficultyLevel as QuestionDifficulty } from './domain.types';