// BodyParser - Specialized request body parsing and validation
// Part of ParsingMiddleware decomposition (Objective 37)

import { HandlerContext, ApiResponse } from '../types/api.types';
import { createLogger } from '../logger';
import { ValidationParser } from './validation-parser';

const logger = createLogger({ component: 'BodyParser' });

export interface ParsedRequest<T = any> {
  data: T;
  error: ApiResponse | null;
}

/**
 * BodyParser - Handles request body parsing with size validation and error handling
 * Extracted from ParsingMiddleware to achieve SRP compliance
 */
export class BodyParser {
  /**
   * Parse and validate JSON request body with enhanced error handling
   */
  static parseRequestBody<T = any>(
    context: HandlerContext,
    required = true,
    maxSize = 1048576 // 1MB default max size
  ): ParsedRequest<T> {
    try {
      // Validate body existence and size
      const bodyValidation = ValidationParser.validateRequestBody(
        context.event.body || '',
        required,
        maxSize
      );
      if (!bodyValidation.isValid) {
        return { data: null as any, error: bodyValidation.error || null };
      }

      // Handle empty body case
      if (!context.event.body) {
        return { data: {} as T, error: null };
      }

      // Enhanced JSON parsing with better error messages
      let requestBody: any;
      try {
        requestBody = JSON.parse(context.event.body);
      } catch (parseError) {
        const error = parseError as Error;
        logger.warn('JSON parsing failed', {
          error: error.message,
          bodyLength: context.event.body.length,
          bodyPreview: context.event.body.substring(0, 100),
        });
        return {
          data: null as any,
          error: ValidationParser.createValidationError(`Invalid JSON: ${error.message}`),
        };
      }

      // Validate JSON structure
      const structureValidation = ValidationParser.validateJsonStructure(requestBody);
      if (!structureValidation.isValid) {
        return { data: null as any, error: structureValidation.error || null };
      }

      logger.debug('Request body parsed successfully', {
        hasBody: true,
        fieldsCount:
          requestBody && typeof requestBody === 'object' ? Object.keys(requestBody).length : 0,
        bodySize: context.event.body.length,
      });

      return { data: requestBody as T, error: null };
    } catch (error) {
      logger.error('Failed to parse request body', error as Error);
      return {
        data: null as any,
        error: ValidationParser.createInternalError('Failed to parse request body'),
      };
    }
  }

  /**
   * Parse request body with custom validation
   */
  static parseRequestBodyWithValidation<T = any>(
    context: HandlerContext,
    validator?: (body: any) => { isValid: boolean; message?: string },
    required = true,
    maxSize = 1048576
  ): ParsedRequest<T> {
    const { data: parsedBody, error } = this.parseRequestBody<T>(context, required, maxSize);
    
    if (error) {
      return { data: null as any, error };
    }

    // Apply custom validation if provided
    if (validator && parsedBody) {
      const validationResult = ValidationParser.validateFieldValue(parsedBody, 'body', validator);
      if (!validationResult.isValid) {
        return { data: null as any, error: validationResult.error || null };
      }
    }

    return { data: parsedBody, error: null };
  }

  /**
   * Parse request body with schema validation
   */
  static parseRequestBodyWithSchema<T = any>(
    context: HandlerContext,
    schema: {
      required?: string[];
      optional?: string[];
      types?: Record<string, string>;
    },
    required = true,
    maxSize = 1048576
  ): ParsedRequest<T> {
    const { data: parsedBody, error } = this.parseRequestBody<T>(context, required, maxSize);
    
    if (error) {
      return { data: null as any, error };
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      return { data: parsedBody, error: null };
    }

    // Validate required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in parsedBody) || (parsedBody as any)[field] === undefined || (parsedBody as any)[field] === null) {
          return {
            data: null as any,
            error: ValidationParser.createValidationError(`Required field missing: ${field}`),
          };
        }
      }
    }

    // Validate field types if specified
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (field in parsedBody) {
          const value = (parsedBody as any)[field];
          if (!this.validateFieldType(value, expectedType)) {
            return {
              data: null as any,
              error: ValidationParser.createValidationError(
                `Field "${field}" must be of type ${expectedType}`
              ),
            };
          }
        }
      }
    }

    return { data: parsedBody, error: null };
  }

  /**
   * Validate field type
   */
  private static validateFieldType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'uuid':
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return typeof value === 'string' && uuidRegex.test(value);
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return typeof value === 'string' && emailRegex.test(value);
      case 'date':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      default:
        return true; // Unknown types pass validation
    }
  }

  /**
   * Extract specific fields from request body
   */
  static extractFields<T = any>(
    context: HandlerContext,
    fields: string[],
    required = true,
    maxSize = 1048576
  ): ParsedRequest<T> {
    const { data: parsedBody, error } = this.parseRequestBody(context, required, maxSize);
    
    if (error) {
      return { data: null as any, error };
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      return { data: {} as T, error: null };
    }

    const extracted: Record<string, any> = {};
    for (const field of fields) {
      if (field in parsedBody) {
        extracted[field] = (parsedBody as any)[field];
      }
    }

    return { data: extracted as T, error: null };
  }

  /**
   * Parse request body and apply transformations
   */
  static parseWithTransformations<T = any>(
    context: HandlerContext,
    transformations: Record<string, (value: any) => any>,
    required = true,
    maxSize = 1048576
  ): ParsedRequest<T> {
    const { data: parsedBody, error } = this.parseRequestBody(context, required, maxSize);
    
    if (error) {
      return { data: null as any, error };
    }

    if (!parsedBody || typeof parsedBody !== 'object') {
      return { data: parsedBody, error: null };
    }

    const transformed = { ...parsedBody };

    // Apply transformations
    for (const [field, transform] of Object.entries(transformations)) {
      if (field in transformed) {
        try {
          transformed[field] = transform(transformed[field]);
        } catch (transformError) {
          logger.warn('Field transformation failed', { field, error: transformError });
          return {
            data: null as any,
            error: ValidationParser.createValidationError(
              `Failed to transform field "${field}": ${(transformError as Error).message}`
            ),
          };
        }
      }
    }

    return { data: transformed as T, error: null };
  }
}