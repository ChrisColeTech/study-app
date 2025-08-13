// Middleware exports for clean imports across the application
// Centralizes all middleware components

export { ValidationMiddleware, ValidationRules } from './validation.middleware';

export {
  SessionValidationSchemas,
  GoalsValidationSchemas,
  AnalyticsValidationSchemas,
  QuestionValidationSchemas,
  AuthValidationSchemas,
  ProviderValidationSchemas,
  ExamValidationSchemas,
  TopicValidationSchemas,
  HealthValidationSchemas,
} from './validation-schemas';

export type {
  ValidationRule,
  ValidationSchema,
  ValidationResult,
  ValidationContext,
} from './validation.middleware';

export { ParsingMiddleware, CommonParsing } from './parsing.middleware';

export type { ParsedRequest, QueryParamConfig } from './parsing.middleware';

export { ErrorHandlingMiddleware, ErrorContexts } from './error-handling.middleware';

export type { ErrorContext, ErrorMapping } from './error-handling.middleware';

export { AuthMiddleware, AuthConfigs } from './auth.middleware';

export type { AuthenticatedContext, AuthOptions } from './auth.middleware';

export { RequestProcessingPipeline } from './request-processing-pipeline';
export { RequestLifecycleTracker } from './request-lifecycle-tracker';
export { MiddlewareOrchestrator, WithMiddleware } from './middleware-orchestrator';

export type { PipelineExecutionContext } from './request-processing-pipeline';
