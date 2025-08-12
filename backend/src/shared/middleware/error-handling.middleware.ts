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
  // Optimized error mappings for common patterns
  private static readonly DEFAULT_ERROR_MAPPINGS: ErrorMapping[] = [
    {
      keywords: ['not found', 'NoSuchKey', 'does not exist', 'ResourceNotFoundException'],
      errorCode: ERROR_CODES.NOT_FOUND,
      statusCode: 404
    },
    {
      keywords: ['already exists', 'duplicate', 'conflict', 'ConditionalCheckFailedException'],
      errorCode: ERROR_CODES.CONFLICT,
      statusCode: 409
    },
    {
      keywords: ['unauthorized', 'access denied', 'permission denied', 'Invalid token', 'malformed'],
      errorCode: ERROR_CODES.UNAUTHORIZED,
      statusCode: 401
    },
    {
      keywords: ['forbidden', 'insufficient privileges'],
      errorCode: ERROR_CODES.FORBIDDEN,
      statusCode: 403
    },
    {
      keywords: ['validation', 'invalid', 'required', 'must be', 'ValidationException'],
      errorCode: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400
    },
    {
      keywords: ['expired', 'timeout'],
      errorCode: ERROR_CODES.TOKEN_EXPIRED,
      statusCode: 408
    },
    {
      keywords: ['rate limit', 'too many requests', 'ProvisionedThroughputExceededException'],
      errorCode: ERROR_CODES.RATE_LIMITED,
      statusCode: 429
    },
    {
      keywords: ['ServiceUnavailableException', 'InternalServerError'],
      errorCode: ERROR_CODES.INTERNAL_ERROR,
      statusCode: 503
    }
  ];

  /**
   * Main error processing method - processes errors and returns standardized error info
   */
  static processError(
    error: Error | any,
    context: ErrorContext,
    customMappings: ErrorMapping[] = []
  ): { code: string; message: string; statusCode: number } {
    const errorMessage = error?.message || 'Unknown error occurred';
    const allMappings = [...customMappings, ...this.DEFAULT_ERROR_MAPPINGS];
    
    // Find matching error mapping efficiently
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

    // Optimized logging with appropriate levels
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

    return { code: errorCode, message: responseMessage, statusCode };
  }

  /**
   * Main async operation wrapper - handles errors and returns standardized results
   * This is the primary method that should be used by BaseHandler and services
   */
  static async withErrorProcessing<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customMappings: ErrorMapping[] = []
  ): Promise<{ result?: T; errorInfo?: { code: string; message: string; statusCode: number } }> {
    try {
      const result = await operation();
      return { result };
    } catch (error) {
      const errorInfo = this.processError(error, context, customMappings);
      return { errorInfo };
    }
  }

  /**
   * Validate required fields - returns error info or null
   */
  static validateRequiredFields(
    fields: Record<string, any>,
    requiredFields: string[]
  ): { code: string; message: string; statusCode: number } | null {
    const missingFields = requiredFields.filter(field => 
      !fields[field] || 
      (typeof fields[field] === 'string' && fields[field].trim() === '')
    );

    if (missingFields.length > 0) {
      const message = missingFields.length === 1 
        ? `${missingFields[0]} is required`
        : `Missing required fields: ${missingFields.join(', ')}`;
        
      return { 
        code: ERROR_CODES.VALIDATION_ERROR, 
        message, 
        statusCode: 400 
      };
    }

    return null;
  }

  /**
   * Handle authentication errors specifically
   */
  static handleAuthError(
    error: Error | any,
    context: ErrorContext
  ): { code: string; message: string; statusCode: number } {
    const errorMessage = error?.message || 'Authentication failed';
    
    // Optimized auth error detection
    if (errorMessage.includes('expired')) {
      return { code: ERROR_CODES.TOKEN_EXPIRED, message: 'Token expired', statusCode: 401 };
    }
    
    if (errorMessage.includes('Invalid token') || errorMessage.includes('malformed')) {
      return { code: ERROR_CODES.TOKEN_INVALID, message: 'Invalid token', statusCode: 401 };
    }
    
    if (errorMessage.includes('Missing') || errorMessage.includes('required')) {
      return { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required', statusCode: 401 };
    }

    // Log auth error efficiently
    logger.warn('Authentication error', {
      requestId: context.requestId,
      operation: context.operation,
      error: errorMessage,
      ...(context.additionalInfo && { additionalInfo: context.additionalInfo })
    });

    return { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication failed', statusCode: 401 };
  }

  /**
   * Handle validation errors with field-specific details
   */
  static handleValidationError(
    error: Error | any,
    context: ErrorContext,
    fieldErrors?: Record<string, string>
  ): { code: string; message: string; statusCode: number; details?: Record<string, string> } {
    const message = error?.message || 'Validation failed';
    
    logger.warn('Validation error', {
      requestId: context.requestId,
      operation: context.operation,
      error: message,
      fieldErrors,
      ...(context.additionalInfo && { additionalInfo: context.additionalInfo })
    });

    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message,
      statusCode: 400,
      ...(fieldErrors && { details: fieldErrors })
    };
  }

  /**
   * Create specialized error mappings for specific services
   * This method provides service-specific error handling without duplication
   */
  static createServiceMappings(serviceName: string): ErrorMapping[] {
    // Define service-specific patterns
    const servicePatterns: Record<string, ErrorMapping[]> = {
      session: [
        {
          keywords: ['Cannot update completed', 'Cannot delete completed', 'Cannot pause', 'Invalid transition'],
          errorCode: ERROR_CODES.CONFLICT,
          statusCode: 409
        },
        {
          keywords: ['Session not found', 'No questions found for session'],
          errorCode: ERROR_CODES.NOT_FOUND,
          statusCode: 404
        }
      ],
      question: [
        {
          keywords: ['Invalid provider', 'Invalid exam', 'Invalid topic'],
          errorCode: ERROR_CODES.NOT_FOUND,
          statusCode: 404
        },
        {
          keywords: ['Question count must be', 'Time limit must be'],
          errorCode: ERROR_CODES.VALIDATION_ERROR,
          statusCode: 400
        }
      ],
      analytics: [
        {
          keywords: ['Insufficient data', 'No analytics available'],
          errorCode: ERROR_CODES.NOT_FOUND,
          statusCode: 404
        }
      ]
    };

    return servicePatterns[serviceName.toLowerCase()] || [];
  }

  // ========================================
  // DEPRECATED METHODS - MAINTAINED FOR BACKWARD COMPATIBILITY
  // These will be removed in a future phase once all usages are migrated
  // ========================================

  /**
   * @deprecated Use withErrorProcessing() instead - this method will be removed
   * Maintained only for backward compatibility during migration
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customMappings: ErrorMapping[] = []
  ): Promise<{ result?: T; error?: ApiResponse }> {
    const { result, errorInfo } = await this.withErrorProcessing(operation, context, customMappings);
    
    if (errorInfo) {
      // Convert new format to legacy format for compatibility
      const errorResponse: ApiResponse = {
        success: false,
        message: errorInfo.message,
        error: {
          code: errorInfo.code,
          message: errorInfo.message
        },
        timestamp: new Date().toISOString()
      };
      return { error: errorResponse };
    }
    
    // Handle undefined result properly for strict TypeScript
    if (result === undefined) {
      return {};
    }
    
    return { result };
  }

  /**
   * @deprecated Use BaseHandler.buildSuccessResponse() instead
   * This method violates BaseHandler pattern and will be removed
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
   * @deprecated Use BaseHandler.buildErrorResponse() instead
   * This method violates BaseHandler pattern and will be removed
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
   * @deprecated Use processError() with createServiceMappings() instead
   * This specialized method will be removed in favor of the unified approach
   */
  static handleServiceError(
    error: Error | any,
    context: ErrorContext,
    serviceName: string
  ): { code: string; message: string; statusCode: number } {
    const serviceMappings = this.createServiceMappings(serviceName);
    return this.processError(error, context, serviceMappings);
  }

  /**
   * @deprecated Use processError() with default mappings instead
   * Repository-specific logic is now handled by the unified error processing
   */
  static handleRepositoryError(
    error: Error | any,
    context: ErrorContext,
    repositoryName: string
  ): { code: string; message: string; statusCode: number } {
    // Repository errors are handled by default mappings now
    return this.processError(error, context);
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
  },
  
  Goals: {
    CREATE: 'goal-create',
    LIST: 'goal-list',
    GET: 'goal-get',
    UPDATE: 'goal-update',
    DELETE: 'goal-delete',
    STATS: 'goal-stats'
  }
};