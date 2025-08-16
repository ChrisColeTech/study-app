// Middleware exports for clean imports across the application
// Centralizes all middleware components

export { ValidationMiddleware } from './validation.middleware';

export { SessionValidationSchemas } from './session-validation-schemas';
export { GoalsValidationSchemas } from './goals-validation-schemas';
export { AnalyticsValidationSchemas } from './analytics-validation-schemas';
export { QuestionValidationSchemas } from './question-validation-schemas';
export { AuthValidationSchemas } from './auth-validation-schemas';
export { ProviderValidationSchemas } from './provider-validation-schemas';
export { ExamValidationSchemas } from './exam-validation-schemas';
export { TopicValidationSchemas } from './topic-validation-schemas';
export { HealthValidationSchemas } from './health-validation-schemas';
export { AdditionalValidationHelpers } from './validation-schemas';

export type {
  ValidationRule,
  ValidationSchema,
  ValidationResult,
  ValidationContext,
} from './validation.middleware';

export { ParsingMiddleware, CommonParsing } from './parsing.middleware';
export { RequestParser } from './request-parser';
export { ParameterParser } from './parameter-parser';
export { BodyParser } from './body-parser';
export { ValidationParser } from './validation-parser';

export type { ParsedRequest, QueryParamConfig } from './parsing.middleware';

export { ErrorHandlingMiddleware, ErrorContexts } from './error-handling.middleware';

export type { ErrorContext, ErrorMapping } from './error-handling.middleware';

export { AuthMiddleware, AuthConfigs } from './auth.middleware';

export type { AuthenticatedContext, AuthOptions } from './auth.middleware';

export { RequestProcessingPipeline } from './request-processing-pipeline';
export { RequestLifecycleTracker } from './request-lifecycle-tracker';
export { MiddlewareOrchestrator, WithMiddleware } from './middleware-orchestrator';

export type { PipelineExecutionContext } from './request-processing-pipeline';
