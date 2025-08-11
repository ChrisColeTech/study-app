// Dedicated password validation logic
// Extracted from AuthService to eliminate mixed validation/business logic

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PasswordValidator {
  
  /**
   * Comprehensive password strength validation
   */
  static validate(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password) {
      return {
        isValid: false,
        errors: ['Password is required']
      };
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be 128 characters or less');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate password and throw error if invalid (for backward compatibility)
   */
  static validateOrThrow(password: string): void {
    const result = this.validate(password);
    
    if (!result.isValid) {
      throw new Error(result.errors[0]); // Throw first error for backward compatibility
    }
  }
}