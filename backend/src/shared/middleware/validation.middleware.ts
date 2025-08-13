// Validation middleware for eliminating repetitive validation boilerplate
// Centralizes all validation logic that was duplicated across handlers
// REFACTORED: Decomposed monster class - delegates to focused components
// Reduced from 1,328 lines to under 300 lines while maintaining full compatibility

import { HandlerContext, ApiResponse } from '../types/api.types';
import { ValidationEngine } from '../validation/validation-engine';
import { ValidationRules, ValidationResult, ValidationContext } from '../validation/validation-rules';
import { ValidationCache } from '../validation/validation-cache';
import { ValidationErrorFormatter } from '../validation/validation-error-formatter';
import { ValidatorIntegration } from '../validation/validator-integration';
import { createLogger } from '../logger';

const logger = createLogger({ component: 'ValidationMiddleware' });

export interface ValidationRule<T = any> {
  field: string;
  validate: (value: T, context?: ValidationContext) => ValidationResult;
}

export type { ValidationContext, ValidationResult };

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

/**
 * ValidationMiddleware - Now a lean facade that delegates to focused components
 * BEFORE: 1,328 lines of monster class violating SRP
 * AFTER: <300 lines of focused delegation maintaining full API compatibility
 */
export class ValidationMiddleware {
  
  // ===== CORE VALIDATION METHODS =====
  // These are the main methods used throughout the codebase
  
  /**
   * Core validation logic - REFACTORED: delegates to ValidationEngine
   * Used by: session.ts, question.ts, goals.ts, and other handlers
   */
  static validateFields(
    fields: Record<string, any>,
    schema: ValidationSchema,
    requestType: 'query' | 'body' | 'params'
  ): ApiResponse | null {
    return ValidationEngine.validateFields(fields, schema, requestType);
  }

  /**
   * Request body validation - REFACTORED: delegates to ValidationEngine
   */
  static validateRequestBody(
    context: HandlerContext,
    schema: ValidationSchema
  ): { error: ApiResponse | null; data: any } {
    if (!context.event.body) {
      if (schema.required && schema.required.length > 0) {
        return {
          error: ValidationErrorFormatter.createStandardErrorResponse('Request body is required'),
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
        error: ValidationErrorFormatter.createStandardErrorResponse('Invalid JSON in request body'),
        data: null,
      };
    }

    const validationError = ValidationEngine.validateFields(requestBody, schema, 'body');
    return {
      error: validationError,
      data: requestBody,
    };
  }

  /**
   * Query parameters validation - REFACTORED: delegates to ValidationEngine
   */
  static validateQueryParams(
    context: HandlerContext,
    schema: ValidationSchema
  ): ApiResponse | null {
    const queryParams = context.event.queryStringParameters || {};
    return ValidationEngine.validateFields(queryParams, schema, 'query');
  }

  /**
   * Path parameters validation - REFACTORED: delegates to ValidationEngine
   */
  static validatePathParams(context: HandlerContext, schema: ValidationSchema): ApiResponse | null {
    const pathParams = context.event.pathParameters || {};
    return ValidationEngine.validateFields(pathParams, schema, 'params');
  }

  /**
   * Parsed request validation - REFACTORED: delegates to ValidationEngine
   */
  static validateParsedRequest(
    parsedData: any,
    schema: ValidationSchema,
    requestType: 'query' | 'body' | 'params'
  ): { error: ApiResponse | null; data: any } {
    const validationError = ValidationEngine.validateFields(parsedData, schema, requestType);
    return {
      error: validationError,
      data: parsedData,
    };
  }

  /**
   * Nested object validation - REFACTORED: delegates to ValidationEngine
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
   * Multiple schemas validation - REFACTORED: delegates to ValidationEngine
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

  // ===== CACHE MANAGEMENT =====
  // REFACTORED: delegates to ValidationCache component
  
  static clearValidationCache(): void {
    return ValidationCache.clearValidationCache();
  }

  static getCacheStats(): { size: number; hitRate: number } {
    return ValidationCache.getCacheStats();
  }

  // ===== VALIDATOR INTEGRATION =====
  // REFACTORED: delegates to ValidatorIntegration component
  
  static validatePasswordField(password: string): ValidationResult {
    return ValidatorIntegration.validatePasswordField(password);
  }

  static validateEmailField(email: string): ValidationResult {
    return ValidatorIntegration.validateEmailField(email);
  }

  static validateUserCreationField(userData: any): ValidationResult {
    return ValidatorIntegration.validateUserCreationField(userData);
  }

  static createPasswordValidationRule(field: string = 'password'): ValidationRule {
    return ValidatorIntegration.createPasswordValidationRule(field);
  }

  static createEmailValidationRule(field: string = 'email'): ValidationRule {
    return ValidatorIntegration.createEmailValidationRule(field);
  }

  static createUserCreationValidationRules(): ValidationRule[] {
    return ValidatorIntegration.createUserCreationValidationRules();
  }

  // ===== VALIDATION RULE METHODS =====
  // REFACTORED: delegates to ValidationRules component
  
  static stringLength(min: number, max?: number) {
    return ValidationRules.stringLength(min, max);
  }

  static numberRange(min: number, max?: number) {
    return ValidationRules.numberRange(min, max);
  }

  static alphanumericId() {
    return ValidationRules.alphanumericId();
  }

  static uuid() {
    return ValidationRules.uuid();
  }

  static email() {
    return ValidationRules.email();
  }

  static array(minItems?: number, maxItems?: number, itemValidator?: (item: any) => ValidationResult) {
    return ValidationRules.array(minItems, maxItems, itemValidator);
  }

  static boolean() {
    return ValidationRules.boolean();
  }

  static custom(validator: (value: any, context?: ValidationContext) => ValidationResult) {
    return ValidationRules.custom(validator);
  }

  static sessionType() {
    return ValidationRules.sessionType();
  }

  static sessionAction() {
    return ValidationRules.sessionAction();
  }

  static isoDate() {
    return ValidationRules.isoDate();
  }

  static float(min?: number, max?: number) {
    return ValidationRules.float(min, max);
  }

  static json() {
    return ValidationRules.json();
  }

  static url() {
    return ValidationRules.url();
  }

  static phoneNumber() {
    return ValidationRules.phoneNumber();
  }

  static fileExtension(allowedExtensions: string[]) {
    return ValidationRules.fileExtension(allowedExtensions);
  }

  static ipAddress() {
    return ValidationRules.ipAddress();
  }

  static hexColor() {
    return ValidationRules.hexColor();
  }

  static timeFormat() {
    return ValidationRules.timeFormat();
  }

  static creditCard() {
    return ValidationRules.creditCard();
  }

  static matchesField(fieldName: string) {
    return ValidationRules.matchesField(fieldName);
  }

  static coordinates() {
    return ValidationRules.coordinates();
  }

  static timezone() {
    return ValidationRules.timezone();
  }
}