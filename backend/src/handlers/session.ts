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
  UpdateSessionRequest
} from '../shared/types/session.types';

// Import new middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  AuthMiddleware,
  AuthConfigs,
  AuthenticatedContext
} from '../shared/middleware';

export class SessionHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'SessionHandler' });

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
        requireAuth: true,
      },
      {
        method: 'GET',
        path: '/v1/sessions/{id}',
        handler: this.getSession.bind(this),
        requireAuth: true,
      },
      {
        method: 'PUT',
        path: '/v1/sessions/{id}',
        handler: this.updateSession.bind(this),
        requireAuth: true,
      }
    ];
  }

  /**
   * Create a new study session - now clean and focused
   */
  private async createSession(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = ParsingMiddleware.parseRequestBody<CreateSessionRequest>(context, true);
    if (parseError) return parseError;

    // Validate using helper method (extracted from massive validation block)
    const validationError = this.validateCreateSessionRequest(requestBody);
    if (validationError) return validationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.createSession(authenticatedContext!.userId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.CREATE,
        userId: authenticatedContext!.userId,
        additionalInfo: { 
          examId: requestBody.examId,
          providerId: requestBody.providerId,
          sessionType: requestBody.sessionType
        }
      }
    );

    if (error) return error;

    this.logger.info('Session created successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      sessionId: result!.session.sessionId,
      totalQuestions: result!.session.totalQuestions,
      providerId: result!.session.providerId,
      examId: result!.session.examId
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session created successfully');
  }

  /**
   * Get an existing study session - now clean and focused
   */
  private async getSession(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate session ID
    const sessionValidationError = this.validateSessionId(pathParams.id);
    if (sessionValidationError) return sessionValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const sessionService: SessionService = this.serviceFactory.getSessionService() as SessionService;
        return await sessionService.getSession(pathParams.id, authenticatedContext!.userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.GET,
        userId: authenticatedContext!.userId,
        additionalInfo: { sessionId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Session retrieved successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      sessionId: result!.session.sessionId,
      status: result!.session.status,
      currentQuestion: result!.progress.currentQuestion,
      totalQuestions: result!.progress.totalQuestions,
      accuracy: result!.progress.accuracy
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session retrieved successfully');
  }

  /**
   * Update an existing study session - now clean and focused
   */
  private async updateSession(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Parse and validate request body using middleware
    const { data: requestBody, error: bodyParseError } = ParsingMiddleware.parseRequestBody<UpdateSessionRequest>(context, true);
    if (bodyParseError) return bodyParseError;

    // Validate session ID and request body
    const sessionValidationError = this.validateSessionId(pathParams.id);
    if (sessionValidationError) return sessionValidationError;

    const updateValidationError = this.validateUpdateSessionRequest(requestBody);
    if (updateValidationError) return updateValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const sessionService: SessionService = this.serviceFactory.getSessionService() as SessionService;
        return await sessionService.updateSession(pathParams.id, authenticatedContext!.userId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.UPDATE,
        userId: authenticatedContext!.userId,
        additionalInfo: { 
          sessionId: pathParams.id,
          action: requestBody.action
        }
      }
    );

    if (error) return error;

    this.logger.info('Session updated successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      sessionId: result!.session.sessionId,
      status: result!.session.status,
      currentQuestion: result!.progress.currentQuestion,
      action: requestBody.action
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session updated successfully');
  }

  /**
   * Helper method to validate create session request - extracted from 107-line validation block
   */
  private validateCreateSessionRequest(requestBody: any): ApiResponse | null {
    // Check required fields
    if (!requestBody.examId || typeof requestBody.examId !== 'string') {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'examId is required and must be a string'
      );
    }

    if (!requestBody.providerId || typeof requestBody.providerId !== 'string') {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'providerId is required and must be a string'
      );
    }

    if (!requestBody.sessionType || typeof requestBody.sessionType !== 'string') {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'sessionType is required and must be a string'
      );
    }

    // Validate session type enum
    const validSessionTypes = ['practice', 'exam', 'review'];
    if (!validSessionTypes.includes(requestBody.sessionType)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `sessionType must be one of: ${validSessionTypes.join(', ')}`
      );
    }

    // Validate ID formats
    if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.providerId)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid providerId format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.examId)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid examId format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    // Validate optional fields
    if (requestBody.questionCount !== undefined) {
      if (typeof requestBody.questionCount !== 'number' || 
          requestBody.questionCount < 1 || 
          requestBody.questionCount > 200) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'questionCount must be a number between 1 and 200'
        );
      }
    }

    if (requestBody.topics !== undefined) {
      if (!Array.isArray(requestBody.topics)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'topics must be an array'
        );
      }

      if (requestBody.topics.length > 20) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Maximum 20 topics allowed'
        );
      }

      for (const topic of requestBody.topics) {
        if (typeof topic !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(topic)) {
          return ErrorHandlingMiddleware.createErrorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            'Each topic must be a string with alphanumeric characters, hyphens, and underscores only'
          );
        }
      }
    }

    if (requestBody.timeLimit !== undefined) {
      if (typeof requestBody.timeLimit !== 'number' || 
          requestBody.timeLimit < 5 || 
          requestBody.timeLimit > 300) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'timeLimit must be a number between 5 and 300 minutes'
        );
      }
    }

    return null; // No validation errors
  }

  /**
   * Helper method to validate session ID - extracted from repetitive validation
   */
  private validateSessionId(sessionId: string | undefined): ApiResponse | null {
    if (!sessionId) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Session ID is required'
      );
    }

    if (!/^[a-f0-9-]{36}$/.test(sessionId)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid session ID format'
      );
    }

    return null;
  }

  /**
   * Helper method to validate update session request - extracted from 96-line validation block
   */
  private validateUpdateSessionRequest(requestBody: any): ApiResponse | null {
    // Check required action field
    if (!requestBody.action || typeof requestBody.action !== 'string') {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'action is required and must be a string'
      );
    }

    // Validate action enum
    const validActions = ['pause', 'resume', 'next', 'previous', 'answer', 'mark_for_review', 'complete'];
    if (!validActions.includes(requestBody.action)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `action must be one of: ${validActions.join(', ')}`
      );
    }

    // Validate status if provided
    if (requestBody.status !== undefined) {
      const validStatuses = ['active', 'paused', 'completed', 'abandoned'];
      if (!validStatuses.includes(requestBody.status)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${validStatuses.join(', ')}`
        );
      }
    }

    // Validate currentQuestionIndex if provided
    if (requestBody.currentQuestionIndex !== undefined) {
      if (typeof requestBody.currentQuestionIndex !== 'number' || 
          requestBody.currentQuestionIndex < 0) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'currentQuestionIndex must be a non-negative number'
        );
      }
    }

    // Validate answer-specific fields
    if (requestBody.action === 'answer') {
      if (!requestBody.questionId || typeof requestBody.questionId !== 'string') {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'questionId is required when submitting an answer'
        );
      }

      if (!requestBody.userAnswer || !Array.isArray(requestBody.userAnswer)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'userAnswer is required and must be an array when submitting an answer'
        );
      }

      if (requestBody.timeSpent === undefined || typeof requestBody.timeSpent !== 'number' || requestBody.timeSpent < 0) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'timeSpent is required and must be a non-negative number when submitting an answer'
        );
      }
    }

    return null; // No validation errors
  }
}

// Export handler function for Lambda
const sessionHandler = new SessionHandler();
export const handler = sessionHandler.handle;