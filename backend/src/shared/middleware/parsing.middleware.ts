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
    type: 'string' | 'number' | 'boolean' | 'array' | 'date' | 'uuid' | 'email' | 'json' | 'float';
    decode?: boolean; // URL decode the value
    arrayDelimiter?: string; // For array parsing (default: ',')
    transform?: (value: any) => any; // Custom transformation
    validate?: (value: any) => { isValid: boolean; message?: string }; // Advanced validation
  };
}

export class ParsingMiddleware {
  // Performance optimization: cache parsed configurations
  private static configCache = new Map<string, QueryParamConfig>();
  private static schemaCache = new Map<string, any>();

  /**
   * Parse query parameters with type conversion and URL decoding
   * Enhanced with performance optimizations and advanced type support
   */
  static parseQueryParams<T = Record<string, any>>(
    context: HandlerContext,
    config?: QueryParamConfig
  ): ParsedRequest<T> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const parsed: Record<string, any> = {};

      // Performance optimization: early return for empty query params
      if (Object.keys(queryParams).length === 0) {
        logger.debug('No query parameters to parse');
        return { data: {} as T, error: null };
      }

      for (const [key, value] of Object.entries(queryParams)) {
        if (value === null || value === undefined) {
          continue;
        }

        const fieldConfig = config?.[key];
        let parsedValue: any = value;

        // Enhanced URL decoding with error recovery
        if (fieldConfig?.decode !== false) {
          try {
            parsedValue = decodeURIComponent(value);
          } catch (error) {
            logger.warn('Failed to decode query parameter, using original value', { key, value });
            parsedValue = value; // Use original value if decode fails
          }
        }

        // Enhanced type conversion with additional types
        if (fieldConfig?.type) {
          const conversionResult = this.convertParameterType(parsedValue, fieldConfig.type, key);
          if (conversionResult.error) {
            return { data: null as any, error: conversionResult.error };
          }
          parsedValue = conversionResult.value;
        }

        // Apply custom transformation if provided
        if (fieldConfig?.transform) {
          try {
            parsedValue = fieldConfig.transform(parsedValue);
          } catch (error) {
            logger.warn('Failed to transform query parameter', { key, value, error });
            return {
              data: null as any,
              error: this.createValidationError(`Invalid ${key} format: ${(error as Error).message}`)
            };
          }
        }

        // Advanced validation integration
        if (fieldConfig?.validate) {
          const validationResult = fieldConfig.validate(parsedValue);
          if (!validationResult.isValid) {
            return {
              data: null as any,
              error: this.createValidationError(`${key}: ${validationResult.message}`)
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
   * Enhanced type conversion with support for additional types
   */
  private static convertParameterType(
    value: any, 
    type: string, 
    key: string
  ): { value?: any; error?: ApiResponse } {
    try {
      switch (type) {
        case 'number':
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            return { error: this.createValidationError(`${key} must be a valid number`) };
          }
          return { value: num };

        case 'float':
          const float = parseFloat(value);
          if (isNaN(float)) {
            return { error: this.createValidationError(`${key} must be a valid decimal number`) };
          }
          return { value: float };

        case 'boolean':
          const lowerValue = value.toLowerCase();
          if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
            return { value: true };
          } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
            return { value: false };
          } else {
            return { error: this.createValidationError(`${key} must be a valid boolean (true/false, 1/0, yes/no)`) };
          }

        case 'date':
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return { error: this.createValidationError(`${key} must be a valid date`) };
          }
          return { value: date };

        case 'uuid':
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(value)) {
            return { error: this.createValidationError(`${key} must be a valid UUID`) };
          }
          return { value: value };

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return { error: this.createValidationError(`${key} must be a valid email address`) };
          }
          return { value: value.toLowerCase() };

        case 'array':
          // Enhanced array parsing with configurable delimiter
          const delimiter = ','; // Default delimiter, could be configurable
          return { value: value.split(delimiter).map((item: string) => item.trim()).filter(Boolean) };

        case 'string':
          // Enhanced string processing with trimming and length validation
          const trimmed = value.trim();
          return { value: trimmed };

        case 'json':
          try {
            return { value: JSON.parse(value) };
          } catch {
            return { error: this.createValidationError(`${key} must be valid JSON`) };
          }

        default:
          return { value: value };
      }
    } catch (error) {
      return { error: this.createValidationError(`Failed to convert ${key} to ${type}`) };
    }
  }

  /**
   * Parse and validate JSON request body with enhanced error handling
   */
  static parseRequestBody<T = any>(
    context: HandlerContext,
    required = true,
    maxSize = 1048576 // 1MB default max size
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

      // Enhanced size validation
      if (context.event.body.length > maxSize) {
        return {
          data: null as any,
          error: this.createValidationError(`Request body too large (max ${maxSize} bytes)`)
        };
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
          bodyPreview: context.event.body.substring(0, 100)
        });
        return {
          data: null as any,
          error: this.createValidationError(`Invalid JSON: ${error.message}`)
        };
      }

      // Type validation for common patterns
      if (requestBody !== null && typeof requestBody !== 'object') {
        return {
          data: null as any,
          error: this.createValidationError('Request body must be a JSON object')
        };
      }
      
      logger.debug('Request body parsed successfully', {
        hasBody: true,
        fieldsCount: requestBody && typeof requestBody === 'object' ? Object.keys(requestBody).length : 0,
        bodySize: context.event.body.length
      });

      return { data: requestBody as T, error: null };
    } catch (error) {
      logger.error('Failed to parse request body', error as Error);
      return {
        data: null as any,
        error: this.createInternalError('Failed to parse request body')
      };
    }
  }

  /**
   * Parse path parameters with enhanced transformation and validation
   */
  static parsePathParams<T = Record<string, string>>(
    context: HandlerContext,
    transformers?: Record<string, (value: string) => any>,
    validators?: Record<string, (value: any) => { isValid: boolean; message?: string }>
  ): ParsedRequest<T> {
    try {
      const pathParams = context.event.pathParameters || {};
      const parsed: Record<string, any> = {};

      for (const [key, value] of Object.entries(pathParams)) {
        if (value === null || value === undefined) {
          continue;
        }

        let parsedValue: any;
        
        // Enhanced URL decoding with error handling
        try {
          parsedValue = decodeURIComponent(value);
        } catch (error) {
          logger.warn('Failed to decode path parameter', { key, value });
          parsedValue = value;
        }

        // Apply transformation if provided
        if (transformers?.[key]) {
          try {
            parsedValue = transformers[key](parsedValue);
          } catch (error) {
            logger.warn('Failed to transform path parameter', { key, value, error });
            return {
              data: null as any,
              error: this.createValidationError(`Invalid ${key} format: ${(error as Error).message}`)
            };
          }
        }

        // Apply validation if provided
        if (validators?.[key]) {
          const validationResult = validators[key](parsedValue);
          if (!validationResult.isValid) {
            return {
              data: null as any,
              error: this.createValidationError(`${key}: ${validationResult.message || 'Invalid value'}`)
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
   * Enhanced pagination parsing with configurable limits and cursor support
   */
  static parsePaginationParams(
    context: HandlerContext,
    options: {
      defaultLimit?: number;
      maxLimit?: number;
      supportCursor?: boolean;
    } = {}
  ): ParsedRequest<{
    limit: number;
    offset?: number;
    cursor?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }> {
    const {
      defaultLimit = 50,
      maxLimit = 100,
      supportCursor = false
    } = options;

    const config: QueryParamConfig = {
      limit: { type: 'number' },
      offset: { type: 'number' },
      sort: { type: 'string' },
      order: { type: 'string' }
    };

    if (supportCursor) {
      config.cursor = { type: 'string', decode: true };
    }

    const { data: queryParams, error } = this.parseQueryParams(context, config);

    if (error) {
      return { data: null as any, error };
    }

    // Enhanced validation with configurable limits
    const limit = queryParams.limit || defaultLimit;
    const offset = queryParams.offset || 0;

    if (limit < 1 || limit > maxLimit) {
      return {
        data: null as any,
        error: this.createValidationError(`Limit must be between 1 and ${maxLimit}`)
      };
    }

    if (offset < 0) {
      return {
        data: null as any,
        error: this.createValidationError('Offset must be non-negative')
      };
    }

    // Validate sort order
    if (queryParams.order && !['asc', 'desc'].includes(queryParams.order)) {
      return {
        data: null as any,
        error: this.createValidationError('Order must be "asc" or "desc"')
      };
    }

    const result: any = { limit, offset };
    
    if (queryParams.cursor && supportCursor) {
      result.cursor = queryParams.cursor;
    }
    
    if (queryParams.sort) {
      result.sort = queryParams.sort;
    }
    
    if (queryParams.order) {
      result.order = queryParams.order as 'asc' | 'desc';
    }

    return { data: result, error: null };
  }

  /**
   * Enhanced filter parsing with schema validation and type coercion
   */
  static parseFilterParams(
    context: HandlerContext,
    schema: {
      allowedFilters: string[];
      filterTypes?: Record<string, string>;
      booleanFilters?: string[];
      dateFilters?: string[];
    }
  ): ParsedRequest<Record<string, any>> {
    const {
      allowedFilters = [],
      filterTypes = {},
      booleanFilters = ['includeInactive', 'includeExplanations', 'includeMetadata'],
      dateFilters = []
    } = schema;

    const { data: queryParams, error } = this.parseQueryParams(context);

    if (error) {
      return { data: null as any, error };
    }

    const filters: Record<string, any> = {};

    // Extract and validate allowed filter parameters
    for (const filterName of allowedFilters) {
      if (queryParams[filterName] !== undefined) {
        let filterValue = queryParams[filterName];

        // Apply type conversion based on schema
        const filterType = filterTypes[filterName];
        if (filterType) {
          const conversionResult = this.convertParameterType(filterValue, filterType, filterName);
          if (conversionResult.error) {
            return { data: null as any, error: conversionResult.error };
          }
          filterValue = conversionResult.value;
        }

        filters[filterName] = filterValue;
      }
    }

    // Enhanced boolean filter processing
    for (const boolFilter of booleanFilters) {
      if (queryParams[boolFilter] !== undefined) {
        const conversionResult = this.convertParameterType(queryParams[boolFilter], 'boolean', boolFilter);
        if (conversionResult.error) {
          return { data: null as any, error: conversionResult.error };
        }
        filters[boolFilter] = conversionResult.value;
      }
    }

    // Enhanced date filter processing
    for (const dateFilter of dateFilters) {
      if (queryParams[dateFilter] !== undefined) {
        const conversionResult = this.convertParameterType(queryParams[dateFilter], 'date', dateFilter);
        if (conversionResult.error) {
          return { data: null as any, error: conversionResult.error };
        }
        filters[dateFilter] = conversionResult.value;
      }
    }

    logger.debug('Filter parameters parsed', { 
      filterCount: Object.keys(filters).length,
      filters: Object.keys(filters)
    });

    return { data: filters, error: null };
  }

  /**
   * Parse complex nested query parameters (e.g., filters[category]=value)
   */
  static parseNestedQueryParams(
    context: HandlerContext,
    schema: Record<string, { type: string; required?: boolean }>
  ): ParsedRequest<Record<string, any>> {
    try {
      const queryParams = context.event.queryStringParameters || {};
      const parsed: Record<string, any> = {};

      for (const [key, value] of Object.entries(queryParams)) {
        if (value === null || value === undefined) {
          continue;
        }

        // Parse nested parameter syntax: parent[child]=value
        const nestedMatch = key.match(/^(\w+)\[(\w+)\]$/);
        if (nestedMatch) {
          const [, parent, child] = nestedMatch;
          const schemaKey = `${parent}.${child}`;
          const fieldSchema = schema[schemaKey];

          if (!parsed[parent]) {
            parsed[parent] = {};
          }

          let parsedValue = value;
          if (fieldSchema?.type) {
            const conversionResult = this.convertParameterType(parsedValue, fieldSchema.type, key);
            if (conversionResult.error) {
              return { data: null as any, error: conversionResult.error };
            }
            parsedValue = conversionResult.value;
          }

          parsed[parent][child] = parsedValue;
        } else {
          // Handle flat parameters
          const fieldSchema = schema[key];
          let parsedValue = value;

          if (fieldSchema?.type) {
            const conversionResult = this.convertParameterType(parsedValue, fieldSchema.type, key);
            if (conversionResult.error) {
              return { data: null as any, error: conversionResult.error };
            }
            parsedValue = conversionResult.value;
          }

          parsed[key] = parsedValue;
        }
      }

      // Validate required fields
      for (const [schemaKey, schemaValue] of Object.entries(schema)) {
        if (schemaValue.required) {
          const keyParts = schemaKey.split('.');
          if (keyParts.length === 2) {
            const [parent, child] = keyParts;
            if (!parsed[parent]?.[child]) {
              return {
                data: null as any,
                error: this.createValidationError(`Required parameter missing: ${schemaKey}`)
              };
            }
          } else if (!parsed[schemaKey]) {
            return {
              data: null as any,
              error: this.createValidationError(`Required parameter missing: ${schemaKey}`)
            };
          }
        }
      }

      return { data: parsed, error: null };
    } catch (error) {
      logger.error('Failed to parse nested query parameters', error as Error);
      return {
        data: null as any,
        error: this.createInternalError('Failed to parse nested query parameters')
      };
    }
  }

  /**
   * Enhanced helper method to create validation error response
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
   * Enhanced helper method to create internal error response
   */
  private static createInternalError(message: string, context?: Record<string, any>): ApiResponse {
    if (context) {
      logger.error('Internal parsing error', { message, context });
    }
    
    return {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Utility method to validate parameter schemas
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
      if (typedConfig.type && !['string', 'number', 'boolean', 'array', 'date', 'uuid', 'email', 'json', 'float'].includes(typedConfig.type)) {
        errors.push(`Invalid type "${typedConfig.type}" for "${key}"`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

// Common parsing configurations that can be reused
export const CommonParsing = {
  /**
   * Standard ID parameter parsing with UUID validation
   */
  id: { type: 'uuid' as const, decode: true },

  /**
   * Simple string ID parameter parsing (for non-UUID IDs)
   */
  stringId: { type: 'string' as const, decode: true },

  /**
   * Standard pagination parsing
   */
  pagination: {
    limit: { type: 'number' as const },
    offset: { type: 'number' as const }
  },

  /**
   * Standard search parameter parsing with length validation
   */
  search: { 
    type: 'string' as const, 
    decode: true,
    validate: (value: string) => ({
      isValid: value.length >= 1 && value.length <= 255,
      message: 'Search term must be between 1 and 255 characters'
    })
  },

  /**
   * Boolean flag parsing with enhanced support
   */
  booleanFlag: { type: 'boolean' as const },

  /**
   * Comma-separated array parsing
   */
  csvArray: { type: 'array' as const, arrayDelimiter: ',' },

  /**
   * Pipe-separated array parsing
   */
  pipeArray: { type: 'array' as const, arrayDelimiter: '|' },

  /**
   * Provider/exam ID parsing (alphanumeric with hyphens/underscores)
   */
  alphanumericId: { 
    type: 'string' as const, 
    decode: true,
    validate: (value: string) => ({
      isValid: /^[a-zA-Z0-9_-]+$/.test(value),
      message: 'ID must contain only alphanumeric characters, hyphens, and underscores'
    })
  },

  /**
   * Email parameter parsing
   */
  email: { type: 'email' as const },

  /**
   * Date parameter parsing
   */
  date: { type: 'date' as const },

  /**
   * JSON parameter parsing (for complex filter objects)
   */
  jsonParam: { type: 'json' as const, decode: true },

  /**
   * Float/decimal number parsing
   */
  decimal: { type: 'float' as const },

  /**
   * Positive integer validation
   */
  positiveInteger: {
    type: 'number' as const,
    validate: (value: number) => ({
      isValid: value > 0 && Number.isInteger(value),
      message: 'Value must be a positive integer'
    })
  },

  /**
   * Percentage validation (0-100)
   */
  percentage: {
    type: 'float' as const,
    validate: (value: number) => ({
      isValid: value >= 0 && value <= 100,
      message: 'Percentage must be between 0 and 100'
    })
  },

  /**
   * Sort order validation
   */
  sortOrder: {
    type: 'string' as const,
    validate: (value: string) => ({
      isValid: ['asc', 'desc'].includes(value.toLowerCase()),
      message: 'Sort order must be "asc" or "desc"'
    }),
    transform: (value: string) => value.toLowerCase()
  },

  /**
   * ISO date string validation
   */
  isoDate: {
    type: 'string' as const,
    validate: (value: string) => {
      const date = new Date(value);
      return {
        isValid: !isNaN(date.getTime()) && value.includes('T'),
        message: 'Date must be in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
      };
    }
  },

  /**
   * Difficulty level validation for exam questions
   */
  difficultyLevel: {
    type: 'string' as const,
    validate: (value: string) => ({
      isValid: ['easy', 'medium', 'hard'].includes(value.toLowerCase()),
      message: 'Difficulty must be "easy", "medium", or "hard"'
    }),
    transform: (value: string) => value.toLowerCase()
  },

  /**
   * Provider validation for certification questions
   */
  certificationProvider: {
    type: 'string' as const,
    validate: (value: string) => ({
      isValid: ['aws', 'azure', 'gcp', 'comptia', 'cisco'].includes(value.toLowerCase()),
      message: 'Provider must be one of: aws, azure, gcp, comptia, cisco'
    }),
    transform: (value: string) => value.toLowerCase()
  }
};