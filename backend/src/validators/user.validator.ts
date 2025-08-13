// Dedicated user validation logic
// Extracted from UserService to eliminate mixed validation/business logic

import { CreateUserRequest, UpdateUserRequest } from '../shared/types/user.types';

export interface UserValidationResult {
  isValid: boolean;
  errors: string[];
}

export class UserValidator {
  /**
   * Validate email format using standard regex
   */
  static validateEmail(email: string): UserValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
      return { isValid: false, errors: ['Email is required'] };
    }

    if (!emailRegex.test(email)) {
      return { isValid: false, errors: ['Invalid email format'] };
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Validate name field (firstName or lastName)
   */
  static validateName(name: string, fieldName: string): UserValidationResult {
    const errors: string[] = [];

    if (!name || !name.trim()) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    if (name.trim().length > 50) {
      errors.push(`${fieldName} must be 50 characters or less`);
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
}
