/**
 * HTTP response utility functions
 * 
 * Single Responsibility: Response formatting and HTTP status utilities
 */

import { formatJSON } from '../common/format-utils';

/**
 * Common HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Common CORS headers
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH',
  'Access-Control-Allow-Headers': 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control',
  'Access-Control-Max-Age': '86400',
} as const;

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode = HTTP_STATUS.OK,
  message?: string,
  headers: Record<string, string> = {}
): any {
  const response = {
    success: true,
    data,
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  };
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...headers,
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  errorCode?: string,
  details?: any,
  headers: Record<string, string> = {}
): any {
  const response = {
    success: false,
    error: {
      message,
      ...(errorCode && { code: errorCode }),
      ...(details && { details }),
    },
    timestamp: new Date().toISOString(),
  };
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...headers,
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  items: T[],
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore?: boolean;
    nextCursor?: string;
  },
  message?: string
): any {
  const response = {
    success: true,
    data: items,
    pagination: {
      total: pagination.total,
      limit: pagination.limit,
      offset: pagination.offset,
      count: items.length,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasMore: pagination.hasMore ?? pagination.offset + items.length < pagination.total,
      ...(pagination.nextCursor && { nextCursor: pagination.nextCursor }),
    },
    ...(message && { message }),
    timestamp: new Date().toISOString(),
  };
  
  return {
    statusCode: HTTP_STATUS.OK,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create CORS preflight response
 */
export function createOptionsResponse(
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: string[] = ['Content-Type', 'Authorization']
): any {
  return {
    statusCode: HTTP_STATUS.OK,
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': allowedMethods.join(','),
      'Access-Control-Allow-Headers': allowedHeaders.join(','),
    },
    body: '',
  };
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(
  errors: string[] | Record<string, string[]>
): any {
  const errorDetails = Array.isArray(errors) 
    ? { general: errors }
    : errors;
  
  return createErrorResponse(
    'Validation failed',
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    'VALIDATION_ERROR',
    { validationErrors: errorDetails }
  );
}

/**
 * Create not found response
 */
export function createNotFoundResponse(resource = 'Resource'): any {
  return createErrorResponse(
    `${resource} not found`,
    HTTP_STATUS.NOT_FOUND,
    'NOT_FOUND'
  );
}

/**
 * Create unauthorized response
 */
export function createUnauthorizedResponse(message = 'Authentication required'): any {
  return createErrorResponse(
    message,
    HTTP_STATUS.UNAUTHORIZED,
    'UNAUTHORIZED'
  );
}

/**
 * Create forbidden response
 */
export function createForbiddenResponse(message = 'Access forbidden'): any {
  return createErrorResponse(
    message,
    HTTP_STATUS.FORBIDDEN,
    'FORBIDDEN'
  );
}

/**
 * Create conflict response
 */
export function createConflictResponse(message: string, details?: any): any {
  return createErrorResponse(
    message,
    HTTP_STATUS.CONFLICT,
    'CONFLICT',
    details
  );
}

/**
 * Create rate limit response
 */
export function createRateLimitResponse(
  retryAfter?: number,
  message = 'Rate limit exceeded'
): any {
  const headers: Record<string, string> = {};
  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }
  
  return createErrorResponse(
    message,
    HTTP_STATUS.TOO_MANY_REQUESTS,
    'RATE_LIMITED',
    retryAfter ? { retryAfter } : undefined,
    headers
  );
}

/**
 * Create redirect response
 */
export function createRedirectResponse(
  location: string,
  permanent = false
): any {
  return {
    statusCode: permanent ? 301 : 302,
    headers: {
      Location: location,
      ...CORS_HEADERS,
    },
    body: '',
  };
}

/**
 * Create cached response
 */
export function createCachedResponse<T>(
  data: T,
  cacheControlValue = 'public, max-age=300', // 5 minutes default
  etag?: string
): any {
  const headers: Record<string, string> = {
    'Cache-Control': cacheControlValue,
  };
  
  if (etag) {
    headers['ETag'] = etag;
  }
  
  return createSuccessResponse(data, HTTP_STATUS.OK, undefined, headers);
}

/**
 * Create not modified response (304)
 */
export function createNotModifiedResponse(): any {
  return {
    statusCode: 304,
    headers: CORS_HEADERS,
    body: '',
  };
}

/**
 * Create file download response
 */
export function createFileDownloadResponse(
  content: string | Buffer,
  filename: string,
  contentType = 'application/octet-stream'
): any {
  const isBuffer = Buffer.isBuffer(content);
  
  return {
    statusCode: HTTP_STATUS.OK,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
      ...CORS_HEADERS,
    },
    body: isBuffer ? content.toString('base64') : content,
    isBase64Encoded: isBuffer,
  };
}

/**
 * Create streaming response headers
 */
export function createStreamingHeaders(contentType = 'text/plain'): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Transfer-Encoding': 'chunked',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    ...CORS_HEADERS,
  };
}

/**
 * Add security headers
 */
export function addSecurityHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'",
  };
}

/**
 * Get status text for HTTP status code
 */
export function getStatusText(statusCode: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
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
  
  return statusTexts[statusCode] || 'Unknown Status';
}

/**
 * Check if status code indicates success
 */
export function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

/**
 * Check if status code indicates client error
 */
export function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500;
}

/**
 * Check if status code indicates server error
 */
export function isServerError(statusCode: number): boolean {
  return statusCode >= 500 && statusCode < 600;
}

/**
 * Create health check response
 */
export function createHealthResponse(
  status: 'healthy' | 'unhealthy' | 'degraded',
  checks: Record<string, { status: string; responseTime?: number; error?: string }>
): any {
  const statusCode = status === 'healthy' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
  
  const response = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.APP_VERSION || '1.0.0',
  };
  
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(response),
  };
}