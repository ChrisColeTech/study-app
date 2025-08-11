// Session handler for Study App V3 Backend
// Phase 15: Session Creation Feature

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  CreateSessionRequest
} from '../shared/types/session.types';

export class SessionHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'SessionHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // Create new session endpoint
      {
        method: 'POST',
        path: '/v1/sessions',
        handler: this.createSession.bind(this),
        requireAuth: true, // Sessions require authentication
      }
    ];
  }

  /**
   * Create a new study session with configuration
   * POST /v1/sessions
   * Phase 15: Session Creation Feature
   */
  private async createSession(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Creating new session', { 
        requestId: context.requestId,
        ...(context.userId ? { userId: context.userId } : {}),
        hasBody: !!context.event.body
      });

      // Validate authentication - user ID should be available from auth middleware
      if (!context.userId) {
        return this.error(
          ERROR_CODES.UNAUTHORIZED,
          'Authentication required to create sessions'
        );
      }

      // Parse and validate request body
      if (!context.event.body) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Request body is required'
        );
      }

      let requestBody: any;
      try {
        requestBody = JSON.parse(context.event.body);
      } catch (error) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON in request body'
        );
      }

      // Validate required fields
      const validationError = this.validateCreateSessionRequest(requestBody);
      if (validationError) {
        return validationError;
      }

      // Build session creation request
      const request: CreateSessionRequest = {
        examId: requestBody.examId,
        providerId: requestBody.providerId,
        sessionType: requestBody.sessionType,
        questionCount: requestBody.questionCount,
        topics: requestBody.topics,
        difficulty: requestBody.difficulty,
        timeLimit: requestBody.timeLimit
      };

      this.logger.debug('Session creation request validated', {
        requestId: context.requestId,
        userId: context.userId,
        examId: request.examId,
        providerId: request.providerId,
        sessionType: request.sessionType,
        questionCount: request.questionCount,
        topicsCount: request.topics?.length || 0
      });

      // Create session through service
      const sessionService = this.serviceFactory.getSessionService();
      const result = await sessionService.createSession(context.userId, request);

      this.logger.info('Session created successfully', { 
        requestId: context.requestId,
        userId: context.userId,
        sessionId: result.session.sessionId,
        totalQuestions: result.session.totalQuestions,
        providerId: result.session.providerId,
        examId: result.session.examId
      });

      return this.success(result, 'Session created successfully');

    } catch (error: any) {
      this.logger.error('Failed to create session', error, { 
        requestId: context.requestId,
        ...(context.userId ? { userId: context.userId } : {}),
        hasBody: !!context.event.body
      });

      // Handle specific error types
      if (error.message.includes('Invalid provider') || 
          error.message.includes('Invalid exam') ||
          error.message.includes('Invalid topic')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      if (error.message.includes('No questions found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          'No questions found matching the specified criteria. Please adjust your filters.'
        );
      }

      if (error.message.includes('Question count must be') || 
          error.message.includes('Time limit must be') ||
          error.message.includes('validation') ||
          error.message.includes('Invalid')) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          error.message
        );
      }

      if (error.message.includes('already exists')) {
        return this.error(
          ERROR_CODES.CONFLICT,
          'Session creation failed due to ID conflict. Please try again.'
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to create session'
      );
    }
  }

  /**
   * Validate create session request body
   */
  private validateCreateSessionRequest(requestBody: any): ApiResponse | null {
    // Check required fields
    if (!requestBody.examId || typeof requestBody.examId !== 'string') {
      return this.error(
        ERROR_CODES.VALIDATION_ERROR,
        'examId is required and must be a string'
      );
    }

    if (!requestBody.providerId || typeof requestBody.providerId !== 'string') {
      return this.error(
        ERROR_CODES.VALIDATION_ERROR,
        'providerId is required and must be a string'
      );
    }

    if (!requestBody.sessionType || typeof requestBody.sessionType !== 'string') {
      return this.error(
        ERROR_CODES.VALIDATION_ERROR,
        'sessionType is required and must be a string'
      );
    }

    // Validate session type enum
    const validSessionTypes = ['practice', 'exam', 'review'];
    if (!validSessionTypes.includes(requestBody.sessionType)) {
      return this.error(
        ERROR_CODES.VALIDATION_ERROR,
        `sessionType must be one of: ${validSessionTypes.join(', ')}`
      );
    }

    // Validate provider ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.providerId)) {
      return this.error(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid providerId format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    // Validate exam ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(requestBody.examId)) {
      return this.error(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid examId format. Use alphanumeric characters, hyphens, and underscores only'
      );
    }

    // Validate optional fields
    if (requestBody.questionCount !== undefined) {
      if (typeof requestBody.questionCount !== 'number' || 
          requestBody.questionCount < 1 || 
          requestBody.questionCount > 200) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'questionCount must be a number between 1 and 200'
        );
      }
    }

    if (requestBody.topics !== undefined) {
      if (!Array.isArray(requestBody.topics)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'topics must be an array'
        );
      }

      for (const topic of requestBody.topics) {
        if (typeof topic !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(topic)) {
          return this.error(
            ERROR_CODES.VALIDATION_ERROR,
            'Each topic must be a string with alphanumeric characters, hyphens, and underscores only'
          );
        }
      }

      if (requestBody.topics.length > 20) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Maximum 20 topics allowed'
        );
      }
    }

    if (requestBody.difficulty !== undefined) {
      const validDifficulties = ['easy', 'medium', 'hard'];
      if (!validDifficulties.includes(requestBody.difficulty)) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          `difficulty must be one of: ${validDifficulties.join(', ')}`
        );
      }
    }

    if (requestBody.timeLimit !== undefined) {
      if (typeof requestBody.timeLimit !== 'number' || 
          requestBody.timeLimit < 5 || 
          requestBody.timeLimit > 300) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'timeLimit must be a number between 5 and 300 minutes'
        );
      }
    }

    return null; // No validation errors
  }
}

// Export handler function for Lambda
const sessionHandler = new SessionHandler();
export const handler = sessionHandler.handle;