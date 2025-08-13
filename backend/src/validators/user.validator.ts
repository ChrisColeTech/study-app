// Dedicated user validation logic
// Extracted from UserService to eliminate mixed validation/business logic

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
    const { validateEmail } = require('../shared/middleware/validation.rules-library');
    const emailValidator = validateEmail();
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
    const { validateStringLength } = require('../shared/middleware/validation.rules-library');
    const lengthValidator = validateStringLength(1, 50);
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
    const emailResult = this.validateEmail(userData.email);
    allErrors.push(...emailResult.errors);

    // Validate firstName
    const firstNameResult = this.validateName(userData.firstName, 'First name');
    allErrors.push(...firstNameResult.errors);

    // Validate lastName
    const lastNameResult = this.validateName(userData.lastName, 'Last name');
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
      const firstNameResult = this.validateName(updateData.firstName, 'First name');
      allErrors.push(...firstNameResult.errors);
    }

    if (updateData.lastName !== undefined) {
      const lastNameResult = this.validateName(updateData.lastName, 'Last name');
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
    const result = this.validateCreateUser(userData);

    if (!result.isValid) {
      throw new Error(result.errors[0]); // Throw first error for backward compatibility
    }
  }

  /**
   * Validate and throw error if invalid (for backward compatibility)
   */
  static validateUpdateUserOrThrow(updateData: UpdateUserRequest): void {
    const result = this.validateUpdateUser(updateData);

    if (!result.isValid) {
      throw new Error(result.errors[0]); // Throw first error for backward compatibility
    }
  }

  /**
   * Validate email format and throw error if invalid (for backward compatibility)
   */
  static validateEmailOrThrow(email: string): void {
    const result = this.validateEmail(email);

    if (!result.isValid) {
      throw new Error(result.errors[0]); // Throw first error for backward compatibility
    }
  }

  /**
   * ValidationMiddleware-compatible email validation function
   */
  static getEmailValidationFunction() {
    return (email: string): { isValid: boolean; error?: string } => {
      const result = this.validateEmail(email);
      
      return {
        isValid: result.isValid,
        error: result.isValid ? undefined : result.errors[0],
      };
    };
  }

  /**
   * ValidationMiddleware-compatible name validation function
   */
  static getNameValidationFunction(fieldName: string) {
    return (name: string): { isValid: boolean; error?: string } => {
      const result = this.validateName(name, fieldName);
      
      return {
        isValid: result.isValid,
        error: result.isValid ? undefined : result.errors[0],
      };
    };
  }

  /**
   * Create validation rules compatible with ValidationMiddleware schema system
   */
  static createEmailValidationRule(field: string = 'email') {
    return {
      field,
      validate: this.getEmailValidationFunction(),
    };
  }

  /**
   * Create validation rules for name fields
   */
  static createNameValidationRule(field: string, displayName: string) {
    return {
      field,
      validate: this.getNameValidationFunction(displayName),
    };
  }

  /**
   * Create complete user creation validation rules
   */
  static createUserCreationRules() {
    return [
      this.createEmailValidationRule('email'),
      this.createNameValidationRule('firstName', 'First name'),
      this.createNameValidationRule('lastName', 'Last name'),
    ];
  }
}
