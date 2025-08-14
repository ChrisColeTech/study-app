// Analytics handler for progress tracking endpoints

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { ProgressAnalyticsRequest, IAnalyticsService } from '../shared/types/analytics.types';
import { EnvironmentDetector } from '../shared/config';

// Import middleware
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ErrorContexts,
  ValidationMiddleware,
} from '../shared/middleware';
import { AnalyticsValidationSchemas, AdditionalValidationHelpers } from '../shared/middleware';

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
      },
    ];
  }

  /**
   * GET /v1/analytics/progress - Get comprehensive progress analytics
   */
  private async getProgressAnalytics(context: HandlerContext): Promise<ApiResponse> {
    // No authentication required initially - will be associated with user in Phase 30

    this.logger.info('Getting progress analytics', { requestId: context.requestId });

    // Parse query parameters for filters
    const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(context);
    if (parseError) return parseError;

    // Validate using type-aware schema that corresponds to ProgressAnalyticsRequest interface
    const validationResult = ValidationMiddleware.validateFields(
      queryParams,
      AdditionalValidationHelpers.createEnhancedAnalyticsValidation(),
      'query'
    );
    if (validationResult) return validationResult;

    const analyticsRequest: ProgressAnalyticsRequest = {
      timeframe:
        (queryParams.timeframe as 'week' | 'month' | 'quarter' | 'year' | 'all') || 'month',
      providerId: queryParams.providerId,
      examId: queryParams.examId,
      topics: queryParams.topics ? queryParams.topics.split(',') : undefined,
      startDate: queryParams.startDate,
      endDate: queryParams.endDate,
      ...(queryParams.limit && { limit: parseInt(queryParams.limit, 10) }),
      ...(queryParams.offset && { offset: parseInt(queryParams.offset, 10) }),
    };

    // Business logic - delegate error handling to middleware
    const { result, error } = await this.executeServiceOrError(
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
          topicCount: analyticsRequest.topics?.length || 0,
          validationType: 'ProgressAnalyticsRequest',
        },
      }
    );

    if (error) return error;

    this.logger.info('Progress analytics retrieved successfully with type-safe validation', {
      requestId: context.requestId,
      totalSessions: result!.metadata.totalSessions,
      dataPoints: result!.metadata.dataPoints,
      timeframe: result!.metadata.timeframe,
      overallAccuracy: result!.data.overview.overallAccuracy,
      topicCount: result!.data.competencyData.topicCompetencies.length,
      validationType: 'ProgressAnalyticsRequest',
    });

    return this.buildSuccessResponse('Progress analytics retrieved successfully', result);
  }

  /**
   * GET /v1/analytics/sessions/{id} - Get detailed session analytics
   */
  private async getSessionAnalytics(context: HandlerContext): Promise<ApiResponse> {
    // Parse path parameters
    const { data: pathParams, error: parseError } = await this.parsePathParamsOrError(context);
    if (parseError) return parseError;

    // Business logic - delegate to service
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const analyticsService = this.serviceFactory.getAnalyticsService();
        return await analyticsService.getSessionAnalytics(pathParams.id);
      },
      {
        requestId: context.requestId,
        operation: 'ANALYTICS_GET_SESSION',
        additionalInfo: { sessionId: pathParams.id },
      }
    );

    if (error) return error;

    return this.buildSuccessResponse('Session analytics retrieved successfully', result);
  }

  /**
   * GET /v1/analytics/performance - Get performance analytics
   */
  private async getPerformanceAnalytics(context: HandlerContext): Promise<ApiResponse> {
    // Parse query parameters
    const { data: queryParams, error: parseError } = await this.parseQueryParamsOrError(context);
    if (parseError) return parseError;

    // Business logic - delegate to service
    const { result, error } = await this.executeServiceOrError(
      async () => {
        const analyticsService = this.serviceFactory.getAnalyticsService();
        return await analyticsService.getPerformanceAnalytics(queryParams);
      },
      {
        requestId: context.requestId,
        operation: 'ANALYTICS_GET_PERFORMANCE',
        additionalInfo: { filters: Object.keys(queryParams) },
      }
    );

    if (error) return error;

    return this.buildSuccessResponse('Performance analytics retrieved successfully', result);
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
        environment: EnvironmentDetector.getEnvironmentString(),
        features: {
          progressAnalytics: 'available',
          competencyTracking: 'available',
          trendAnalysis: 'available',
          learningInsights: 'available',
          visualizationData: 'available',
        },
        version: '1.0.0',
        capabilities: [
          'Progress overview calculation',
          'Competency analysis',
          'Historical performance tracking',
          'Learning pattern identification',
          'Visualization data preparation',
          'Trend analysis',
          'Mastery progression tracking',
        ],
      };

      this.logger.info('Analytics health check completed', {
        requestId: context.requestId,
        status: healthData.status,
      });

      return this.buildSuccessResponse('Analytics service is healthy', healthData);
    } catch (error) {
      this.logger.error('Analytics health check failed', error as Error, {
        requestId: context.requestId,
      });

      return this.buildErrorResponse(
        'Analytics service health check failed',
        503,
        'SERVICE_UNAVAILABLE',
        { error: (error as Error).message }
      );
    }
  }
}

// Export handler function for Lambda
const analyticsHandler = new AnalyticsHandler();
export const handler = analyticsHandler.handle;
