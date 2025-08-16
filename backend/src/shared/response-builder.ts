// API response builder utility

import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiResponse, ApiSuccessResponse, ApiErrorResponse, ErrorDetails, PaginationInfo } from './types/api.types';
import { HTTP_STATUS_CODES, COMMON_HEADERS } from './constants/api.constants';
import { ERROR_CODES, ERROR_MESSAGES, ErrorCode } from './constants/error.constants';

import { ConfigurationManager } from '@/shared/service-factory';

export class ResponseBuilder {
  /**
   * Create a successful API response
   * Delegates to HttpResponseFormatter
   */
  public static success<T>(
    data: T,
    statusCode: number = HTTP_STATUS_CODES.OK,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createSuccessResponse(data, statusCode, message, requestId);
  }

  /**
   * Create a created response (201)
   * Delegates to ResponseStatusManager and HttpResponseFormatter
   */
  public static created<T>(data: T, message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createSuccessResponse(
      data, 
      ResponseStatusManager.getCreatedStatusCode(), 
      message, 
      requestId
    );
  }

  /**
   * Create an accepted response (202)
   * Delegates to ResponseStatusManager and HttpResponseFormatter
   */
  public static accepted<T>(data: T, message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createSuccessResponse(
      data, 
      ResponseStatusManager.getAcceptedStatusCode(), 
      message, 
      requestId
    );
  }

  /**
   * Create a no content response (204)
   * Delegates to HttpResponseFormatter
   */
  public static noContent(requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createNoContentResponse();
  }

  /**
   * Create a partial content response (206)
   * Delegates to ResponseStatusManager and HttpResponseFormatter
   */
  public static partialContent<T>(
    data: T,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createSuccessResponse(
      data, 
      ResponseStatusManager.getPartialContentStatusCode(), 
      message, 
      requestId
    );
  }

  /**
   * Create an error response
   * Delegates to HttpResponseFormatter
   */
  public static error(
    errorCode: ErrorCode | string,
    message?: string,
    statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    details?: ErrorDetails,
    requestId?: string
  ): APIGatewayProxyResult {
    const errorMessage = message || ERROR_MESSAGES[errorCode as ErrorCode] || 'An error occurred';
    return HttpResponseFormatter.createErrorResponse(errorCode, errorMessage, statusCode, details, requestId);
  }

  /**
   * Create a bad request response (400)
   * Delegates to HttpResponseFormatter
   */
  public static badRequest(
    message?: string,
    details?: any,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      message || 'Bad request',
      HTTP_STATUS_CODES.BAD_REQUEST,
      details,
      requestId
    );
  }

  /**
   * Create an unauthorized response (401)
   * Delegates to HttpResponseFormatter
   */
  public static unauthorized(message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      message || 'Authentication required',
      HTTP_STATUS_CODES.UNAUTHORIZED,
      undefined,
      requestId
    );
  }

  /**
   * Create a forbidden response (403)
   * Delegates to HttpResponseFormatter
   */
  public static forbidden(message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      ERROR_CODES.FORBIDDEN,
      message || 'Access forbidden',
      HTTP_STATUS_CODES.FORBIDDEN,
      undefined,
      requestId
    );
  }

  /**
   * Create a not found response (404)
   * Delegates to HttpResponseFormatter
   */
  public static notFound(resource?: string, requestId?: string): APIGatewayProxyResult {
    const message = resource ? `${resource} not found` : 'Resource not found';
    return HttpResponseFormatter.createErrorResponse(
      ERROR_CODES.NOT_FOUND,
      message,
      HTTP_STATUS_CODES.NOT_FOUND,
      undefined,
      requestId
    );
  }

  /**
   * Create a method not allowed response (405)
   * Delegates to HttpResponseFormatter
   */
  public static methodNotAllowed(
    allowedMethods: string[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createMethodNotAllowedResponse(
      allowedMethods,
      message || 'Method not allowed',
      requestId
    );
  }

  /**
   * Create a not acceptable response (406)
   * Delegates to HttpResponseFormatter
   */
  public static notAcceptable(
    acceptableTypes: string[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'NOT_ACCEPTABLE',
      message || 'Not acceptable',
      406,
      { acceptableTypes },
      requestId
    );
  }

  /**
   * Create a conflict response (409)
   * Delegates to HttpResponseFormatter
   */
  public static conflict(
    message?: string,
    details?: any,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      ERROR_CODES.CONFLICT,
      message || 'Resource conflict',
      HTTP_STATUS_CODES.CONFLICT,
      details,
      requestId
    );
  }

  /**
   * Create a gone response (410)
   * Delegates to HttpResponseFormatter
   */
  public static gone(message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'RESOURCE_GONE',
      message || 'Resource no longer available',
      410,
      undefined,
      requestId
    );
  }

  /**
   * Create a precondition failed response (412)
   * Delegates to HttpResponseFormatter
   */
  public static preconditionFailed(
    message?: string,
    details?: any,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'PRECONDITION_FAILED',
      message || 'Precondition failed',
      412,
      details,
      requestId
    );
  }

  /**
   * Create a payload too large response (413)
   * Delegates to HttpResponseFormatter
   */
  public static payloadTooLarge(
    maxSize?: number,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'PAYLOAD_TOO_LARGE',
      message || 'Request payload too large',
      413,
      maxSize ? { maxSize } : undefined,
      requestId
    );
  }

  /**
   * Create an unsupported media type response (415)
   * Delegates to HttpResponseFormatter
   */
  public static unsupportedMediaType(
    supportedTypes: string[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'UNSUPPORTED_MEDIA_TYPE',
      message || 'Unsupported media type',
      415,
      { supportedTypes },
      requestId
    );
  }

  /**
   * Create an unprocessable entity response (422)
   * Delegates to HttpResponseFormatter
   */
  public static unprocessableEntity(
    validationErrors: any[],
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      message || 'Validation failed',
      422,
      { validationErrors },
      requestId
    );
  }

  /**
   * Create a rate limited response (429)
   * Delegates to HttpResponseFormatter
   */
  public static rateLimited(
    retryAfter?: number,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createRateLimitedResponse(
      ERROR_CODES.RATE_LIMITED,
      message || 'Rate limit exceeded',
      retryAfter,
      requestId
    );
  }

  /**
   * Create an internal server error response (500)
   * Delegates to HttpResponseFormatter
   */
  public static internalError(error?: any, requestId?: string): APIGatewayProxyResult {
    const details = error
      ? {
          name: error.name,
          message: error.message,
          // Only include stack trace in non-production environments
          ...(ConfigurationManager.getInstance().shouldIncludeDebugInfo() && { stack: error.stack }),
        }
      : undefined;

    return HttpResponseFormatter.createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Internal server error',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      details,
      requestId
    );
  }

  /**
   * Create a not implemented response (501)
   * Delegates to HttpResponseFormatter
   */
  public static notImplemented(message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'NOT_IMPLEMENTED',
      message || 'Feature not implemented',
      501,
      undefined,
      requestId
    );
  }

  /**
   * Create a bad gateway response (502)
   * Delegates to HttpResponseFormatter
   */
  public static badGateway(message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'BAD_GATEWAY',
      message || 'Bad gateway',
      502,
      undefined,
      requestId
    );
  }

  /**
   * Create a service unavailable response (503)
   * Delegates to HttpResponseFormatter
   */
  public static serviceUnavailable(
    retryAfter?: number,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createServiceUnavailableResponse(
      'SERVICE_UNAVAILABLE',
      message || 'Service temporarily unavailable',
      retryAfter,
      requestId
    );
  }

  /**
   * Create a gateway timeout response (504)
   * Delegates to HttpResponseFormatter
   */
  public static gatewayTimeout(message?: string, requestId?: string): APIGatewayProxyResult {
    return HttpResponseFormatter.createErrorResponse(
      'GATEWAY_TIMEOUT',
      message || 'Gateway timeout',
      504,
      undefined,
      requestId
    );
  }

  /**
   * Create a CORS preflight response (OPTIONS)
   * Delegates to HttpResponseFormatter
   */
  public static corsResponse(): APIGatewayProxyResult {
    return HttpResponseFormatter.createCorsResponse();
  }

  /**
   * Create a response with custom headers
   * Delegates to ResponseMetadataBuilder
   */
  public static withHeaders<T>(
    data: T,
    statusCode: number,
    headers: Record<string, string>,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseMetadataBuilder.createResponseWithHeaders(data, statusCode, headers, message, requestId);
  }

  /**
   * Create a paginated response with Link headers
   * Delegates to ResponseMetadataBuilder
   */
  public static paginated<T>(
    data: T[],
    pagination: PaginationInfo,
    baseUrl: string,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return ResponseMetadataBuilder.buildPaginatedResponse(data, pagination, baseUrl, message, requestId);
  }

  /**
   * Create a response from an ApiResponse object
   * Delegates to ErrorResponseMapper and HttpResponseFormatter
   */
  public static fromApiResponse(
    apiResponse: ApiResponse,
    requestId?: string
  ): APIGatewayProxyResult {
    if (apiResponse.success) {
      return HttpResponseFormatter.createSuccessResponse(
        apiResponse.data,
        HTTP_STATUS_CODES.OK,
        apiResponse.message,
        requestId
      );
    } else {
      // Map error codes to appropriate HTTP status codes
      const statusCode = ErrorResponseMapper.getHttpStatusFromErrorCode(apiResponse.error.code);

      return HttpResponseFormatter.createErrorResponse(
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
   * Delegates to ErrorResponseMapper
   */
  private static getHttpStatusFromErrorCode(errorCode: string): number {
    return ErrorResponseMapper.getHttpStatusFromErrorCode(errorCode);
  }

  /**
   * Build error response with standardized format
   * Delegates to ErrorResponseMapper
   */
  public static buildStandardErrorResponse(
    error: Error,
    statusCode?: number,
    requestId?: string
  ): APIGatewayProxyResult {
    return ErrorResponseMapper.buildStandardErrorResponse(error, statusCode, requestId);
  }

  /**
   * Infer HTTP status code from error
   * Delegates to ErrorResponseMapper
   */
  private static inferStatusCodeFromError(error: Error): number {
    return ErrorResponseMapper.inferStatusCodeFromError(error);
  }

  /**
   * Extract error code from error
   * Delegates to ErrorResponseMapper
   */
  private static extractErrorCode(error: Error): string {
    return ErrorResponseMapper.extractErrorCode(error);
  }
}

// ===================================
// HELPER CLASSES FOR RESPONSE BUILDER OPTIMIZATION
// ===================================

/**
 * HttpResponseFormatter - HTTP-specific response construction and formatting
 * Handles CORS, headers, status codes, and HTTP protocol specifics
 */
export class HttpResponseFormatter {
  /**
   * Create basic HTTP response structure
   */
  static createHttpResponse(
    statusCode: number,
    body: string,
    headers: Record<string, string> = {}
  ): APIGatewayProxyResult {
    return {
      statusCode,
      headers: {
        ...COMMON_HEADERS,
        ...headers,
      },
      body,
    };
  }

  /**
   * Create success HTTP response with data
   */
  static createSuccessResponse<T>(
    data: T,
    statusCode: number = HTTP_STATUS_CODES.OK,
    message?: string,
    requestId?: string,
    headers: Record<string, string> = {}
  ): APIGatewayProxyResult {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    };

    return HttpResponseFormatter.createHttpResponse(
      statusCode,
      JSON.stringify(response),
      headers
    );
  }

  /**
   * Create error HTTP response
   */
  static createErrorResponse(
    errorCode: ErrorCode | string,
    message: string,
    statusCode: number,
    details?: ErrorDetails,
    requestId?: string,
    headers: Record<string, string> = {}
  ): APIGatewayProxyResult {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    return HttpResponseFormatter.createHttpResponse(
      statusCode,
      JSON.stringify(response),
      headers
    );
  }

  /**
   * Create CORS preflight response
   */
  static createCorsResponse(): APIGatewayProxyResult {
    return HttpResponseFormatter.createHttpResponse(
      HTTP_STATUS_CODES.OK,
      '',
      {
        'Access-Control-Max-Age': '86400', // 24 hours
      }
    );
  }

  /**
   * Create no content response (204)
   */
  static createNoContentResponse(): APIGatewayProxyResult {
    return HttpResponseFormatter.createHttpResponse(
      HTTP_STATUS_CODES.NO_CONTENT,
      ''
    );
  }

  /**
   * Create response with rate limiting headers
   */
  static createRateLimitedResponse(
    errorCode: string,
    message: string,
    retryAfter?: number,
    requestId?: string
  ): APIGatewayProxyResult {
    const headers = retryAfter ? { 'Retry-After': retryAfter.toString() } : {};
    
    return HttpResponseFormatter.createErrorResponse(
      errorCode,
      message,
      429,
      retryAfter ? { retryAfter } : undefined,
      requestId,
      headers
    );
  }

  /**
   * Create response with service unavailable headers
   */
  static createServiceUnavailableResponse(
    errorCode: string,
    message: string,
    retryAfter?: number,
    requestId?: string
  ): APIGatewayProxyResult {
    const headers = retryAfter ? { 'Retry-After': retryAfter.toString() } : {};
    
    return HttpResponseFormatter.createErrorResponse(
      errorCode,
      message,
      503,
      retryAfter ? { retryAfter } : undefined,
      requestId,
      headers
    );
  }

  /**
   * Create method not allowed response with Allow header
   */
  static createMethodNotAllowedResponse(
    allowedMethods: string[],
    message: string,
    requestId?: string
  ): APIGatewayProxyResult {
    const headers = {
      Allow: allowedMethods.join(', '),
    };

    return HttpResponseFormatter.createErrorResponse(
      'METHOD_NOT_ALLOWED',
      message,
      405,
      { allowedMethods },
      requestId,
      headers
    );
  }
}

/**
 * ErrorResponseMapper - Error code mapping and status code inference
 * Handles error classification, status code determination, and error standardization
 */
export class ErrorResponseMapper {
  /**
   * Map error codes to HTTP status codes with comprehensive coverage
   */
  static getHttpStatusFromErrorCode(errorCode: string): number {
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
   * Infer HTTP status code from error
   */
  static inferStatusCodeFromError(error: Error): number {
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
  static extractErrorCode(error: Error): string {
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

  /**
   * Build standardized error response from Error object
   */
  static buildStandardErrorResponse(
    error: Error,
    statusCode?: number,
    requestId?: string
  ): APIGatewayProxyResult {
    const finalStatusCode = statusCode || ErrorResponseMapper.inferStatusCodeFromError(error);
    const errorCode = ErrorResponseMapper.extractErrorCode(error);

    const details = {
      name: error.name,
      ...(ConfigurationManager.getInstance().shouldIncludeDebugInfo() && { stack: error.stack }),
    };

    return HttpResponseFormatter.createErrorResponse(
      errorCode,
      error.message,
      finalStatusCode,
      details,
      requestId
    );
  }
}

/**
 * ResponseMetadataBuilder - Pagination, custom headers, and link building
 * Handles complex response metadata construction and standardization
 */
export class ResponseMetadataBuilder {
  /**
   * Build paginated response with Link headers
   */
  static buildPaginatedResponse<T>(
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
        pagination: ResponseMetadataBuilder.buildPaginationMetadata(pagination),
        count: data.length,
      },
    };

    const linkHeaders = ResponseMetadataBuilder.buildLinkHeaders(pagination, baseUrl);
    const headers = linkHeaders.length > 0 ? { Link: linkHeaders.join(', ') } : {};

    return HttpResponseFormatter.createHttpResponse(
      HTTP_STATUS_CODES.OK,
      JSON.stringify(response),
      headers
    );
  }

  /**
   * Build pagination metadata
   */
  static buildPaginationMetadata(pagination: PaginationInfo) {
    return {
      currentPage: pagination.currentPage || 1,
      pageSize: pagination.pageSize || 10,
      totalItems: pagination.totalItems || 0,
      totalPages: pagination.totalPages || 0,
      hasNextPage: pagination.hasNextPage || false,
      hasPreviousPage: pagination.hasPreviousPage || false,
    };
  }

  /**
   * Build Link headers for pagination
   */
  static buildLinkHeaders(pagination: PaginationInfo, baseUrl: string): string[] {
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

    return links;
  }

  /**
   * Create response with custom headers
   */
  static createResponseWithHeaders<T>(
    data: T,
    statusCode: number,
    headers: Record<string, string>,
    message?: string,
    requestId?: string
  ): APIGatewayProxyResult {
    return HttpResponseFormatter.createSuccessResponse(
      data,
      statusCode,
      message,
      requestId,
      headers
    );
  }
}

/**
 * ResponseStatusManager - Status code determination and HTTP standards compliance
 * Handles status code logic and HTTP protocol compliance
 */
export class ResponseStatusManager {
  /**
   * Get appropriate status code for created resources
   */
  static getCreatedStatusCode(): number {
    return HTTP_STATUS_CODES.CREATED;
  }

  /**
   * Get appropriate status code for accepted requests
   */
  static getAcceptedStatusCode(): number {
    return HTTP_STATUS_CODES.ACCEPTED;
  }

  /**
   * Get appropriate status code for partial content
   */
  static getPartialContentStatusCode(): number {
    return 206;
  }

  /**
   * Get appropriate status code for no content
   */
  static getNoContentStatusCode(): number {
    return HTTP_STATUS_CODES.NO_CONTENT;
  }

  /**
   * Determine if status code represents success
   */
  static isSuccessStatusCode(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 300;
  }

  /**
   * Determine if status code represents client error
   */
  static isClientErrorStatusCode(statusCode: number): boolean {
    return statusCode >= 400 && statusCode < 500;
  }

  /**
   * Determine if status code represents server error
   */
  static isServerErrorStatusCode(statusCode: number): boolean {
    return statusCode >= 500 && statusCode < 600;
  }

  /**
   * Get default message for status code
   */
  static getDefaultMessageForStatusCode(statusCode: number): string {
    const messageMap: Record<number, string> = {
      200: 'Success',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      206: 'Partial Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return messageMap[statusCode] || 'Unknown Status';
  }
}
