// Validation Error Formatter - Simplified version for ValidationMiddleware decomposition
// Focused responsibility: Creating standardized validation error responses
// Part of Objective 30 ValidationMiddleware decomposition

import { ApiErrorResponse } from '../types/api.types';
import { ERROR_CODES } from '../constants/error.constants';

/**
 * Simplified ValidationErrorFormatter for creating validation error responses
 * Compatible with existing ApiResponse interface
 */
export class ValidationErrorFormatter {
  
  /**
   * Create standardized error response for validation failures
   */
  static createStandardErrorResponse(
    message: string,
    errorCode: string = ERROR_CODES.VALIDATION_ERROR
  ): ApiErrorResponse {
    return {
      success: false,
      error: {
        code: errorCode,
        message,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create field-specific error response
   */
  static createFieldErrorResponse(
    field: string,
    error: string,
    requestType: 'query' | 'body' | 'params' = 'body'
  ): ApiErrorResponse {
    const location = requestType === 'params' ? 'path parameters' : 
                    requestType === 'query' ? 'query parameters' : 'request body';
    
    const message = `Invalid ${field} in ${location}: ${error}`;
    
    return {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message,
        details: {
          field,
          location: requestType,
          fieldError: error,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create multiple field errors response
   */
  static createMultipleFieldErrorsResponse(
    errors: Array<{ field: string; error: string; location?: string }>
  ): ApiErrorResponse {
    const errorCount = errors.length;
    const message = `Validation failed for ${errorCount} field${errorCount > 1 ? 's' : ''}`;
    
    return {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message,
        details: {
          count: errorCount,
          fieldErrors: errors.map(err => ({
            field: err.field,
            message: err.error,
            location: err.location || 'body',
          })),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create missing required fields error
   */
  static createMissingRequiredFieldsResponse(
    missingFields: string[],
    requestType: 'query' | 'body' | 'params' = 'body'
  ): ApiErrorResponse {
    const location = requestType === 'params' ? 'path parameters' : 
                    requestType === 'query' ? 'query parameters' : 'request body';
    
    const fieldList = missingFields.join(', ');
    const message = `Missing required fields in ${location}: ${fieldList}`;
    
    return {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message,
        details: {
          missingFields,
          location: requestType,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}