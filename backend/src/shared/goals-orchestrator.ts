/**
 * GoalsOrchestrator - Business logic coordination for GoalsHandler
 * Extracted from GoalsHandler to achieve SRP compliance
 * Following established patterns from Objectives 37-38 (ParsingMiddleware, BaseHandler decomposition)
 */

import { HandlerContext, ApiResponse } from './types/api.types';
import { CreateGoalRequest, UpdateGoalRequest, GetGoalsRequest } from './types/goals.types';
import { ServiceFactory } from './service-factory';
import { createLogger } from './logger';
import { ERROR_CODES } from './constants/error.constants';
import { ValidationMiddleware, ParsingMiddleware, ErrorContexts } from './middleware';
import { GoalsValidationSchemas, AdditionalValidationHelpers } from './middleware';

export class GoalsOrchestrator {
  private static instance: GoalsOrchestrator;
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ component: 'GoalsOrchestrator' });

  private constructor() {
    this.serviceFactory = ServiceFactory.getInstance();
  }

  public static getInstance(): GoalsOrchestrator {
    if (!GoalsOrchestrator.instance) {
      GoalsOrchestrator.instance = new GoalsOrchestrator();
    }
    return GoalsOrchestrator.instance;
  }

  /**
   * Validate userId from request body and return error response if invalid
   */
  public validateUserIdFromBodyOrError(requestBody: any): ApiResponse | null {
    if (!requestBody?.userId) {
      return {
        success: false,
        message: 'userId is required until Phase 30 authentication is implemented',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'userId is required until Phase 30 authentication is implemented',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  /**
   * Validate userId from query parameters and return error response if invalid
   */
  public validateUserIdFromQueryOrError(queryParams: any): ApiResponse | null {
    if (!queryParams?.userId) {
      return {
        success: false,
        message: 'userId query parameter is required until Phase 30 authentication is implemented',
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'userId query parameter is required until Phase 30 authentication is implemented',
        },
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  /**
   * Build GetGoalsRequest from query parameters with business logic
   */
  public buildGetGoalsRequest(queryParams: any): GetGoalsRequest {
    const request: GetGoalsRequest = {};

    // Apply business rules for parameter processing
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
    
    // Apply business rules for limits
    if (queryParams?.limit) request.limit = Math.min(queryParams.limit, 100);
    if (queryParams?.offset) request.offset = queryParams.offset;

    return request;
  }

  /**
   * Orchestrate goal creation with validation and service coordination
   */
  public async orchestrateCreateGoal(
    context: HandlerContext,
    requestBody: CreateGoalRequest & { userId: string },
    executeServiceOrError: Function
  ): Promise<any> {
    // Validate request using enhanced goal validation
    const validationResult = ValidationMiddleware.validateRequestBody(
      context,
      AdditionalValidationHelpers.createEnhancedGoalValidation()
    );
    if (validationResult.error) return { error: validationResult.error };

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
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
          targetValue: requestBody.targetValue,
          validationType: 'CreateGoalRequest',
        },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Goal created successfully with type-safe validation', {
      requestId: context.requestId,
      userId: requestBody.userId,
      goalId: result.goal.goalId,
      type: result.goal.type,
      targetValue: result.goal.targetValue,
      validationType: 'CreateGoalRequest',
    });

    return { result };
  }

  /**
   * Orchestrate goal retrieval with filtering coordination
   */
  public async orchestrateGetGoals(
    context: HandlerContext,
    userId: string,
    request: GetGoalsRequest,
    executeServiceOrError: Function
  ): Promise<any> {
    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoals(userId, request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.LIST,
        userId: userId,
        additionalInfo: { filters: request },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Goals retrieved successfully', {
      requestId: context.requestId,
      userId: userId,
      total: result.total,
      returned: result.goals.length,
      filters: request,
    });

    return { result };
  }

  /**
   * Orchestrate single goal retrieval with validation coordination
   */
  public async orchestrateGetGoal(
    context: HandlerContext,
    goalId: string,
    userId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Validate goal ID using ValidationMiddleware
    const goalValidation = ValidationMiddleware.validateFields(
      { goalId },
      GoalsValidationSchemas.goalId(),
      'params'
    );
    if (goalValidation) return { error: goalValidation };

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoal(goalId, userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.GET,
        userId: userId,
        additionalInfo: { goalId },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Goal retrieved successfully', {
      requestId: context.requestId,
      userId: userId,
      goalId: result.goal.goalId,
      type: result.goal.type,
      status: result.goal.status,
      progress: result.goal.progressPercentage,
    });

    return { result };
  }

  /**
   * Orchestrate goal update with validation coordination
   */
  public async orchestrateUpdateGoal(
    context: HandlerContext,
    goalId: string,
    userId: string,
    requestBody: UpdateGoalRequest,
    executeServiceOrError: Function
  ): Promise<any> {
    // Validate goal ID and request body using ValidationMiddleware
    const goalValidation = ValidationMiddleware.validateFields(
      { goalId },
      GoalsValidationSchemas.goalId(),
      'params'
    );
    if (goalValidation) return { error: goalValidation };

    const updateValidation = ValidationMiddleware.validateFields(
      requestBody,
      GoalsValidationSchemas.updateGoalRequest(),
      'body'
    );
    if (updateValidation) return { error: updateValidation };

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.updateGoal(goalId, userId, requestBody);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.UPDATE,
        userId: userId,
        additionalInfo: {
          goalId,
          updates: Object.keys(requestBody),
        },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Goal updated successfully', {
      requestId: context.requestId,
      userId: userId,
      goalId: result.goal.goalId,
      status: result.goal.status,
      progress: result.goal.progressPercentage,
      updates: Object.keys(requestBody),
    });

    return { result };
  }

  /**
   * Orchestrate goal deletion with validation coordination
   */
  public async orchestrateDeleteGoal(
    context: HandlerContext,
    goalId: string,
    userId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Validate goal ID using ValidationMiddleware
    const goalValidation = ValidationMiddleware.validateFields(
      { goalId },
      GoalsValidationSchemas.goalId(),
      'params'
    );
    if (goalValidation) return { error: goalValidation };

    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.deleteGoal(goalId, userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.DELETE,
        userId: userId,
        additionalInfo: { goalId },
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Goal deleted successfully', {
      requestId: context.requestId,
      userId: userId,
      goalId: goalId,
    });

    return { result };
  }

  /**
   * Orchestrate goal statistics retrieval
   */
  public async orchestrateGetGoalStats(
    context: HandlerContext,
    userId: string,
    executeServiceOrError: Function
  ): Promise<any> {
    // Execute service logic with proper error context
    const { result, error } = await executeServiceOrError(
      async () => {
        const goalsService = this.serviceFactory.getGoalsService();
        return await goalsService.getGoalStats(userId);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Goals.STATS,
        userId: userId,
      }
    );

    if (error) return { error };

    // Log business success
    this.logger.info('Goal statistics retrieved successfully', {
      requestId: context.requestId,
      userId: userId,
      totalGoals: result.totalGoals,
      activeGoals: result.activeGoals,
      completedGoals: result.completedGoals,
      completionRate: result.completionRate,
    });

    return { result };
  }
}