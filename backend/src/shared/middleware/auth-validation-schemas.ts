// Authentication validation schemas
// Phase 35: ValidationSchemas Decomposition

import { ValidationSchema } from './validation.middleware';
import { ValidationRules } from '../validation/validation-rules';

/**
 * Authentication validation schemas
 */
export class AuthValidationSchemas {
  /**
   * Schema for user registration request
   */
  static registerRequest(): ValidationSchema {
    return {
      required: ['email', 'password', 'firstName', 'lastName'],
      rules: [
        { field: 'email', validate: ValidationRules.email() },
        { field: 'password', validate: ValidationRules.stringLength(8, 128) },
        { field: 'firstName', validate: ValidationRules.stringLength(1, 50) },
        { field: 'lastName', validate: ValidationRules.stringLength(1, 50) },
        {
          field: 'password',
          validate: ValidationRules.custom((value: string) => {
            // Enhanced password validation
            const hasUpperCase = /[A-Z]/.test(value);
            const hasLowerCase = /[a-z]/.test(value);
            const hasNumbers = /\d/.test(value);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

            if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
              return {
                isValid: false,
                error: 'Password must contain uppercase, lowercase, number, and special character',
              };
            }
            return { isValid: true };
          }),
        },
      ],
    };
  }

  /**
   * Schema for user login request
   */
  static loginRequest(): ValidationSchema {
    return {
      required: ['email', 'password'],
      rules: [
        { field: 'email', validate: ValidationRules.email() },
        { field: 'password', validate: ValidationRules.stringLength(1, 128) },
      ],
    };
  }

  /**
   * Schema for refresh token request
   */
  static refreshTokenRequest(): ValidationSchema {
    return {
      required: ['refreshToken'],
      rules: [{ field: 'refreshToken', validate: ValidationRules.stringLength(1) }],
    };
  }
}