// BaseHandler pattern to eliminate HTTP boilerplate

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  HandlerContext,
  RouteHandler,
  HttpMethod,
  ApiResponse,
  LambdaHandler,
  ErrorDetails,
  ResponseMetadata,
  PaginationInfo,
  StandardizedPagination,
  ResponsePerformanceMetrics,
  StandardizedResponsePerformance,
  ResourceInfo,
  StandardizedResource,
  StandardizedResourceLinks,
  CacheInfo,
  StandardizedCache,
  ContentRange,
  StandardizedContentRange,
  ValidationError,
  StandardizedValidationError,
  StandardizedErrorDetails,
} from './types/api.types';
import { ResponseBuilder } from './response-builder';
import { createLogger } from './logger';
import { HTTP_STATUS_CODES } from './constants/api.constants';
import { ERROR_CODES } from './constants/error.constants';
import {
  ParsingMiddleware,
  ErrorHandlingMiddleware,
  ValidationMiddleware,
  ValidationSchema,
} from './middleware';
import { RequestProcessingPipeline } from './middleware/request-processing-pipeline';
import { RequestLifecycleTracker } from './middleware/request-lifecycle-tracker';
import { ResponseBuilder as HandlerResponseBuilder } from './handler-response-builder';
import { MiddlewareCoordinator } from './handler-middleware-coordinator';
import { HandlerUtils } from './handler-utils';

export interface RouteConfig {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  requireAuth?: boolean;
  permissions?: string[] | undefined;
  validationSchema?: {
    query?: ValidationSchema;
    path?: ValidationSchema;
    body?: ValidationSchema;
  };
}

export abstract class BaseHandler {
  protected routes: RouteConfig[] = [];

  constructor() {
    this.setupRoutes();
  }

  /**
   * Main Lambda handler function with enhanced request processing pipeline
   */
  public handle: LambdaHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    const requestId = context.awsRequestId;
    const logger = createLogger({ requestId });

    // Initialize request lifecycle tracking
    const requestLifecycle = new RequestLifecycleTracker(requestId, logger);
    requestLifecycle.start('handler_init');

    try {
      // Handle CORS preflight requests
      if (event.httpMethod === 'OPTIONS') {
        requestLifecycle.complete('cors_preflight');
        return ResponseBuilder.corsResponse();
      }

      logger.info('Request received', {
        method: event.httpMethod,
        path: event.path,
        queryParams: event.queryStringParameters,
        headers: event.headers ? Object.keys(event.headers) : [],
      });

      // Initialize request processing pipeline with optional logging service
      let apiLoggingService;
      try {
        const { ServiceFactory } = require('./service-factory');
        apiLoggingService = ServiceFactory.getInstance().getApiLoggingService();
      } catch (error) {
        // Graceful degradation if logging service unavailable
        logger.debug('ApiLoggingService not available, proceeding without comprehensive logging');
      }
      
      const pipeline = new RequestProcessingPipeline(event, context, logger, apiLoggingService);
      requestLifecycle.start('pipeline_execution');

      // Execute the complete pipeline
      const result = await pipeline.execute(this.routes);
      requestLifecycle.complete('pipeline_execution');

      // Convert ApiResponse to APIGatewayProxyResult with performance metadata
      const response = ResponseBuilder.fromApiResponse(result, requestId);
      
      // Add performance metrics to response headers
      const performanceMetrics = requestLifecycle.getMetrics();
      if (performanceMetrics.totalTime < 1000) { // Only add for fast requests
        response.headers = {
          ...response.headers,
          'X-Response-Time': `${performanceMetrics.totalTime}ms`,
          'X-Pipeline-Stages': performanceMetrics.stages.length.toString(),
        };
      }

      requestLifecycle.complete('response_building');

      logger.info('Request completed', {
        statusCode: response.statusCode,
        responseTime: performanceMetrics.totalTime,
        stages: performanceMetrics.stages.length,
      });

      return response;
    } catch (error) {
      requestLifecycle.error('unhandled_error', error as Error);
      
      logger.error('Unhandled error in handler', error, {
        method: event.httpMethod,
        path: event.path,
      });

      return ResponseBuilder.internalError(error, requestId);
    } finally {
      requestLifecycle.finish();
    }
  };

  /**
   * Abstract method to be implemented by concrete handlers
   */
  protected abstract setupRoutes(): void;

  /**
   * Find matching route for the request
   */
  private findRoute(method: HttpMethod, path: string): RouteConfig | undefined {
    return this.routes.find(route => {
      if (route.method !== method) {
        return false;
      }

      // Exact match
      if (route.path === path) {
        return true;
      }

      // Pattern match for paths with parameters (e.g., /sessions/{id})
      return HandlerUtils.matchPath(route.path, path);
    });
  }

  // ===================================
  // DELEGATED RESPONSE METHODS
  // ===================================

  /**
   * Helper method to create success responses
   * Delegates to ResponseBuilder
   */
  protected success<T>(data: T, message?: string): ApiResponse<T> {
    return HandlerResponseBuilder.success(data, message);
  }

  /**
   * Helper method to create error responses
   * Delegates to ResponseBuilder
   */
  protected error(code: string, message: string, details?: ErrorDetails): ApiResponse {
    return HandlerResponseBuilder.error(code, message, details);
  }

  /**
   * Build standardized success response with comprehensive metadata support
   * Delegates to ResponseBuilder
   */
  protected buildSuccessResponse<T>(
    message: string,
    data: T,
    metadata?: ResponseMetadata
  ): ApiResponse<T> {
    return HandlerResponseBuilder.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build standardized error response with enhanced error details
   * Delegates to ResponseBuilder
   */
  protected buildErrorResponse(
    message: string,
    statusCode: number,
    errorCode: string,
    details?: any
  ): ApiResponse {
    return HandlerResponseBuilder.buildErrorResponse(message, statusCode, errorCode, details);
  }

  /**
   * Build paginated response with standardized pagination metadata
   * Delegates to ResponseBuilder
   */
  protected buildPaginatedResponse<T>(
    message: string,
    data: T[],
    pagination: PaginationInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T[]> {
    return HandlerResponseBuilder.buildPaginatedResponse(message, data, pagination, additionalMetadata);
  }

  /**
   * Build response with performance metrics
   * Delegates to ResponseBuilder
   */
  protected buildPerformanceResponse<T>(
    message: string,
    data: T,
    performanceData: ResponsePerformanceMetrics,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    return HandlerResponseBuilder.buildPerformanceResponse(message, data, performanceData, additionalMetadata);
  }

  /**
   * Build response with validation errors
   * Delegates to ResponseBuilder
   */
  protected buildValidationErrorResponse(
    validationErrors: ValidationError[],
    statusCode: number = 400
  ): ApiResponse {
    return HandlerResponseBuilder.buildValidationErrorResponse(validationErrors, statusCode);
  }

  /**
   * Build response with resource information
   * Delegates to ResponseBuilder
   */
  protected buildResourceResponse<T>(
    message: string,
    data: T,
    resourceInfo: ResourceInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    return HandlerResponseBuilder.buildResourceResponse(message, data, resourceInfo, additionalMetadata);
  }

  /**
   * Build partial content response (206)
   * Delegates to ResponseBuilder
   */
  protected buildPartialContentResponse<T>(
    message: string,
    data: T,
    contentRange: ContentRange,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    return HandlerResponseBuilder.buildPartialContentResponse(message, data, contentRange, additionalMetadata);
  }

  /**
   * Build response with caching information
   * Delegates to ResponseBuilder
   */
  protected buildCachedResponse<T>(
    message: string,
    data: T,
    cacheInfo: CacheInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    return HandlerResponseBuilder.buildCachedResponse(message, data, cacheInfo, additionalMetadata);
  }

  // ===================================
  // DELEGATED MIDDLEWARE METHODS
  // ===================================

  /**
   * Parse authentication from the request
   * Delegates to MiddlewareCoordinator
   */
  protected async parseAuthentication(context: HandlerContext): Promise<void> {
    return MiddlewareCoordinator.parseAuthentication(context);
  }

  /**
   * Check if user has required permissions
   * Delegates to MiddlewareCoordinator
   */
  protected async checkPermissions(
    context: HandlerContext,
    requiredPermissions: string[]
  ): Promise<boolean> {
    return MiddlewareCoordinator.checkPermissions(context, requiredPermissions);
  }

  /**
   * Helper to parse request body with error handling
   * Delegates to MiddlewareCoordinator
   */
  protected async parseRequestBodyOrError<T>(
    context: HandlerContext,
    required: boolean = true
  ): Promise<{ data?: T; error?: ApiResponse }> {
    return MiddlewareCoordinator.parseRequestBodyOrError(context, required);
  }

  /**
   * Helper to parse path parameters with error handling
   * Delegates to MiddlewareCoordinator
   */
  protected async parsePathParamsOrError(
    context: HandlerContext
  ): Promise<{ data?: any; error?: ApiResponse }> {
    return MiddlewareCoordinator.parsePathParamsOrError(context);
  }

  /**
   * Helper to parse query parameters with error handling
   * Delegates to MiddlewareCoordinator
   */
  protected async parseQueryParamsOrError(
    context: HandlerContext,
    schema?: any
  ): Promise<{ data?: any; error?: ApiResponse }> {
    return MiddlewareCoordinator.parseQueryParamsOrError(context, schema);
  }

  /**
   * Helper to validate request with error handling
   * Delegates to MiddlewareCoordinator
   */
  protected validateOrError(context: HandlerContext, schema: ValidationSchema): ApiResponse | null {
    return MiddlewareCoordinator.validateOrError(context, schema);
  }

  /**
   * Helper to execute service logic with error handling
   * Delegates to MiddlewareCoordinator
   */
  protected async executeServiceOrError<T>(
    serviceLogic: () => Promise<T>,
    errorContext: {
      requestId: string;
      operation: string;
      userId?: string;
      additionalInfo?: Record<string, any>;
    }
  ): Promise<{ result?: T; error?: ApiResponse }> {
    return MiddlewareCoordinator.executeServiceOrError(serviceLogic, errorContext);
  }

  /**
   * Enhanced middleware helper using MiddlewareOrchestrator
   * Delegates to MiddlewareCoordinator
   */
  protected async executeWithMiddleware<T>(
    context: HandlerContext,
    pattern: 'read' | 'write' | 'auth-read' | 'auth-write' | 'admin-only',
    schemas: {
      query?: ValidationSchema;
      body?: ValidationSchema;  
      path?: ValidationSchema;
    },
    serviceLogic: () => Promise<T>
  ): Promise<ApiResponse<T> | ApiResponse> {
    return MiddlewareCoordinator.executeWithMiddleware(context, pattern, schemas, serviceLogic);
  }

  // ===================================
  // DELEGATED UTILITY METHODS
  // ===================================

  /**
   * Extract path parameters from the request
   * Delegates to HandlerUtils
   */
  protected getPathParameters(context: HandlerContext): Record<string, string> {
    return HandlerUtils.getPathParameters(context);
  }

  /**
   * Extract query parameters from the request
   * Delegates to HandlerUtils
   */
  protected getQueryParameters(context: HandlerContext): Record<string, string> {
    return HandlerUtils.getQueryParameters(context);
  }

  /**
   * Parse request body as JSON
   * Delegates to HandlerUtils
   */
  protected parseBody<T>(context: HandlerContext): T | null {
    return HandlerUtils.parseBody(context);
  }
}
