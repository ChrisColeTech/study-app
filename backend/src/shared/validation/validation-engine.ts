// Validation Engine - Core orchestration for ValidationMiddleware decomposition
// Focused responsibility: Coordinating validation components and workflow
// Part of Objective 30 ValidationMiddleware decomposition

import { ValidationRules, ValidationResult, ValidationContext } from './validation-rules';
import { ValidationCache } from './validation-cache';
import { ValidationErrorFormatter } from './validation-error-formatter';
import { ValidatorIntegration } from './validator-integration';
import { ApiResponse } from '../types/api.types';

export interface ValidationRule<T = any> {
  field: string;
  validate: (value: T, context?: ValidationContext) => ValidationResult;
}

// Support the existing ValidationSchema format used by ValidationMiddleware
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
 * Core ValidationEngine class that orchestrates all validation components
 * Replaces the monster ValidationMiddleware logic with focused delegation
 */
export class ValidationEngine {
  
  /**
   * Validate fields against schema rules (compatible with existing ValidationMiddleware format)
   */
  static validateFields(
    fields: Record<string, any>,
    schema: ValidationSchema,
    requestType: 'query' | 'body' | 'params' = 'body'
  ): ApiResponse | null {
    // Check cache if enabled
    if (ValidationCache.isCachingEnabled()) {
      const schemaRuleFields = schema.rules.map(rule => rule.field);
      const cacheKey = ValidationCache.generateCacheKey(fields, schemaRuleFields);
      const cachedResult = ValidationCache.getCachedValidation(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    // First check required fields
    if (schema.required) {
      const missingFields = schema.required.filter(
        field => fields[field] === undefined || fields[field] === null || fields[field] === ''
      );
      
      if (missingFields.length > 0) {
        const error = ValidationErrorFormatter.createMissingRequiredFieldsResponse(
          missingFields,
          requestType
        );
        
        // Cache the result
        if (ValidationCache.isCachingEnabled()) {
          const schemaRuleFields = schema.rules.map(rule => rule.field);
          const cacheKey = ValidationCache.generateCacheKey(fields, schemaRuleFields);
          ValidationCache.cacheValidation(cacheKey, error);
        }
        
        return error;
      }
    }

    // Validate fields using rules
    const context: ValidationContext = {
      allFields: fields,
      requestType,
    };

    for (const rule of schema.rules) {
      const fieldValue = fields[rule.field];
      
      // Skip validation if field is not present
      if (fieldValue === undefined || fieldValue === null) {
        continue;
      }

      const result = rule.validate(fieldValue, context);
      if (!result.isValid) {
        const error = ValidationErrorFormatter.createFieldErrorResponse(
          rule.field,
          result.error || `Invalid ${rule.field}`,
          requestType
        );
        
        // Cache the result
        if (ValidationCache.isCachingEnabled()) {
          const schemaRuleFields = schema.rules.map(rule => rule.field);
          const cacheKey = ValidationCache.generateCacheKey(fields, schemaRuleFields);
          ValidationCache.cacheValidation(cacheKey, error);
        }
        
        return error;
      }
    }

    // No validation errors
    const result = null;
    
    // Cache the successful result
    if (ValidationCache.isCachingEnabled()) {
      const schemaRuleFields = schema.rules.map(rule => rule.field);
      const cacheKey = ValidationCache.generateCacheKey(fields, schemaRuleFields);
      ValidationCache.cacheValidation(cacheKey, result);
    }

    return result;
  }

  /**
   * Validate required fields exist
   */
  static validateRequiredFields(
    fields: Record<string, any>,
    requiredFields: string[],
    requestType: 'query' | 'body' | 'params' = 'body'
  ): ApiResponse | null {
    const missingFields = requiredFields.filter(
      field => fields[field] === undefined || fields[field] === null || fields[field] === ''
    );

    if (missingFields.length > 0) {
      return ValidationErrorFormatter.createMissingRequiredFieldsResponse(
        missingFields,
        requestType
      );
    }

    return null;
  }

  /**
   * Create common validation schemas using ValidationRules
   */
  static createCommonSchemas() {
    return {
      // User registration schema
      userRegistration: {
        email: { field: 'email', validate: ValidationRules.email() },
        password: { field: 'password', validate: ValidatorIntegration.validatePasswordField },
        firstName: { field: 'firstName', validate: ValidationRules.stringLength(1, 50) },
        lastName: { field: 'lastName', validate: ValidationRules.stringLength(1, 50) },
      },

      // User login schema  
      userLogin: {
        email: { field: 'email', validate: ValidationRules.email() },
        password: { field: 'password', validate: ValidationRules.stringLength(1) },
      },

      // Session creation schema
      sessionCreation: {
        type: { field: 'type', validate: ValidationRules.sessionType() },
        providerId: { field: 'providerId', validate: ValidationRules.uuid() },
        topicId: { field: 'topicId', validate: ValidationRules.uuid() },
      },

      // Session update schema
      sessionUpdate: {
        action: { field: 'action', validate: ValidationRules.sessionAction() },
        data: { field: 'data', validate: ValidationRules.json() },
      },

      // ID parameter schema
      idParam: {
        id: { field: 'id', validate: ValidationRules.uuid() },
      },

      // Pagination schema
      pagination: {
        page: { field: 'page', validate: ValidationRules.numberRange(1) },
        limit: { field: 'limit', validate: ValidationRules.numberRange(1, 100) },
      },
    };
  }

  /**
   * Enhanced validation with integrated validators
   */
  static validateWithIntegratedValidators(
    fields: Record<string, any>,
    validationType: 'registration' | 'login' | 'password' | 'email'
  ): ApiResponse | null {
    switch (validationType) {
      case 'registration':
        return this.validateUserRegistration(fields);
      
      case 'login':
        return this.validateUserLogin(fields);
        
      case 'password':
        const passwordResult = ValidatorIntegration.validatePasswordField(fields.password);
        return passwordResult.isValid ? null : 
          ValidationErrorFormatter.createFieldErrorResponse('password', passwordResult.error!);
          
      case 'email':
        const emailResult = ValidatorIntegration.validateEmailField(fields.email);
        return emailResult.isValid ? null :
          ValidationErrorFormatter.createFieldErrorResponse('email', emailResult.error!);
          
      default:
        return ValidationErrorFormatter.createStandardErrorResponse(
          'Unknown validation type'
        );
    }
  }

  /**
   * Validate user registration with integrated validators
   */
  private static validateUserRegistration(userData: any): ApiResponse | null {
    const registrationResult = ValidatorIntegration.validateUserCreationField(userData);
    
    if (!registrationResult.isValid) {
      return ValidationErrorFormatter.createStandardErrorResponse(
        registrationResult.error!
      );
    }

    return null;
  }

  /**
   * Validate user login
   */
  private static validateUserLogin(loginData: any): ApiResponse | null {
    const requiredFields = ['email', 'password'];
    const requiredFieldsError = this.validateRequiredFields(loginData, requiredFields);
    
    if (requiredFieldsError) {
      return requiredFieldsError;
    }

    const emailResult = ValidatorIntegration.validateEmailField(loginData.email);
    if (!emailResult.isValid) {
      return ValidationErrorFormatter.createFieldErrorResponse('email', emailResult.error!);
    }

    return null;
  }

  /**
   * Health check for validation system
   */
  static healthCheck(): {
    validationEngine: boolean;
    validationRules: boolean;
    validationCache: boolean;
    validatorIntegration: boolean;
    overallHealth: boolean;
  } {
    let validationEngine = true;
    let validationRules = true;
    let validationCache = true;
    
    try {
      // Test ValidationRules
      ValidationRules.email()('test@example.com');
      validationRules = true;
    } catch (error) {
      validationRules = false;
    }

    try {
      // Test ValidationCache
      ValidationCache.isCachingEnabled();
      validationCache = true;
    } catch (error) {
      validationCache = false;
    }

    const integrationHealth = ValidatorIntegration.validateIntegrationHealth();
    
    return {
      validationEngine,
      validationRules,
      validationCache,
      validatorIntegration: integrationHealth.overallHealth,
      overallHealth: validationEngine && validationRules && validationCache && integrationHealth.overallHealth,
    };
  }
}