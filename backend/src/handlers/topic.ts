// Topic handler for Study App V3 Backend

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  GetTopicsRequest,
  GetTopicRequest
} from '../shared/types/topic.types';

export class TopicHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'TopicHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // Get all topics endpoint
      {
        method: 'GET',
        path: '/v1/topics',
        handler: this.getTopics.bind(this),
        requireAuth: false, // Public endpoint for now
      },
      // Get single topic endpoint
      {
        method: 'GET',
        path: '/v1/topics/{id}',
        handler: this.getTopic.bind(this),
        requireAuth: false, // Public endpoint for now
      }
    ];
  }

  /**
   * Get all topics with optional filtering
   * GET /v1/topics?provider=aws&exam=clf-c02&category=cloud&search=security&level=foundational
   */
  private async getTopics(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Getting all topics', { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      // Parse query parameters
      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetTopicsRequest = {};
      
      // Only set properties if they have values
      if (queryParams.provider) {
        request.provider = decodeURIComponent(queryParams.provider);
      }
      
      if (queryParams.exam) {
        request.exam = decodeURIComponent(queryParams.exam);
      }
      
      if (queryParams.category) {
        request.category = decodeURIComponent(queryParams.category);
      }

      if (queryParams.search) {
        request.search = decodeURIComponent(queryParams.search);
      }

      if (queryParams.level) {
        request.level = decodeURIComponent(queryParams.level);
      }

      // Get topics from service
      const topicService = this.serviceFactory.getTopicService();
      const result = await topicService.getTopics(request);

      this.logger.info('Topics retrieved successfully', { 
        requestId: context.requestId,
        total: result.total,
        filters: {
          provider: request.provider,
          exam: request.exam,
          category: request.category,
          search: request.search,
          level: request.level
        }
      });

      return this.success(result, 'Topics retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get topics', error, { 
        requestId: context.requestId,
        queryParams: context.event.queryStringParameters
      });

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve topics'
      );
    }
  }

  /**
   * Get single topic by ID with optional context
   * GET /v1/topics/{id}?includeProvider=true&includeExam=true
   */
  private async getTopic(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Getting topic by ID', { 
        requestId: context.requestId,
        pathParams: context.event.pathParameters,
        queryParams: context.event.queryStringParameters
      });

      // Extract topic ID from path parameters
      const topicId = context.event.pathParameters?.id;
      
      if (!topicId) {
        this.logger.warn('Topic ID missing from path parameters', { 
          requestId: context.requestId 
        });
        
        return this.error(
          ERROR_CODES.BAD_REQUEST,
          'Topic ID is required'
        );
      }

      // Parse query parameters
      const queryParams = context.event.queryStringParameters || {};
      
      const request: GetTopicRequest = {
        id: decodeURIComponent(topicId)
      };
      
      // Set optional parameters
      if (queryParams.includeProvider === 'true') {
        request.includeProvider = true;
      }
      
      if (queryParams.includeExam === 'true') {
        request.includeExam = true;
      }

      // Get topic from service
      const topicService = this.serviceFactory.getTopicService();
      const result = await topicService.getTopic(request);

      this.logger.info('Topic retrieved successfully', { 
        requestId: context.requestId,
        topicId: request.id,
        includeProvider: request.includeProvider,
        includeExam: request.includeExam
      });

      return this.success(result, 'Topic retrieved successfully');

    } catch (error: any) {
      this.logger.error('Failed to get topic', error, { 
        requestId: context.requestId,
        pathParams: context.event.pathParameters,
        queryParams: context.event.queryStringParameters
      });

      // Handle topic not found specifically
      if (error.message && error.message.includes('not found')) {
        return this.error(
          ERROR_CODES.NOT_FOUND,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve topic'
      );
    }
  }
}

// Export handler function for Lambda
const topicHandler = new TopicHandler();
export const handler = topicHandler.handle;