// API response builder utility

import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse, ApiSuccessResponse, ApiErrorResponse, ErrorDetails, PaginationInfo } from './types/api.types';
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
   * Create an accepted response (202)
   */
  public static accepted<T>(data: T, message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.success(data, HTTP_STATUS_CODES.ACCEPTED, message, requestId);
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
   * Create a partial content response (206)
   */
  public static partialContent<T>(
    data: T,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseBuilder.success(data, 206, message, requestId);
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
  public static badRequest(
    message?: string,
    details?: any,
    requestId?: string
  ): APIGatewayProxyResult {
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
   * Create a method not allowed response (405)
   */
  public static methodNotAllowed(
    allowedMethods: string[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    const headers = {
      ...COMMON_HEADERS,
      Allow: allowedMethods.join(', '),
    };

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: message || 'Method not allowed',
        details: { allowedMethods },
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify(response),
    };
  }

  /**
   * Create a not acceptable response (406)
   */
  public static notAcceptable(
    acceptableTypes: string[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'NOT_ACCEPTABLE',
      message || 'Not acceptable',
      406,
      { acceptableTypes },
      requestId
    );
  }

  /**
   * Create a conflict response (409)
   */
  public static conflict(
    message?: string,
    details?: any,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseBuilder.error(
      ERROR_CODES.CONFLICT,
      message || 'Resource conflict',
      HTTP_STATUS_CODES.CONFLICT,
      details,
      requestId
    );
  }

  /**
   * Create a gone response (410)
   */
  public static gone(message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'RESOURCE_GONE',
      message || 'Resource no longer available',
      410,
      undefined,
      requestId
    );
  }

  /**
   * Create a precondition failed response (412)
   */
  public static preconditionFailed(
    message?: string,
    details?: any,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'PRECONDITION_FAILED',
      message || 'Precondition failed',
      412,
      details,
      requestId
    );
  }

  /**
   * Create a payload too large response (413)
   */
  public static payloadTooLarge(
    maxSize?: number,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'PAYLOAD_TOO_LARGE',
      message || 'Request payload too large',
      413,
      maxSize ? { maxSize } : undefined,
      requestId
    );
  }

  /**
   * Create an unsupported media type response (415)
   */
  public static unsupportedMediaType(
    supportedTypes: string[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'UNSUPPORTED_MEDIA_TYPE',
      message || 'Unsupported media type',
      415,
      { supportedTypes },
      requestId
    );
  }

  /**
   * Create an unprocessable entity response (422)
   */
  public static unprocessableEntity(
    validationErrors: any[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseBuilder.error(
      ERROR_CODES.VALIDATION_ERROR,
      message || 'Validation failed',
      422,
      { validationErrors },
      requestId
    );
  }

  /**
   * Create a rate limited response (429)
   */
  public static rateLimited(
    retryAfter?: number,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    const headers = {
      ...COMMON_HEADERS,
      ...(retryAfter && { 'Retry-After': retryAfter.toString() }),
    };

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: message || 'Rate limit exceeded',
        details: retryAfter ? { retryAfter } : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    return {
      statusCode: 429,
      headers,
      body: JSON.stringify(response),
    };
  }

  /**
   * Create an internal server error response (500)
   */
  public static internalError(error?: any, requestId?: string): APIGatewayProxyResult {
    const details = error
      ? {
          name: error.name,
          message: error.message,
          // Only include stack trace in non-production environments
          ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
        }
      : undefined;

    return ResponseBuilder.error(
      ERROR_CODES.INTERNAL_ERROR,
      'Internal server error',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      details,
      requestId
    );
  }

  /**
   * Create a not implemented response (501)
   */
  public static notImplemented(message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'NOT_IMPLEMENTED',
      message || 'Feature not implemented',
      501,
      undefined,
      requestId
    );
  }

  /**
   * Create a bad gateway response (502)
   */
  public static badGateway(message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'BAD_GATEWAY',
      message || 'Bad gateway',
      502,
      undefined,
      requestId
    );
  }

  /**
   * Create a service unavailable response (503)
   */
  public static serviceUnavailable(
    retryAfter?: number,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    const headers = {
      ...COMMON_HEADERS,
      ...(retryAfter && { 'Retry-After': retryAfter.toString() }),
    };

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: message || 'Service temporarily unavailable',
        details: retryAfter ? { retryAfter } : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    return {
      statusCode: 503,
      headers,
      body: JSON.stringify(response),
    };
  }

  /**
   * Create a gateway timeout response (504)
   */
  public static gatewayTimeout(message?: string, requestId?: string): APIGatewayProxyResult {
    return ResponseBuilder.error(
      'GATEWAY_TIMEOUT',
      message || 'Gateway timeout',
      504,
      undefined,
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
   * Create a response with custom headers
   */
  public static withHeaders<T>(
    data: T,
    statusCode: number,
    headers: Record<string, string>,
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
      headers: {
        ...COMMON_HEADERS,
        ...headers,
      },
      body: JSON.stringify(response),
    };
  }

  /**
   * Create a paginated response with Link headers
   */
  public static paginated<T>(
    data: T[],
    pagination: PaginationInfo,
    baseUrl: string,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    const response: ApiSuccessResponse<T[]> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId,
      metadata: {
        pagination: {
          currentPage: pagination.currentPage || 1,
          pageSize: pagination.pageSize || 10,
          totalItems: pagination.totalItems || 0,
          totalPages: pagination.totalPages || 0,
          hasNextPage: pagination.hasNextPage || false,
          hasPreviousPage: pagination.hasPreviousPage || false,
        },
        count: data.length,
      },
    };

    // Build Link header for pagination
    const links: string[] = [];
    const currentPage = pagination.currentPage || 1;
    const pageSize = pagination.pageSize || 10;

    if (pagination.hasNextPage) {
      links.push(`<${baseUrl}?page=${currentPage + 1}&limit=${pageSize}>; rel="next"`);
    }
    if (pagination.hasPreviousPage) {
      links.push(`<${baseUrl}?page=${currentPage - 1}&limit=${pageSize}>; rel="prev"`);
    }
    if (currentPage > 1) {
      links.push(`<${baseUrl}?page=1&limit=${pageSize}>; rel="first"`);
    }
    if (pagination.totalPages && currentPage < pagination.totalPages) {
      links.push(`<${baseUrl}?page=${pagination.totalPages}&limit=${pageSize}>; rel="last"`);
    }

    const headers = {
      ...COMMON_HEADERS,
      ...(links.length > 0 && { Link: links.join(', ') }),
    };

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      headers,
      body: JSON.stringify(response),
    };
  }

  /**
   * Create a response from an ApiResponse object
   */
  public static fromApiResponse(
    apiResponse: ApiResponse,
    requestId?: string
  ): APIGatewayProxyResult {
    if (apiResponse.success) {
      return ResponseBuilder.success(
        apiResponse.data,
        HTTP_STATUS_CODES.OK,
        apiResponse.message,
        requestId
      );
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
   * Map error codes to HTTP status codes with comprehensive coverage
   */
  private static getHttpStatusFromErrorCode(errorCode: string): number {
    // Map common error patterns to HTTP status codes
    const statusCodeMap: Record<string, number> = {
      // 400 Bad Request
      [ERROR_CODES.VALIDATION_ERROR]: HTTP_STATUS_CODES.BAD_REQUEST,
      INVALID_REQUEST: HTTP_STATUS_CODES.BAD_REQUEST,
      INVALID_PARAMETER: HTTP_STATUS_CODES.BAD_REQUEST,
      INVALID_FORMAT: HTTP_STATUS_CODES.BAD_REQUEST,
      MISSING_PARAMETER: HTTP_STATUS_CODES.BAD_REQUEST,
      INVALID_JSON: HTTP_STATUS_CODES.BAD_REQUEST,

      // 401 Unauthorized
      [ERROR_CODES.UNAUTHORIZED]: HTTP_STATUS_CODES.UNAUTHORIZED,
      [ERROR_CODES.TOKEN_EXPIRED]: HTTP_STATUS_CODES.UNAUTHORIZED,
      [ERROR_CODES.TOKEN_INVALID]: HTTP_STATUS_CODES.UNAUTHORIZED,
      AUTHENTICATION_REQUIRED: HTTP_STATUS_CODES.UNAUTHORIZED,
      INVALID_CREDENTIALS: HTTP_STATUS_CODES.UNAUTHORIZED,

      // 403 Forbidden
      [ERROR_CODES.FORBIDDEN]: HTTP_STATUS_CODES.FORBIDDEN,
      [ERROR_CODES.ACCOUNT_DISABLED]: HTTP_STATUS_CODES.FORBIDDEN,
      INSUFFICIENT_PERMISSIONS: HTTP_STATUS_CODES.FORBIDDEN,
      ACCESS_DENIED: HTTP_STATUS_CODES.FORBIDDEN,

      // 404 Not Found
      [ERROR_CODES.NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      [ERROR_CODES.PROVIDER_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      [ERROR_CODES.EXAM_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      [ERROR_CODES.TOPIC_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      [ERROR_CODES.QUESTION_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      [ERROR_CODES.USER_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      [ERROR_CODES.GOAL_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      [ERROR_CODES.SESSION_NOT_FOUND]: HTTP_STATUS_CODES.NOT_FOUND,
      RESOURCE_NOT_FOUND: HTTP_STATUS_CODES.NOT_FOUND,

      // 405 Method Not Allowed
      METHOD_NOT_ALLOWED: 405,

      // 406 Not Acceptable
      NOT_ACCEPTABLE: 406,

      // 409 Conflict
      [ERROR_CODES.CONFLICT]: HTTP_STATUS_CODES.CONFLICT,
      [ERROR_CODES.GOAL_ALREADY_EXISTS]: HTTP_STATUS_CODES.CONFLICT,
      [ERROR_CODES.SESSION_ALREADY_COMPLETED]: HTTP_STATUS_CODES.CONFLICT,
      RESOURCE_CONFLICT: HTTP_STATUS_CODES.CONFLICT,
      DUPLICATE_RESOURCE: HTTP_STATUS_CODES.CONFLICT,

      // 410 Gone
      RESOURCE_GONE: 410,

      // 412 Precondition Failed
      PRECONDITION_FAILED: 412,
      ETAG_MISMATCH: 412,

      // 413 Payload Too Large
      PAYLOAD_TOO_LARGE: 413,
      REQUEST_TOO_LARGE: 413,

      // 415 Unsupported Media Type
      UNSUPPORTED_MEDIA_TYPE: 415,

      // 422 Unprocessable Entity
      UNPROCESSABLE_ENTITY: 422,
      VALIDATION_FAILED: 422,

      // 429 Too Many Requests
      [ERROR_CODES.RATE_LIMITED]: 429,
      RATE_LIMIT_EXCEEDED: 429,

      // 500 Internal Server Error
      [ERROR_CODES.INTERNAL_ERROR]: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      DATABASE_ERROR: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      SERVICE_ERROR: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,

      // 501 Not Implemented
      NOT_IMPLEMENTED: 501,
      FEATURE_NOT_IMPLEMENTED: 501,

      // 502 Bad Gateway
      BAD_GATEWAY: 502,
      UPSTREAM_ERROR: 502,

      // 503 Service Unavailable
      SERVICE_UNAVAILABLE: 503,
      MAINTENANCE_MODE: 503,

      // 504 Gateway Timeout
      GATEWAY_TIMEOUT: 504,
      UPSTREAM_TIMEOUT: 504,
    };

    return statusCodeMap[errorCode] || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  }

  /**
   * Build error response with standardized format
   */
  public static buildStandardErrorResponse(
    error: Error,
    statusCode?: number,
    requestId?: string
  ): APIGatewayProxyResult {
    // Determine status code based on error type/message if not provided
    const finalStatusCode = statusCode || ResponseBuilder.inferStatusCodeFromError(error);
    
    // Extract error code from error type or message
    const errorCode = ResponseBuilder.extractErrorCode(error);

    return ResponseBuilder.error(
      errorCode,
      error.message,
      finalStatusCode,
      {
        name: error.name,
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
      },
      requestId
    );
  }

  /**
   * Infer HTTP status code from error
   */
  private static inferStatusCodeFromError(error: Error): number {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Check error name patterns
    if (errorName.includes('validation')) return 400;
    if (errorName.includes('authentication') || errorName.includes('unauthorized')) return 401;
    if (errorName.includes('forbidden') || errorName.includes('access')) return 403;
    if (errorName.includes('notfound') || errorName.includes('missing')) return 404;
    if (errorName.includes('conflict') || errorName.includes('duplicate')) return 409;
    if (errorName.includes('timeout')) return 504;

    // Check error message patterns
    if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) return 404;
    if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token')) return 401;
    if (errorMessage.includes('forbidden') || errorMessage.includes('access denied')) return 403;
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) return 400;
    if (errorMessage.includes('conflict') || errorMessage.includes('already exists')) return 409;
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) return 504;
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) return 429;

    return HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  }

  /**
   * Extract error code from error
   */
  private static extractErrorCode(error: Error): string {
    // Check if error has a code property
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }

    // Generate code from error name
    const errorName = error.name.toUpperCase().replace(/ERROR$/i, '');
    if (errorName && errorName !== 'ERROR') {
      return errorName;
    }

    // Default based on error type
    return 'INTERNAL_ERROR';
  }
}
