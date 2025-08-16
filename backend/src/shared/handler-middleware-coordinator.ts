/**
 * MiddlewareCoordinator - Middleware orchestration for BaseHandler
 * Extracted from BaseHandler to achieve SRP compliance
 */

import { Context } from 'aws-lambda';
import { HandlerContext, ApiResponse } from './types';
import { ValidationSchema } from './middleware';
import { createLogger } from './logger';
import { ParsingMiddleware } from './middleware/parsing.middleware';
import { ValidationMiddleware } from './middleware/validation.middleware';
import { ErrorHandlingMiddleware } from './middleware/error-handling.middleware';
import { ResponseBuilder } from './handler-response-builder';

export class MiddlewareCoordinator {
  /**
   * Parse authentication from the request
   */
  static async parseAuthentication(context: HandlerContext): Promise<void> {
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
  static async checkPermissions(
    context: HandlerContext,
    requiredPermissions: string[]
  ): Promise<boolean> {
    // Placeholder implementation - will be enhanced in Phase 2
    // For now, authenticated users have all permissions
    return context.isAuthenticated;
  }

  /**
   * Helper to parse request body with error handling
   * Eliminates: const { data: X, error: parseError } = ParsingMiddleware.parseRequestBody(...); if (parseError) return parseError;
   */
  static async parseRequestBodyOrError<T>(
    context: HandlerContext,
    required: boolean = true
  ): Promise<{ data?: T; error?: ApiResponse }> {
    // Debug logging
    console.log('DEBUG: parseRequestBodyOrError called', {
      hasEvent: !!context.event,
      hasBody: !!context.event?.body,
      bodyPreview: context.event?.body?.substring(0, 100),
      hasParsedData: !!context.parsedData,
      parsedDataKeys: context.parsedData ? Object.keys(context.parsedData) : [],
      parsedBodyValue: context.parsedData?.body
    });

    // Check if body has already been parsed by the pipeline and is valid
    if (context.parsedData && 'body' in context.parsedData && context.parsedData.body !== null) {
      console.log('DEBUG: Using pre-parsed body from context.parsedData');
      return { data: context.parsedData.body as T };
    }

    console.log('DEBUG: Falling back to direct parsing');
    // Fall back to direct parsing if not already parsed or parsing failed
    const { data, error: parseError } = ParsingMiddleware.parseRequestBody<T>(context, required);
    console.log('DEBUG: Direct parsing result', { hasData: !!data, hasError: !!parseError, data });
    if (parseError) return { error: parseError };
    return { data };
  }

  /**
   * Helper to parse path parameters with error handling
   * Eliminates: const { data: pathParams, error: parseError } = ParsingMiddleware.parsePathParams(...); if (parseError) return parseError;
   */
  static async parsePathParamsOrError(
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
  static async parseQueryParamsOrError(
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
  static validateOrError(context: HandlerContext, schema: ValidationSchema): ApiResponse | null {
    const validationResult = ValidationMiddleware.validateRequestBody(context, schema);
    return validationResult.error || null;
  }

  /**
   * Helper to execute service logic with error handling
   * Eliminates repetitive ErrorHandlingMiddleware.withErrorHandling boilerplate
   */
  static async executeServiceOrError<T>(
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
      // Use ResponseBuilder's standardized error response builder
      const errorResponse = ResponseBuilder.buildErrorResponse(
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
  static async executeWithMiddleware<T>(
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
    const serviceResult = await MiddlewareCoordinator.executeServiceOrError(serviceLogic, {
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