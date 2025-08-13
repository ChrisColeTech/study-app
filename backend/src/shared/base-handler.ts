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

      // Initialize request processing pipeline
      const pipeline = new RequestProcessingPipeline(event, context, logger);
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
   * Parse authentication from the request
   */
  protected async parseAuthentication(context: HandlerContext): Promise<void> {
    const authHeader = context.event.headers?.Authorization || context.event.headers?.authorization;

    if (!authHeader) {
      return;
    }

    try {
      // Extract Bearer token
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

      // This will be implemented in Phase 2 with actual JWT verification
      // For now, just mark as authenticated if token is present
      context.isAuthenticated = !!token;

      if (context.isAuthenticated) {
        // In Phase 2, decode JWT to get userId
        // context.userId = decodedToken.userId;
        context.userId = 'placeholder-user-id';
      }
    } catch (error) {
      const logger = createLogger({ requestId: context.requestId });
      logger.error('Failed to parse authentication token', error as Error);
      // Don't throw error, just leave as unauthenticated
    }
  }

  /**
   * Check if user has required permissions
   */
  protected async checkPermissions(
    context: HandlerContext,
    requiredPermissions: string[]
  ): Promise<boolean> {
    // Placeholder implementation - will be enhanced in Phase 2
    // For now, authenticated users have all permissions
    return context.isAuthenticated;
  }

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
      return this.matchPath(route.path, path);
    });
  }

  /**
   * Match path patterns with parameters
   */
  private matchPath(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    return patternParts.every((part, index) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        // This is a parameter, so it matches any value
        return true;
      }
      return part === pathParts[index];
    });
  }

  // ===================================
  // ENHANCED RESPONSE FORMATTING METHODS
  // ===================================

  /**
   * Helper method to create success responses
   */
  protected success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper method to create error responses
   */
  protected error(code: string, message: string, details?: ErrorDetails): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build standardized success response with comprehensive metadata support
   */
  protected buildSuccessResponse<T>(
    message: string,
    data: T,
    metadata?: ResponseMetadata
  ): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    if (metadata) {
      response.metadata = this.standardizeMetadata(metadata);
    }

    return response;
  }

  /**
   * Build standardized error response with enhanced error details
   */
  protected buildErrorResponse(
    message: string,
    statusCode: number,
    errorCode: string,
    details?: any
  ): ApiResponse {
    return {
      success: false,
      message,
      error: {
        code: errorCode,
        message,
        details: this.standardizeErrorDetails(details, statusCode),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build paginated response with standardized pagination metadata
   */
  protected buildPaginatedResponse<T>(
    message: string,
    data: T[],
    pagination: PaginationInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T[]> {
    const paginationMetadata = this.standardizePaginationMetadata(pagination);
    
    const metadata: ResponseMetadata = {
      pagination: paginationMetadata,
      count: data.length,
      ...additionalMetadata,
    };

    return this.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with performance metrics
   */
  protected buildPerformanceResponse<T>(
    message: string,
    data: T,
    performanceData: ResponsePerformanceMetrics,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      performance: this.standardizePerformanceMetadata(performanceData),
      ...additionalMetadata,
    };

    return this.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with validation errors
   */
  protected buildValidationErrorResponse(
    validationErrors: ValidationError[],
    statusCode: number = 400
  ): ApiResponse {
    const formattedErrors = this.standardizeValidationErrors(validationErrors);
    
    return this.buildErrorResponse(
      'Validation failed',
      statusCode,
      ERROR_CODES.VALIDATION_ERROR,
      {
        validationErrors: formattedErrors,
        errorCount: formattedErrors.length,
      }
    );
  }

  /**
   * Build response with resource information
   */
  protected buildResourceResponse<T>(
    message: string,
    data: T,
    resourceInfo: ResourceInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      resource: this.standardizeResourceInfo(resourceInfo),
      ...additionalMetadata,
    };

    return this.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build partial content response (206)
   */
  protected buildPartialContentResponse<T>(
    message: string,
    data: T,
    contentRange: ContentRange,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      contentRange: this.standardizeContentRange(contentRange),
      ...additionalMetadata,
    };

    return this.buildSuccessResponse(message, data, metadata);
  }

  /**
   * Build response with caching information
   */
  protected buildCachedResponse<T>(
    message: string,
    data: T,
    cacheInfo: CacheInfo,
    additionalMetadata?: Record<string, any>
  ): ApiResponse<T> {
    const metadata: ResponseMetadata = {
      cache: this.standardizeCacheInfo(cacheInfo),
      ...additionalMetadata,
    };

    return this.buildSuccessResponse(message, data, metadata);
  }

  // ===================================
  // METADATA STANDARDIZATION METHODS
  // ===================================

  /**
   * Standardize general response metadata
   */
  private standardizeMetadata(metadata: ResponseMetadata): ResponseMetadata {
    const standardized: ResponseMetadata = {};

    if (metadata.pagination) {
      standardized.pagination = this.standardizePaginationMetadata(metadata.pagination);
    }

    if (metadata.performance && 'executionTime' in metadata.performance) {
      standardized.performance = this.standardizePerformanceMetadata(metadata.performance as ResponsePerformanceMetrics);
    }

    if (metadata.resource && 'id' in metadata.resource) {
      standardized.resource = this.standardizeResourceInfo(metadata.resource as ResourceInfo);
    }

    if (metadata.cache && 'cached' in metadata.cache) {
      standardized.cache = this.standardizeCacheInfo(metadata.cache as CacheInfo);
    }

    if (metadata.contentRange && 'unit' in metadata.contentRange) {
      standardized.contentRange = this.standardizeContentRange(metadata.contentRange as ContentRange);
    }

    // Include any additional metadata
    Object.keys(metadata).forEach(key => {
      if (!['pagination', 'performance', 'resource', 'cache', 'contentRange'].includes(key)) {
        standardized[key] = metadata[key];
      }
    });

    return standardized;
  }

  /**
   * Standardize pagination metadata
   */
  private standardizePaginationMetadata(pagination: PaginationInfo): StandardizedPagination {
    return {
      currentPage: pagination.currentPage || 1,
      pageSize: pagination.pageSize || 10,
      totalItems: pagination.totalItems || 0,
      totalPages: pagination.totalPages || Math.ceil((pagination.totalItems || 0) / (pagination.pageSize || 10)),
      hasNextPage: pagination.hasNextPage ?? false,
      hasPreviousPage: pagination.hasPreviousPage ?? false,
      nextPage: pagination.hasNextPage ? (pagination.currentPage || 1) + 1 : null,
      previousPage: pagination.hasPreviousPage ? (pagination.currentPage || 1) - 1 : null,
    };
  }

  /**
   * Standardize performance metadata
   */
  private standardizePerformanceMetadata(performance: ResponsePerformanceMetrics): StandardizedResponsePerformance {
    return {
      executionTime: performance.executionTime || 0,
      memoryUsed: performance.memoryUsed || 0,
      stages: performance.stages || [],
      dbQueries: performance.dbQueries || 0,
      cacheHits: performance.cacheHits || 0,
      cacheMisses: performance.cacheMisses || 0,
    };
  }

  /**
   * Standardize resource information
   */
  private standardizeResourceInfo(resource: ResourceInfo): StandardizedResource {
    return {
      id: resource.id,
      type: resource.type,
      version: resource.version || '1.0',
      lastModified: resource.lastModified || new Date().toISOString(),
      etag: resource.etag || undefined,
      links: this.standardizeResourceLinks(resource.links || {}),
    };
  }

  /**
   * Standardize resource links
   */
  private standardizeResourceLinks(links: Record<string, string>): StandardizedResourceLinks {
    const standardized: StandardizedResourceLinks = {};

    Object.keys(links).forEach(rel => {
      standardized[rel] = {
        href: links[rel],
        rel,
        method: this.getDefaultMethodForRel(rel),
      };
    });

    return standardized;
  }

  /**
   * Get default HTTP method for relation type
   */
  private getDefaultMethodForRel(rel: string): string {
    const methodMap: Record<string, string> = {
      self: 'GET',
      edit: 'PUT',
      delete: 'DELETE',
      create: 'POST',
      update: 'PATCH',
      list: 'GET',
      parent: 'GET',
      next: 'GET',
      prev: 'GET',
      first: 'GET',
      last: 'GET',
    };

    return methodMap[rel] || 'GET';
  }

  /**
   * Standardize cache information
   */
  private standardizeCacheInfo(cache: CacheInfo): StandardizedCache {
    return {
      cached: cache.cached || false,
      cacheKey: cache.cacheKey || undefined,
      ttl: cache.ttl || 0,
      hitRate: cache.hitRate || 0,
      lastUpdated: cache.lastUpdated || new Date().toISOString(),
      source: cache.source || 'database',
    };
  }

  /**
   * Standardize content range information
   */
  private standardizeContentRange(contentRange: ContentRange): StandardizedContentRange {
    return {
      unit: contentRange.unit || 'items',
      start: contentRange.start || 0,
      end: contentRange.end || 0,
      total: contentRange.total || 0,
      range: `${contentRange.start || 0}-${contentRange.end || 0}/${contentRange.total || 0}`,
    };
  }

  /**
   * Standardize error details
   */
  private standardizeErrorDetails(details: any, statusCode: number): StandardizedErrorDetails {
    if (!details) {
      return {
        statusCode,
        timestamp: new Date().toISOString(),
      };
    }

    const standardized: StandardizedErrorDetails = {
      statusCode,
      timestamp: new Date().toISOString(),
    };

    if (details.validationErrors) {
      standardized.validationErrors = this.standardizeValidationErrors(details.validationErrors);
    }

    if (details.field) {
      standardized.field = details.field;
    }

    if (details.value) {
      standardized.value = details.value;
    }

    if (details.expected) {
      standardized.expected = details.expected;
    }

    if (details.actual) {
      standardized.actual = details.actual;
    }

    // Include any additional details
    Object.keys(details).forEach(key => {
      if (!['validationErrors', 'field', 'value', 'expected', 'actual'].includes(key)) {
        standardized[key] = details[key];
      }
    });

    return standardized;
  }

  /**
   * Standardize validation errors
   */
  private standardizeValidationErrors(errors: ValidationError[]): StandardizedValidationError[] {
    return errors.map(error => ({
      field: error.field,
      message: error.message,
      code: error.code || 'VALIDATION_ERROR',
      value: error.value,
      location: error.location || 'body',
      constraint: error.constraint || undefined,
    }));
  }

  // ===================================
  // UTILITY METHODS
  // ===================================

  /**
   * Extract path parameters from the request
   */
  protected getPathParameters(context: HandlerContext): Record<string, string> {
    const params = context.event.pathParameters || {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Extract query parameters from the request
   */
  protected getQueryParameters(context: HandlerContext): Record<string, string> {
    const params = context.event.queryStringParameters || {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Parse request body as JSON
   */
  protected parseBody<T>(context: HandlerContext): T | null {
    if (!context.event.body) {
      return null;
    }

    try {
      return JSON.parse(context.event.body) as T;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  // ===================================
  // DRY ELIMINATION HELPER METHODS
  // ===================================

  /**
   * Helper to parse request body with error handling
   * Eliminates: const { data: X, error: parseError } = ParsingMiddleware.parseRequestBody(...); if (parseError) return parseError;
   */
  protected async parseRequestBodyOrError<T>(
    context: HandlerContext,
    required: boolean = true
  ): Promise<{ data?: T; error?: ApiResponse }> {
    const { data, error: parseError } = ParsingMiddleware.parseRequestBody<T>(context, required);
    if (parseError) return { error: parseError };
    return { data };
  }

  /**
   * Helper to parse path parameters with error handling
   * Eliminates: const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(...); if (parseError) return parseError;
   */
  protected async parsePathParamsOrError(
    context: HandlerContext
  ): Promise<{ data?: any; error?: ApiResponse }> {
    const { data, error: parseError } = ParsingMiddleware.parsePathParams(context);
    if (parseError) return { error: parseError };
    return { data };
  }

  /**
   * Helper to parse query parameters with error handling
   * Eliminates: const { data: queryParams, error: parseError } = ParsingMiddleware.parseQueryParams(...); if (parseError) return parseError;
   */
  protected async parseQueryParamsOrError(
    context: HandlerContext,
    schema?: any
  ): Promise<{ data?: any; error?: ApiResponse }> {
    const { data, error: parseError } = ParsingMiddleware.parseQueryParams(context, schema);
    if (parseError) return { error: parseError };
    return { data };
  }

  /**
   * Helper to validate request with error handling
   * Eliminates: if (validationResult.error) return validationResult.error;
   */
  protected validateOrError(context: HandlerContext, schema: ValidationSchema): ApiResponse | null {
    const validationResult = ValidationMiddleware.validateRequestBody(context, schema);
    return validationResult.error || null;
  }

  /**
   * Helper to execute service logic with error handling
   * Eliminates repetitive ErrorHandlingMiddleware.withErrorHandling boilerplate
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
    // Use the optimized withErrorProcessing method for better performance and consistency
    const { result, errorInfo } = await ErrorHandlingMiddleware.withErrorProcessing(
      serviceLogic,
      errorContext
    );

    if (errorInfo) {
      // Use BaseHandler's standardized error response builder
      const errorResponse = this.buildErrorResponse(
        errorInfo.message,
        errorInfo.statusCode,
        errorInfo.code
      );
      return { error: errorResponse };
    }

    if (result === undefined) return {};
    return { result };
  }

  /**
   * Enhanced middleware helper using MiddlewareOrchestrator
   * Provides optimized middleware execution with performance benefits
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
    const startTime = Date.now();

    // Import at runtime to avoid circular dependencies
    const { MiddlewareOrchestrator } = await import('./middleware');

    // Execute middleware stack with pattern
    const middlewareResult = await MiddlewareOrchestrator.executeCommonPattern(
      context,
      pattern,
      schemas
    );

    if (!middlewareResult.success) {
      return middlewareResult.error!;
    }

    // Update context with middleware results
    if (middlewareResult.data?.parsed) {
      context.parsedData = middlewareResult.data.parsed;
    }
    if (middlewareResult.data?.auth) {
      context.isAuthenticated = middlewareResult.data.auth.isAuthenticated;
      context.userId = middlewareResult.data.auth.userId;
      context.userRole = middlewareResult.data.auth.userRole;
    }

    // Execute service logic with error handling
    const serviceResult = await this.executeServiceOrError(serviceLogic, {
      requestId: context.requestId,
      operation: `${pattern}-operation`,
      ...(context.userId && { userId: context.userId }),
    });

    if (serviceResult.error) {
      return serviceResult.error;
    }

    // Create optimized response with performance metrics
    const executionTime = Date.now() - startTime;
    return MiddlewareOrchestrator.createOptimizedResponse(
      serviceResult.result!,
      'Operation completed successfully',
      {
        middlewareStages: 3, // parsing, auth, validation
        executionTime,
        cacheHit: false, // Could be enhanced to track cache hits
      }
    );
  }
}
