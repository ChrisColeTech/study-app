// ParameterParser - Specialized parameter parsing and type conversion
// Part of ParsingMiddleware decomposition (Objective 37)

import { HandlerContext, ApiResponse } from '../types/api.types';
import { createLogger } from '../logger';
import { ValidationParser } from './validation-parser';

const logger = createLogger({ component: 'ParameterParser' });

export interface QueryParamConfig {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'date' | 'uuid' | 'email' | 'json' | 'float';
    decode?: boolean; // URL decode the value
    arrayDelimiter?: string; // For array parsing (default: ',')
    transform?: (value: any) => any; // Custom transformation
    validate?: (value: any) => { isValid: boolean; message?: string }; // Advanced validation
  };
}

export interface ParsedRequest<T = any> {
  data: T;
  error: ApiResponse | null;
}

/**
 * ParameterParser - Handles path and query parameter parsing with type conversion
 * Extracted from ParsingMiddleware to achieve SRP compliance
 */
export class ParameterParser {
  /**
   * Convert parameter value to specified type with validation
   */
  static convertParameterType(
    value: any,
    type: string,
    key: string
  ): { value?: any; error?: ApiResponse } {
    try {
      switch (type) {
        case 'number':
          const num = parseInt(value, 10);
          if (isNaN(num)) {
            return { error: ValidationParser.createValidationError(`${key} must be a valid number`) };
          }
          return { value: num };

        case 'float':
          const float = parseFloat(value);
          if (isNaN(float)) {
            return { error: ValidationParser.createValidationError(`${key} must be a valid decimal number`) };
          }
          return { value: float };

        case 'boolean':
          const lowerValue = value.toLowerCase();
          if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
            return { value: true };
          } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
            return { value: false };
          } else {
            return {
              error: ValidationParser.createValidationError(
                `${key} must be a valid boolean (true/false, 1/0, yes/no)`
              ),
            };
          }

        case 'date':
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return { error: ValidationParser.createValidationError(`${key} must be a valid date`) };
          }
          return { value: date };

        case 'uuid':
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(value)) {
            return { error: ValidationParser.createValidationError(`${key} must be a valid UUID`) };
          }
          return { value: value };

        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return { error: ValidationParser.createValidationError(`${key} must be a valid email address`) };
          }
          return { value: value.toLowerCase() };

        case 'array':
          // Enhanced array parsing with configurable delimiter
          const delimiter = ','; // Default delimiter, could be configurable
          return {
            value: value
              .split(delimiter)
              .map((item: string) => item.trim())
              .filter(Boolean),
          };

        case 'string':
          // Enhanced string processing with trimming and length validation
          const trimmed = value.trim();
          return { value: trimmed };

        case 'json':
          try {
            return { value: JSON.parse(value) };
          } catch {
            return { error: ValidationParser.createValidationError(`${key} must be valid JSON`) };
          }

        default:
          return { value: value };
      }
    } catch (error) {
      return { error: ValidationParser.createValidationError(`Failed to convert ${key} to ${type}`) };
    }
  }

  /**
   * Parse query parameters with type conversion and validation
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
              error: ValidationParser.createValidationError(
                `Invalid ${key} format: ${(error as Error).message}`
              ),
            };
          }
        }

        // Advanced validation integration
        if (fieldConfig?.validate) {
          const validationResult = ValidationParser.validateFieldValue(parsedValue, key, fieldConfig.validate);
          if (!validationResult.isValid) {
            return { data: null as any, error: validationResult.error || null };
          }
        }

        parsed[key] = parsedValue;
      }

      logger.debug('Query parameters parsed successfully', {
        originalCount: Object.keys(queryParams).length,
        parsedCount: Object.keys(parsed).length,
      });

      return { data: parsed as T, error: null };
    } catch (error) {
      logger.error('Failed to parse query parameters', error as Error);
      return {
        data: null as any,
        error: ValidationParser.createInternalError('Failed to parse query parameters'),
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
              error: ValidationParser.createValidationError(
                `Invalid ${key} format: ${(error as Error).message}`
              ),
            };
          }
        }

        // Apply validation if provided
        if (validators?.[key]) {
          const validationResult = ValidationParser.validateFieldValue(parsedValue, key, validators[key]);
          if (!validationResult.isValid) {
            return { data: null as any, error: validationResult.error || null };
          }
        }

        parsed[key] = parsedValue;
      }

      logger.debug('Path parameters parsed successfully', {
        pathParamsCount: Object.keys(parsed).length,
      });

      return { data: parsed as T, error: null };
    } catch (error) {
      logger.error('Failed to parse path parameters', error as Error);
      return {
        data: null as any,
        error: ValidationParser.createInternalError('Failed to parse path parameters'),
      };
    }
  }

  /**
   * Parse pagination parameters with configurable limits
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
    const { defaultLimit = 50, maxLimit = 100, supportCursor = false } = options;

    const config: QueryParamConfig = {
      limit: { type: 'number' },
      offset: { type: 'number' },
      sort: { type: 'string' },
      order: { type: 'string' },
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

    const validationResult = ValidationParser.validatePaginationParams(limit, offset, maxLimit);
    if (!validationResult.isValid) {
      return { data: null as any, error: validationResult.error || null };
    }

    // Validate sort order
    if (queryParams.order) {
      const orderValidation = ValidationParser.validateSortOrder(queryParams.order);
      if (!orderValidation.isValid) {
        return { data: null as any, error: orderValidation.error || null };
      }
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
   * Parse filter parameters with schema validation
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
      dateFilters = [],
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
        const conversionResult = this.convertParameterType(
          queryParams[boolFilter],
          'boolean',
          boolFilter
        );
        if (conversionResult.error) {
          return { data: null as any, error: conversionResult.error };
        }
        filters[boolFilter] = conversionResult.value;
      }
    }

    // Enhanced date filter processing
    for (const dateFilter of dateFilters) {
      if (queryParams[dateFilter] !== undefined) {
        const conversionResult = this.convertParameterType(
          queryParams[dateFilter],
          'date',
          dateFilter
        );
        if (conversionResult.error) {
          return { data: null as any, error: conversionResult.error };
        }
        filters[dateFilter] = conversionResult.value;
      }
    }

    logger.debug('Filter parameters parsed', {
      filterCount: Object.keys(filters).length,
      filters: Object.keys(filters),
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
      const validationResult = ValidationParser.validateRequiredFields(parsed, schema);
      if (!validationResult.isValid) {
        return { data: null as any, error: validationResult.error || null };
      }

      return { data: parsed, error: null };
    } catch (error) {
      logger.error('Failed to parse nested query parameters', error as Error);
      return {
        data: null as any,
        error: ValidationParser.createInternalError('Failed to parse nested query parameters'),
      };
    }
  }
}