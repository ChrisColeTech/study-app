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
  ValidationMiddleware,
  AuthMiddleware,
  AuthConfigs,
  AuthenticatedContext
} from '../shared/middleware';
import { GoalsValidationSchemas } from '../shared/middleware/validation-schemas';

export class GoalsHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'GoalsHandler' });
  // Helper methods for GoalsHandler standardization
  private validateUserIdFromBody(requestBody: any): ApiResponse | null {
    if (!requestBody.userId) {
      return this.buildErrorResponse('userId is required until Phase 30 authentication is implemented', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    return null;
  }

  private validateUserIdFromQuery(queryParams: any): ApiResponse | null {
    if (!queryParams?.userId) {
      return this.buildErrorResponse('userId query parameter is required until Phase 30 authentication is implemented', 400, ERROR_CODES.VALIDATION_ERROR);
    }
    return null;
  }

  private buildGetGoalsRequest(queryParams: any): GetGoalsRequest {
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
    
    return request;
  }

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
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/goals',
        handler: this.getGoals.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/goals/stats',
        handler: this.getGoalStats.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/goals/{id}',
        handler: this.getGoal.bind(this),
        requireAuth: false,
      },
      {
        method: 'PUT',
        path: '/v1/goals/{id}',
        handler: this.updateGoal.bind(this),
        requireAuth: false,
      },
      {
        method: 'DELETE',
        path: '/v1/goals/{id}',
        handler: this.deleteGoal.bind(this),
        requireAuth: false,
      }
    ];
  }

  /**
   * Create a new goal
   */
  private async createGoal(context: HandlerContext): Promise<ApiResponse> {
// Parse and validate request body using middleware
    const { data: requestBody, error: parseError } = ParsingMiddleware.parseRequestBody<CreateGoalRequest & { userId: string }>(context, true);
    if (parseError) return parseError;

    // Validate userId is provided until Phase 30
    const userIdValidation = this.validateUserIdFromBody(requestBody);
    if (userIdValidation) return userIdValidation;

    // Validate using comprehensive schema (replaces validateCreateGoalRequest)
    const validationResult = ValidationMiddleware.validateRequestBody(context, GoalsValidationSchemas.createGoalRequest());
    if (validationResult.error) return validationResult.error;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.createGoal(requestBody.userId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.CREATE,
        userId: requestBody.userId,
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
      userId: requestBody.userId,
      goalId: result!.goal.goalId,
      type: result!.goal.type,
      targetValue: result!.goal.targetValue
    });

    return this.buildSuccessResponse('Goal created successfully', result);
  }

  /**
   * Get goals with optional filtering
   */
  private async getGoals(context: HandlerContext): Promise<ApiResponse> {
// Parse query parameters using middleware
    const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(context, {
      userId: { type: 'string', decode: true },
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

    // Validate userId is provided until Phase 30
    const userIdValidation = this.validateUserIdFromQuery(queryParams);
    if (userIdValidation) return userIdValidation;

    // Build request object using helper method
    const request = this.buildGetGoalsRequest(queryParams);

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoals(queryParams.userId, request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.LIST,
        userId: queryParams.userId,
        additionalInfo: { filters: request }
      }
    );

    if (error) return error;

    this.logger.info('Goals retrieved successfully', { 
      requestId: context.requestId,
      userId: queryParams.userId,
      total: result!.total,
      returned: result!.goals.length,
      filters: request
    });

    return this.buildSuccessResponse('Goals retrieved successfully', result);
  }

  /**
   * Get a specific goal by ID
   */
  private async getGoal(context: HandlerContext): Promise<ApiResponse> {
// Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Parse query parameters using middleware
    const { data: queryParams, error: queryParseError } = ParsingMiddleware.parseQueryParams(context, {
      userId: { type: 'string', decode: true }
    });
    if (queryParseError) return queryParseError;

    // Validate userId is provided until Phase 30
    const userIdValidation = this.validateUserIdFromQuery(queryParams);
    if (userIdValidation) return userIdValidation;

    // Validate goal ID using ValidationMiddleware (replaces validateGoalId)
    const goalValidation = ValidationMiddleware.validateFields({ goalId: pathParams.id }, GoalsValidationSchemas.goalId(), 'params');
    if (goalValidation) return goalValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoal(pathParams.id, queryParams.userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.GET,
        userId: queryParams.userId,
        additionalInfo: { goalId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Goal retrieved successfully', { 
      requestId: context.requestId,
      userId: queryParams.userId,
      goalId: result!.goal.goalId,
      type: result!.goal.type,
      status: result!.goal.status,
      progress: result!.goal.progressPercentage
    });

    return this.buildSuccessResponse('Goal retrieved successfully', result);
  }

  /**
   * Update an existing goal
   */
  private async updateGoal(context: HandlerContext): Promise<ApiResponse> {
// Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Parse query parameters using middleware
    const { data: queryParams, error: queryParseError } = ParsingMiddleware.parseQueryParams(context, {
      userId: { type: 'string', decode: true }
    });
    if (queryParseError) return queryParseError;

    // Validate userId is provided until Phase 30
    const userIdValidation = this.validateUserIdFromQuery(queryParams);
    if (userIdValidation) return userIdValidation;

    // Parse and validate request body using middleware
    const { data: requestBody, error: bodyParseError } = ParsingMiddleware.parseRequestBody<UpdateGoalRequest>(context, true);
    if (bodyParseError) return bodyParseError;

    // Validate goal ID and request body using ValidationMiddleware
    const goalValidation = ValidationMiddleware.validateFields({ goalId: pathParams.id }, GoalsValidationSchemas.goalId(), 'params');
    if (goalValidation) return goalValidation;

    const updateValidation = ValidationMiddleware.validateFields(requestBody, GoalsValidationSchemas.updateGoalRequest(), 'body');
    if (updateValidation) return updateValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.updateGoal(pathParams.id, queryParams.userId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.UPDATE,
        userId: queryParams.userId,
        additionalInfo: { 
          goalId: pathParams.id,
          updates: Object.keys(requestBody)
        }
      }
    );

    if (error) return error;

    this.logger.info('Goal updated successfully', { 
      requestId: context.requestId,
      userId: queryParams.userId,
      goalId: result!.goal.goalId,
      status: result!.goal.status,
      progress: result!.goal.progressPercentage,
      updates: Object.keys(requestBody)
    });

    return this.buildSuccessResponse('Goal updated successfully', result);
  }

  /**
   * Delete a goal
   */
  private async deleteGoal(context: HandlerContext): Promise<ApiResponse> {
// Parse path parameters using middleware
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Parse query parameters using middleware
    const { data: queryParams, error: queryParseError } = ParsingMiddleware.parseQueryParams(context, {
      userId: { type: 'string', decode: true }
    });
    if (queryParseError) return queryParseError;

    // Validate userId is provided until Phase 30
    const userIdValidation = this.validateUserIdFromQuery(queryParams);
    if (userIdValidation) return userIdValidation;

    // Validate goal ID using ValidationMiddleware (replaces validateGoalId)
    const goalValidation = ValidationMiddleware.validateFields({ goalId: pathParams.id }, GoalsValidationSchemas.goalId(), 'params');
    if (goalValidation) return goalValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.deleteGoal(pathParams.id, queryParams.userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.DELETE,
        userId: queryParams.userId,
        additionalInfo: { goalId: pathParams.id }
      }
    );

    if (error) return error;

    this.logger.info('Goal deleted successfully', { 
      requestId: context.requestId,
      userId: queryParams.userId,
      goalId: pathParams.id
    });

    return this.buildSuccessResponse('Goal deleted successfully', result);
  }

  /**
   * Get goal statistics for user
   */
  private async getGoalStats(context: HandlerContext): Promise<ApiResponse> {
// Parse query parameters using middleware
    const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(context, {
      userId: { type: 'string', decode: true }
    });
    if (parseError) return parseError;

    // Validate userId is provided until Phase 30
    const userIdValidation = this.validateUserIdFromQuery(queryParams);
    if (userIdValidation) return userIdValidation;

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoalStats(queryParams.userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.STATS,
        userId: queryParams.userId
      }
    );

    if (error) return error;

    this.logger.info('Goal statistics retrieved successfully', { 
      requestId: context.requestId,
      userId: queryParams.userId,
      totalGoals: result!.totalGoals,
      activeGoals: result!.activeGoals,
      completedGoals: result!.completedGoals,
      completionRate: result!.completionRate
    });

    return this.buildSuccessResponse('Goal statistics retrieved successfully', result);
  }






}

// Export handler function for Lambda
const goalsHandler = new GoalsHandler();
export const handler = goalsHandler.handle;