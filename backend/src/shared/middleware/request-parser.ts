// RequestParser - Main coordinator for all parsing operations
// Part of ParsingMiddleware decomposition (Objective 37)

import { HandlerContext, ApiResponse } from '../types/api.types';
import { createLogger } from '../logger';
import { ParameterParser, QueryParamConfig, ParsedRequest } from './parameter-parser';
import { BodyParser } from './body-parser';
import { ValidationParser } from './validation-parser';

const logger = createLogger({ component: 'RequestParser' });

/**
 * RequestParser - Central coordinator for all parsing operations
 * Delegates to specialized parsers while maintaining caching infrastructure
 * Extracted from ParsingMiddleware to achieve SRP compliance
 */
export class RequestParser {
  // Performance optimization: cache parsed configurations
  private static configCache = new Map<string, QueryParamConfig>();
  private static schemaCache = new Map<string, any>();

  /**
   * Parse query parameters with type conversion and URL decoding
   * Delegates to ParameterParser for actual parsing logic
   */
  static parseQueryParams<T = Record<string, any>>(
    context: HandlerContext,
    config?: QueryParamConfig
  ): ParsedRequest<T> {
    return ParameterParser.parseQueryParams<T>(context, config);
  }

  /**
   * Parse and validate JSON request body with enhanced error handling
   * Delegates to BodyParser for actual parsing logic
   */
  static parseRequestBody<T = any>(
    context: HandlerContext,
    required = true,
    maxSize = 1048576 // 1MB default max size
  ): ParsedRequest<T> {
    return BodyParser.parseRequestBody<T>(context, required, maxSize);
  }

  /**
   * Parse path parameters with enhanced transformation and validation
   * Delegates to ParameterParser for actual parsing logic
   */
  static parsePathParams<T = Record<string, string>>(
    context: HandlerContext,
    transformers?: Record<string, (value: string) => any>,
    validators?: Record<string, (value: any) => { isValid: boolean; message?: string }>
  ): ParsedRequest<T> {
    return ParameterParser.parsePathParams<T>(context, transformers, validators);
  }

  /**
   * Enhanced pagination parsing with configurable limits and cursor support
   * Delegates to ParameterParser for actual parsing logic
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
    return ParameterParser.parsePaginationParams(context, options);
  }

  /**
   * Enhanced filter parsing with schema validation and type coercion
   * Delegates to ParameterParser for actual parsing logic
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
    return ParameterParser.parseFilterParams(context, schema);
  }

  /**
   * Parse complex nested query parameters (e.g., filters[category]=value)
   * Delegates to ParameterParser for actual parsing logic
   */
  static parseNestedQueryParams(
    context: HandlerContext,
    schema: Record<string, { type: string; required?: boolean }>
  ): ParsedRequest<Record<string, any>> {
    return ParameterParser.parseNestedQueryParams(context, schema);
  }

  /**
   * Utility method to validate parameter schemas
   * Delegates to ValidationParser for actual validation logic
   */
  static validateParameterSchema(schema: any): { isValid: boolean; errors: string[] } {
    return ValidationParser.validateParameterSchema(schema);
  }

  /**
   * Enhanced helper method to create validation error response
   * Delegates to ValidationParser for error creation
   */
  static createValidationError(message: string): ApiResponse {
    return ValidationParser.createValidationError(message);
  }

  /**
   * Enhanced helper method to create internal error response
   * Delegates to ValidationParser for error creation
   */
  static createInternalError(message: string, context?: Record<string, any>): ApiResponse {
    return ValidationParser.createInternalError(message, context);
  }

  /**
   * Parse request body with custom validation
   * Delegates to BodyParser for enhanced body parsing
   */
  static parseRequestBodyWithValidation<T = any>(
    context: HandlerContext,
    validator?: (body: any) => { isValid: boolean; message?: string },
    required = true,
    maxSize = 1048576
  ): ParsedRequest<T> {
    return BodyParser.parseRequestBodyWithValidation<T>(context, validator, required, maxSize);
  }

  /**
   * Parse request body with schema validation
   * Delegates to BodyParser for schema-based validation
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
    return BodyParser.parseRequestBodyWithSchema<T>(context, schema, required, maxSize);
  }

  /**
   * Extract specific fields from request body
   * Delegates to BodyParser for field extraction
   */
  static extractFields<T = any>(
    context: HandlerContext,
    fields: string[],
    required = true,
    maxSize = 1048576
  ): ParsedRequest<T> {
    return BodyParser.extractFields<T>(context, fields, required, maxSize);
  }

  /**
   * Parse request body and apply transformations
   * Delegates to BodyParser for transformation logic
   */
  static parseWithTransformations<T = any>(
    context: HandlerContext,
    transformations: Record<string, (value: any) => any>,
    required = true,
    maxSize = 1048576
  ): ParsedRequest<T> {
    return BodyParser.parseWithTransformations<T>(context, transformations, required, maxSize);
  }

  /**
   * Convert parameter value to specified type with validation
   * Delegates to ParameterParser for type conversion
   */
  static convertParameterType(
    value: any,
    type: string,
    key: string
  ): { value?: any; error?: ApiResponse } {
    return ParameterParser.convertParameterType(value, type, key);
  }

  /**
   * Clear configuration caches (useful for testing)
   */
  static clearCaches(): void {
    this.configCache.clear();
    this.schemaCache.clear();
    logger.debug('Parsing caches cleared');
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): {
    configCacheSize: number;
    schemaCacheSize: number;
  } {
    return {
      configCacheSize: this.configCache.size,
      schemaCacheSize: this.schemaCache.size,
    };
  }

  /**
   * Set cached configuration
   */
  static setCachedConfig(key: string, config: QueryParamConfig): void {
    this.configCache.set(key, config);
  }

  /**
   * Get cached configuration
   */
  static getCachedConfig(key: string): QueryParamConfig | undefined {
    return this.configCache.get(key);
  }

  /**
   * Set cached schema
   */
  static setCachedSchema(key: string, schema: any): void {
    this.schemaCache.set(key, schema);
  }

  /**
   * Get cached schema
   */
  static getCachedSchema(key: string): any {
    return this.schemaCache.get(key);
  }
}