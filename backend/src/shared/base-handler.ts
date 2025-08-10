// BaseHandler pattern to eliminate HTTP boilerplate

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { 
  HandlerContext, 
  RouteHandler, 
  HttpMethod, 
  ApiResponse,
  LambdaHandler
} from './types/api.types';
import { ResponseBuilder } from './response-builder';
import { createLogger } from './logger';
import { HTTP_STATUS_CODES } from './constants/api.constants';

export interface RouteConfig {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  requireAuth?: boolean;
  permissions?: string[] | undefined;
}

export abstract class BaseHandler {
  protected routes: RouteConfig[] = [];
  
  constructor() {
    this.setupRoutes();
  }

  /**
   * Main Lambda handler function
   */
  public handle: LambdaHandler = async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    const logger = createLogger({ requestId: context.awsRequestId });
    
    try {
      // Handle CORS preflight requests
      if (event.httpMethod === 'OPTIONS') {
        return ResponseBuilder.corsResponse();
      }

      logger.info('Request received', {
        method: event.httpMethod,
        path: event.path,
        queryParams: event.queryStringParameters,
        headers: event.headers ? Object.keys(event.headers) : [],
      });

      // Create handler context
      const handlerContext: HandlerContext = {
        event,
        context,
        requestId: context.awsRequestId,
        isAuthenticated: false,
      };

      // Parse and validate authentication if present
      await this.parseAuthentication(handlerContext);

      // Find matching route
      const route = this.findRoute(event.httpMethod as HttpMethod, event.path);
      
      if (!route) {
        logger.warn('Route not found', {
          method: event.httpMethod,
          path: event.path,
        });
        return ResponseBuilder.notFound('Endpoint', context.awsRequestId);
      }

      // Check authentication requirements
      if (route.requireAuth && !handlerContext.isAuthenticated) {
        logger.warn('Authentication required', { path: event.path });
        return ResponseBuilder.unauthorized('Authentication required', context.awsRequestId);
      }

      // Check permissions if specified
      if (route.permissions && route.permissions.length > 0) {
        const hasPermission = await this.checkPermissions(handlerContext, route.permissions);
        if (!hasPermission) {
          logger.warn('Insufficient permissions', { 
            path: event.path,
            requiredPermissions: route.permissions || [],
            userId: handlerContext.userId || '',
          });
          return ResponseBuilder.forbidden('Insufficient permissions', context.awsRequestId);
        }
      }

      // Execute route handler
      logger.time('handler_execution');
      const result = await route.handler(handlerContext);
      logger.timeEnd('handler_execution', 'Handler execution completed');

      // Convert ApiResponse to APIGatewayProxyResult
      const response = ResponseBuilder.fromApiResponse(result, context.awsRequestId);

      logger.info('Request completed', {
        statusCode: response.statusCode,
        executionTime: logger,
      });

      return response;

    } catch (error) {
      logger.error('Unhandled error in handler', error, {
        method: event.httpMethod,
        path: event.path,
      });

      return ResponseBuilder.internalError(error, context.awsRequestId);
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
      logger.warn('Failed to parse authentication token', error as Error);
      // Don't throw error, just leave as unauthenticated
    }
  }

  /**
   * Check if user has required permissions
   */
  protected async checkPermissions(context: HandlerContext, requiredPermissions: string[]): Promise<boolean> {
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
  protected error(code: string, message: string, details?: any): ApiResponse {
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
}