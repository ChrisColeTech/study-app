// Parsing middleware for eliminating repetitive parsing boilerplate
// Centralizes query parameter and request body parsing logic

import { HandlerContext, ApiResponse } from '../types/api.types';
import { ERROR_CODES } from '../constants/error.constants';
import { createLogger } from '../logger';

const logger = createLogger({ component: 'ParsingMiddleware' });

export interface ParsedRequest<T = any> {
  data: T;
  error: ApiResponse | null;
}

export interface QueryParamConfig {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array';
    decode?: boolean; // URL decode the value
    arrayDelimiter?: string; // For array parsing (default: ',')
    transform?: (value: any) => any; // Custom transformation
  };
}

export class ParsingMiddleware {
  /**
   * Parse query parameters with type conversion and URL decoding
   */
  static parseQueryParams<T = Record<string, any>>(
    context: HandlerContext,
    config?: QueryParamConfig
  ): ParsedRequest<T> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const parsed: Record<string, any> = {};

      for (const [key, value] of Object.entries(queryParams)) {
        if (value === null || value === undefined) {
          continue;
        }

        const fieldConfig = config?.[key];
        let parsedValue: any = value;

        // URL decode if requested
        if (fieldConfig?.decode !== false) {
          try {
            parsedValue = decodeURIComponent(value);
          } catch (error) {
            logger.warn('Failed to decode query parameter', { key, value });
            parsedValue = value; // Use original value if decode fails
          }
        }

        // Type conversion
        if (fieldConfig?.type) {
          switch (fieldConfig.type) {
            case 'number':
              const num = parseInt(parsedValue, 10);
              if (isNaN(num)) {
                return {
                  data: null as any,
                  error: this.createValidationError(`${key} must be a valid number`)
                };
              }
              parsedValue = num;
              break;

            case 'boolean':
              if (parsedValue === 'true') {
                parsedValue = true;
              } else if (parsedValue === 'false') {
                parsedValue = false;
              } else {
                return {
                  data: null as any,
                  error: this.createValidationError(`${key} must be 'true' or 'false'`)
                };
              }
              break;

            case 'array':
              const delimiter = fieldConfig.arrayDelimiter || ',';
              parsedValue = parsedValue.split(delimiter).map((item: string) => item.trim());
              break;

            case 'string':
              // Already a string, just trim
              parsedValue = parsedValue.trim();
              break;
          }
        }

        // Apply custom transformation if provided
        if (fieldConfig?.transform) {
          try {
            parsedValue = fieldConfig.transform(parsedValue);
          } catch (error) {
            logger.warn('Failed to transform query parameter', { key, value, error });
            return {
              data: null as any,
              error: this.createValidationError(`Invalid ${key} format`)
            };
          }
        }

        parsed[key] = parsedValue;
      }

      logger.debug('Query parameters parsed successfully', { 
        originalCount: Object.keys(queryParams).length,
        parsedCount: Object.keys(parsed).length
      });

      return { data: parsed as T, error: null };
    } catch (error) {
      logger.error('Failed to parse query parameters', error as Error);
      return {
        data: null as any,
        error: this.createInternalError('Failed to parse query parameters')
      };
    }
  }

  /**
   * Parse and validate JSON request body
   */
  static parseRequestBody<T = any>(
    context: HandlerContext,
    required = true
  ): ParsedRequest<T> {
    try {
      if (!context.event.body) {
        if (required) {
          return {
            data: null as any,
            error: this.createValidationError('Request body is required')
          };
        }
        return { data: {} as T, error: null };
      }

      const requestBody = JSON.parse(context.event.body);
      
      logger.debug('Request body parsed successfully', {
        hasBody: true,
        fieldsCount: Object.keys(requestBody).length
      });

      return { data: requestBody as T, error: null };
    } catch (error) {
      logger.warn('Failed to parse JSON request body', { error: (error as Error).message });
      return {
        data: null as any,
        error: this.createValidationError('Invalid JSON in request body')
      };
    }
  }

  /**
   * Parse path parameters with optional transformation
   */
  static parsePathParams<T = Record<string, string>>(
    context: HandlerContext,
    transformers?: Record<string, (value: string) => any>
  ): ParsedRequest<T> {
    try {
      const pathParams = context.event.pathParameters || {};
      const parsed: Record<string, any> = {};

      for (const [key, value] of Object.entries(pathParams)) {
        if (value === null || value === undefined) {
          continue;
        }

        let parsedValue: any = decodeURIComponent(value);

        // Apply transformation if provided
        if (transformers?.[key]) {
          try {
            parsedValue = transformers[key](parsedValue);
          } catch (error) {
            logger.warn('Failed to transform path parameter', { key, value, error });
            return {
              data: null as any,
              error: this.createValidationError(`Invalid ${key} format`)
            };
          }
        }

        parsed[key] = parsedValue;
      }

      logger.debug('Path parameters parsed successfully', { 
        pathParamsCount: Object.keys(parsed).length
      });

      return { data: parsed as T, error: null };
    } catch (error) {
      logger.error('Failed to parse path parameters', error as Error);
      return {
        data: null as any,
        error: this.createInternalError('Failed to parse path parameters')
      };
    }
  }

  /**
   * Parse pagination parameters (common pattern)
   */
  static parsePaginationParams(context: HandlerContext): ParsedRequest<{
    limit: number;
    offset: number;
  }> {
    const { data: queryParams, error } = this.parseQueryParams(context, {
      limit: { type: 'number' },
      offset: { type: 'number' }
    });

    if (error) {
      return { data: null as any, error };
    }

    // Validate pagination parameters
    const limit = queryParams.limit || 50;
    const offset = queryParams.offset || 0;

    if (limit < 1 || limit > 100) {
      return {
        data: null as any,
        error: this.createValidationError('Limit must be between 1 and 100')
      };
    }

    if (offset < 0) {
      return {
        data: null as any,
        error: this.createValidationError('Offset must be non-negative')
      };
    }

    return { 
      data: { limit, offset }, 
      error: null 
    };
  }

  /**
   * Parse common filtering parameters
   */
  static parseFilterParams(
    context: HandlerContext,
    allowedFilters: string[] = []
  ): ParsedRequest<Record<string, any>> {
    const { data: queryParams, error } = this.parseQueryParams(context);

    if (error) {
      return { data: null as any, error };
    }

    const filters: Record<string, any> = {};

    // Extract only allowed filter parameters
    for (const filterName of allowedFilters) {
      if (queryParams[filterName] !== undefined) {
        filters[filterName] = queryParams[filterName];
      }
    }

    // Common boolean filters
    const booleanFilters = ['includeInactive', 'includeExplanations', 'includeMetadata'];
    for (const boolFilter of booleanFilters) {
      if (queryParams[boolFilter] === 'true') {
        filters[boolFilter] = true;
      } else if (queryParams[boolFilter] === 'false') {
        filters[boolFilter] = false;
      }
    }

    logger.debug('Filter parameters parsed', { 
      filterCount: Object.keys(filters).length,
      filters: Object.keys(filters)
    });

    return { data: filters, error: null };
  }

  /**
   * Helper method to create validation error response
   */
  private static createValidationError(message: string): ApiResponse {
    return {
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Helper method to create internal error response
   */
  private static createInternalError(message: string): ApiResponse {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Common parsing configurations that can be reused
export const CommonParsing = {
  /**
   * Standard ID parameter parsing
   */
  id: { type: 'string' as const, decode: true },

  /**
   * Standard pagination parsing
   */
  pagination: {
    limit: { type: 'number' as const },
    offset: { type: 'number' as const }
  },

  /**
   * Standard search parameter parsing
   */
  search: { type: 'string' as const, decode: true },

  /**
   * Boolean flag parsing
   */
  booleanFlag: { type: 'boolean' as const },

  /**
   * Comma-separated array parsing
   */
  csvArray: { type: 'array' as const, arrayDelimiter: ',' },

  /**
   * Provider/exam ID parsing (alphanumeric with hyphens/underscores)
   */
  alphanumericId: { 
    type: 'string' as const, 
    decode: true,
    transform: (value: string) => {
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        throw new Error('Invalid format');
      }
      return value;
    }
  }
};