import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PublicHandler, AuthenticatedHandler, ApiResponse, ErrorCode, ApiError } from '../types';
import { ResponseBuilder } from './response-builder';
import { Logger } from './logger';

/**
 * Base Handler Class - Eliminates ALL boilerplate code across Lambda functions
 * 
 * This addresses the V1 issue where auth code was duplicated across 7+ handlers.
 * Now ALL common functionality is centralized in this base class.
 */
export abstract class BaseHandler {
  protected logger: Logger;
  protected version: string = '2.0.0';

  constructor(protected handlerName: string) {
    this.logger = new Logger(handlerName);
  }

  /**
   * Main entry point for authenticated handlers
   * Handles ALL common concerns: auth, CORS, logging, error handling
   */
  public withAuth(handler: AuthenticatedHandler): PublicHandler {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const requestId = event.requestContext.requestId;
      const route = `${event.httpMethod} ${event.resource}`;
      
      try {
        this.logger.info(`[${requestId}] ${route} - Request started`, {
          httpMethod: event.httpMethod,
          resource: event.resource,
          userAgent: event.headers['User-Agent'],
          sourceIp: event.requestContext.identity.sourceIp
        });

        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
          return ResponseBuilder.cors();
        }

        // Extract and validate user context
        const userId = this.extractUserId(event);
        
        if (!userId) {
          this.logger.warn(`[${requestId}] ${route} - No userId in authorizer context`, {
            authorizerContext: event.requestContext.authorizer
          });
          return ResponseBuilder.unauthorized('User not authenticated');
        }

        this.logger.info(`[${requestId}] ${route} - Authenticated user: ${userId}`);

        // Validate request if needed
        const validationError = await this.validateRequest(event);
        if (validationError) {
          this.logger.warn(`[${requestId}] ${route} - Validation failed`, validationError);
          return ResponseBuilder.badRequest(validationError.message, validationError);
        }

        // Execute the actual handler
        const startTime = Date.now();
        const result = await handler(event, userId);
        const duration = Date.now() - startTime;

        this.logger.info(`[${requestId}] ${route} - Request completed`, {
          statusCode: result.statusCode,
          duration: `${duration}ms`
        });

        return result;

      } catch (error) {
        this.logger.error(`[${requestId}] ${route} - Request failed`, error);
        return this.handleError(error);
      }
    };
  }

  /**
   * Entry point for public handlers (no auth required)
   * Still handles common concerns: CORS, logging, error handling
   */
  public withoutAuth(handler: PublicHandler): PublicHandler {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const requestId = event.requestContext.requestId;
      const route = `${event.httpMethod} ${event.resource}`;
      
      try {
        this.logger.info(`[${requestId}] ${route} - Public request started`);

        // Handle CORS preflight
        if (event.httpMethod === 'OPTIONS') {
          return ResponseBuilder.cors();
        }

        // Execute the handler
        const startTime = Date.now();
        const result = await handler(event);
        const duration = Date.now() - startTime;

        this.logger.info(`[${requestId}] ${route} - Public request completed`, {
          statusCode: result.statusCode,
          duration: `${duration}ms`
        });

        return result;

      } catch (error) {
        this.logger.error(`[${requestId}] ${route} - Public request failed`, error);
        return this.handleError(error);
      }
    };
  }

  /**
   * Extract userId from API Gateway authorizer context
   * Handles both TOKEN and REQUEST authorizer formats
   */
  private extractUserId(event: APIGatewayProxyEvent): string | null {
    const authorizer = event.requestContext.authorizer;
    
    if (!authorizer) {
      return null;
    }

    // Try different possible locations for userId
    return (
      authorizer.userId ||
      authorizer.principalId ||
      authorizer.claims?.userId ||
      authorizer.claims?.sub ||
      null
    );
  }

  /**
   * Validate request - override in specific handlers
   */
  protected async validateRequest(event: APIGatewayProxyEvent): Promise<ApiError | null> {
    return null; // No validation by default
  }

  /**
   * Centralized error handling
   */
  private handleError(error: any): APIGatewayProxyResult {
    if (error instanceof ApiError) {
      return ResponseBuilder.error(error.message, error.code, error.details);
    }

    if (error.name === 'ValidationError') {
      return ResponseBuilder.badRequest(error.message);
    }

    if (error.name === 'UnauthorizedError') {
      return ResponseBuilder.unauthorized(error.message);
    }

    if (error.name === 'ForbiddenError') {
      return ResponseBuilder.forbidden(error.message);
    }

    if (error.name === 'NotFoundError') {
      return ResponseBuilder.notFound(error.message);
    }

    // Default to internal server error
    return ResponseBuilder.internalError('An unexpected error occurred');
  }

  /**
   * Helper: Parse JSON body safely
   */
  protected parseJsonBody<T>(event: APIGatewayProxyEvent): T | null {
    if (!event.body) {
      return null;
    }

    try {
      // Handle base64 encoded body
      let bodyString = event.body;
      if (event.isBase64Encoded) {
        bodyString = Buffer.from(event.body, 'base64').toString('utf-8');
      }
      
      this.logger.debug('Parsing request body', { 
        isBase64Encoded: event.isBase64Encoded, 
        bodyLength: bodyString.length 
      });
      
      return JSON.parse(bodyString) as T;
    } catch (error: any) {
      this.logger.error('JSON parsing failed', { 
        body: event.body, 
        isBase64Encoded: event.isBase64Encoded, 
        error: error.message 
      });
      throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Invalid JSON in request body');
    }
  }

  /**
   * Helper: Get query parameter with default
   */
  protected getQueryParam(event: APIGatewayProxyEvent, key: string, defaultValue?: string): string | undefined {
    return event.queryStringParameters?.[key] || defaultValue;
  }

  /**
   * Helper: Get path parameter
   */
  protected getPathParam(event: APIGatewayProxyEvent, key: string): string | undefined {
    return event.pathParameters?.[key];
  }

  /**
   * Helper: Get header value
   */
  protected getHeader(event: APIGatewayProxyEvent, key: string): string | undefined {
    return event.headers[key] || event.headers[key.toLowerCase()];
  }

  /**
   * Helper: Create success response with data
   */
  protected success<T>(data: T, message?: string): APIGatewayProxyResult {
    return ResponseBuilder.success(data, 200, message);
  }

  /**
   * Helper: Create created response
   */
  protected created<T>(data: T, message?: string): APIGatewayProxyResult {
    return ResponseBuilder.success(data, 201, message);
  }

  /**
   * Helper: Create no content response
   */
  protected noContent(): APIGatewayProxyResult {
    return ResponseBuilder.success(null, 204);
  }

  /**
   * Helper: Create bad request response
   */
  protected badRequest(message: string, details?: any): APIGatewayProxyResult {
    return ResponseBuilder.badRequest(message, details);
  }

  /**
   * Helper: Create not found response
   */
  protected notFound(message: string): APIGatewayProxyResult {
    return ResponseBuilder.notFound(message);
  }

  /**
   * Helper: Create internal error response
   */
  protected internalError(message: string): APIGatewayProxyResult {
    return ResponseBuilder.internalError(message);
  }
}