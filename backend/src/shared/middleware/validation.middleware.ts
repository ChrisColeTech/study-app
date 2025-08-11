// Validation middleware for eliminating repetitive validation boilerplate
// Centralizes all validation logic that was duplicated across handlers

import { HandlerContext, ApiResponse } from '../types/api.types';
import { ERROR_CODES } from '../constants/error.constants';
import { createLogger } from '../logger';

const logger = createLogger({ component: 'ValidationMiddleware' });

export interface ValidationRule<T = any> {
  field: string;
  validate: (value: T, context?: ValidationContext) => ValidationResult;
}

export interface ValidationContext {
  allFields?: Record<string, any>;
  requestType?: 'query' | 'body' | 'params';
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ValidationSchema {
  rules: ValidationRule[];
  required?: string[];
}

export class ValidationMiddleware {
  /**
   * Validate query parameters against schema
   */
  static validateQueryParams(
    context: HandlerContext,
    schema: ValidationSchema
  ): ApiResponse | null {
    const queryParams = context.event.queryStringParameters || {};
    return this.validateFields(queryParams, schema, 'query');
  }

  /**
   * Validate request body against schema
   */
  static validateRequestBody(
    context: HandlerContext,
    schema: ValidationSchema
  ): { error: ApiResponse | null; data: any } {
    if (!context.event.body) {
      if (schema.required && schema.required.length > 0) {
        return {
          error: {
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Request body is required'
            },
            timestamp: new Date().toISOString()
          },
          data: null
        };
      }
      return { error: null, data: {} };
    }

    let requestBody: any;
    try {
      requestBody = JSON.parse(context.event.body);
    } catch (error) {
      return {
        error: {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Invalid JSON in request body'
          },
          timestamp: new Date().toISOString()
        },
        data: null
      };
    }

    const validationError = this.validateFields(requestBody, schema, 'body');
    return {
      error: validationError,
      data: requestBody
    };
  }

  /**
   * Validate path parameters against schema
   */
  static validatePathParams(
    context: HandlerContext,
    schema: ValidationSchema
  ): ApiResponse | null {
    const pathParams = context.event.pathParameters || {};
    return this.validateFields(pathParams, schema, 'params');
  }

  /**
   * Core validation logic
   */
  private static validateFields(
    fields: Record<string, any>,
    schema: ValidationSchema,
    requestType: 'query' | 'body' | 'params'
  ): ApiResponse | null {
    // Check required fields
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!fields[requiredField] || 
            (typeof fields[requiredField] === 'string' && fields[requiredField].trim() === '')) {
          logger.warn('Validation failed: missing required field', {
            field: requiredField,
            requestType
          });
          
          return {
            success: false,
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: `${requiredField} is required`
            },
            timestamp: new Date().toISOString()
          };
        }
      }
    }

    // Validate each field against its rules
    const validationContext: ValidationContext = {
      allFields: fields,
      requestType
    };

    for (const rule of schema.rules) {
      const fieldValue = fields[rule.field];
      
      // Skip validation if field is not present and not required
      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }

      const result = rule.validate(fieldValue, validationContext);
      if (!result.isValid) {
        logger.warn('Validation failed', {
          field: rule.field,
          error: result.error,
          requestType
        });

        return {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: result.error || `Invalid ${rule.field}`
          },
          timestamp: new Date().toISOString()
        };
      }
    }

    return null; // No validation errors
  }
}

// Common validation functions that can be reused across handlers
export class ValidationRules {
  /**
   * Validate string length
   */
  static stringLength(min: number, max?: number) {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const length = value.trim().length;
      if (length < min) {
        return { isValid: false, error: `Must be at least ${min} characters long` };
      }

      if (max && length > max) {
        return { isValid: false, error: `Must be ${max} characters or less` };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate number range
   */
  static numberRange(min: number, max?: number) {
    return (value: any): ValidationResult => {
      const num = typeof value === 'string' ? parseInt(value, 10) : value;
      
      if (isNaN(num) || typeof num !== 'number') {
        return { isValid: false, error: 'Must be a valid number' };
      }

      if (num < min) {
        return { isValid: false, error: `Must be at least ${min}` };
      }

      if (max !== undefined && num > max) {
        return { isValid: false, error: `Must be ${max} or less` };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate enum values
   */
  static enumValue<T extends Record<string, string>>(enumObj: T, caseSensitive = false) {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const enumValues = Object.values(enumObj) as string[];
      const testValue = caseSensitive ? value : value.toUpperCase();
      const validValues = caseSensitive ? enumValues : enumValues.map(v => v.toUpperCase());

      if (!validValues.includes(testValue)) {
        return { 
          isValid: false, 
          error: `Invalid value. Valid options: ${enumValues.join(', ')}` 
        };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate alphanumeric with hyphens and underscores (common for IDs)
   */
  static alphanumericId() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return { 
          isValid: false, 
          error: 'Invalid format. Use alphanumeric characters, hyphens, and underscores only' 
        };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate UUID format
   */
  static uuid() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      if (!/^[a-f0-9-]{36}$/.test(value)) {
        return { isValid: false, error: 'Invalid UUID format' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate email format
   */
  static email() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { isValid: false, error: 'Invalid email format' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate array with constraints
   */
  static array(minItems?: number, maxItems?: number, itemValidator?: (item: any) => ValidationResult) {
    return (value: any): ValidationResult => {
      if (!Array.isArray(value)) {
        return { isValid: false, error: 'Must be an array' };
      }

      if (minItems !== undefined && value.length < minItems) {
        return { isValid: false, error: `Must have at least ${minItems} items` };
      }

      if (maxItems !== undefined && value.length > maxItems) {
        return { isValid: false, error: `Must have at most ${maxItems} items` };
      }

      if (itemValidator) {
        for (let i = 0; i < value.length; i++) {
          const itemResult = itemValidator(value[i]);
          if (!itemResult.isValid) {
            return { 
              isValid: false, 
              error: `Item ${i + 1}: ${itemResult.error}` 
            };
          }
        }
      }

      return { isValid: true };
    };
  }

  /**
   * Validate boolean
   */
  static boolean() {
    return (value: any): ValidationResult => {
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        return { isValid: false, error: 'Must be a boolean value' };
      }

      return { isValid: true };
    };
  }

  /**
   * Custom validation function
   */
  static custom(validator: (value: any, context?: ValidationContext) => ValidationResult) {
    return validator;
  }
}