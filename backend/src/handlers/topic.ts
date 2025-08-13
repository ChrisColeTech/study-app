// Refactored Topic handler using middleware pattern
// Eliminates architecture violations: repetitive validation patterns similar to other handlers

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { GetTopicsRequest, GetTopicRequest } from '../shared/types/topic.types';

// Import new middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  CommonParsing,
} from '../shared/middleware';

export class TopicHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'TopicHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'GET',
        path: '/v1/topics',
        handler: this.getTopics.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/topics/{id}',
        handler: this.getTopic.bind(this),
        requireAuth: false,
      },
    ];
  }

  /**
   * Get all topics with optional filtering - now clean and focused
   */
  private async getTopics(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters using middleware
    const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(context, {
      provider: { type: 'string', decode: true },
      exam: { type: 'string', decode: true },
      category: { type: 'string', decode: true },
      search: CommonParsing.search,
      level: { type: 'string', decode: true },
    });
    if (parseError) return parseError;

    // Build request object
    const request: GetTopicsRequest = {
      ...(queryParams.provider && { provider: queryParams.provider }),
      ...(queryParams.exam && { exam: queryParams.exam }),
      ...(queryParams.category && { category: queryParams.category }),
      ...(queryParams.search && { search: queryParams.search }),
      ...(queryParams.level && { level: queryParams.level }),
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const topicService = this.serviceFactory.getTopicService();
        return await topicService.getTopics(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Topic.LIST,
        additionalInfo: { filters: request },
      }
    );

    if (error) return error;

    this.logger.info('Topics retrieved successfully', {
      requestId: context.requestId,
      total: result!.total,
      filters: request,
    });

    return this.buildSuccessResponse('Topics retrieved successfully', result);
  }

  /**
   * Get single topic by ID with optional context - now clean and focused
   */
  private async getTopic(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters using middleware
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Validate topic ID
    if (!pathParams.id) {
      return this.buildErrorResponse('Topic ID is required', 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Parse query parameters
    const { data: queryParams } = ParsingMiddleware.parseQueryParams(context, {
      includeProvider: CommonParsing.booleanFlag,
      includeExam: CommonParsing.booleanFlag,
    });

    // Build request object
    const request: GetTopicRequest = {
      id: decodeURIComponent(pathParams.id),
      ...(queryParams?.includeProvider && { includeProvider: queryParams.includeProvider }),
      ...(queryParams?.includeExam && { includeExam: queryParams.includeExam }),
    };

    // Business logic only - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const topicService = this.serviceFactory.getTopicService();
        return await topicService.getTopic(request);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Topic.GET,
        additionalInfo: { topicId: request.id },
      }
    );

    if (error) return error;

    this.logger.info('Topic retrieved successfully', {
      requestId: context.requestId,
      topicId: request.id,
      includeProvider: request.includeProvider,
      includeExam: request.includeExam,
    });

    return this.buildSuccessResponse('Topic retrieved successfully', result);
  }
}

// Export handler function for Lambda
const topicHandler = new TopicHandler();
export const handler = topicHandler.handle;
