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
  SubmitAnswerRequest
} from '../shared/types/session.types';

// Import new middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  ValidationMiddleware,
  ValidationRules,
  AuthMiddleware,
  AuthConfigs,
  AuthenticatedContext
} from '../shared/middleware';
import { SessionValidationSchemas } from '../shared/middleware/validation-schemas';

export class SessionHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'SessionHandler' });
  // Common session error mappings for standardization
  private static readonly SESSION_ERROR_MAPPINGS = {
    COMMON: [
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404
      }
    ],
    DELETE: [
      {
        keywords: ['Cannot delete completed'],
        errorCode: 'CONFLICT',
        statusCode: 409
      },
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404
      }
    ],
    COMPLETE: [
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404
      },
      {
        keywords: ['Session is already completed'],
        errorCode: 'CONFLICT',
        statusCode: 409
      },
      {
        keywords: ['Cannot complete abandoned session'],
        errorCode: 'CONFLICT',
        statusCode: 409
      },
      {
        keywords: ['Cannot complete session:', 'questions remain unanswered'],
        errorCode: 'VALIDATION_ERROR',
        statusCode: 400
      }
    ],
    SUBMIT_ANSWER: [
      {
        keywords: ['Session not found'],
        errorCode: 'NOT_FOUND',
        statusCode: 404
      },
      {
        keywords: ['Cannot submit answers to inactive'],
        errorCode: 'CONFLICT',
        statusCode: 409
      },
      {
        keywords: ['Question not found in session'],
        errorCode: 'VALIDATION_ERROR',
        statusCode: 400
      }
    ]
  };

  // Common session ID validation helper
  private validateSessionId(pathParams: any): ApiResponse | null {
    return ValidationMiddleware.validateFields({ sessionId: pathParams.id }, SessionValidationSchemas.sessionId(), 'params');
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
      }
    ];
  }

  /**
   * Create a new study session - now clean and focused
   */
  private async createSession(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = await this.parseRequestBodyOrError<CreateSessionRequest>(context, true);
    if (parseError) return parseError;

    // Validate using comprehensive schema (replaces validateCreateSessionRequest)
    const validationResult = ValidationMiddleware.validateRequestBody(context, SessionValidationSchemas.createSessionRequest());
    if (validationResult.error) return validationResult.error;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.createSession(requestBody!);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.CREATE,
        additionalInfo: { 
          examId: requestBody!.examId,
          providerId: requestBody!.providerId,
          sessionType: requestBody!.sessionType
        }
      }
    );

    if (error) return error;

    this.logger.info('Session created successfully', { 
      requestId: context.requestId,
      sessionId: result!.session.sessionId,
      totalQuestions: result!.session.totalQuestions,
      providerId: result!.session.providerId,
      examId: result!.session.examId
    });

    return this.buildSuccessResponse('Session created successfully', result);
  }

  /**
   * Get an existing study session - now clean and focused
   */
  private async getSession(context: HandlerContext): Promise<ApiResponse> {
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
        return await sessionService.getSession(pathParams.id);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.GET,
        additionalInfo: { sessionId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Session retrieved successfully', { 
      requestId: context.requestId,
      sessionId: result!.session.sessionId,
      status: result!.session.status,
      currentQuestion: result!.progress.currentQuestion,
      totalQuestions: result!.progress.totalQuestions,
      accuracy: result!.progress.accuracy
    });

    return this.buildSuccessResponse('Session retrieved successfully', result);
  }

  /**
   * Update an existing study session - now clean and focused
   */
  private async updateSession(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Parse and validate request body using middleware
    const { data: requestBody, error: bodyParseError } = ParsingMiddleware.parseRequestBody<UpdateSessionRequest>(context, true);
    if (bodyParseError) return bodyParseError;

    // Validate session ID using standardized helper
    const sessionIdValidation = this.validateSessionId(pathParams);
    if (sessionIdValidation) return sessionIdValidation;

    // Validate update request using ValidationMiddleware
    const updateValidation = ValidationMiddleware.validateFields(requestBody, SessionValidationSchemas.updateSessionRequest(), 'body');
    if (updateValidation) return updateValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.updateSession(pathParams.id, requestBody!);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.UPDATE,
        additionalInfo: { 
          sessionId: pathParams.id,
          action: requestBody!.action
        }
      }
    );

    if (error) return error;

    this.logger.info('Session updated successfully', { 
      requestId: context.requestId,
      sessionId: result!.session.sessionId,
      status: result!.session.status,
      currentQuestion: result!.progress.currentQuestion,
      action: requestBody!.action
    });

    return this.buildSuccessResponse('Session updated successfully', result);
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
        additionalInfo: { sessionId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Session deleted successfully', { 
      requestId: context.requestId,
      sessionId: pathParams.id
    });

    return this.buildSuccessResponse('Session deleted successfully', result);
  }

  /**
   * Submit answer for a question in a session - Phase 20 implementation
   */
  private async submitAnswer(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Parse and validate request body using middleware
    const { data: requestBody, error: bodyParseError } = ParsingMiddleware.parseRequestBody<SubmitAnswerRequest>(context, true);
    if (bodyParseError) return bodyParseError;

    // Validate session ID using standardized helper
    const sessionIdValidation = this.validateSessionId(pathParams);
    if (sessionIdValidation) return sessionIdValidation;

    // Validate answer submission using ValidationMiddleware
    const answerValidation = ValidationMiddleware.validateFields(requestBody, SessionValidationSchemas.submitAnswerRequest(), 'body');
    if (answerValidation) return answerValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.submitAnswer(pathParams.id, requestBody!);
      },
      {
        requestId: context.requestId,
        operation: 'SESSION_SUBMIT_ANSWER',
        additionalInfo: { 
          sessionId: pathParams.id,
          questionId: requestBody!.questionId
        }
      }
    );

    if (error) return error;

    this.logger.info('Answer submitted successfully', { 
      requestId: context.requestId,
      sessionId: pathParams.id,
      questionId: requestBody!.questionId,
      isCorrect: result!.feedback.isCorrect,
      score: result!.feedback.score,
      sessionStatus: result!.session.status
    });

    return this.buildSuccessResponse('Answer submitted successfully', result);
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
        additionalInfo: { sessionId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Session completed successfully', { 
      requestId: context.requestId,
      sessionId: pathParams.id,
      finalScore: result!.detailedResults.finalScore,
      accuracy: result!.detailedResults.accuracyPercentage,
      overallRecommendation: result!.recommendations.overallRecommendation,
      readinessForExam: result!.recommendations.readinessForExam
    });

    return this.buildSuccessResponse('Session completed successfully', result);
  }

  /**
   * Create an adaptive study session - Phase 22 implementation
   * Reuses existing createSession logic with isAdaptive flag
   */
  private async createAdaptiveSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = await this.parseRequestBodyOrError<CreateSessionRequest>(context, true);
    if (parseError) return parseError;

    // Use same validation as createSession (now using schema)
    const validationResult = ValidationMiddleware.validateRequestBody(context, SessionValidationSchemas.createSessionRequest());
    if (validationResult.error) return validationResult.error;

    // Mark as adaptive and delegate to existing createSession logic
    const adaptiveRequest = { ...requestBody, isAdaptive: true };
    return await this.createSession({ ...context, event: { ...context.event, body: JSON.stringify(adaptiveRequest) } });
  }




}

// Export handler function for Lambda
const sessionHandler = new SessionHandler();
export const handler = sessionHandler.handle;