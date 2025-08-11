// Centralized type exports for the Study App V3 Backend

// API Types
export * from './api.types';

// Domain Types  
export * from './domain.types';

// Auth Types
export * from './auth.types';

// Session Types
export * from './session.types';

// Provider Types
export * from './provider.types';

// Exam Types (Phase 8) - Using type-only exports to avoid conflicts
export type {
  Exam as ExamV2,
  ExamResource,
  ExamMetadata,
  ExamComparison,
  ExamSearchCriteria,
  ExamFilters,
  ExamAggregations,
  ListExamsRequest,
  ListExamsResponse,
  GetExamRequest,
  GetExamResponse,
  SearchExamsRequest,
  SearchExamsResponse,
  CompareExamsRequest,
  CompareExamsResponse,
  GetProviderExamsRequest,
  GetProviderExamsResponse,
  IExamService
} from './exam.types';

// Export enums and constants as values
export {
  ExamCategory,
  ExamStatus,
  MarketDemand,
  SalaryImpact,
  ExamSortOption,
  SortOrder,
  EXAM_ERROR_CODES
} from './exam.types';

// Re-export commonly used AWS Lambda types
export type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
  APIGatewayProxyHandler
} from 'aws-lambda';