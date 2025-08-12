// Middleware exports for clean imports across the application
// Centralizes all middleware components

export {
  ValidationMiddleware,
  ValidationRules
} from './validation.middleware';

export {
  SessionValidationSchemas,
  GoalsValidationSchemas,
  AnalyticsValidationSchemas,
  QuestionValidationSchemas,
  AuthValidationSchemas,
  ProviderValidationSchemas,
  ExamValidationSchemas,
  TopicValidationSchemas,
  HealthValidationSchemas
} from './validation-schemas';

export type {
  ValidationRule,
  ValidationSchema,
  ValidationResult,
  ValidationContext
} from './validation.middleware';

export {
  ParsingMiddleware,
  CommonParsing
} from './parsing.middleware';

export type {
  ParsedRequest,
  QueryParamConfig
} from './parsing.middleware';

export {
  ErrorHandlingMiddleware,
  ErrorContexts
} from './error-handling.middleware';

export type {
  ErrorContext,
  ErrorMapping
} from './error-handling.middleware';

export {
  AuthMiddleware,
  AuthConfigs
} from './auth.middleware';

export type {
  AuthenticatedContext,
  AuthOptions
} from './auth.middleware';

// TODO: Common middleware patterns that can be composed together
// Commented out for now to fix build issues
// export class MiddlewarePipeline {
//   // Implementation will be added later
// }