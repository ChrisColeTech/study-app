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
    const { data: requestBody, error: parseError } = ParsingMiddleware.parseRequestBody<CreateSessionRequest>(context, true);
    if (parseError) return parseError;

    // Use ValidationMiddleware properly
    const validationResult = ValidationMiddleware.validateRequestBody(context, {
      required: ['examId', 'providerId', 'sessionType'],
      rules: [
        { field: 'examId', validate: ValidationRules.stringLength(1) },
        { field: 'providerId', validate: ValidationRules.stringLength(1) },
        { field: 'sessionType', validate: (value) => 
          ['practice', 'exam', 'review'].includes(value) 
            ? { isValid: true }
            : { isValid: false, error: 'Must be practice, exam, or review' }
        }
      ]
    });
    if (validationResult.error) return validationResult.error;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.createSession(requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.CREATE,
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
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate session ID
    const sessionValidationError = this.validateSessionId(pathParams.id);
    if (sessionValidationError) return sessionValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
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

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session retrieved successfully');
  }

  /**
   * Update an existing study session - now clean and focused
   */
  private async updateSession(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

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
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.updateSession(pathParams.id, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.UPDATE,
        additionalInfo: { 
          sessionId: pathParams.id,
          action: requestBody.action
        }
      }
    );

    if (error) return error;

    this.logger.info('Session updated successfully', { 
      requestId: context.requestId,
      sessionId: result!.session.sessionId,
      status: result!.session.status,
      currentQuestion: result!.progress.currentQuestion,
      action: requestBody.action
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session updated successfully');
  }

  /**
   * Delete a study session - Phase 19 implementation
   */
  private async deleteSession(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate session ID
    const sessionValidationError = this.validateSessionId(pathParams.id);
    if (sessionValidationError) return sessionValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.deleteSession(pathParams.id);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.DELETE,
        additionalInfo: { sessionId: pathParams.id }
      },
      // Use service-specific error mappings for proper business logic error handling
      [
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
      ]
    );

    if (error) return error;

    this.logger.info('Session deleted successfully', { 
      requestId: context.requestId,
      sessionId: pathParams.id
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session deleted successfully');
  }

  /**
   * Submit answer for a question in a session - Phase 20 implementation
   */
  private async submitAnswer(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Parse and validate request body using middleware
    const { data: requestBody, error: bodyParseError } = ParsingMiddleware.parseRequestBody<SubmitAnswerRequest>(context, true);
    if (bodyParseError) return bodyParseError;

    // Validate session ID
    const sessionValidationError = this.validateSessionId(pathParams.id);
    if (sessionValidationError) return sessionValidationError;

    // Validate answer submission request
    const answerValidationError = this.validateSubmitAnswerRequest(requestBody);
    if (answerValidationError) return answerValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.submitAnswer(pathParams.id, requestBody);
      },
      {
        requestId: context.requestId,
        operation: 'SESSION_SUBMIT_ANSWER',
        additionalInfo: { 
          sessionId: pathParams.id,
          questionId: requestBody.questionId
        }
      },
      // Use service-specific error mappings for proper business logic error handling
      [
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
    );

    if (error) return error;

    this.logger.info('Answer submitted successfully', { 
      requestId: context.requestId,
      sessionId: pathParams.id,
      questionId: requestBody.questionId,
      isCorrect: result!.feedback.isCorrect,
      score: result!.feedback.score,
      sessionStatus: result!.session.status
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Answer submitted successfully');
  }

  /**
   * Complete a study session - Phase 21 implementation
   */
  private async completeSession(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required - sessions work independently (auth association in Phase 30)

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate session ID
    const sessionValidationError = this.validateSessionId(pathParams.id);
    if (sessionValidationError) return sessionValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.completeSession(pathParams.id);
      },
      {
        requestId: context.requestId,
        operation: 'SESSION_COMPLETE',
        additionalInfo: { sessionId: pathParams.id }
      },
      // Use service-specific error mappings for proper business logic error handling
      [
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
      ]
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

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session completed successfully');
  }

  /**
   * Create an adaptive study session - Phase 22 implementation
   * Reuses existing createSession logic with isAdaptive flag
   */
  private async createAdaptiveSession(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = ParsingMiddleware.parseRequestBody<CreateSessionRequest>(context, true);
    if (parseError) return parseError;

    // Use same validation as createSession
    const validationResult = ValidationMiddleware.validateRequestBody(context, {
      required: ['examId', 'providerId', 'sessionType'],
      rules: [
        { field: 'examId', validate: ValidationRules.stringLength(1) },
        { field: 'providerId', validate: ValidationRules.stringLength(1) },
        { field: 'sessionType', validate: (value) => 
          ['practice', 'exam', 'review'].includes(value) 
            ? { isValid: true }
            : { isValid: false, error: 'Must be practice, exam, or review' }
        }
      ]
    });
    if (validationResult.error) return validationResult.error;

    // Mark as adaptive and delegate to existing createSession logic
    const adaptiveRequest = { ...requestBody, isAdaptive: true };
    return await this.createSession({ ...context, event: { ...context.event, body: JSON.stringify(adaptiveRequest) } });
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

  /**
   * Helper method to validate submit answer request - Phase 20 implementation
   */
  private validateSubmitAnswerRequest(requestBody: any): ApiResponse | null {
    // Check required fields
    if (!requestBody.questionId || typeof requestBody.questionId !== 'string') {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'questionId is required and must be a string'
      );
    }

    if (!requestBody.answer || !Array.isArray(requestBody.answer)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'answer is required and must be an array'
      );
    }

    if (requestBody.answer.length === 0) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'answer array cannot be empty'
      );
    }

    // Validate all answers are strings
    for (const answer of requestBody.answer) {
      if (typeof answer !== 'string') {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'All answers must be strings'
        );
      }
    }

    if (requestBody.timeSpent === undefined || typeof requestBody.timeSpent !== 'number' || requestBody.timeSpent < 0) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'timeSpent is required and must be a non-negative number'
      );
    }

    // Validate optional fields
    if (requestBody.skipped !== undefined && typeof requestBody.skipped !== 'boolean') {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'skipped must be a boolean if provided'
      );
    }

    if (requestBody.markedForReview !== undefined && typeof requestBody.markedForReview !== 'boolean') {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'markedForReview must be a boolean if provided'
      );
    }

    // Validate questionId format (should be a UUID or similar identifier)
    if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.questionId)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid questionId format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    return null; // No validation errors
  }
}

// Export handler function for Lambda
const sessionHandler = new SessionHandler();
export const handler = sessionHandler.handle;