// API response builder utility

import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse, ApiSuccessResponse, ApiErrorResponse, ErrorDetails } from './types/api.types';
import { HTTP_STATUS_CODES, COMMON_HEADERS } from './constants/api.constants';
import { ERROR_CODES, ERROR_MESSAGES, ErrorCode } from './constants/error.constants';

export class ResponseBuilder {
  /**
   * Create a successful API response
   */
  public static success<T>(
    data: T,
    statusCode: number = HTTP_STATUS_CODES.OK,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    };

    return {
      statusCode,
      headers: COMMON_HEADERS,
      body: JSON.stringify(response),
    };
  }

  /**
   * Create a created response (201)
   */
  public static created<T>(data: T, message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.success(data, HTTP_STATUS_CODES.CREATED, message, requestId);
  }

  /**
   * Create a no content response (204)
   */
  public static noContent(requestId?: string): APIGatewayProxyResult {
    return {
      statusCode: HTTP_STATUS_CODES.NO_CONTENT,
      headers: COMMON_HEADERS,
      body: '',
    };
  }

  /**
   * Create an error response
   */
  public static error(
    errorCode: ErrorCode | string,
    message?: string,
    statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    details?: ErrorDetails,
    requestId?: string
  ): APIGatewayProxyResult {
    const errorMessage = message || ERROR_MESSAGES[errorCode as ErrorCode] || 'An error occurred';
    
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    return {
      statusCode,
      headers: COMMON_HEADERS,
      body: JSON.stringify(response),
    };
  }

  /**
   * Create a bad request response (400)
   */
  public static badRequest(message?: string, details?: any, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      ERROR_CODES.VALIDATION_ERROR,
      message || 'Bad request',
      HTTP_STATUS_CODES.BAD_REQUEST,
      details,
      requestId
    );
  }

  /**
   * Create an unauthorized response (401)
   */
  public static unauthorized(message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      ERROR_CODES.UNAUTHORIZED,
      message || 'Authentication required',
      HTTP_STATUS_CODES.UNAUTHORIZED,
      undefined,
      requestId
    );
  }

  /**
   * Create a forbidden response (403)
   */
  public static forbidden(message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      ERROR_CODES.FORBIDDEN,
      message || 'Access forbidden',
      HTTP_STATUS_CODES.FORBIDDEN,
      undefined,
      requestId
    );
  }

  /**
   * Create a not found response (404)
   */
  public static notFound(resource?: string, requestId?: string): APIGatewayProxyResult {
    const message = resource ? `${resource} not found` : 'Resource not found';
    return ResponseBuilder.error(
      ERROR_CODES.NOT_FOUND,
      message,
      HTTP_STATUS_CODES.NOT_FOUND,
      undefined,
      requestId
    );
  }

  /**
   * Create a conflict response (409)
   */
  public static conflict(message?: string, details?: any, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      ERROR_CODES.CONFLICT,
      message || 'Resource conflict',
      HTTP_STATUS_CODES.CONFLICT,
      details,
      requestId
    );
  }

  /**
   * Create an internal server error response (500)
   */
  public static internalError(error?: any, requestId?: string): APIGatewayProxyResult {
    const details = error ? {
      name: error.name,
      message: error.message,
      // Only include stack trace in non-production environments
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    } : undefined;

    return ResponseBuilder.error(
      ERROR_CODES.INTERNAL_ERROR,
      'Internal server error',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      details,
      requestId
    );
  }

  /**
   * Create a CORS preflight response (OPTIONS)
   */
  public static corsResponse(): APIGatewayProxyResult {
    return {
      statusCode: HTTP_STATUS_CODES.OK,
      headers: {
        ...COMMON_HEADERS,
        'Access-Control-Max-Age': '86400', // 24 hours
      },
      body: '',
    };
  }

  /**
   * Create a response from an ApiResponse object
   */
  public static fromApiResponse(apiResponse: ApiResponse, requestId?: string): APIGatewayProxyResult {
    if (apiResponse.success) {
      return ResponseBuilder.success(apiResponse.data, HTTP_STATUS_CODES.OK, apiResponse.message, requestId);
    } else {
      // Map error codes to appropriate HTTP status codes
      const statusCode = ResponseBuilder.getHttpStatusFromErrorCode(apiResponse.error.code);
      
      return ResponseBuilder.error(
        apiResponse.error.code,
        apiResponse.error.message,
        statusCode,
        apiResponse.error.details,
        requestId
      );
    }
  }

  /**
   * Map error codes to HTTP status codes
   */
  private static getHttpStatusFromErrorCode(errorCode: string): number {
    switch (errorCode) {
      case ERROR_CODES.VALIDATION_ERROR:
        return HTTP_STATUS_CODES.BAD_REQUEST;
      
      case ERROR_CODES.UNAUTHORIZED:
      case ERROR_CODES.TOKEN_EXPIRED:
      case ERROR_CODES.TOKEN_INVALID:
        return HTTP_STATUS_CODES.UNAUTHORIZED;
      
      case ERROR_CODES.FORBIDDEN:
      case ERROR_CODES.ACCOUNT_DISABLED:
        return HTTP_STATUS_CODES.FORBIDDEN;
      
      case ERROR_CODES.NOT_FOUND:
      case ERROR_CODES.PROVIDER_NOT_FOUND:
      case ERROR_CODES.EXAM_NOT_FOUND:
      case ERROR_CODES.TOPIC_NOT_FOUND:
      case ERROR_CODES.QUESTION_NOT_FOUND:
      case ERROR_CODES.USER_NOT_FOUND:
      case ERROR_CODES.GOAL_NOT_FOUND:
      case ERROR_CODES.SESSION_NOT_FOUND:
        return HTTP_STATUS_CODES.NOT_FOUND;
      
      case ERROR_CODES.CONFLICT:
      case ERROR_CODES.GOAL_ALREADY_EXISTS:
      case ERROR_CODES.SESSION_ALREADY_COMPLETED:
        return HTTP_STATUS_CODES.CONFLICT;
      
      case ERROR_CODES.RATE_LIMITED:
        return 429; // Too Many Requests
      
      case ERROR_CODES.INTERNAL_ERROR:
      default:
        return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    }
  }
}