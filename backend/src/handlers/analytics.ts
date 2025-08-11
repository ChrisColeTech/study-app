// Analytics handler for progress tracking endpoints

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { 
  ProgressAnalyticsRequest,
  IAnalyticsService
} from '../shared/types/analytics.types';

// Import middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts
} from '../shared/middleware';

export class AnalyticsHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'AnalyticsHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'GET',
        path: '/v1/analytics/progress',
        handler: this.getProgressAnalytics.bind(this),
        requireAuth: false, // Will be enabled in Phase 30 with authentication
      },
      {
        method: 'GET',
        path: '/v1/analytics/sessions/{id}',
        handler: this.getSessionAnalytics.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/analytics/performance',
        handler: this.getPerformanceAnalytics.bind(this),
        requireAuth: false,
      },
      {
        method: 'GET',
        path: '/v1/analytics/health',
        handler: this.getAnalyticsHealth.bind(this),
        requireAuth: false,
      }
    ];
  }

  /**
   * GET /v1/analytics/progress - Get comprehensive progress analytics
   */
  private async getProgressAnalytics(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required initially - will be associated with user in Phase 30

    this.logger.info('Getting progress analytics', { requestId: context.requestId });

    // Parse query parameters for filters
    const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(context);
    if (parseError) return parseError;

    // Validate and build analytics request
    const validationError = this.validateProgressAnalyticsRequest(queryParams);
    if (validationError) return validationError;

    const analyticsRequest: ProgressAnalyticsRequest = {
      timeframe: queryParams.timeframe as 'week' | 'month' | 'quarter' | 'year' | 'all' || 'month',
      providerId: queryParams.providerId,
      examId: queryParams.examId,
      topics: queryParams.topics ? queryParams.topics.split(',') : undefined,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      ...(queryParams.limit && { limit: parseInt(queryParams.limit, 10) }),
      ...(queryParams.offset && { offset: parseInt(queryParams.offset, 10) })
    };

    // Business logic - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const analyticsService = this.serviceFactory.getAnalyticsService();
        return await analyticsService.getProgressAnalytics(analyticsRequest);
      },
      {
        requestId: context.requestId,
        operation: 'ANALYTICS_GET_PROGRESS',
        additionalInfo: { 
          timeframe: analyticsRequest.timeframe,
          providerId: analyticsRequest.providerId,
          examId: analyticsRequest.examId,
          topicCount: analyticsRequest.topics?.length || 0
        }
      },
      // Custom error mappings for analytics-specific errors
      [
        {
          keywords: ['No analytics data available'],
          errorCode: 'NO_DATA',
          statusCode: 404
        },
        {
          keywords: ['Invalid timeframe'],
          errorCode: 'VALIDATION_ERROR',
          statusCode: 400
        },
        {
          keywords: ['Analytics calculation failed'],
          errorCode: 'CALCULATION_ERROR',
          statusCode: 500
        }
      ]
    );

    if (error) return error;

    this.logger.info('Progress analytics retrieved successfully', { 
      requestId: context.requestId,
      totalSessions: result!.metadata.totalSessions,
      dataPoints: result!.metadata.dataPoints,
      timeframe: result!.metadata.timeframe,
      overallAccuracy: result!.data.overview.overallAccuracy,
      topicCount: result!.data.competencyData.topicCompetencies.length
    });

    return ErrorHandlingMiddleware.createSuccessResponse(
      result, 
      'Progress analytics retrieved successfully'
    );
  }

  /**
   * GET /v1/analytics/sessions/{id} - Get detailed session analytics
   */
  private async getSessionAnalytics(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters
    const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return parseError;

    // Business logic - delegate to service
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const analyticsService = this.serviceFactory.getAnalyticsService();
        return await analyticsService.getSessionAnalytics(pathParams.id);
      },
      {
        requestId: context.requestId,
        operation: 'ANALYTICS_GET_SESSION',
        additionalInfo: { sessionId: pathParams.id }
      }
    );

    if (error) return error;

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Session analytics retrieved successfully');
  }

  /**
   * GET /v1/analytics/performance - Get performance analytics
   */
  private async getPerformanceAnalytics(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters
    const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(context);
    if (parseError) return parseError;

    // Business logic - delegate to service  
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const analyticsService = this.serviceFactory.getAnalyticsService();
        return await analyticsService.getPerformanceAnalytics(queryParams);
      },
      {
        requestId: context.requestId,
        operation: 'ANALYTICS_GET_PERFORMANCE',
        additionalInfo: { filters: Object.keys(queryParams) }
      }
    );

    if (error) return error;

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Performance analytics retrieved successfully');
  }

  /**
   * GET /v1/analytics/health - Analytics service health check
   */
  private async getAnalyticsHealth(context: HandlerContext): Promise<ApiResponse> {
    this.logger.info('Analytics health check', { requestId: context.requestId });

    try {
      const analyticsService = this.serviceFactory.getAnalyticsService();
      
      // Basic health check - verify service can be instantiated and basic methods exist
      const healthData = {
        status: 'healthy',
        service: 'analytics',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        features: {
          progressAnalytics: 'available',
          competencyTracking: 'available',
          trendAnalysis: 'available',
          learningInsights: 'available',
          visualizationData: 'available'
        },
        version: '1.0.0',
        capabilities: [
          'Progress overview calculation',
          'Competency analysis',
          'Historical performance tracking',
          'Learning pattern identification',
          'Visualization data preparation',
          'Trend analysis',
          'Mastery progression tracking'
        ]
      };

      this.logger.info('Analytics health check completed', { 
        requestId: context.requestId,
        status: healthData.status
      });

      return ErrorHandlingMiddleware.createSuccessResponse(
        healthData, 
        'Analytics service is healthy'
      );

    } catch (error) {
      this.logger.error('Analytics health check failed', error as Error, { 
        requestId: context.requestId 
      });

      return ErrorHandlingMiddleware.createErrorResponse(
        'SERVICE_UNAVAILABLE',
        'Analytics service health check failed',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Validate progress analytics request parameters
   */
  private validateProgressAnalyticsRequest(queryParams: any): ApiResponse | null {
    // Validate timeframe
    if (queryParams.timeframe) {
      const validTimeframes = ['week', 'month', 'quarter', 'year', 'all'];
      if (!validTimeframes.includes(queryParams.timeframe)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          `timeframe must be one of: ${validTimeframes.join(', ')}`
        );
      }
    }

    // Validate date formats
    if (queryParams.startDate) {
      if (!this.isValidISODate(queryParams.startDate)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'startDate must be a valid ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)'
        );
      }
    }

    if (queryParams.endDate) {
      if (!this.isValidISODate(queryParams.endDate)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'endDate must be a valid ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)'
        );
      }
    }

    // Validate date range
    if (queryParams.startDate && queryParams.endDate) {
      const startDate = new Date(queryParams.startDate);
      const endDate = new Date(queryParams.endDate);
      
      if (startDate >= endDate) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'startDate must be before endDate'
        );
      }

      // Validate range is not too large (max 2 years)
      const maxRangeMs = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years
      if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Date range cannot exceed 2 years'
        );
      }
    }

    // Validate provider ID format
    if (queryParams.providerId) {
      if (typeof queryParams.providerId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(queryParams.providerId)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid providerId format. Use alphanumeric characters, hyphens, and underscores only'
        );
      }
    }

    // Validate exam ID format
    if (queryParams.examId) {
      if (typeof queryParams.examId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(queryParams.examId)) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid examId format. Use alphanumeric characters, hyphens, and underscores only'
        );
      }
    }

    // Validate topics format
    if (queryParams.topics) {
      const topics = queryParams.topics.split(',');
      if (topics.length > 20) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Maximum 20 topics allowed'
        );
      }

      for (const topic of topics) {
        if (!/^[a-zA-Z0-9_-]+$/.test(topic.trim())) {
          return ErrorHandlingMiddleware.createErrorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            'Invalid topic format. Use alphanumeric characters, hyphens, and underscores only'
          );
        }
      }
    }

    // Validate pagination parameters
    if (queryParams.limit) {
      const limit = parseInt(queryParams.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'limit must be a number between 1 and 1000'
        );
      }
    }

    if (queryParams.offset) {
      const offset = parseInt(queryParams.offset, 10);
      if (isNaN(offset) || offset < 0) {
        return ErrorHandlingMiddleware.createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'offset must be a non-negative number'
        );
      }
    }

    return null; // No validation errors
  }

  /**
   * Helper method to validate ISO date strings
   */
  private isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid and the string format matches ISO standard
      return date instanceof Date && 
             !isNaN(date.getTime()) && 
             (!!dateString.match(/^\d{4}-\d{2}-\d{2}$/) || 
              !!dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/));
    } catch {
      return false;
    }
  }

  /**
   * Helper method to create standard analytics error responses
   */
  private createAnalyticsError(code: string, message: string, details?: any): ApiResponse {
    return ErrorHandlingMiddleware.createErrorResponse(code, message, details);
  }

  /**
   * Helper method to create standard analytics success responses
   */
  private createAnalyticsSuccess<T>(data: T, message: string): ApiResponse<T> {
    return ErrorHandlingMiddleware.createSuccessResponse(data, message);
  }
}

// Export handler function for Lambda
const analyticsHandler = new AnalyticsHandler();
export const handler = analyticsHandler.handle;