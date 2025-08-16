// Goals handler using middleware pattern
// Phase 18: Goals Management System

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { GoalsService } from '../services/goals.service';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { CreateGoalRequest, UpdateGoalRequest, GetGoalsRequest } from '../shared/types/goals.types';

// Import middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  ValidationMiddleware,
  AuthMiddleware,
  AuthConfigs,
  AuthenticatedContext,
} from '../shared/middleware';
import { GoalsValidationSchemas, AdditionalValidationHelpers } from '../shared/middleware';
import { GoalsOrchestrator } from '../shared/goals-orchestrator';

export class GoalsHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'GoalsHandler' });
  private goalsOrchestrator = GoalsOrchestrator.getInstance();

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
      },
    ];
  }

  /**
   * Create a new goal - Pure routing with orchestrator delegation
   */
  private async createGoal(context: HandlerContext): Promise<ApiResponse> {
    // Parse request body using middleware
    const { data: requestBody, error: parseError } = await this.parseRequestBodyOrError<
      CreateGoalRequest & { userId: string }
    >(context, true);
    if (parseError) return parseError;

    // Validate userId using orchestrator
    const userIdError = this.goalsOrchestrator.validateUserIdFromBodyOrError(requestBody!);
    if (userIdError) return userIdError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.goalsOrchestrator.orchestrateCreateGoal(
      context,
      requestBody!,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Goal created successfully', result);
  }

  /**
   * Get goals with optional filtering - Pure routing with orchestrator delegation
   */
  private async getGoals(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters using middleware
    const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(context, {
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
      offset: { type: 'number' },
    });
    if (parseError) return parseError;

    // Validate userId using orchestrator
    const userIdError = this.goalsOrchestrator.validateUserIdFromQueryOrError(queryParams);
    if (userIdError) return userIdError;

    // Build request using orchestrator business logic
    const request = this.goalsOrchestrator.buildGetGoalsRequest(queryParams);

    // Delegate business logic to orchestrator
    const { result, error } = await this.goalsOrchestrator.orchestrateGetGoals(
      context,
      queryParams.userId,
      request,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Goals retrieved successfully', result);
  }

  /**
   * Get a specific goal by ID - Pure routing with orchestrator delegation
   */
  private async getGoal(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Parse query parameters using middleware
    const { data: queryParams, error: queryParseError } = ParsingMiddleware.parseQueryParams(
      context,
      {
        userId: { type: 'string', decode: true },
      }
    );
    if (queryParseError) return queryParseError;

    // Validate userId using orchestrator
    const userIdError = this.goalsOrchestrator.validateUserIdFromQueryOrError(queryParams);
    if (userIdError) return userIdError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.goalsOrchestrator.orchestrateGetGoal(
      context,
      pathParams.id,
      queryParams.userId,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Goal retrieved successfully', result);
  }

  /**
   * Update an existing goal - Pure routing with orchestrator delegation
   */
  private async updateGoal(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Parse query parameters using middleware
    const { data: queryParams, error: queryParseError } = ParsingMiddleware.parseQueryParams(
      context,
      {
        userId: { type: 'string', decode: true },
      }
    );
    if (queryParseError) return queryParseError;

    // Validate userId using orchestrator
    const userIdError = this.goalsOrchestrator.validateUserIdFromQueryOrError(queryParams);
    if (userIdError) return userIdError;

    // Parse request body using middleware
    const { data: requestBody, error: bodyParseError } =
      ParsingMiddleware.parseRequestBody<UpdateGoalRequest>(context, true);
    if (bodyParseError) return bodyParseError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.goalsOrchestrator.orchestrateUpdateGoal(
      context,
      pathParams.id,
      queryParams.userId,
      requestBody!,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Goal updated successfully', result);
  }

  /**
   * Delete a goal - Pure routing with orchestrator delegation
   */
  private async deleteGoal(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Parse query parameters using middleware
    const { data: queryParams, error: queryParseError } = ParsingMiddleware.parseQueryParams(
      context,
      {
        userId: { type: 'string', decode: true },
      }
    );
    if (queryParseError) return queryParseError;

    // Validate userId using orchestrator
    const userIdError = this.goalsOrchestrator.validateUserIdFromQueryOrError(queryParams);
    if (userIdError) return userIdError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.goalsOrchestrator.orchestrateDeleteGoal(
      context,
      pathParams.id,
      queryParams.userId,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Goal deleted successfully', result);
  }

  /**
   * Get goal statistics for user - Pure routing with orchestrator delegation
   */
  private async getGoalStats(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters using middleware
    const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(context, {
      userId: { type: 'string', decode: true },
    });
    if (parseError) return parseError;

    // Validate userId using orchestrator
    const userIdError = this.goalsOrchestrator.validateUserIdFromQueryOrError(queryParams);
    if (userIdError) return userIdError;

    // Delegate business logic to orchestrator
    const { result, error } = await this.goalsOrchestrator.orchestrateGetGoalStats(
      context,
      queryParams.userId,
      this.executeServiceOrError.bind(this)
    );

    if (error) return error;

    return this.buildSuccessResponse('Goal statistics retrieved successfully', result);
  }
}

// Export handler function for Lambda
const goalsHandler = new GoalsHandler();
export const handler = goalsHandler.handle;
