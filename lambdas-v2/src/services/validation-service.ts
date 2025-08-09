import * as Joi from 'joi';
import { Logger } from '../shared/logger';
import { ApiError, ErrorCode } from '../types';

/**
 * Validation Service - Centralized request validation using Joi
 */
export class ValidationService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ValidationService');
  }

  /**
   * User registration validation schema
   */
  public static readonly registerSchema = Joi.object({
    email: Joi.string()
      .email({ minDomainSegments: 2, tlds: { allow: true } })
      .required()
      .max(255)
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required',
        'string.max': 'Email must not exceed 255 characters'
      }),
    
    password: Joi.string()
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password must not exceed 128 characters',
        'any.required': 'Password is required'
      }),
    
    name: Joi.string()
      .min(1)
      .max(100)
      .optional()
      .trim()
      .messages({
        'string.min': 'Name must be at least 1 character long',
        'string.max': 'Name must not exceed 100 characters'
      })
  });

  /**
   * User login validation schema
   */
  public static readonly loginSchema = Joi.object({
    email: Joi.string()
      .email({ minDomainSegments: 2, tlds: { allow: true } })
      .required()
      .max(255)
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required',
        'string.max': 'Email must not exceed 255 characters'
      }),
    
    password: Joi.string()
      .min(1)
      .max(128)
      .required()
      .messages({
        'string.min': 'Password is required',
        'string.max': 'Password must not exceed 128 characters',
        'any.required': 'Password is required'
      })
  });

  /**
   * Refresh token validation schema
   */
  public static readonly refreshTokenSchema = Joi.object({
    refreshToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Refresh token is required'
      })
  });

  /**
   * Validate registration request
   */
  validateRegistration(data: any): void {
    const { error } = ValidationService.registerSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => detail.message);
      this.logger.warn('Registration validation failed', {
        errors: validationErrors,
        data: { email: data?.email } // Only log non-sensitive data
      });

      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        { errors: validationErrors }
      );
    }

    this.logger.debug('Registration validation passed');
  }

  /**
   * Validate login request
   */
  validateLogin(data: any): void {
    const { error } = ValidationService.loginSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => detail.message);
      this.logger.warn('Login validation failed', {
        errors: validationErrors,
        data: { email: data?.email } // Only log non-sensitive data
      });

      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        { errors: validationErrors }
      );
    }

    this.logger.debug('Login validation passed');
  }

  /**
   * Validate refresh token request
   */
  validateRefreshToken(data: any): void {
    const { error } = ValidationService.refreshTokenSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => detail.message);
      this.logger.warn('Refresh token validation failed', {
        errors: validationErrors
      });

      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        { errors: validationErrors }
      );
    }

    this.logger.debug('Refresh token validation passed');
  }

  /**
   * Generic validation method
   */
  validate<T>(schema: Joi.ObjectSchema, data: any): T {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => detail.message);
      this.logger.warn('Validation failed', {
        errors: validationErrors
      });

      throw new ApiError(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        { errors: validationErrors }
      );
    }

    return value as T;
  }
}