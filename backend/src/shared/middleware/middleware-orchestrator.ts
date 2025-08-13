import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { 
  HandlerContext, 
  ApiResponse, 
  HttpMethod
} from '../types/api.types';
import { ValidationSchema } from './validation.middleware';
import { createLogger } from '../logger';
import { ParsingMiddleware, ParsedRequest } from './parsing.middleware';
import { ValidationMiddleware } from './validation.middleware';
import { ErrorHandlingMiddleware } from './error-handling.middleware';
import { AuthMiddleware } from './auth.middleware';

/**
 * Comprehensive Middleware Orchestrator
 * Provides standardized middleware integration patterns for handlers
 * Optimizes performance through coordinated middleware execution
 */
export class MiddlewareOrchestrator {
  private static performanceCache = new Map<string, any>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Execute complete middleware stack with unified error handling
   * Provides one-stop middleware processing for handlers
   */
  static async executeMiddlewareStack(
    context: HandlerContext,
    options: {
      parsing?: {
        query?: boolean;
        body?: boolean;
        path?: boolean;
        bodyRequired?: boolean;
      };
      validation?: {
        query?: ValidationSchema;
        body?: ValidationSchema;
        path?: ValidationSchema;
      };
      authentication?: {
        required?: boolean;
        permissions?: string[];
      };
      caching?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    error?: ApiResponse;
    data?: {
      parsed?: {
        query?: any;
        body?: any;
        path?: any;
      };
      auth?: {
        isAuthenticated: boolean;
        userId?: string;
        userRole?: string;
      };
    };
  }> {
    const logger = createLogger({ requestId: context.requestId });
    const cacheKey = this.generateStackCacheKey(context, options);
    
    try {
      // Check cache if enabled
      if (options.caching && this.performanceCache.has(cacheKey)) {
        const cached = this.performanceCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.CACHE_TTL) {
          logger.debug('Middleware stack cache hit', { requestId: context.requestId });
          return cached.result;
        }
      }

      const result = {
        success: true,
        data: {
          parsed: {},
          auth: {
            isAuthenticated: false,
          },
        },
      };

      // Step 1: Request Parsing (if enabled)
      if (options.parsing) {
        const parsingResult = await this.executeParsingStack(context, options.parsing);
        if (parsingResult.error) {
          return { success: false, error: parsingResult.error };
        }
        result.data.parsed = parsingResult.data;
      }

      // Step 2: Authentication Processing (if enabled)
      if (options.authentication) {
        const authResult = await this.executeAuthenticationStack(context, options.authentication);
        if (authResult.error) {
          return { success: false, error: authResult.error };
        }
        result.data.auth = authResult.data!;
        
        // Update context with auth info
        context.isAuthenticated = authResult.data!.isAuthenticated;
        if (authResult.data!.userId) {
          context.userId = authResult.data!.userId;
        }
        if (authResult.data!.userRole) {
          context.userRole = authResult.data!.userRole;
        }
      }

      // Step 3: Request Validation (if enabled)
      if (options.validation) {
        const validationResult = await this.executeValidationStack(
          result.data.parsed,
          options.validation
        );
        if (validationResult.error) {
          return { success: false, error: validationResult.error };
        }
      }

      // Cache successful result if enabled
      if (options.caching) {
        this.performanceCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });
      }

      logger.debug('Middleware stack executed successfully', {
        requestId: context.requestId,
        hasParsing: !!options.parsing,
        hasValidation: !!options.validation,
        hasAuth: !!options.authentication,
        cached: options.caching,
      });

      return result;

    } catch (error) {
      logger.error('Middleware stack execution failed', error as Error, {
        requestId: context.requestId,
      });

      return {
        success: false,
        error: {
          success: false,
          error: {
            code: 'MIDDLEWARE_ERROR',
            message: 'Middleware processing failed',
            details: {
              error: (error as Error).message,
            },
          },
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Execute unified parsing stack with optimization
   */
  private static async executeParsingStack(
    context: HandlerContext,
    options: {
      query?: boolean;
      body?: boolean;
      path?: boolean;
      bodyRequired?: boolean;
    }
  ): Promise<{ data?: any; error?: ApiResponse }> {
    const parsed: any = {};

    try {
      // Parse query parameters
      if (options.query) {
        const { data: queryData, error: queryError } = ParsingMiddleware.parseQueryParams(context);
        if (queryError) {
          return { error: queryError };
        }
        parsed.query = queryData;
      }

      // Parse path parameters
      if (options.path) {
        const { data: pathData, error: pathError } = ParsingMiddleware.parsePathParams(context);
        if (pathError) {
          return { error: pathError };
        }
        parsed.path = pathData;
      }

      // Parse request body
      if (options.body) {
        const { data: bodyData, error: bodyError } = ParsingMiddleware.parseRequestBody(
          context,
          options.bodyRequired ?? false
        );
        if (bodyError) {
          return { error: bodyError };
        }
        parsed.body = bodyData;
      }

      return { data: parsed };
    } catch (error) {
      return {
        error: {
          success: false,
          error: {
            code: 'PARSING_ERROR',
            message: 'Request parsing failed',
            details: { error: (error as Error).message },
          },
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Execute unified authentication stack
   */
  private static async executeAuthenticationStack(
    context: HandlerContext,
    options: {
      required?: boolean;
      permissions?: string[];
    }
  ): Promise<{
    data?: {
      isAuthenticated: boolean;
      userId?: string;
      userRole?: string;
    };
    error?: ApiResponse;
  }> {
    try {
      const authHeader = context.event.headers?.Authorization || context.event.headers?.authorization;

      // If authentication not required and no header present
      if (!options.required && !authHeader) {
        return {
          data: {
            isAuthenticated: false,
          },
        };
      }

      // If authentication required but no header present
      if (options.required && !authHeader) {
        return {
          error: {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
            },
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Process authentication if header present
      if (authHeader) {
        const authResult = await AuthMiddleware.authenticateRequest(context, {
          required: true,
        });
        if (authResult.error) {
          return { error: authResult.error };
        }

        const authData: {
          isAuthenticated: boolean;
          userId?: string;
          userRole?: string;
        } = {
          isAuthenticated: true,
          ...(authResult.authenticatedContext?.userId && { userId: authResult.authenticatedContext.userId }),
          ...(authResult.authenticatedContext?.userRole && { userRole: authResult.authenticatedContext.userRole }),
        };

        // Check permissions if specified
        if (options.permissions && options.permissions.length > 0) {
          const hasPermissions = await this.checkUserPermissions(
            authData.userRole || 'user',
            options.permissions
          );

          if (!hasPermissions) {
            return {
              error: {
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: 'Insufficient permissions',
                  details: {
                    requiredPermissions: options.permissions,
                    userRole: authData.userRole,
                  },
                },
                timestamp: new Date().toISOString(),
              },
            };
          }
        }

        return { data: authData };
      }

      return {
        data: {
          isAuthenticated: false,
        },
      };
    } catch (error) {
      return {
        error: {
          success: false,
          error: {
            code: 'AUTH_ERROR',
            message: 'Authentication processing failed',
            details: { error: (error as Error).message },
          },
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Execute unified validation stack
   */
  private static async executeValidationStack(
    parsedData: any,
    schemas: {
      query?: ValidationSchema;
      body?: ValidationSchema;
      path?: ValidationSchema;
    }
  ): Promise<{ error?: ApiResponse }> {
    try {
      // Validate query parameters
      if (schemas.query && parsedData.query) {
        const queryValidation = ValidationMiddleware.validateFields(
          parsedData.query,
          schemas.query,
          'query'
        );
        if (queryValidation) {
          return { error: queryValidation };
        }
      }

      // Validate path parameters
      if (schemas.path && parsedData.path) {
        const pathValidation = ValidationMiddleware.validateFields(
          parsedData.path,
          schemas.path,
          'params'
        );
        if (pathValidation) {
          return { error: pathValidation };
        }
      }

      // Validate request body
      if (schemas.body && parsedData.body) {
        const bodyValidation = ValidationMiddleware.validateFields(
          parsedData.body,
          schemas.body,
          'body'
        );
        if (bodyValidation) {
          return { error: bodyValidation };
        }
      }

      return {};
    } catch (error) {
      return {
        error: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: { error: (error as Error).message },
          },
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Simplified middleware execution for common patterns
   */
  static async executeCommonPattern(
    context: HandlerContext,
    pattern: 'read' | 'write' | 'auth-read' | 'auth-write' | 'admin-only',
    schemas?: {
      query?: ValidationSchema;
      body?: ValidationSchema;
      path?: ValidationSchema;
    }
  ): Promise<{
    success: boolean;
    error?: ApiResponse;
    data?: any;
  }> {
    const patternConfigs: Record<string, any> = {
      read: {
        parsing: { query: true, path: true },
        ...(schemas && { validation: schemas }),
        authentication: { required: false },
        caching: true,
      },
      write: {
        parsing: { query: true, path: true, body: true, bodyRequired: true },
        ...(schemas && { validation: schemas }),
        authentication: { required: false },
        caching: false,
      },
      'auth-read': {
        parsing: { query: true, path: true },
        ...(schemas && { validation: schemas }),
        authentication: { required: true },
        caching: true,
      },
      'auth-write': {
        parsing: { query: true, path: true, body: true, bodyRequired: true },
        ...(schemas && { validation: schemas }),
        authentication: { required: true },
        caching: false,
      },
      'admin-only': {
        parsing: { query: true, path: true, body: true },
        ...(schemas && { validation: schemas }),
        authentication: { required: true, permissions: ['admin'] },
        caching: false,
      },
    };

    return this.executeMiddlewareStack(context, patternConfigs[pattern]);
  }

  /**
   * Check user permissions based on role
   */
  private static async checkUserPermissions(
    userRole: string,
    requiredPermissions: string[]
  ): Promise<boolean> {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'], // All permissions
      user: ['read', 'write:own', 'session:manage'],
      readonly: ['read'],
    };

    const userPermissions = rolePermissions[userRole] || [];

    // Admin has all permissions
    if (userPermissions.includes('*')) {
      return true;
    }

    // Check specific permissions
    return requiredPermissions.every(permission => userPermissions.includes(permission));
  }

  /**
   * Generate cache key for middleware stack
   */
  private static generateStackCacheKey(
    context: HandlerContext,
    options: any
  ): string {
    const keyComponents = [
      context.event.httpMethod,
      context.event.path,
      JSON.stringify(options),
      context.event.headers?.Authorization ? 'auth' : 'noauth',
    ];
    return keyComponents.join(':');
  }

  /**
   * Performance helper - extract parsed data from context
   */
  static extractParsedData(context: HandlerContext): {
    query?: any;
    body?: any;
    path?: any;
  } {
    return context.parsedData || {};
  }

  /**
   * Performance helper - create optimized response with metrics
   */
  static createOptimizedResponse<T>(
    data: T,
    message: string,
    performanceMetrics?: {
      cacheHit?: boolean;
      middlewareStages?: number;
      executionTime?: number;
    }
  ): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    if (performanceMetrics) {
      response.metadata = {
        performance: {
          middlewareOptimized: true,
          cacheHit: performanceMetrics.cacheHit || false,
          stages: performanceMetrics.middlewareStages || 0,
          executionTime: performanceMetrics.executionTime || 0,
        },
      };
    }

    return response;
  }

  /**
   * Clear performance cache (useful for testing)
   */
  static clearCache(): void {
    this.performanceCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    size: number;
    hitRate: number;
    keys: string[];
  } {
    return {
      size: this.performanceCache.size,
      hitRate: 0, // Could implement hit/miss tracking
      keys: Array.from(this.performanceCache.keys()),
    };
  }
}

/**
 * Convenience decorator for middleware integration
 * Provides annotation-based middleware configuration
 */
export function WithMiddleware(config: {
  pattern?: 'read' | 'write' | 'auth-read' | 'auth-write' | 'admin-only';
  parsing?: {
    query?: boolean;
    body?: boolean;
    path?: boolean;
    bodyRequired?: boolean;
  };
  validation?: {
    query?: ValidationSchema;
    body?: ValidationSchema;
    path?: ValidationSchema;
  };
  authentication?: {
    required?: boolean;
    permissions?: string[];
  };
  caching?: boolean;
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (context: HandlerContext) {
      // Execute middleware stack based on configuration
      let middlewareResult;
      
      if (config.pattern) {
        middlewareResult = await MiddlewareOrchestrator.executeCommonPattern(
          context,
          config.pattern,
          config.validation
        );
      } else {
        const middlewareOptions: any = {};
        if (config.parsing) middlewareOptions.parsing = config.parsing;
        if (config.validation) middlewareOptions.validation = config.validation;
        if (config.authentication) middlewareOptions.authentication = config.authentication;
        if (config.caching !== undefined) middlewareOptions.caching = config.caching;
        
        middlewareResult = await MiddlewareOrchestrator.executeMiddlewareStack(context, middlewareOptions);
      }

      if (!middlewareResult.success) {
        return middlewareResult.error;
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

      // Execute original method
      return method.call(this, context);
    };

    return descriptor;
  };
}