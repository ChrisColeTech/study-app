import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { SessionService } from '../services/session-service';
import { 
  CreateSessionRequest, 
  UpdateSessionRequest, 
  SubmitAnswerRequest, 
  ListSessionsRequest,
  ErrorCode,
  ApiError
} from '../types';
import { ValidationService } from '../services/validation-service';
import Joi from 'joi';

/**
 * Session Handler - Comprehensive study session management
 * Implements complete session lifecycle with question selection, answer processing, and progress tracking
 */
class SessionHandler extends BaseHandler {
  private sessionService: SessionService;
  private validationService: ValidationService;

  constructor() {
    super('SessionHandler');
    this.sessionService = new SessionService();
    this.validationService = new ValidationService();
  }

  public async handleRequest(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    const { httpMethod, resource } = event;
    
    try {
      // Route based on HTTP method and path
      if (httpMethod === 'GET' && !event.pathParameters?.sessionId) {
        // GET /sessions - List sessions
        return await this.listSessions(event, userId);
      } else if (httpMethod === 'GET' && event.pathParameters?.sessionId) {
        // GET /sessions/{sessionId} - Get specific session
        return await this.getSession(event, userId);
      } else if (httpMethod === 'POST' && !event.pathParameters?.sessionId) {
        // POST /sessions - Create new session
        return await this.createSession(event, userId);
      } else if (httpMethod === 'POST' && resource.includes('/answers')) {
        // POST /sessions/{sessionId}/answers - Submit answer
        return await this.submitAnswer(event, userId);
      } else if (httpMethod === 'POST' && resource.includes('/complete')) {
        // POST /sessions/{sessionId}/complete - Complete session
        return await this.completeSession(event, userId);
      } else if (httpMethod === 'PUT' && event.pathParameters?.sessionId) {
        // PUT /sessions/{sessionId} - Update session
        return await this.updateSession(event, userId);
      } else if (httpMethod === 'DELETE' && event.pathParameters?.sessionId) {
        // DELETE /sessions/{sessionId} - Delete session
        return await this.deleteSession(event, userId);
      } else {
        return this.methodNotAllowed('Method or endpoint not supported');
      }
    } catch (error) {
      this.logger.error('Request handling failed', { httpMethod, resource, userId, error });
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        ErrorCode.INTERNAL_ERROR,
        'An unexpected error occurred while processing your request'
      );
    }
  }

  /**
   * GET /sessions - List user sessions with filtering and pagination
   */
  private async listSessions(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      // Parse query parameters
      const status = this.getQueryParam(event, 'status');
      const provider = this.getQueryParam(event, 'provider');
      const exam = this.getQueryParam(event, 'exam');
      const limit = Math.min(parseInt(this.getQueryParam(event, 'limit') || '20'), 100);
      const lastEvaluatedKey = this.getQueryParam(event, 'lastEvaluatedKey');

      // Validate status if provided
      if (status && !['active', 'completed', 'paused', 'expired'].includes(status)) {
        return this.badRequest('Invalid status filter');
      }

      // Get sessions from service
      const result = await this.sessionService.listUserSessions(
        userId, 
        status, 
        limit,
        lastEvaluatedKey ? JSON.parse(decodeURIComponent(lastEvaluatedKey)) : undefined
      );

      // Filter by provider/exam if specified (client-side filtering for now)
      let filteredSessions = result.sessions;
      if (provider) {
        filteredSessions = filteredSessions.filter(s => s.provider === provider);
      }
      if (exam) {
        filteredSessions = filteredSessions.filter(s => s.exam === exam);
      }

      return this.success({
        sessions: filteredSessions,
        hasMore: !!result.lastEvaluatedKey,
        lastEvaluatedKey: result.lastEvaluatedKey 
          ? encodeURIComponent(JSON.stringify(result.lastEvaluatedKey))
          : undefined
      });

    } catch (error) {
      this.logger.error('Failed to list sessions', { userId, error });
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to retrieve sessions');
    }
  }

  /**
   * GET /sessions/{sessionId} - Get session state with current question
   */
  private async getSession(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const sessionId = this.getPathParam(event, 'sessionId');
      if (!sessionId) {
        return this.badRequest('Session ID is required');
      }

      // Get session
      const session = await this.sessionService.getSession(sessionId, userId);
      if (!session) {
        return this.notFound('Session not found');
      }

      // Get current state if session is active
      let currentState = null;
      if (session.status === 'active') {
        currentState = await this.sessionService.getSessionState(sessionId, userId);
      }

      return this.success({
        session,
        currentState
      });

    } catch (error) {
      this.logger.error('Failed to get session', { 
        sessionId: this.getPathParam(event, 'sessionId'), 
        userId, 
        error 
      });
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to retrieve session');
    }
  }

  /**
   * POST /sessions - Create new study session
   */
  private async createSession(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const body = this.parseJsonBody<CreateSessionRequest>(event);
      if (!body) {
        return this.badRequest('Request body is required');
      }

      // Validate request
      const schema = Joi.object({
        provider: Joi.string().required().min(1),
        exam: Joi.string().required().min(1),
        config: Joi.object({
          questionCount: Joi.number().integer().min(1).max(100),
          timeLimit: Joi.number().integer().min(1).max(480), // max 8 hours
          difficulty: Joi.string().valid('easy', 'medium', 'hard'),
          topics: Joi.array().items(Joi.string()),
          serviceCategories: Joi.array().items(Joi.string()),
          awsServices: Joi.array().items(Joi.string()),
          questionTypes: Joi.array().items(Joi.string().valid('single_choice', 'multiple_choice')),
          shuffleQuestions: Joi.boolean(),
          immediateResultsFeedback: Joi.boolean(),
          allowReview: Joi.boolean()
        }).optional()
      });

      const { error } = schema.validate(body);
      if (error) {
        return this.badRequest(`Validation failed: ${error.details[0]?.message || 'Unknown validation error'}`);
      }

      // Create session
      const session = await this.sessionService.createSession(userId, body);

      return this.created(session, 'Session created successfully');

    } catch (error) {
      this.logger.error('Failed to create session', { userId, error });
      
      if (error instanceof Error && error.message.includes('No questions found')) {
        return this.badRequest(error.message);
      }
      
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to create session');
    }
  }

  /**
   * POST /sessions/{sessionId}/answers - Submit answer for current question
   */
  private async submitAnswer(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const sessionId = this.getPathParam(event, 'sessionId');
      if (!sessionId) {
        return this.badRequest('Session ID is required');
      }

      const body = this.parseJsonBody<SubmitAnswerRequest>(event);
      if (!body) {
        return this.badRequest('Request body is required');
      }

      // Validate request
      const schema = Joi.object({
        questionId: Joi.string().required(),
        answer: Joi.alternatives().try(
          Joi.string(),
          Joi.array().items(Joi.string())
        ).required(),
        timeSpent: Joi.number().integer().min(1).max(3600).optional()
      });

      const { error } = schema.validate(body);
      if (error) {
        return this.badRequest(`Validation failed: ${error.details[0]?.message || 'Unknown validation error'}`);
      }

      // Submit answer
      const response = await this.sessionService.submitAnswer(sessionId, userId, body);

      return this.success(response);

    } catch (error) {
      this.logger.error('Failed to submit answer', { 
        sessionId: this.getPathParam(event, 'sessionId'), 
        userId, 
        error 
      });
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('does not match')) {
          return this.badRequest(error.message);
        }
        if (error.message.includes('not active')) {
          return this.badRequest(error.message);
        }
      }
      
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to submit answer');
    }
  }

  /**
   * POST /sessions/{sessionId}/complete - Complete session and get results
   */
  private async completeSession(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const sessionId = this.getPathParam(event, 'sessionId');
      if (!sessionId) {
        return this.badRequest('Session ID is required');
      }

      // Complete session
      const results = await this.sessionService.completeSession(sessionId, userId);

      return this.success({
        results,
        message: 'Session completed successfully'
      });

    } catch (error) {
      this.logger.error('Failed to complete session', { 
        sessionId: this.getPathParam(event, 'sessionId'), 
        userId, 
        error 
      });
      
      if (error instanceof Error && error.message.includes('not found')) {
        return this.notFound('Session not found');
      }
      
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to complete session');
    }
  }

  /**
   * PUT /sessions/{sessionId} - Update session configuration
   */
  private async updateSession(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const sessionId = this.getPathParam(event, 'sessionId');
      if (!sessionId) {
        return this.badRequest('Session ID is required');
      }

      const body = this.parseJsonBody<UpdateSessionRequest>(event);
      if (!body) {
        return this.badRequest('Request body is required');
      }

      // Validate request
      const schema = Joi.object({
        config: Joi.object({
          timeLimit: Joi.number().integer().min(1).max(480),
          immediateResultsFeedback: Joi.boolean(),
          allowReview: Joi.boolean()
        }).optional(),
        status: Joi.string().valid('paused', 'active').optional()
      });

      const { error } = schema.validate(body);
      if (error) {
        return this.badRequest(`Validation failed: ${error.details[0]?.message || 'Unknown validation error'}`);
      }

      // Update session
      const session = await this.sessionService.updateSession(sessionId, userId, body);

      return this.success(session, 'Session updated successfully');

    } catch (error) {
      this.logger.error('Failed to update session', { 
        sessionId: this.getPathParam(event, 'sessionId'), 
        userId, 
        error 
      });
      
      if (error instanceof Error && error.message.includes('not found')) {
        return this.notFound('Session not found');
      }
      
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to update session');
    }
  }

  /**
   * DELETE /sessions/{sessionId} - Delete session
   */
  private async deleteSession(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const sessionId = this.getPathParam(event, 'sessionId');
      if (!sessionId) {
        return this.badRequest('Session ID is required');
      }

      // Delete session
      await this.sessionService.deleteSession(sessionId, userId);

      return this.noContent();

    } catch (error) {
      this.logger.error('Failed to delete session', { 
        sessionId: this.getPathParam(event, 'sessionId'), 
        userId, 
        error 
      });
      
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete session');
    }
  }

  private methodNotAllowed(message: string): APIGatewayProxyResult {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: message })
    };
  }
}

const sessionHandler = new SessionHandler();
export const handler = sessionHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => sessionHandler.handleRequest(event, userId)
);