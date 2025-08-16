// Parsing middleware for eliminating repetitive parsing boilerplate
// Centralizes query parameter and request body parsing logic

import { HandlerContext, ApiResponse } from '../types/api.types';
import { ERROR_CODES } from '../constants/error.constants';
import { createLogger } from '../logger';
import { RequestParser } from './request-parser';

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
    return RequestParser.parseQueryParams<T>(context, config);
  }

  /**
   * Enhanced type conversion with support for additional types
   */
  private static convertParameterType(
    value: any,
    type: string,
    key: string
  ): { value?: any; error?: ApiResponse } {
    return RequestParser.convertParameterType(value, type, key);
  }

  /**
   * Parse and validate JSON request body with enhanced error handling
   */
  static parseRequestBody<T = any>(
    context: HandlerContext,
    required = true,
    maxSize = 1048576 // 1MB default max size
  ): ParsedRequest<T> {
    return RequestParser.parseRequestBody<T>(context, required, maxSize);
  }

  /**
   * Parse path parameters with enhanced transformation and validation
   */
  static parsePathParams<T = Record<string, string>>(
    context: HandlerContext,
    transformers?: Record<string, (value: string) => any>,
    validators?: Record<string, (value: any) => { isValid: boolean; message?: string }>
  ): ParsedRequest<T> {
    return RequestParser.parsePathParams<T>(context, transformers, validators);
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
    return RequestParser.parsePaginationParams(context, options);
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
    return RequestParser.parseFilterParams(context, schema);
  }

  /**
   * Parse complex nested query parameters (e.g., filters[category]=value)
   */
  static parseNestedQueryParams(
    context: HandlerContext,
    schema: Record<string, { type: string; required?: boolean }>
  ): ParsedRequest<Record<string, any>> {
    return RequestParser.parseNestedQueryParams(context, schema);
  }

  /**
   * Enhanced helper method to create validation error response
   */
  private static createValidationError(message: string): ApiResponse {
    return RequestParser.createValidationError(message);
  }

  /**
   * Enhanced helper method to create internal error response
   */
  private static createInternalError(message: string, context?: Record<string, any>): ApiResponse {
    return RequestParser.createInternalError(message, context);
  }

  /**
   * Utility method to validate parameter schemas
   */
  static validateParameterSchema(schema: any): { isValid: boolean; errors: string[] } {
    return RequestParser.validateParameterSchema(schema);
  }
}

// Re-export CommonParsing from dedicated file
export { CommonParsing } from './common-parsing';
