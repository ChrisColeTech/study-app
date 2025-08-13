/**
 * HTTP error handling utility functions
 * 
 * Single Responsibility: Error classification, mapping, and response formatting
 */

import { HTTP_STATUS, createErrorResponse } from './response-utils';

/**
 * Error classification types
 */
export type ErrorCategory = 
  | 'validation'
  | 'authentication' 
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'server_error'
  | 'external_service'
  | 'timeout';

/**
 * Structured error information
 */
export interface HttpError {
  message: string;
  statusCode: number;
  errorCode: string;
  category: ErrorCategory;
  details?: any;
  retryable: boolean;
  timestamp: string;
}

/**
 * Map error to HTTP status code
 */
export function mapErrorToStatusCode(error: Error): number {
  const errorName = error.name.toLowerCase();
  const errorMessage = error.message.toLowerCase();
  
  // Authentication errors
  if (errorName.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('token')) {
    return HTTP_STATUS.UNAUTHORIZED;
  }
  
  // Authorization/permission errors
  if (errorName.includes('permission') || errorName.includes('forbidden') || errorMessage.includes('access denied')) {
    return HTTP_STATUS.FORBIDDEN;
  }
  
  // Validation errors
  if (errorName.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('required')) {
    return HTTP_STATUS.UNPROCESSABLE_ENTITY;
  }
  
  // Not found errors
  if (errorName.includes('notfound') || errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    return HTTP_STATUS.NOT_FOUND;
  }
  
  // Conflict errors
  if (errorName.includes('conflict') || errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
    return HTTP_STATUS.CONFLICT;
  }
  
  // Rate limiting errors
  if (errorName.includes('rate') || errorName.includes('throttl') || errorMessage.includes('too many')) {
    return HTTP_STATUS.TOO_MANY_REQUESTS;
  }
  
  // Timeout errors
  if (errorName.includes('timeout') || errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return HTTP_STATUS.GATEWAY_TIMEOUT;
  }
  
  // External service errors
  if (errorName.includes('service') || errorMessage.includes('service unavailable')) {
    return HTTP_STATUS.BAD_GATEWAY;
  }
  
  // Default to internal server error
  return HTTP_STATUS.INTERNAL_SERVER_ERROR;
}

/**
 * Classify error by category
 */
export function classifyError(error: Error): ErrorCategory {
  const statusCode = mapErrorToStatusCode(error);
  
  switch (statusCode) {
    case HTTP_STATUS.UNAUTHORIZED:
      return 'authentication';
    case HTTP_STATUS.FORBIDDEN:
      return 'authorization';
    case HTTP_STATUS.NOT_FOUND:
      return 'not_found';
    case HTTP_STATUS.CONFLICT:
      return 'conflict';
    case HTTP_STATUS.UNPROCESSABLE_ENTITY:
      return 'validation';
    case HTTP_STATUS.TOO_MANY_REQUESTS:
      return 'rate_limit';
    case HTTP_STATUS.GATEWAY_TIMEOUT:
      return 'timeout';
    case HTTP_STATUS.BAD_GATEWAY:
      return 'external_service';
    default:
      return 'server_error';
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error | HttpError): boolean {
  if ('retryable' in error) {
    return error.retryable;
  }
  
  const statusCode = mapErrorToStatusCode(error);
  
  // Retryable status codes
  const retryableStatusCodes: number[] = [
    HTTP_STATUS.TOO_MANY_REQUESTS,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    HTTP_STATUS.BAD_GATEWAY,
    HTTP_STATUS.SERVICE_UNAVAILABLE,
    HTTP_STATUS.GATEWAY_TIMEOUT,
  ];
  
  return retryableStatusCodes.includes(statusCode);
}

/**
 * Create structured HTTP error
 */
export function createHttpError(
  message: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
  errorCode?: string,
  details?: any
): HttpError {
  const error = new Error(message) as any;
  error.name = errorCode || 'HttpError';
  
  return {
    message,
    statusCode,
    errorCode: errorCode || 'UNKNOWN_ERROR',
    category: classifyError(error),
    retryable: isRetryableError(error),
    timestamp: new Date().toISOString(),
    ...(details && { details }),
  };
}

/**
 * Convert error to HTTP response
 */
export function errorToHttpResponse(
  error: Error | HttpError,
  includeStackTrace = false
): any {
  let httpError: HttpError;
  
  if ('statusCode' in error) {
    httpError = error as HttpError;
  } else {
    const statusCode = mapErrorToStatusCode(error);
    httpError = createHttpError(
      error.message,
      statusCode,
      error.name,
      includeStackTrace ? { stack: error.stack } : undefined
    );
  }
  
  return createErrorResponse(
    httpError.message,
    httpError.statusCode,
    httpError.errorCode,
    httpError.details
  );
}

/**
 * Format validation errors
 */
export function formatValidationErrors(
  errors: string[] | Record<string, string[]>
): HttpError {
  const errorDetails = Array.isArray(errors)
    ? { general: errors }
    : errors;
  
  const errorCount = Array.isArray(errors) 
    ? errors.length
    : Object.values(errors).flat().length;
  
  return createHttpError(
    `Validation failed with ${errorCount} error(s)`,
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    'VALIDATION_ERROR',
    { validationErrors: errorDetails }
  );
}

/**
 * Create timeout error
 */
export function createTimeoutError(operation: string, timeoutMs: number): HttpError {
  return createHttpError(
    `Operation '${operation}' timed out after ${timeoutMs}ms`,
    HTTP_STATUS.GATEWAY_TIMEOUT,
    'TIMEOUT_ERROR',
    { operation, timeoutMs }
  );
}

/**
 * Create rate limit error
 */
export function createRateLimitError(
  limit: number,
  windowMs: number,
  retryAfterMs?: number
): HttpError {
  const retryAfterSeconds = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined;
  
  return createHttpError(
    `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
    HTTP_STATUS.TOO_MANY_REQUESTS,
    'RATE_LIMITED',
    {
      limit,
      windowMs,
      ...(retryAfterSeconds && { retryAfterSeconds }),
    }
  );
}

/**
 * Create external service error
 */
export function createExternalServiceError(
  serviceName: string,
  originalError?: Error
): HttpError {
  return createHttpError(
    `External service '${serviceName}' is unavailable`,
    HTTP_STATUS.BAD_GATEWAY,
    'EXTERNAL_SERVICE_ERROR',
    {
      serviceName,
      ...(originalError && {
        originalError: {
          name: originalError.name,
          message: originalError.message,
        }
      }),
    }
  );
}

/**
 * Extract error context from AWS errors
 */
export function extractAwsErrorContext(error: any): {
  service?: string;
  operation?: string;
  errorCode?: string;
  requestId?: string;
  region?: string;
} {
  return {
    service: error.$service,
    operation: error.$operation,
    errorCode: error.Code || error.code,
    requestId: error.RequestId || error.requestId || error.$metadata?.requestId,
    region: error.$metadata?.region,
  };
}

/**
 * Check if error is AWS service error
 */
export function isAwsServiceError(error: any): boolean {
  return !!(error.$service || error.Code || error.$metadata);
}

/**
 * Map AWS error to HTTP error
 */
export function mapAwsErrorToHttp(error: any): HttpError {
  const context = extractAwsErrorContext(error);
  const errorCode = context.errorCode || error.name;
  
  // Common AWS error mappings
  const awsErrorMappings: Record<string, { statusCode: number; category: ErrorCategory }> = {
    // DynamoDB errors
    'ResourceNotFoundException': { statusCode: HTTP_STATUS.NOT_FOUND, category: 'not_found' },
    'ConditionalCheckFailedException': { statusCode: HTTP_STATUS.CONFLICT, category: 'conflict' },
    'ValidationException': { statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY, category: 'validation' },
    'ProvisionedThroughputExceededException': { statusCode: HTTP_STATUS.TOO_MANY_REQUESTS, category: 'rate_limit' },
    
    // S3 errors
    'NoSuchKey': { statusCode: HTTP_STATUS.NOT_FOUND, category: 'not_found' },
    'NoSuchBucket': { statusCode: HTTP_STATUS.NOT_FOUND, category: 'not_found' },
    'AccessDenied': { statusCode: HTTP_STATUS.FORBIDDEN, category: 'authorization' },
    
    // Common AWS errors
    'ThrottlingException': { statusCode: HTTP_STATUS.TOO_MANY_REQUESTS, category: 'rate_limit' },
    'ServiceUnavailable': { statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE, category: 'external_service' },
    'TimeoutError': { statusCode: HTTP_STATUS.GATEWAY_TIMEOUT, category: 'timeout' },
  };
  
  const mapping = awsErrorMappings[errorCode];
  const statusCode = mapping?.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const category = mapping?.category || 'server_error';
  
  return {
    message: error.message || `AWS ${context.service} error`,
    statusCode,
    errorCode,
    category,
    retryable: isRetryableError(error),
    timestamp: new Date().toISOString(),
    details: {
      awsContext: context,
      ...(error.$fault && { fault: error.$fault }),
    },
  };
}

/**
 * Create comprehensive error summary
 */
export function createErrorSummary(errors: Error[]): {
  totalErrors: number;
  categories: Record<ErrorCategory, number>;
  retryableCount: number;
  mostCommonError: string;
  errorCodes: string[];
} {
  const categories: Record<ErrorCategory, number> = {
    validation: 0,
    authentication: 0,
    authorization: 0,
    not_found: 0,
    conflict: 0,
    rate_limit: 0,
    server_error: 0,
    external_service: 0,
    timeout: 0,
  };
  
  const errorCodeCounts: Record<string, number> = {};
  let retryableCount = 0;
  
  for (const error of errors) {
    const category = classifyError(error);
    categories[category]++;
    
    const errorCode = error.name || 'UNKNOWN_ERROR';
    errorCodeCounts[errorCode] = (errorCodeCounts[errorCode] || 0) + 1;
    
    if (isRetryableError(error)) {
      retryableCount++;
    }
  }
  
  const mostCommonError = Object.entries(errorCodeCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'UNKNOWN_ERROR';
  
  return {
    totalErrors: errors.length,
    categories,
    retryableCount,
    mostCommonError,
    errorCodes: Object.keys(errorCodeCounts),
  };
}