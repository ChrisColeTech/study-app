import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse, ErrorCode } from '../types';

/**
 * Enhanced Response Builder - V2
 * Provides consistent API responses with proper CORS headers
 */
export class ResponseBuilder {
  private static readonly VERSION = '2.0.0';

  private static readonly CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Configure specific origins in production
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Auth-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,HEAD',
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  /**
   * Create successful response
   */
  public static success<T>(
    data: T, 
    statusCode: number = 200,
    message?: string
  ): APIGatewayProxyResult {
    const response: ApiResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      version: this.VERSION
    };

    return {
      statusCode,
      headers: this.CORS_HEADERS,
      body: JSON.stringify(response)
    };
  }

  /**
   * Create error response
   */
  public static error(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details?: any,
    statusCode: number = 500
  ): APIGatewayProxyResult {
    const response: ApiResponse = {
      success: false,
      error: message,
      message: `[${code}] ${message}`,
      timestamp: new Date().toISOString(),
      version: this.VERSION,
      ...(details && { data: details })
    };

    return {
      statusCode,
      headers: this.CORS_HEADERS,
      body: JSON.stringify(response)
    };
  }

  /**
   * Bad Request (400)
   */
  public static badRequest(message: string, details?: any): APIGatewayProxyResult {
    return this.error(message, ErrorCode.VALIDATION_ERROR, details, 400);
  }

  /**
   * Unauthorized (401)
   */
  public static unauthorized(message: string = 'Unauthorized'): APIGatewayProxyResult {
    return this.error(message, ErrorCode.UNAUTHORIZED, undefined, 401);
  }

  /**
   * Forbidden (403)
   */
  public static forbidden(message: string = 'Forbidden'): APIGatewayProxyResult {
    return this.error(message, ErrorCode.FORBIDDEN, undefined, 403);
  }

  /**
   * Not Found (404)
   */
  public static notFound(message: string = 'Resource not found'): APIGatewayProxyResult {
    return this.error(message, ErrorCode.NOT_FOUND, undefined, 404);
  }

  /**
   * Rate Limited (429)
   */
  public static rateLimited(message: string = 'Rate limit exceeded'): APIGatewayProxyResult {
    return this.error(message, ErrorCode.RATE_LIMITED, undefined, 429);
  }

  /**
   * Internal Server Error (500)
   */
  public static internalError(message: string = 'Internal server error'): APIGatewayProxyResult {
    return this.error(message, ErrorCode.INTERNAL_ERROR, undefined, 500);
  }

  /**
   * CORS preflight response
   */
  public static cors(): APIGatewayProxyResult {
    return {
      statusCode: 200,
      headers: {
        ...this.CORS_HEADERS,
        'Access-Control-Max-Age': '86400' // Cache preflight for 24 hours
      },
      body: ''
    };
  }

  /**
   * Health check response
   */
  public static health(data: any): APIGatewayProxyResult {
    return this.success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: this.VERSION,
      environment: process.env.STAGE || 'unknown',
      ...data
    });
  }

  /**
   * Paginated response
   */
  public static paginated<T>(
    items: T[],
    totalCount: number,
    page: number,
    pageSize: number,
    message?: string
  ): APIGatewayProxyResult {
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return this.success({
      items,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize,
        hasNextPage,
        hasPrevPage
      }
    }, 200, message);
  }
}