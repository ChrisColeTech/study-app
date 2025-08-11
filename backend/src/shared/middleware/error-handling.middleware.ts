// Error handling middleware for eliminating repetitive error handling patterns
// Centralizes error response formatting and logging

import { ApiResponse, HandlerContext } from '../types/api.types';
import { ERROR_CODES } from '../constants/error.constants';
import { createLogger } from '../logger';

const logger = createLogger({ component: 'ErrorHandlingMiddleware' });

export interface ErrorContext {
  requestId: string;
  userId?: string;
  operation: string;
  additionalInfo?: Record<string, any>;
}

export interface ErrorMapping {
  keywords: string[];
  errorCode: string;
  statusCode: number;
  message?: string; // Custom message, otherwise uses original
}

export class ErrorHandlingMiddleware {
  // Common error mappings that handlers can extend
  private static readonly DEFAULT_ERROR_MAPPINGS: ErrorMapping[] = [
    {
      keywords: ['not found', 'NoSuchKey', 'does not exist'],
      errorCode: ERROR_CODES.NOT_FOUND,
      statusCode: 404
    },
    {
      keywords: ['already exists', 'duplicate', 'conflict'],
      errorCode: ERROR_CODES.CONFLICT,
      statusCode: 409
    },
    {
      keywords: ['unauthorized', 'access denied', 'permission denied'],
      errorCode: ERROR_CODES.UNAUTHORIZED,
      statusCode: 401
    },
    {
      keywords: ['forbidden', 'insufficient privileges'],
      errorCode: ERROR_CODES.FORBIDDEN,
      statusCode: 403
    },
    {
      keywords: ['validation', 'invalid', 'required', 'must be'],
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400
    },
    {
      keywords: ['expired', 'timeout'],
      errorCode: ERROR_CODES.TOKEN_EXPIRED,
      statusCode: 408
    },
    {
      keywords: ['rate limit', 'too many requests'],
      errorCode: ERROR_CODES.RATE_LIMITED,
      statusCode: 429
    }
  ];

  /**
   * Handle and format errors with consistent logging and response structure
   */
  static handleError(
    error: Error | any,
    context: ErrorContext,
    customMappings: ErrorMapping[] = []
  ): ApiResponse {
    const errorMessage = error?.message || 'Unknown error occurred';
    const allMappings = [...customMappings, ...this.DEFAULT_ERROR_MAPPINGS];
    
    // Find matching error mapping
    const errorMapping = allMappings.find(mapping =>
      mapping.keywords.some(keyword =>
        errorMessage.toLowerCase().includes(keyword.toLowerCase())
      )
    );

    let statusCode = 500;
    let errorCode = ERROR_CODES.INTERNAL_ERROR as string;
    let responseMessage = errorMessage;

    if (errorMapping) {
      statusCode = errorMapping.statusCode;
      errorCode = errorMapping.errorCode;
      if (errorMapping.message) {
        responseMessage = errorMapping.message;
      }
    }

    // Log error with context
    const logContext = {
      requestId: context.requestId,
      operation: context.operation,
      errorCode,
      statusCode,
      originalError: errorMessage,
      ...(context.userId && { userId: context.userId }),
      ...(context.additionalInfo && { additionalInfo: context.additionalInfo })
    };

    if (statusCode >= 500) {
      logger.error(`${context.operation} failed`, error, logContext);
    } else if (statusCode >= 400) {
      logger.warn(`${context.operation} client error`, logContext);
    }

    return this.createErrorResponse(errorCode, responseMessage);
  }

  /**
   * Handle async operation with automatic error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customMappings: ErrorMapping[] = []
  ): Promise<{ result?: T; error?: ApiResponse }> {
    try {
      const result = await operation();
      return { result };
    } catch (error) {
      const errorResponse = this.handleError(error, context, customMappings);
      return { error: errorResponse };
    }
  }

  /**
   * Create standardized success response
   */
  static createSuccessResponse<T>(
    data: T,
    message: string = 'Operation completed successfully'
  ): ApiResponse {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create standardized error response
   */
  static createErrorResponse(
    code: string,
    message: string,
    details?: any
  ): ApiResponse {
    const errorResponse: any = {
      success: false,
      message,
      error: {
        code,
        message
      },
      timestamp: new Date().toISOString()
    };

    if (details) {
      errorResponse.error.details = details;
    }

    return errorResponse;
  }

  /**
   * Validate required fields and return error if missing
   */
  static validateRequiredFields(
    fields: Record<string, any>,
    requiredFields: string[]
  ): ApiResponse | null {
    const missingFields = requiredFields.filter(field => 
      !fields[field] || 
      (typeof fields[field] === 'string' && fields[field].trim() === '')
    );

    if (missingFields.length > 0) {
      const message = missingFields.length === 1 
        ? `${missingFields[0]} is required`
        : `Missing required fields: ${missingFields.join(', ')}`;
        
      return this.createErrorResponse(ERROR_CODES.VALIDATION_ERROR, message);
    }

    return null;
  }

  /**
   * Handle authentication errors specifically
   */
  static handleAuthError(
    error: Error | any,
    context: ErrorContext
  ): ApiResponse {
    const errorMessage = error?.message || 'Authentication failed';
    
    // Check for specific auth error types
    if (errorMessage.includes('expired')) {
      return this.createErrorResponse(
        ERROR_CODES.TOKEN_EXPIRED,
        'Token expired'
      );
    }
    
    if (errorMessage.includes('Invalid token') || errorMessage.includes('malformed')) {
      return this.createErrorResponse(
        ERROR_CODES.TOKEN_INVALID,
        'Invalid token'
      );
    }
    
    if (errorMessage.includes('Missing') || errorMessage.includes('required')) {
      return this.createErrorResponse(
        ERROR_CODES.UNAUTHORIZED,
        'Authentication required'
      );
    }

    // Log auth error
    logger.warn('Authentication error', {
      requestId: context.requestId,
      operation: context.operation,
      error: errorMessage,
      ...(context.additionalInfo && { additionalInfo: context.additionalInfo })
    });

    return this.createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      'Authentication failed'
    );
  }

  /**
   * Handle validation errors with field-specific details
   */
  static handleValidationError(
    error: Error | any,
    context: ErrorContext,
    fieldErrors?: Record<string, string>
  ): ApiResponse {
    const message = error?.message || 'Validation failed';
    
    logger.warn('Validation error', {
      requestId: context.requestId,
      operation: context.operation,
      error: message,
      fieldErrors,
      ...(context.additionalInfo && { additionalInfo: context.additionalInfo })
    });

    return this.createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      fieldErrors
    );
  }

  /**
   * Handle service-specific errors (for business logic)
   */
  static handleServiceError(
    error: Error | any,
    context: ErrorContext,
    serviceName: string
  ): ApiResponse {
    const errorMessage = error?.message || `${serviceName} operation failed`;
    
    // Service-specific error mappings
    const serviceMappings: ErrorMapping[] = [
      {
        keywords: ['Question count must be', 'Time limit must be'],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        statusCode: 400
      },
      {
        keywords: ['Invalid provider', 'Invalid exam', 'Invalid topic'],
        errorCode: ERROR_CODES.NOT_FOUND,
        statusCode: 404
      },
      {
        keywords: ['No questions found', 'Session not found'],
        errorCode: ERROR_CODES.NOT_FOUND,
        statusCode: 404
      },
      {
        keywords: ['Cannot update completed', 'Cannot pause', 'Invalid transition'],
        errorCode: ERROR_CODES.CONFLICT,
        statusCode: 409
      }
    ];

    return this.handleError(error, context, serviceMappings);
  }

  /**
   * Handle database/repository errors
   */
  static handleRepositoryError(
    error: Error | any,
    context: ErrorContext,
    repositoryName: string
  ): ApiResponse {
    const errorMessage = error?.message || `${repositoryName} operation failed`;
    
    // Repository-specific error mappings
    const repositoryMappings: ErrorMapping[] = [
      {
        keywords: ['ConditionalCheckFailedException', 'already exists'],
        errorCode: ERROR_CODES.CONFLICT,
        statusCode: 409
      },
      {
        keywords: ['ResourceNotFoundException', 'not found'],
        errorCode: ERROR_CODES.NOT_FOUND,
        statusCode: 404
      },
      {
        keywords: ['ValidationException', 'invalid format'],
        errorCode: ERROR_CODES.VALIDATION_ERROR,
        statusCode: 400
      },
      {
        keywords: ['ProvisionedThroughputExceededException', 'rate limit'],
        errorCode: ERROR_CODES.RATE_LIMITED,
        statusCode: 429
      },
      {
        keywords: ['ServiceUnavailableException', 'InternalServerError'],
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        statusCode: 503
      }
    ];

    return this.handleError(error, context, repositoryMappings);
  }
}

// Common error contexts that can be reused
export const ErrorContexts = {
  Auth: {
    LOGIN: 'user-login',
    REGISTER: 'user-register',
    REFRESH: 'token-refresh',
    LOGOUT: 'user-logout',
    VALIDATE: 'token-validate'
  },
  
  Session: {
    CREATE: 'session-create',
    GET: 'session-get',
    UPDATE: 'session-update',
    DELETE: 'session-delete'
  },
  
  Question: {
    LIST: 'question-list',
    GET: 'question-get',
    SEARCH: 'question-search'
  },
  
  Provider: {
    LIST: 'provider-list',
    GET: 'provider-get',
    REFRESH_CACHE: 'provider-cache-refresh'
  },
  
  Exam: {
    LIST: 'exam-list',
    GET: 'exam-get'
  },
  
  Topic: {
    LIST: 'topic-list',
    GET: 'topic-get'
  }
};