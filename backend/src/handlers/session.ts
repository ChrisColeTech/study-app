// Refactored Session handler using middleware pattern
// Eliminates architecture violations: massive SRP violations, mixed routing/validation/parsing/error handling/business logic

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { SessionService } from '../services/session.service';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import {
  CreateSessionRequest,
  UpdateSessionRequest,
  SubmitAnswerRequest,
} from '../shared/types/session.types';

// Import new middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  ValidationMiddleware,
  AuthMiddleware,
  AuthConfigs,
  AuthenticatedContext,
} from '../shared/middleware';
import { ValidationRules } from '../shared/validation/validation-rules';
import { SessionValidationSchemas, AdditionalValidationHelpers } from '../shared/middleware';

export class SessionHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'SessionHandler' });
  // Common session error mappings for standardization
  private static readonly SESSION_ERROR_MAPPINGS = {
    COMMON: [
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404,
      },
    ],
    DELETE: [
      {
        keywords: ['Cannot delete completed'],
        errorCode: 'CONFLICT',
        statusCode: 409,
      },
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404,
      },
    ],
    COMPLETE: [
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404,
      },
      {
        keywords: ['Session is already completed'],
        errorCode: 'CONFLICT',
        statusCode: 409,
      },
      {
        keywords: ['Cannot complete abandoned session'],
        errorCode: 'CONFLICT',
        statusCode: 409,
      },
      {
        keywords: ['Cannot complete session:', 'questions remain unanswered'],
        errorCode: 'VALIDATION_ERROR',
        statusCode: 400,
      },
    ],
    SUBMIT_ANSWER: [
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404,
      },
      {
        keywords: ['Cannot submit answers to inactive'],
        errorCode: 'CONFLICT',
        statusCode: 409,
      },
      {
        keywords: ['Question not found in session'],
        errorCode: 'VALIDATION_ERROR',
        statusCode: 400,
      },
    ],
  };

  // Common session ID validation helper
  private validateSessionId(pathParams: any): ApiResponse | null {
    return ValidationMiddleware.validateFields(
      { sessionId: pathParams.id },
      SessionValidationSchemas.sessionId(),
      'params'
    );
  }

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'POST',
        path: '/v1/sessions',
        handler: this.createSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/sessions/{id}',
        handler: this.getSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'PUT',
        path: '/v1/sessions/{id}',
        handler: this.updateSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'DELETE',
        path: '/v1/sessions/{id}',
        handler: this.deleteSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/sessions/{id}/answers',
        handler: this.submitAnswer.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/sessions/{id}/complete',
        handler: this.completeSession.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/sessions/adaptive',
        handler: this.createAdaptiveSession.bind(this),
        requireAuth: false,
      },
    ];
  }

  /**
   * Create a new study session - now clean and focused
   */
  /**
   * Create a new study session - Enhanced with optimized middleware integration
   */
  private async createSession(context: HandlerContext): Promise<ApiResponse> {
    // Use type-aware validation that corresponds to CreateSessionRequest interface
    return this.executeWithMiddleware(
      context,
      'write', // Pattern: parsing + validation + error handling
      {
        body: AdditionalValidationHelpers.createEnhancedSessionValidation(),
      },
      async () => {
        const requestBody = context.parsedData?.body as CreateSessionRequest;
        
        const sessionService = this.serviceFactory.getSessionService();
        const result = await sessionService.createSession(requestBody);

        this.logger.info('Session created successfully with type-safe validation', {
          requestId: context.requestId,
          sessionId: result.session.sessionId,
          totalQuestions: result.session.totalQuestions,
          providerId: result.session.providerId,
          examId: result.session.examId,
          validationType: 'CreateSessionRequest',
        });

        return result;
      }
    );
  }

  /**
   * Get an existing study session - now clean and focused
   */
  /**
   * Get an existing study session - Enhanced with optimized middleware integration
   */
  private async getSession(context: HandlerContext): Promise<ApiResponse> {
    // Use optimized middleware pattern for read operations
    return this.executeWithMiddleware(
      context,
      'read', // Pattern: parsing + validation + caching
      {
        path: SessionValidationSchemas.sessionId(),
      },
      async () => {
        const pathParams = context.parsedData?.path!;
        
        const sessionService = this.serviceFactory.getSessionService();
        const result = await sessionService.getSession(pathParams.id);

        this.logger.info('Session retrieved successfully', {
          requestId: context.requestId,
          sessionId: result.session.sessionId,
          status: result.session.status,
          currentQuestion: result.progress.currentQuestion,
          totalQuestions: result.progress.totalQuestions,
          accuracy: result.progress.accuracy,
        });

        return result;
      }
    );
  }

  /**
   * Update an existing study session - now clean and focused
   */
  private async updateSession(context: HandlerContext): Promise<ApiResponse> {
    // Use type-aware validation that corresponds to UpdateSessionRequest interface
    return this.executeWithMiddleware(
      context,
      'write', // Pattern: parsing + validation + error handling
      {
        path: AdditionalValidationHelpers.createEnhancedSessionIdValidation(),
        body: AdditionalValidationHelpers.createEnhancedUpdateValidation(),
      },
      async () => {
        const pathParams = context.parsedData?.path!;
        const requestBody = context.parsedData?.body as UpdateSessionRequest;
        
        const sessionService = this.serviceFactory.getSessionService();
        const result = await sessionService.updateSession(pathParams.id, requestBody);

        this.logger.info('Session updated successfully with type-safe validation', {
          requestId: context.requestId,
          sessionId: result.session.sessionId,
          status: result.session.status,
          currentQuestion: result.progress.currentQuestion,
          action: requestBody.action,
          validationType: 'UpdateSessionRequest',
        });

        return result;
      }
    );
  }

  /**
   * Delete a study session - Phase 19 implementation
   */
  private async deleteSession(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate session ID using standardized helper
    const sessionIdValidation = this.validateSessionId(pathParams);
    if (sessionIdValidation) return sessionIdValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.deleteSession(pathParams.id);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.DELETE,
        additionalInfo: { sessionId: pathParams.id },
      }
    );

    if (error) return error;

    this.logger.info('Session deleted successfully', {
      requestId: context.requestId,
      sessionId: pathParams.id,
    });

    return this.buildSuccessResponse('Session deleted successfully', result);
  }

  /**
   * Submit answer for a question in a session - Phase 20 implementation
   */
  /**
   * Submit answer for a question in a session - Enhanced with optimized middleware integration
   */
  private async submitAnswer(context: HandlerContext): Promise<ApiResponse> {
    // Use type-aware validation that corresponds to SubmitAnswerRequest interface
    return this.executeWithMiddleware(
      context,
      'write', // Pattern: parsing + validation + error handling
      {
        path: AdditionalValidationHelpers.createEnhancedSessionIdValidation(),
        body: AdditionalValidationHelpers.createEnhancedAnswerValidation(),
      },
      async () => {
        const pathParams = context.parsedData?.path!;
        const requestBody = context.parsedData?.body as SubmitAnswerRequest;
        
        const sessionService = this.serviceFactory.getSessionService();
        const result = await sessionService.submitAnswer(pathParams.id, requestBody);

        this.logger.info('Answer submitted successfully with type-safe validation', {
          requestId: context.requestId,
          sessionId: pathParams.id,
          questionId: requestBody.questionId,
          isCorrect: result.feedback.isCorrect,
          score: result.feedback.score,
          sessionStatus: result.session.status,
          validationType: 'SubmitAnswerRequest',
        });

        return result;
      }
    );
  }

  /**
   * Complete a study session - Phase 21 implementation
   */
  private async completeSession(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate session ID using standardized helper
    const sessionIdValidation = this.validateSessionId(pathParams);
    if (sessionIdValidation) return sessionIdValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.completeSession(pathParams.id);
      },
      {
        requestId: context.requestId,
        operation: 'SESSION_COMPLETE',
        additionalInfo: { sessionId: pathParams.id },
      }
    );

    if (error) return error;

    this.logger.info('Session completed successfully', {
      requestId: context.requestId,
      sessionId: pathParams.id,
      finalScore: result!.detailedResults.finalScore,
      accuracy: result!.detailedResults.accuracyPercentage,
      overallRecommendation: result!.recommendations.overallRecommendation,
      readinessForExam: result!.recommendations.readinessForExam,
    });

    return this.buildSuccessResponse('Session completed successfully', result);
  }

  /**
   * Create an adaptive study session - Phase 22 implementation
   * Reuses existing createSession logic with isAdaptive flag
   */
  private async createAdaptiveSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } =
      await this.parseRequestBodyOrError<CreateSessionRequest>(context, true);
    if (parseError) return parseError;

    // Use same validation as createSession (now using schema)
    const validationResult = ValidationMiddleware.validateRequestBody(
      context,
      SessionValidationSchemas.createSessionRequest()
    );
    if (validationResult.error) return validationResult.error;

    // Mark as adaptive and delegate to existing createSession logic
    const adaptiveRequest = { ...requestBody, isAdaptive: true };
    return await this.createSession({
      ...context,
      event: { ...context.event, body: JSON.stringify(adaptiveRequest) },
    });
  }
}

// Export handler function for Lambda
const sessionHandler = new SessionHandler();
export const handler = sessionHandler.handle;
