import { ServiceFactory } from './service-factory';
import { createLogger } from './logger';
import { ApiResponse, HandlerContext } from './types/api.types';
import { ERROR_CODES } from './constants/error.constants';
import { ErrorContexts } from './middleware';
import { ValidationMiddleware } from './middleware';
import { SessionValidationSchemas } from './middleware';
import { AdditionalValidationHelpers } from './middleware';
import {
  CreateSessionRequest,
  UpdateSessionRequest,
  SubmitAnswerRequest,
} from './types/session.types';

/**
 * SessionOrchestrator - Business Logic Coordination for Session Operations
 * 
 * Extracted from SessionHandler (Objective 40) following GoalsOrchestrator pattern
 * Handles session business logic orchestration while maintaining handler routing focus
 */
export class SessionOrchestrator {
  private static instance: SessionOrchestrator;
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ component: 'SessionOrchestrator' });

  // Session error mappings for standardization - moved from SessionHandler
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

  private constructor() {
    this.serviceFactory = ServiceFactory.getInstance();
  }

  public static getInstance(): SessionOrchestrator {
    if (!SessionOrchestrator.instance) {
      SessionOrchestrator.instance = new SessionOrchestrator();
    }
    return SessionOrchestrator.instance;
  }

  /**
   * Validate session ID and return error response if invalid
   */
  public validateSessionIdOrError(pathParams: any): ApiResponse | null {
    return ValidationMiddleware.validateFields(
      { sessionId: pathParams.id },
      SessionValidationSchemas.sessionId(),
      'params'
    );
  }

  /**
   * Get session error mappings for specific operation
   */
  public getSessionErrorMappings(operation: keyof typeof SessionOrchestrator.SESSION_ERROR_MAPPINGS) {
    return SessionOrchestrator.SESSION_ERROR_MAPPINGS[operation] || SessionOrchestrator.SESSION_ERROR_MAPPINGS.COMMON;
  }

  /**
   * Orchestrate session creation with validation and service coordination
   */
  public async orchestrateCreateSession(
    context: HandlerContext,
    executeServiceOrError: Function
  ): Promise<any> {
    // Use type-aware validation that corresponds to CreateSessionRequest interface
    const validationResult = ValidationMiddleware.validateRequestBody(
      context,
      AdditionalValidationHelpers.createEnhancedSessionValidation()
    );
    if (validationResult.error) return { error: validationResult.error };

    const requestBody = context.parsedData?.body as CreateSessionRequest;

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.createSession(requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.CREATE,
        additionalInfo: {
          providerId: requestBody.providerId,
          examId: requestBody.examId,
          totalQuestions: requestBody.questionCount,
          validationType: 'CreateSessionRequest',
        },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Session created successfully with type-safe validation', {
      requestId: context.requestId,
      sessionId: result.session.sessionId,
      totalQuestions: result.session.totalQuestions,
      providerId: result.session.providerId,
      examId: result.session.examId,
      validationType: 'CreateSessionRequest',
    });

    return { result };
  }

  /**
   * Orchestrate session retrieval with validation coordination
   */
  public async orchestrateGetSession(
    context: HandlerContext,
    sessionId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.getSession(sessionId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.GET,
        additionalInfo: { sessionId },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Session retrieved successfully', {
      requestId: context.requestId,
      sessionId: result.session.sessionId,
      status: result.session.status,
      currentQuestion: result.progress.currentQuestion,
      totalQuestions: result.progress.totalQuestions,
      accuracy: result.progress.accuracy,
    });

    return { result };
  }

  /**
   * Orchestrate session update with validation coordination
   */
  public async orchestrateUpdateSession(
    context: HandlerContext,
    sessionId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Use type-aware validation that corresponds to UpdateSessionRequest interface
    const validationResult = ValidationMiddleware.validateRequestBody(
      context,
      AdditionalValidationHelpers.createEnhancedUpdateValidation()
    );
    if (validationResult.error) return { error: validationResult.error };

    const requestBody = context.parsedData?.body as UpdateSessionRequest;

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.updateSession(sessionId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.UPDATE,
        additionalInfo: {
          sessionId,
          action: requestBody.action,
          validationType: 'UpdateSessionRequest',
        },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Session updated successfully with type-safe validation', {
      requestId: context.requestId,
      sessionId: result.session.sessionId,
      status: result.session.status,
      currentQuestion: result.progress.currentQuestion,
      action: requestBody.action,
      validationType: 'UpdateSessionRequest',
    });

    return { result };
  }

  /**
   * Orchestrate session deletion with validation coordination
   */
  public async orchestrateDeleteSession(
    context: HandlerContext,
    sessionId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.deleteSession(sessionId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.DELETE,
        additionalInfo: { sessionId },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Session deleted successfully', {
      requestId: context.requestId,
      sessionId: sessionId,
    });

    return { result };
  }

  /**
   * Orchestrate answer submission with validation coordination
   */
  public async orchestrateSubmitAnswer(
    context: HandlerContext,
    sessionId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Use type-aware validation that corresponds to SubmitAnswerRequest interface
    const validationResult = ValidationMiddleware.validateRequestBody(
      context,
      AdditionalValidationHelpers.createEnhancedAnswerValidation()
    );
    if (validationResult.error) return { error: validationResult.error };

    const requestBody = context.parsedData?.body as SubmitAnswerRequest;

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.submitAnswer(sessionId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.UPDATE,
        additionalInfo: {
          sessionId,
          questionId: requestBody.questionId,
          validationType: 'SubmitAnswerRequest',
        },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Answer submitted successfully with type-safe validation', {
      requestId: context.requestId,
      sessionId: sessionId,
      questionId: requestBody.questionId,
      isCorrect: result.feedback.isCorrect,
      score: result.feedback.score,
      sessionStatus: result.session.status,
      validationType: 'SubmitAnswerRequest',
    });

    return { result };
  }

  /**
   * Orchestrate session completion with validation coordination
   */
  public async orchestrateCompleteSession(
    context: HandlerContext,
    sessionId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.completeSession(sessionId);
      },
      {
        requestId: context.requestId,
        operation: 'SESSION_COMPLETE',
        additionalInfo: { sessionId },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Session completed successfully', {
      requestId: context.requestId,
      sessionId: sessionId,
      finalScore: result!.detailedResults.finalScore,
      accuracy: result!.detailedResults.accuracyPercentage,
      overallRecommendation: result!.recommendations.overallRecommendation,
      readinessForExam: result!.recommendations.readinessForExam,
    });

    return { result };
  }

  /**
   * Orchestrate adaptive session creation with validation coordination
   */
  public async orchestrateCreateAdaptiveSession(
    context: HandlerContext,
    executeServiceOrError: Function
  ): Promise<any> {
    // Use same validation as createSession but mark as adaptive
    const validationResult = ValidationMiddleware.validateRequestBody(
      context,
      SessionValidationSchemas.createSessionRequest()
    );
    if (validationResult.error) return { error: validationResult.error };

    const requestBody = context.parsedData?.body as CreateSessionRequest;
    
    // Mark as adaptive and delegate to existing createSession logic
    const adaptiveRequest = { ...requestBody, isAdaptive: true };

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const sessionService = this.serviceFactory.getSessionService();
        return await sessionService.createSession(adaptiveRequest);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Session.CREATE,
        additionalInfo: {
          providerId: adaptiveRequest.providerId,
          examId: adaptiveRequest.examId,
          totalQuestions: adaptiveRequest.questionCount,
          isAdaptive: true,
          validationType: 'CreateSessionRequest',
        },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Adaptive session created successfully', {
      requestId: context.requestId,
      sessionId: result.session.sessionId,
      totalQuestions: result.session.totalQuestions,
      providerId: result.session.providerId,
      examId: result.session.examId,
      isAdaptive: true,
      validationType: 'CreateSessionRequest',
    });

    return { result };
  }
}