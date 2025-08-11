// Goals handler using middleware pattern
// Phase 18: Goals Management System

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { GoalsService } from '../services/goals.service';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  CreateGoalRequest,
  UpdateGoalRequest,
  GetGoalsRequest
} from '../shared/types/goals.types';

// Import middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  AuthMiddleware,
  AuthConfigs,
  AuthenticatedContext
} from '../shared/middleware';

export class GoalsHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'GoalsHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'POST',
        path: '/v1/goals',
        handler: this.createGoal.bind(this),
        requireAuth: true,
      },
      {
        method: 'GET',
        path: '/v1/goals',
        handler: this.getGoals.bind(this),
        requireAuth: true,
      },
      {
        method: 'GET',
        path: '/v1/goals/stats',
        handler: this.getGoalStats.bind(this),
        requireAuth: true,
      },
      {
        method: 'GET',
        path: '/v1/goals/{id}',
        handler: this.getGoal.bind(this),
        requireAuth: true,
      },
      {
        method: 'PUT',
        path: '/v1/goals/{id}',
        handler: this.updateGoal.bind(this),
        requireAuth: true,
      },
      {
        method: 'DELETE',
        path: '/v1/goals/{id}',
        handler: this.deleteGoal.bind(this),
        requireAuth: true,
      }
    ];
  }

  /**
   * Create a new goal
   */
  private async createGoal(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = ParsingMiddleware.parseRequestBody<CreateGoalRequest>(context, true);
    if (parseError) return parseError;

    // Validate using helper method
    const validationError = this.validateCreateGoalRequest(requestBody);
    if (validationError) return validationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.createGoal(authenticatedContext!.userId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.CREATE,
        userId: authenticatedContext!.userId,
        additionalInfo: { 
          type: requestBody.type,
          targetType: requestBody.targetType,
          targetValue: requestBody.targetValue
        }
      }
    );

    if (error) return error;

    this.logger.info('Goal created successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      goalId: result!.goal.goalId,
      type: result!.goal.type,
      targetValue: result!.goal.targetValue
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Goal created successfully');
  }

  /**
   * Get goals with optional filtering
   */
  private async getGoals(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Parse query parameters using middleware
    const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(context, {
      status: { type: 'string', decode: true },
      type: { type: 'string', decode: true },
      priority: { type: 'string', decode: true },
      examId: { type: 'string', decode: true },
      topicId: { type: 'string', decode: true },
      providerId: { type: 'string', decode: true },
      isArchived: { type: 'boolean' },
      search: { type: 'string', decode: true },
      sortBy: { type: 'string', decode: true },
      sortOrder: { type: 'string', decode: true },
      limit: { type: 'number' },
      offset: { type: 'number' }
    });
    if (parseError) return parseError;

    // Build request object
    const request: GetGoalsRequest = {};
    
    if (queryParams?.status) {
      request.status = queryParams.status.split(',').map((s: string) => s.trim()) as any[];
    }
    if (queryParams?.type) {
      request.type = queryParams.type.split(',').map((t: string) => t.trim()) as any[];
    }
    if (queryParams?.priority) {
      request.priority = queryParams.priority.split(',').map((p: string) => p.trim()) as any[];
    }
    if (queryParams?.examId) request.examId = queryParams.examId;
    if (queryParams?.topicId) request.topicId = queryParams.topicId;
    if (queryParams?.providerId) request.providerId = queryParams.providerId;
    if (queryParams?.isArchived !== undefined) request.isArchived = queryParams.isArchived;
    if (queryParams?.search) request.search = queryParams.search;
    if (queryParams?.sortBy) request.sortBy = queryParams.sortBy as any;
    if (queryParams?.sortOrder) request.sortOrder = queryParams.sortOrder as any;
    if (queryParams?.limit) request.limit = Math.min(queryParams.limit, 100);
    if (queryParams?.offset) request.offset = queryParams.offset;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoals(authenticatedContext!.userId, request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.LIST,
        userId: authenticatedContext!.userId,
        additionalInfo: { filters: request }
      }
    );

    if (error) return error;

    this.logger.info('Goals retrieved successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      total: result!.total,
      returned: result!.goals.length,
      filters: request
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Goals retrieved successfully');
  }

  /**
   * Get a specific goal by ID
   */
  private async getGoal(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate goal ID
    const goalValidationError = this.validateGoalId(pathParams.id);
    if (goalValidationError) return goalValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoal(pathParams.id, authenticatedContext!.userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.GET,
        userId: authenticatedContext!.userId,
        additionalInfo: { goalId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Goal retrieved successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      goalId: result!.goal.goalId,
      type: result!.goal.type,
      status: result!.goal.status,
      progress: result!.goal.progressPercentage
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Goal retrieved successfully');
  }

  /**
   * Update an existing goal
   */
  private async updateGoal(context: HandlerContext): Promise<ApiResponse> {
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
    const { data: requestBody, error: bodyParseError } = ParsingMiddleware.parseRequestBody<UpdateGoalRequest>(context, true);
    if (bodyParseError) return bodyParseError;

    // Validate goal ID and request body
    const goalValidationError = this.validateGoalId(pathParams.id);
    if (goalValidationError) return goalValidationError;

    const updateValidationError = this.validateUpdateGoalRequest(requestBody);
    if (updateValidationError) return updateValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.updateGoal(pathParams.id, authenticatedContext!.userId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.UPDATE,
        userId: authenticatedContext!.userId,
        additionalInfo: { 
          goalId: pathParams.id,
          updates: Object.keys(requestBody)
        }
      }
    );

    if (error) return error;

    this.logger.info('Goal updated successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      goalId: result!.goal.goalId,
      status: result!.goal.status,
      progress: result!.goal.progressPercentage,
      updates: Object.keys(requestBody)
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Goal updated successfully');
  }

  /**
   * Delete a goal
   */
  private async deleteGoal(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Validate goal ID
    const goalValidationError = this.validateGoalId(pathParams.id);
    if (goalValidationError) return goalValidationError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.deleteGoal(pathParams.id, authenticatedContext!.userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.DELETE,
        userId: authenticatedContext!.userId,
        additionalInfo: { goalId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Goal deleted successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      goalId: pathParams.id
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Goal deleted successfully');
  }

  /**
   * Get goal statistics for user
   */
  private async getGoalStats(context: HandlerContext): Promise<ApiResponse> {
    // Authenticate user using middleware
    const { authenticatedContext, error: authError } = await AuthMiddleware.authenticateRequest(
      context, 
      AuthConfigs.AUTHENTICATED
    );
    if (authError) return authError;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoalStats(authenticatedContext!.userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.STATS,
        userId: authenticatedContext!.userId
      }
    );

    if (error) return error;

    this.logger.info('Goal statistics retrieved successfully', { 
      requestId: context.requestId,
      userId: authenticatedContext!.userId,
      totalGoals: result!.totalGoals,
      activeGoals: result!.activeGoals,
      completedGoals: result!.completedGoals,
      completionRate: result!.completionRate
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Goal statistics retrieved successfully');
  }

  /**
   * Helper method to validate create goal request
   */
  private validateCreateGoalRequest(requestBody: any): ApiResponse | null {
    // Check required fields
    const requiredFields = ['title', 'type', 'priority', 'targetType', 'targetValue'];
    for (const field of requiredFields) {
      if (!requestBody[field]) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          `${field} is required`
        );
      }
    }

    // Validate field types and values
    if (typeof requestBody.title !== 'string' || requestBody.title.trim().length === 0) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'title must be a non-empty string'
      );
    }

    if (requestBody.title.length > 200) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'title must be 200 characters or less'
      );
    }

    if (requestBody.description && requestBody.description.length > 1000) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'description must be 1000 characters or less'
      );
    }

    // Validate enum values
    const validTypes = ['exam_preparation', 'topic_mastery', 'daily_practice', 'score_target', 'streak'];
    if (!validTypes.includes(requestBody.type)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `type must be one of: ${validTypes.join(', ')}`
      );
    }

    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(requestBody.priority)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `priority must be one of: ${validPriorities.join(', ')}`
      );
    }

    const validTargetTypes = ['exam', 'topic', 'questions', 'score', 'days'];
    if (!validTargetTypes.includes(requestBody.targetType)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `targetType must be one of: ${validTargetTypes.join(', ')}`
      );
    }

    // Validate target value
    if (typeof requestBody.targetValue !== 'number' || requestBody.targetValue <= 0) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'targetValue must be a positive number'
      );
    }

    // Validate deadline if provided
    if (requestBody.deadline) {
      const deadline = new Date(requestBody.deadline);
      if (isNaN(deadline.getTime())) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'deadline must be a valid ISO 8601 date'
        );
      }
      if (deadline <= new Date()) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'deadline must be in the future'
        );
      }
    }

    // Validate ID formats if provided
    const idFields = ['examId', 'topicId', 'providerId'];
    for (const field of idFields) {
      if (requestBody[field] && (typeof requestBody[field] !== 'string' || requestBody[field].trim().length === 0)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          `${field} must be a non-empty string`
        );
      }
    }

    return null; // No validation errors
  }

  /**
   * Helper method to validate update goal request
   */
  private validateUpdateGoalRequest(requestBody: any): ApiResponse | null {
    // Validate optional fields if provided
    if (requestBody.title !== undefined) {
      if (typeof requestBody.title !== 'string' || requestBody.title.trim().length === 0) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'title must be a non-empty string'
        );
      }
      if (requestBody.title.length > 200) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'title must be 200 characters or less'
        );
      }
    }

    if (requestBody.description !== undefined && requestBody.description.length > 1000) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'description must be 1000 characters or less'
      );
    }

    // Validate enum values if provided
    if (requestBody.priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(requestBody.priority)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          `priority must be one of: ${validPriorities.join(', ')}`
        );
      }
    }

    if (requestBody.status !== undefined) {
      const validStatuses = ['active', 'completed', 'paused', 'abandoned'];
      if (!validStatuses.includes(requestBody.status)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${validStatuses.join(', ')}`
        );
      }
    }

    // Validate numeric values if provided
    if (requestBody.targetValue !== undefined) {
      if (typeof requestBody.targetValue !== 'number' || requestBody.targetValue <= 0) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'targetValue must be a positive number'
        );
      }
    }

    if (requestBody.currentValue !== undefined) {
      if (typeof requestBody.currentValue !== 'number' || requestBody.currentValue < 0) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'currentValue must be a non-negative number'
        );
      }
    }

    // Validate deadline if provided
    if (requestBody.deadline !== undefined && requestBody.deadline) {
      const deadline = new Date(requestBody.deadline);
      if (isNaN(deadline.getTime())) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'deadline must be a valid ISO 8601 date'
        );
      }
      if (deadline <= new Date()) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'deadline must be in the future'
        );
      }
    }

    return null; // No validation errors
  }

  /**
   * Helper method to validate goal ID
   */
  private validateGoalId(goalId: string | undefined): ApiResponse | null {
    if (!goalId) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Goal ID is required'
      );
    }

    if (!/^[a-f0-9-]{36}$/.test(goalId)) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid goal ID format'
      );
    }

    return null;
  }
}

// Export handler function for Lambda
const goalsHandler = new GoalsHandler();
export const handler = goalsHandler.handle;