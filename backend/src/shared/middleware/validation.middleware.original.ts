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

export type ValidationFunction = (value: any, context?: ValidationContext) => ValidationResult;

export interface ValidationSchema {
  rules: ValidationRule[];
  required?: string[];
  metadata?: {
    typeName?: string;
    generatedAt?: string;
    version?: string;
  };
}

export class ValidationMiddleware {
  // Performance optimization: Cache validation results for repeated validations
  private static validationCache = new Map<
    string,
    { result: ApiResponse | null; timestamp: number }
  >();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Integration point with ParsingMiddleware for seamless validation workflow
   */
  static validateParsedRequest(
    parsedData: any,
    schema: ValidationSchema,
    requestType: 'query' | 'body' | 'params'
  ): { error: ApiResponse | null; data: any } {
    const validationError = this.validateFields(parsedData, schema, requestType);
    return {
      error: validationError,
      data: parsedData,
    };
  }

  /**
   * Enhanced validation with parsing integration for query parameters
   */
  static validateQueryParams(
    context: HandlerContext,
    schema: ValidationSchema
  ): ApiResponse | null {
    const queryParams = context.event.queryStringParameters || {};
    return this.validateFields(queryParams, schema, 'query');
  }

  /**
   * Enhanced validation with improved JSON parsing and error handling
   */
  static validateRequestBody(
    context: HandlerContext,
    schema: ValidationSchema
  ): { error: ApiResponse | null; data: any } {
    if (!context.event.body) {
      if (schema.required && schema.required.length > 0) {
        return {
          error: this.createStandardErrorResponse(
            'Request body is required',
            ERROR_CODES.VALIDATION_ERROR
          ),
          data: null,
        };
      }
      return { error: null, data: {} };
    }

    let requestBody: any;
    try {
      requestBody = JSON.parse(context.event.body);
    } catch (error) {
      logger.warn('JSON parsing failed', { error: (error as Error).message });
      return {
        error: this.createStandardErrorResponse(
          'Invalid JSON in request body',
          ERROR_CODES.VALIDATION_ERROR
        ),
        data: null,
      };
    }

    const validationError = this.validateFields(requestBody, schema, 'body');
    return {
      error: validationError,
      data: requestBody,
    };
  }

  /**
   * Enhanced path parameter validation with better error messages
   */
  static validatePathParams(context: HandlerContext, schema: ValidationSchema): ApiResponse | null {
    const pathParams = context.event.pathParameters || {};
    return this.validateFields(pathParams, schema, 'params');
  }

  /**
   * Core validation logic with performance optimizations and enhanced error handling
   */
  static validateFields(
    fields: Record<string, any>,
    schema: ValidationSchema,
    requestType: 'query' | 'body' | 'params'
  ): ApiResponse | null {
    // Performance optimization: Check cache for repeated validations
    const cacheKey = this.generateCacheKey(fields, schema, requestType);
    const cached = this.getCachedValidation(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Enhanced required field validation with better error messages
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!this.isFieldPresent(fields[requiredField])) {
          const error = this.createFieldErrorResponse(
            requiredField,
            `${requiredField} is required`,
            requestType
          );
          this.cacheValidation(cacheKey, error);
          return error;
        }
      }
    }

    // Enhanced field validation with context and better error handling
    const validationContext: ValidationContext = {
      allFields: fields,
      requestType,
    };

    for (const rule of schema.rules) {
      const fieldValue = fields[rule.field];

      // Skip validation if field is not present and not required
      if (!this.isFieldPresent(fieldValue)) {
        continue;
      }

      try {
        const result = rule.validate(fieldValue, validationContext);
        if (!result.isValid) {
          const error = this.createFieldErrorResponse(
            rule.field,
            result.error || `Invalid ${rule.field}`,
            requestType
          );
          this.cacheValidation(cacheKey, error);
          return error;
        }
      } catch (validationError) {
        logger.error('Validation rule execution failed', {
          field: rule.field,
          error: (validationError as Error).message,
          requestType,
        });
        const error = this.createFieldErrorResponse(
          rule.field,
          `Validation failed for ${rule.field}`,
          requestType
        );
        this.cacheValidation(cacheKey, error);
        return error;
      }
    }

    // Cache successful validation
    this.cacheValidation(cacheKey, null);
    return null; // No validation errors
  }

  /**
   * Advanced validation for complex nested objects
   */
  static validateNestedObject(
    obj: Record<string, any>,
    schema: Record<string, ValidationSchema>,
    requestType: 'query' | 'body' | 'params'
  ): ApiResponse | null {
    for (const [key, nestedSchema] of Object.entries(schema)) {
      if (obj[key]) {
        const nestedError = this.validateFields(obj[key], nestedSchema, requestType);
        if (nestedError) {
          return nestedError;
        }
      }
    }
    return null;
  }

  /**
   * Batch validation for multiple schemas with early termination
   */
  static validateMultipleSchemas(
    data: Record<string, any>,
    schemas: { schema: ValidationSchema; type: 'query' | 'body' | 'params' }[]
  ): ApiResponse | null {
    for (const { schema, type } of schemas) {
      const error = this.validateFields(data, schema, type);
      if (error) {
        return error;
      }
    }
    return null;
  }

  /**
   * Performance optimization: Check if field has a meaningful value
   */
  private static isFieldPresent(value: any): boolean {
    return (
      value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
    );
  }

  /**
   * Generate cache key for validation caching
   */
  private static generateCacheKey(
    fields: Record<string, any>,
    schema: ValidationSchema,
    requestType: string
  ): string {
    const fieldsKey = JSON.stringify(Object.keys(fields).sort());
    const schemaKey = `${schema.required?.join(',') || ''}-${schema.rules.length}`;
    return `${requestType}-${fieldsKey}-${schemaKey}`;
  }

  /**
   * Get cached validation result if still valid
   */
  private static getCachedValidation(cacheKey: string): ApiResponse | null {
    const cached = this.validationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    // Clean up expired cache entry
    if (cached) {
      this.validationCache.delete(cacheKey);
    }
    return null;
  }

  /**
   * Cache validation result for performance
   */
  private static cacheValidation(cacheKey: string, result: ApiResponse | null): void {
    // Limit cache size to prevent memory leaks
    if (this.validationCache.size > 1000) {
      const oldestKey = this.validationCache.keys().next().value;
      if (oldestKey) {
        this.validationCache.delete(oldestKey);
      }
    }

    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Standardized error response creation with enhanced context
   */
  private static createStandardErrorResponse(
    message: string,
    code: string,
    details?: Record<string, any>
  ): ApiResponse {
    return {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Enhanced field-specific error response with context
   */
  private static createFieldErrorResponse(
    field: string,
    message: string,
    requestType: string
  ): ApiResponse {
    logger.warn('Validation failed', {
      field,
      message,
      requestType,
    });

    return this.createStandardErrorResponse(message, ERROR_CODES.VALIDATION_ERROR, {
      field,
      location: requestType,
    });
  }

  /**
   * Clear validation cache (useful for testing or memory management)
   */
  static clearValidationCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get cache statistics for monitoring
   */
  static getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.validationCache.size,
      hitRate: 0, // Simplified for now, could track hits/misses
    };
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
          error: `Invalid value. Valid options: ${enumValues.join(', ')}`,
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
          error: 'Invalid format. Use alphanumeric characters, hyphens, and underscores only',
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
  static array(
    minItems?: number,
    maxItems?: number,
    itemValidator?: (item: any) => ValidationResult
  ) {
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
              error: `Item ${i + 1}: ${itemResult.error}`,
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

  /**
   * Validate session type enum
   */
  static sessionType() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const validSessionTypes = ['practice', 'exam', 'review'];
      if (!validSessionTypes.includes(value)) {
        return {
          isValid: false,
          error: `sessionType must be one of: ${validSessionTypes.join(', ')}`,
        };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate session action enum
   */
  static sessionAction() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const validActions = [
        'pause',
        'resume',
        'next',
        'previous',
        'answer',
        'mark_for_review',
        'complete',
      ];
      if (!validActions.includes(value)) {
        return {
          isValid: false,
          error: `action must be one of: ${validActions.join(', ')}`,
        };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate ISO date string
   */
  static isoDate() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      try {
        const date = new Date(value);

        // Check if the date is valid and the string format matches ISO standard
        const isValid =
          date instanceof Date &&
          !isNaN(date.getTime()) &&
          (!!value.match(/^\d{4}-\d{2}-\d{2}$/) ||
            !!value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/));

        if (!isValid) {
          return {
            isValid: false,
            error: 'Must be a valid ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)',
          };
        }

        return { isValid: true };
      } catch {
        return { isValid: false, error: 'Invalid date format' };
      }
    };
  }

  /**
   * Validate float/decimal number
   */
  static float(min?: number, max?: number) {
    return (value: any): ValidationResult => {
      const num = typeof value === 'string' ? parseFloat(value) : value;

      if (isNaN(num) || typeof num !== 'number') {
        return { isValid: false, error: 'Must be a valid decimal number' };
      }

      if (min !== undefined && num < min) {
        return { isValid: false, error: `Must be at least ${min}` };
      }

      if (max !== undefined && num > max) {
        return { isValid: false, error: `Must be ${max} or less` };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate JSON string
   */
  static json() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      try {
        JSON.parse(value);
        return { isValid: true };
      } catch {
        return { isValid: false, error: 'Must be valid JSON' };
      }
    };
  }

  /**
   * Validate URL format
   */
  static url() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      try {
        new URL(value);
        return { isValid: true };
      } catch {
        return { isValid: false, error: 'Must be a valid URL' };
      }
    };
  }

  /**
   * Validate phone number format (basic international format)
   */
  static phoneNumber() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(value) || value.length < 10 || value.length > 20) {
        return { isValid: false, error: 'Invalid phone number format' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate file extension
   */
  static fileExtension(allowedExtensions: string[]) {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const extension = value.toLowerCase().split('.').pop();
      if (!extension || !allowedExtensions.includes(extension)) {
        return {
          isValid: false,
          error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`,
        };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate IP address (IPv4)
   */
  static ipAddress() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(value)) {
        return { isValid: false, error: 'Invalid IP address format' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate hexadecimal color
   */
  static hexColor() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexRegex.test(value)) {
        return { isValid: false, error: 'Invalid hex color format (e.g., #FF0000)' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate time format (HH:MM or HH:MM:SS)
   */
  static timeFormat() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
      if (!timeRegex.test(value)) {
        return { isValid: false, error: 'Invalid time format. Use HH:MM or HH:MM:SS' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate credit card number (basic Luhn algorithm)
   */
  static creditCard() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      const cleaned = value.replace(/\s+/g, '').replace(/-/g, '');
      if (!/^\d+$/.test(cleaned) || cleaned.length < 13 || cleaned.length > 19) {
        return { isValid: false, error: 'Invalid credit card number format' };
      }

      // Basic Luhn algorithm check
      let sum = 0;
      let isEven = false;
      for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned.charAt(i), 10);
        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }
        sum += digit;
        isEven = !isEven;
      }

      if (sum % 10 !== 0) {
        return { isValid: false, error: 'Invalid credit card number' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate that a field matches another field (e.g., password confirmation)
   */
  static matchesField(fieldName: string) {
    return (value: any, context?: ValidationContext): ValidationResult => {
      if (!context?.allFields) {
        return { isValid: false, error: 'Cannot validate field match without context' };
      }

      const otherValue = context.allFields[fieldName];
      if (value !== otherValue) {
        return { isValid: false, error: `Must match ${fieldName}` };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate geographic coordinates (latitude, longitude)
   */
  static coordinates() {
    return (value: { lat: number; lng: number }): ValidationResult => {
      if (!value || typeof value !== 'object') {
        return { isValid: false, error: 'Must be an object with lat and lng properties' };
      }

      const { lat, lng } = value;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { isValid: false, error: 'Latitude and longitude must be numbers' };
      }

      if (lat < -90 || lat > 90) {
        return { isValid: false, error: 'Latitude must be between -90 and 90' };
      }

      if (lng < -180 || lng > 180) {
        return { isValid: false, error: 'Longitude must be between -180 and 180' };
      }

      return { isValid: true };
    };
  }

  /**
   * Validate timezone string
   */
  static timezone() {
    return (value: string): ValidationResult => {
      if (typeof value !== 'string') {
        return { isValid: false, error: 'Must be a string' };
      }

      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return { isValid: true };
      } catch {
        return { isValid: false, error: 'Invalid timezone identifier' };
      }
    };
  }
}

/**
 * Type-safe validation generator that creates runtime validation schemas from TypeScript types
 * Bridges compile-time type definitions with runtime validation
 */
export class TypeSafeValidationGenerator {
  /**
   * Generate validation schema from TypeScript interface structure
   * Provides type-aware validation that corresponds to actual type definitions
   */
  static fromTypeSchema<T extends Record<string, any>>(
    typeDefinition: TypeValidationDefinition<T>
  ): ValidationSchema {
    const rules: ValidationRule[] = [];
    const required: string[] = [];

    for (const [field, definition] of Object.entries(typeDefinition.fields)) {
      if (definition.required) {
        required.push(field);
      }

      // Add field validation rule with type-aware validation
      rules.push({
        field,
        validate: this.createTypeAwareValidator(field, definition, typeDefinition.typeName),
      });
    }

    return {
      required,
      rules,
      metadata: {
        typeName: typeDefinition.typeName,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Create type-aware validator that references the original TypeScript type
   */
  private static createTypeAwareValidator(
    fieldName: string,
    definition: FieldValidationDefinition,
    typeName: string
  ): ValidationFunction {
    return (value: any, context?: ValidationContext): ValidationResult => {
      try {
        // Apply all validators for this field
        for (const validator of definition.validators) {
          const result = validator(value);
          if (!result.isValid) {
            const typeInfo: {
              fieldName: string;
              fieldType: string;
              typeName: string;
              expectedFormat?: string;
            } = {
              fieldName,
              fieldType: definition.type,
              typeName,
            };
            
            if (definition.description) {
              typeInfo.expectedFormat = definition.description;
            }
            
            return {
              isValid: false,
              error: this.enhanceErrorWithTypeInfo(result.error || 'Validation failed', typeInfo),
            };
          }
        }

        return { isValid: true };
      } catch (error) {
        logger.error('Type-aware validation failed', {
          field: fieldName,
          type: definition.type,
          typeName,
          error: (error as Error).message,
        });

        const typeInfo: {
          fieldName: string;
          fieldType: string;
          typeName: string;
          expectedFormat?: string;
        } = {
          fieldName,
          fieldType: definition.type,
          typeName,
        };
        
        if (definition.description) {
          typeInfo.expectedFormat = definition.description;
        }
        
        return {
          isValid: false,
          error: this.enhanceErrorWithTypeInfo('Validation error occurred', typeInfo),
        };
      }
    };
  }

  /**
   * Enhance error messages with type information for better developer experience
   */
  private static enhanceErrorWithTypeInfo(
    baseError: string,
    typeInfo: {
      fieldName: string;
      fieldType: string;
      typeName: string;
      expectedFormat?: string;
    }
  ): string {
    const { fieldName, fieldType, typeName, expectedFormat } = typeInfo;
    
    let enhancedError = `${baseError} (Field: ${fieldName}, Type: ${fieldType})`;
    
    if (expectedFormat) {
      enhancedError += ` - Expected: ${expectedFormat}`;
    }
    
    enhancedError += ` - From TypeScript interface: ${typeName}`;
    
    return enhancedError;
  }

  /**
   * Generate enum-aware validator that uses actual TypeScript enum values
   */
  static fromEnum<T extends Record<string, string>>(
    enumObject: T,
    enumName: string
  ): ValidationFunction {
    return (value: any): ValidationResult => {
      if (typeof value !== 'string') {
        return {
          isValid: false,
          error: `Expected string value for enum ${enumName}`,
        };
      }

      const enumValues = Object.values(enumObject);
      if (!enumValues.includes(value)) {
        return {
          isValid: false,
          error: `Invalid ${enumName}. Valid values: ${enumValues.join(', ')} (from TypeScript enum)`,
        };
      }

      return { isValid: true };
    };
  }

  /**
   * Generate interface-aware validator that validates object structure against TypeScript interface
   */
  static fromInterface<T extends Record<string, any>>(
    interfaceDefinition: InterfaceValidationDefinition<T>
  ): ValidationFunction {
    return (value: any): ValidationResult => {
      if (!value || typeof value !== 'object') {
        return {
          isValid: false,
          error: `Expected object matching interface ${interfaceDefinition.interfaceName}`,
        };
      }

      // Validate each field according to interface definition
      for (const [fieldName, fieldDef] of Object.entries(interfaceDefinition.fields)) {
        const fieldValue = value[fieldName];
        
        if (fieldDef.required && (fieldValue === undefined || fieldValue === null)) {
          return {
            isValid: false,
            error: `Required field '${fieldName}' missing (from interface ${interfaceDefinition.interfaceName})`,
          };
        }

        if (fieldValue !== undefined) {
          for (const validator of fieldDef.validators) {
            const result = validator(fieldValue);
            if (!result.isValid) {
              return {
                isValid: false,
                error: `Field '${fieldName}' validation failed: ${result.error} (from interface ${interfaceDefinition.interfaceName})`,
              };
            }
          }
        }
      }

      return { isValid: true };
    };
  }
}

/**
 * Type definitions for type-safe validation configuration
 */
export interface TypeValidationDefinition<T extends Record<string, any>> {
  typeName: string;
  fields: {
    [K in keyof T]: FieldValidationDefinition;
  };
}

export interface FieldValidationDefinition {
  type: string;
  required: boolean;
  validators: ValidationFunction[];
  description?: string;
}

export interface InterfaceValidationDefinition<T extends Record<string, any>> {
  interfaceName: string;
  fields: {
    [K in keyof T]: FieldValidationDefinition;
  };
}

/**
 * Enhanced validation schema with type metadata
 */
export interface TypeAwareValidationSchema extends ValidationSchema {
  metadata?: {
    typeName?: string;
    generatedAt?: string;
    version?: string;
  };
}

/**
 * Type-safe validation decorators for runtime validation
 */
export class TypeSafeValidators {
  /**
   * Decorator that validates request against TypeScript type definition
   */
  static validateType<T extends Record<string, any>>(
    typeDefinition: TypeValidationDefinition<T>
  ) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const context = args[0] as HandlerContext;
        
        // Generate validation schema from type definition
        const schema = TypeSafeValidationGenerator.fromTypeSchema(typeDefinition);
        
        // Validate request body against schema
        const validationResult = ValidationMiddleware.validateRequestBody(context, schema);
        if (validationResult.error) {
          return validationResult.error;
        }
        
        // Call original method with validated data
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }

  /**
   * Decorator that validates query parameters against TypeScript type
   */
  static validateQueryType<T extends Record<string, any>>(
    typeDefinition: TypeValidationDefinition<T>
  ) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const context = args[0] as HandlerContext;
        
        // Generate validation schema from type definition
        const schema = TypeSafeValidationGenerator.fromTypeSchema(typeDefinition);
        
        // Validate query parameters against schema
        const validationError = ValidationMiddleware.validateQueryParams(context, schema);
        if (validationError) {
          return validationError;
        }
        
        // Call original method with validated data
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }

  /**
   * Decorator that validates path parameters against TypeScript type
   */
  static validatePathType<T extends Record<string, any>>(
    typeDefinition: TypeValidationDefinition<T>
  ) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const context = args[0] as HandlerContext;
        
        // Generate validation schema from type definition
        const schema = TypeSafeValidationGenerator.fromTypeSchema(typeDefinition);
        
        // Validate path parameters against schema
        const validationError = ValidationMiddleware.validatePathParams(context, schema);
        if (validationError) {
          return validationError;
        }
        
        // Call original method with validated data
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }
}
