import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { logger } from '../logger';

type Logger = typeof logger;
import { RouteConfig } from '../base-handler';
import { HandlerContext, HttpMethod, ApiResponse } from '../types/api.types';
import { ResponseBuilder } from '../response-builder';
import { ParsingMiddleware } from './parsing.middleware';
import { ValidationMiddleware, ValidationSchema } from './validation.middleware';
import { ErrorHandlingMiddleware } from './error-handling.middleware';
import { AuthMiddleware } from './auth.middleware';
import { RequestLifecycleTracker } from './request-lifecycle-tracker';
import { EnvironmentDetector } from '../config';

export interface PipelineExecutionContext {
  event: APIGatewayProxyEvent;
  context: Context;
  handlerContext: HandlerContext;
  logger: Logger;
  lifecycle: RequestLifecycleTracker;
}

/**
 * Request Processing Pipeline
 * Orchestrates the complete request processing flow with middleware integration
 */
export class RequestProcessingPipeline {
  private event: APIGatewayProxyEvent;
  private context: Context;
  private logger: Logger;
  private lifecycle: RequestLifecycleTracker;
  private middlewareCache: Map<string, any> = new Map();

  constructor(event: APIGatewayProxyEvent, context: Context, logger: Logger) {
    this.event = event;
    this.context = context;
    this.logger = logger;
    this.lifecycle = new RequestLifecycleTracker(context.awsRequestId, logger);
  }

  /**
   * Execute the complete integrated middleware pipeline
   * Optimized with unified middleware orchestration
   */
  async execute(routes: RouteConfig[]): Promise<ApiResponse> {
    this.lifecycle.start('pipeline_init');

    try {
      // Step 1: Create handler context with enhanced initialization
      this.lifecycle.start('context_creation');
      const handlerContext = await this.createHandlerContext();
      this.lifecycle.complete('context_creation');

      // Step 2: Parse request data through integrated ParsingMiddleware
      this.lifecycle.start('request_parsing');
      const parsingResult = await this.processRequestParsing(handlerContext);
      if (parsingResult.error) {
        this.lifecycle.complete('request_parsing', { success: false });
        return parsingResult.error;
      }
      handlerContext.parsedData = parsingResult.data;
      this.lifecycle.complete('request_parsing', { success: true });

      // Step 3: Process authentication through integrated AuthMiddleware
      this.lifecycle.start('authentication');
      const authResult = await this.processAuthentication(handlerContext);
      if (authResult) {
        this.lifecycle.complete('authentication', { passed: false });
        return authResult;
      }
      this.lifecycle.complete('authentication', { passed: true });

      // Step 4: Find matching route with enhanced route matching
      this.lifecycle.start('route_matching');
      const route = this.findRoute(routes, this.event.httpMethod as HttpMethod, this.event.path);
      if (!route) {
        this.lifecycle.complete('route_matching', { found: false });
        return this.createNotFoundResponse();
      }
      this.lifecycle.complete('route_matching', { found: true, route: route.path });

      // Step 5: Check authentication requirements
      this.lifecycle.start('auth_check');
      const authCheckResult = await this.checkAuthentication(handlerContext, route);
      if (authCheckResult) {
        this.lifecycle.complete('auth_check', { passed: false });
        return authCheckResult;
      }
      this.lifecycle.complete('auth_check', { passed: true });

      // Step 6: Check permissions with caching
      this.lifecycle.start('permission_check');
      const permissionResult = await this.checkPermissions(handlerContext, route);
      if (permissionResult) {
        this.lifecycle.complete('permission_check', { passed: false });
        return permissionResult;
      }
      this.lifecycle.complete('permission_check', { passed: true });

      // Step 7: Validate request through integrated ValidationMiddleware
      this.lifecycle.start('request_validation');
      const validationResult = await this.processRequestValidation(handlerContext, route);
      if (validationResult) {
        this.lifecycle.complete('request_validation', { success: false });
        return validationResult;
      }
      this.lifecycle.complete('request_validation', { success: true });

      // Step 8: Execute route handler with comprehensive error handling
      this.lifecycle.start('handler_execution');
      const result = await this.executeHandler(route, handlerContext);
      this.lifecycle.complete('handler_execution', { 
        success: result.success,
        statusCode: this.getStatusCodeFromResponse(result)
      });

      this.lifecycle.complete('pipeline_init');
      return result;

    } catch (error) {
      this.lifecycle.error('pipeline_execution', error as Error);
      
      this.logger.error('Pipeline execution failed', error, {
        method: this.event.httpMethod,
        path: this.event.path,
        requestId: this.context.awsRequestId,
      });

      return this.createInternalErrorResponse(error as Error);
    }
  }

  /**
   * Create handler context with enhanced data structure
   */
  private async createHandlerContext(): Promise<HandlerContext> {
    return {
      event: this.event,
      context: this.context,
      requestId: this.context.awsRequestId,
      isAuthenticated: false,
      parsedData: {},
      validationResults: {},
      middlewareCache: this.middlewareCache,
    };
  }

  /**
   * Integrated request parsing with ParsingMiddleware optimization
   */
  private async processRequestParsing(handlerContext: HandlerContext): Promise<{
    data?: any;
    error?: ApiResponse;
  }> {
    const parsedData: any = {};

    try {
      // Parse query parameters with caching
      const queryKey = `query:${JSON.stringify(this.event.queryStringParameters)}`;
      if (this.middlewareCache.has(queryKey)) {
        parsedData.query = this.middlewareCache.get(queryKey);
      } else {
        const { data: queryParams, error: queryError } = ParsingMiddleware.parseQueryParams(
          handlerContext
        );
        if (queryError) {
          return { error: queryError };
        }
        parsedData.query = queryParams;
        this.middlewareCache.set(queryKey, queryParams);
      }

      // Parse path parameters with validation
      const { data: pathParams, error: pathError } = ParsingMiddleware.parsePathParams(
        handlerContext
      );
      if (pathError) {
        return { error: pathError };
      }
      parsedData.path = pathParams;

      // Parse request body with enhanced handling
      if (this.event.body && this.event.httpMethod !== 'GET') {
        const { data: bodyData, error: bodyError } = ParsingMiddleware.parseRequestBody(
          handlerContext,
          true
        );
        if (bodyError) {
          return { error: bodyError };
        }
        parsedData.body = bodyData;
      }

      this.logger.debug('Request parsing completed', {
        requestId: handlerContext.requestId,
        queryCount: Object.keys(parsedData.query || {}).length,
        pathCount: Object.keys(parsedData.path || {}).length,
        hasBody: !!parsedData.body,
      });

      return { data: parsedData };
    } catch (error) {
      this.logger.error('Request parsing failed', error as Error, {
        requestId: handlerContext.requestId,
      });
      return { error: this.createInternalErrorResponse(error as Error) };
    }
  }

  /**
   * Enhanced authentication processing with AuthMiddleware integration
   */
  private async processAuthentication(handlerContext: HandlerContext): Promise<ApiResponse | null> {
    const authHeader = this.event.headers?.Authorization || this.event.headers?.authorization;

    if (!authHeader) {
      return null;
    }

    try {
      // Use AuthMiddleware for standardized authentication
      const authResult = await AuthMiddleware.authenticateRequest(handlerContext, {
        required: true,
      });
      
      if (authResult.error) {
        return authResult.error;
      }

      handlerContext.isAuthenticated = true;
      if (authResult.authenticatedContext?.userId) {
        handlerContext.userId = authResult.authenticatedContext.userId;
      }
      if (authResult.authenticatedContext?.userRole) {
        handlerContext.userRole = authResult.authenticatedContext.userRole;
      }

      this.logger.debug('Authentication processed', {
        requestId: handlerContext.requestId,
        isAuthenticated: handlerContext.isAuthenticated,
        ...(handlerContext.userId && { userId: handlerContext.userId }),
        ...(handlerContext.userRole && { role: handlerContext.userRole }),
      });

      return null;
    } catch (error) {
      this.logger.error('Failed to process authentication', error as Error, {
        requestId: handlerContext.requestId,
      });
      return this.createUnauthorizedResponse('Authentication processing failed');
    }
  }

  /**
   * Integrated request validation with ValidationMiddleware optimization
   */
  private async processRequestValidation(
    handlerContext: HandlerContext,
    route: RouteConfig
  ): Promise<ApiResponse | null> {
    try {
      // Skip validation if route doesn't require it
      if (!route.validationSchema) {
        return null;
      }

      const validationResults: any = {};

      // Validate query parameters if present
      if (handlerContext.parsedData?.query && route.validationSchema.query) {
        const queryValidation = ValidationMiddleware.validateFields(
          handlerContext.parsedData.query,
          route.validationSchema.query,
          'query'
        );
        if (queryValidation) {
          return queryValidation;
        }
        validationResults.query = true;
      }

      // Validate path parameters if present
      if (handlerContext.parsedData?.path && route.validationSchema.path) {
        const pathValidation = ValidationMiddleware.validateFields(
          handlerContext.parsedData.path,
          route.validationSchema.path,
          'params'
        );
        if (pathValidation) {
          return pathValidation;
        }
        validationResults.path = true;
      }

      // Validate request body if present
      if (handlerContext.parsedData?.body && route.validationSchema.body) {
        const bodyValidation = ValidationMiddleware.validateFields(
          handlerContext.parsedData.body,
          route.validationSchema.body,
          'body'
        );
        if (bodyValidation) {
          return bodyValidation;
        }
        validationResults.body = true;
      }

      handlerContext.validationResults = validationResults;

      this.logger.debug('Request validation completed', {
        requestId: handlerContext.requestId,
        validatedComponents: Object.keys(validationResults),
      });

      return null;
    } catch (error) {
      this.logger.error('Request validation failed', error as Error, {
        requestId: handlerContext.requestId,
      });
      return this.createInternalErrorResponse(error as Error);
    }
  }

  /**
   * Find matching route with improved pattern matching and caching
   */
  private findRoute(routes: RouteConfig[], method: HttpMethod, path: string): RouteConfig | undefined {
    const routeKey = `${method}:${path}`;
    
    // Check cache first for performance
    if (this.middlewareCache.has(routeKey)) {
      return this.middlewareCache.get(routeKey);
    }

    const route = routes.find(route => {
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

    // Cache the result for performance
    if (route) {
      this.middlewareCache.set(routeKey, route);
    }

    return route;
  }

  /**
   * Enhanced path pattern matching with parameter extraction
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

  /**
   * Enhanced authentication checking with permission caching
   */
  private async checkAuthentication(
    handlerContext: HandlerContext,
    route: RouteConfig
  ): Promise<ApiResponse | null> {
    if (route.requireAuth && !handlerContext.isAuthenticated) {
      this.logger.warn('Authentication required', { 
        path: this.event.path,
        requestId: handlerContext.requestId,
      });
      
      return this.createUnauthorizedResponse('Authentication required');
    }
    
    return null;
  }

  /**
   * Enhanced permission checking with role-based access
   */
  private async checkPermissions(
    handlerContext: HandlerContext,
    route: RouteConfig
  ): Promise<ApiResponse | null> {
    if (route.permissions && route.permissions.length > 0) {
      const permissionKey = `perm:${handlerContext.userId}:${route.permissions.join(',')}`;
      
      // Check cache first
      if (this.middlewareCache.has(permissionKey)) {
        const hasPermission = this.middlewareCache.get(permissionKey);
        if (!hasPermission) {
          return this.createForbiddenResponse('Insufficient permissions');
        }
        return null;
      }

      const hasPermission = await this.hasRequiredPermissions(handlerContext, route.permissions);
      
      // Cache the result
      this.middlewareCache.set(permissionKey, hasPermission);
      
      if (!hasPermission) {
        this.logger.warn('Insufficient permissions', {
          path: this.event.path,
          requiredPermissions: route.permissions,
          userId: handlerContext.userId || '',
          requestId: handlerContext.requestId,
        });
        
        return this.createForbiddenResponse('Insufficient permissions');
      }
    }
    
    return null;
  }

  /**
   * Enhanced permission checking with role-based logic
   */
  private async hasRequiredPermissions(
    context: HandlerContext,
    requiredPermissions: string[]
  ): Promise<boolean> {
    // Enhanced implementation with role-based permissions
    if (!context.isAuthenticated) {
      return false;
    }

    // Admin users have all permissions
    if (context.userRole === 'admin') {
      return true;
    }

    // Check specific permissions based on user role
    const userPermissions = this.getUserPermissions(context.userRole || 'user');
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Get user permissions based on role
   */
  private getUserPermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // All permissions
      user: ['read', 'write:own', 'session:manage'],
      readonly: ['read'],
    };

    return rolePermissions[role] || [];
  }

  /**
   * Execute route handler with enhanced context and error handling
   */
  private async executeHandler(route: RouteConfig, handlerContext: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.debug('Executing route handler', {
        method: route.method,
        path: route.path,
        requestId: handlerContext.requestId,
        hasValidatedData: !!handlerContext.validationResults,
        hasParsedData: !!handlerContext.parsedData,
      });

      const result = await route.handler(handlerContext);
      
      this.logger.debug('Route handler completed', {
        method: route.method,
        path: route.path,
        success: result.success,
        requestId: handlerContext.requestId,
      });

      return result;
    } catch (error) {
      this.logger.error('Route handler execution failed', error, {
        method: route.method,
        path: route.path,
        requestId: handlerContext.requestId,
      });

      return this.createInternalErrorResponse(error as Error);
    }
  }

  /**
   * Enhanced response creation methods with better error context
   */
  private createNotFoundResponse(): ApiResponse {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        details: {
          path: this.event.path,
          method: this.event.httpMethod,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createUnauthorizedResponse(message: string): ApiResponse {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
        details: {
          path: this.event.path,
          method: this.event.httpMethod,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createForbiddenResponse(message: string): ApiResponse {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
        details: {
          path: this.event.path,
          method: this.event.httpMethod,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createInternalErrorResponse(error: Error): ApiResponse {
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: {
          ...(EnvironmentDetector.isDevelopment() && { errorMessage: error.message }),
          path: this.event.path,
          method: this.event.httpMethod,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract status code from API response for logging
   */
  private getStatusCodeFromResponse(response: ApiResponse): number {
    if (response.success) {
      return 200;
    }

    // Map error codes to HTTP status codes
    switch (response.error?.code) {
      case 'NOT_FOUND':
        return 404;
      case 'UNAUTHORIZED':
        return 401;
      case 'FORBIDDEN':
        return 403;
      case 'VALIDATION_ERROR':
        return 400;
      case 'CONFLICT':
        return 409;
      case 'RATE_LIMITED':
        return 429;
      default:
        return 500;
    }
  }

  /**
   * Get pipeline execution metrics with enhanced performance data
   */
  getMetrics() {
    const metrics = this.lifecycle.getMetrics();
    const performance = this.lifecycle.isPerformanceAcceptable();
    
    return {
      ...metrics,
      performance,
      cacheStats: {
        size: this.middlewareCache.size,
        keys: Array.from(this.middlewareCache.keys()),
      },
    };
  }

  /**
   * Clear middleware cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.middlewareCache.clear();
  }
}