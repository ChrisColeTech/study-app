// Dedicated user validation logic
// Extracted from UserService to eliminate mixed validation/business logic
// Fixed static method context issue - forcing deployment

import { CreateUserRequest, UpdateUserRequest } from '../shared/types/user.types';

export interface UserValidationResult {
  isValid: boolean;
  errors: string[];
}

export class UserValidator {
  /**
   * Validate email format using ValidationRulesLibrary standard
   * Eliminates duplication with ValidationRules.email()
   */
  static validateEmail(email: string): UserValidationResult {
    // Use centralized email validation to eliminate duplication
    const { ValidationRules } = require('../shared/middleware/validation.middleware');
    const emailValidator = ValidationRules.email();
    const result = emailValidator(email);

    return {
      isValid: result.isValid,
      errors: result.isValid ? [] : [result.error!],
    };
  }

  /**
   * Validate name field (firstName or lastName)
   * Uses ValidationRulesLibrary for consistent string length validation
   */
  static validateName(name: string, fieldName: string): UserValidationResult {
    const errors: string[] = [];

    if (!name || !name.trim()) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    // Use centralized string length validation
    const { ValidationRules } = require('../shared/middleware/validation.middleware');
    const lengthValidator = ValidationRules.stringLength(1, 50);
    const lengthResult = lengthValidator(name.trim());

    if (!lengthResult.isValid) {
      errors.push(`${fieldName}: ${lengthResult.error}`);
    }

    // Validate name contains only letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(name.trim())) {
      errors.push(`${fieldName} contains invalid characters`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Comprehensive validation for user creation data
   */
  static validateCreateUser(userData: CreateUserRequest): UserValidationResult {
    const allErrors: string[] = [];

    // Validate email
    const emailResult = UserValidator.validateEmail(userData.email);
    allErrors.push(...emailResult.errors);

    // Validate firstName
    const firstNameResult = UserValidator.validateName(userData.firstName, 'First name');
    allErrors.push(...firstNameResult.errors);

    // Validate lastName
    const lastNameResult = UserValidator.validateName(userData.lastName, 'Last name');
    allErrors.push(...lastNameResult.errors);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * Validation for user update data (only validates provided fields)
   */
  static validateUpdateUser(updateData: UpdateUserRequest): UserValidationResult {
    const allErrors: string[] = [];

    // Only validate fields that are being updated
    if (updateData.firstName !== undefined) {
      const firstNameResult = UserValidator.validateName(updateData.firstName, 'First name');
      allErrors.push(...firstNameResult.errors);
    }

    if (updateData.lastName !== undefined) {
      const lastNameResult = UserValidator.validateName(updateData.lastName, 'Last name');
      allErrors.push(...lastNameResult.errors);
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /**
   * Validate and throw error if invalid (for backward compatibility)
   */
  static validateCreateUserOrThrow(userData: CreateUserRequest): void {
    const result = UserValidator.validateCreateUser(userData);

    if (!result.isValid) {
      throw new Error(result.errors[0]); // Throw first error for backward compatibility
    }
  }

  /**
   * Validate and throw error if invalid (for backward compatibility)
   */
  static validateUpdateUserOrThrow(updateData: UpdateUserRequest): void {
    const result = UserValidator.validateUpdateUser(updateData);

    if (!result.isValid) {
      throw new Error(result.errors[0]); // Throw first error for backward compatibility
    }
  }

  /**
   * Validate email format and throw error if invalid (for backward compatibility)
   */
  static validateEmailOrThrow(email: string): void {
    const result = UserValidator.validateEmail(email);

    if (!result.isValid) {
      throw new Error(result.errors[0]); // Throw first error for backward compatibility
    }
  }

  /**
   * ValidationMiddleware-compatible email validation function
   */
  static getEmailValidationFunction() {
    return (email: string): { isValid: boolean; error?: string } => {
      const result = UserValidator.validateEmail(email);
      
      if (result.isValid) {
        return { isValid: true };
      } else {
        return { isValid: false, error: result.errors[0] };
      }
    };
  }

  /**
   * ValidationMiddleware-compatible name validation function
   */
  static getNameValidationFunction(fieldName: string) {
    return (name: string): { isValid: boolean; error?: string } => {
      const result = UserValidator.validateName(name, fieldName);
      
      if (result.isValid) {
        return { isValid: true };
      } else {
        return { isValid: false, error: result.errors[0] };
      }
    };
  }

  /**
   * Create validation rules compatible with ValidationMiddleware schema system
   */
  static createEmailValidationRule(field: string = 'email') {
    return {
      field,
      validate: UserValidator.getEmailValidationFunction(),
    };
  }

  /**
   * Create validation rules for name fields
   */
  static createNameValidationRule(field: string, displayName: string) {
    return {
      field,
      validate: UserValidator.getNameValidationFunction(displayName),
    };
  }

  /**
   * Create complete user creation validation rules
   */
  static createUserCreationRules() {
    return [
      UserValidator.createEmailValidationRule('email'),
      UserValidator.createNameValidationRule('firstName', 'First name'),
      UserValidator.createNameValidationRule('lastName', 'Last name'),
    ];
  }
}
