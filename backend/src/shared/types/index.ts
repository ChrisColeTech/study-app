// Centralized type exports for the Study App V3 Backend

// API Types
export * from './api.types';

// Domain Types (excluding conflicting interfaces that are redefined in specific type files)
export type { 
  User, 
  UserPreferences, 
  StudySession, 
  SessionQuestion,
  ExamProvider,
  TopicAnalytics
} from './domain.types';

// Auth Types
export * from './auth.types';

// Session Types
export * from './session.types';

// Provider Types
export * from './provider.types';

// Exam Types
export * from './exam.types';

// Topic Types
export * from './topic.types';

// Question Types
export * from './question.types';

// Analytics Types
export * from './analytics.types';

// Goals Types  
export * from './goals.types';

// Health Types
export * from './health.types';

// Profile Types
export * from './profile.types';

// Re-export commonly used AWS Lambda types
export type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  APIGatewayProxyHandler
} from 'aws-lambda';