// ValidationParser - Focused validation and error handling for parsing operations
// Part of ParsingMiddleware decomposition (Objective 37)

import { ApiResponse } from '../types/api.types';
import { ERROR_CODES } from '../constants/error.constants';
import { createLogger } from '../logger';

const logger = createLogger({ component: 'ValidationParser' });

/**
 * ValidationParser - Handles validation logic and error creation for parsing operations
 * Extracted from ParsingMiddleware to achieve SRP compliance
 */
export class ValidationParser {
  /**
   * Create validation error response with standardized format
   */
  static createValidationError(message: string): ApiResponse {
    return {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create internal error response with optional context
   */
  static createInternalError(message: string, context?: Record<string, any>): ApiResponse {
    if (context) {
      logger.error('Internal parsing error', { message, context });
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate parameter schema structure and types
   */
  static validateParameterSchema(schema: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema || typeof schema !== 'object') {
      errors.push('Schema must be an object');
      return { isValid: false, errors };
    }

    for (const [key, config] of Object.entries(schema)) {
      if (typeof config !== 'object' || config === null) {
        errors.push(`Schema for "${key}" must be an object`);
        continue;
      }

      const typedConfig = config as any;
      if (
        typedConfig.type &&
        ![
          'string',
          'number',
          'boolean',
          'array',
          'date',
          'uuid',
          'email',
          'json',
          'float',
        ].includes(typedConfig.type)
      ) {
        errors.push(`Invalid type "${typedConfig.type}" for "${key}"`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate field-level parsing results and apply custom validation
   */
  static validateFieldValue(
    value: any,
    key: string,
    validateFunction?: (value: any) => { isValid: boolean; message?: string }
  ): { isValid: boolean; error?: ApiResponse | null } {
    if (!validateFunction) {
      return { isValid: true };
    }

    try {
      const validationResult = validateFunction(value);
      if (!validationResult.isValid) {
        return {
          isValid: false,
          error: this.createValidationError(`${key}: ${validationResult.message}`),
        };
      }
      return { isValid: true };
    } catch (error) {
      logger.warn('Validation function failed', { key, value, error });
      return {
        isValid: false,
        error: this.createValidationError(`${key}: Validation failed`),
      };
    }
  }

  /**
   * Validate required fields in nested parameter structures
   */
  static validateRequiredFields(
    parsed: Record<string, any>,
    schema: Record<string, { required?: boolean }>
  ): { isValid: boolean; error?: ApiResponse | null } {
    for (const [schemaKey, schemaValue] of Object.entries(schema)) {
      if (schemaValue.required) {
        const keyParts = schemaKey.split('.');
        if (keyParts.length === 2) {
          const [parent, child] = keyParts;
          if (!parsed[parent]?.[child]) {
            return {
              isValid: false,
              error: this.createValidationError(`Required parameter missing: ${schemaKey}`),
            };
          }
        } else if (!parsed[schemaKey]) {
          return {
            isValid: false,
            error: this.createValidationError(`Required parameter missing: ${schemaKey}`),
          };
        }
      }
    }
    return { isValid: true };
  }

  /**
   * Validate pagination parameters
   */
  static validatePaginationParams(
    limit: number,
    offset: number,
    maxLimit: number
  ): { isValid: boolean; error?: ApiResponse | null } {
    if (limit < 1 || limit > maxLimit) {
      return {
        isValid: false,
        error: this.createValidationError(`Limit must be between 1 and ${maxLimit}`),
      };
    }

    if (offset < 0) {
      return {
        isValid: false,
        error: this.createValidationError('Offset must be non-negative'),
      };
    }

    return { isValid: true };
  }

  /**
   * Validate sort order parameter
   */
  static validateSortOrder(order: string): { isValid: boolean; error?: ApiResponse | null } {
    if (!['asc', 'desc'].includes(order)) {
      return {
        isValid: false,
        error: this.createValidationError('Order must be "asc" or "desc"'),
      };
    }
    return { isValid: true };
  }

  /**
   * Validate request body size and structure
   */
  static validateRequestBody(
    body: string,
    required: boolean,
    maxSize: number
  ): { isValid: boolean; error?: ApiResponse | null } {
    if (!body) {
      if (required) {
        return {
          isValid: false,
          error: this.createValidationError('Request body is required'),
        };
      }
      return { isValid: true };
    }

    if (body.length > maxSize) {
      return {
        isValid: false,
        error: this.createValidationError(`Request body too large (max ${maxSize} bytes)`),
      };
    }

    return { isValid: true };
  }

  /**
   * Validate parsed JSON structure
   */
  static validateJsonStructure(parsedBody: any): { isValid: boolean; error?: ApiResponse | null } {
    if (parsedBody !== null && typeof parsedBody !== 'object') {
      return {
        isValid: false,
        error: this.createValidationError('Request body must be a JSON object'),
      };
    }
    return { isValid: true };
  }
}