// Validator Integration - Extracted from ValidationMiddleware monster class  
// Focused responsibility: Integrating standalone validators (PasswordValidator, UserValidator)
// Part of Objective 30 ValidationMiddleware decomposition

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ValidationRule<T = any> {
  field: string;
  validate: (value: T, context?: any) => ValidationResult;
}

/**
 * Focused ValidatorIntegration class for standalone validator integration
 * Contains the Phase 30 additions that were incorrectly added directly to ValidationMiddleware
 * Extracted to achieve SRP compliance
 */
export class ValidatorIntegration {

  // === ENHANCED VALIDATOR INTEGRATIONS ===
  // Integration with standalone validators to eliminate duplication

  /**
   * Validate password using enhanced PasswordValidator
   * Integrates sophisticated password validation with ValidationMiddleware
   */
  static validatePasswordField(password: string): ValidationResult {
    try {
      // Use PasswordValidator for comprehensive validation
      const { PasswordValidator } = require('../../validators/password.validator');
      const result = PasswordValidator.validate(password);
      
      if (result.isValid) {
        return { isValid: true };
      } else {
        return { isValid: false, error: result.errors[0] };
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Password validation service unavailable',
      };
    }
  }

  /**
   * Validate email using enhanced UserValidator
   * Integrates email validation with ValidationMiddleware
   */
  static validateEmailField(email: string): ValidationResult {
    try {
      // Use UserValidator for email validation
      const { UserValidator } = require('../../validators/user.validator');
      const result = UserValidator.validateEmail(email);
      
      if (result.isValid) {
        return { isValid: true };
      } else {
        return { isValid: false, error: result.errors[0] };
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Email validation service unavailable',
      };
    }
  }

  /**
   * Validate user creation data using UserValidator
   * Comprehensive validation for user registration
   */
  static validateUserCreationField(userData: any): ValidationResult {
    try {
      const { UserValidator } = require('../../validators/user.validator');
      
      // Validate required fields
      if (!userData.email) {
        return { isValid: false, error: 'Email is required' };
      }
      
      if (!userData.firstName) {
        return { isValid: false, error: 'First name is required' };
      }
      
      if (!userData.lastName) {
        return { isValid: false, error: 'Last name is required' };
      }

      // Use UserValidator for comprehensive validation
      const emailResult = UserValidator.validateEmail(userData.email);
      if (!emailResult.isValid) {
        return { isValid: false, error: `Email: ${emailResult.errors[0]}` };
      }

      const nameResult = UserValidator.validateName(userData.firstName, 'firstName');
      if (!nameResult.isValid) {
        return { isValid: false, error: `First name: ${nameResult.errors[0]}` };
      }

      const lastNameResult = UserValidator.validateName(userData.lastName, 'lastName');
      if (!lastNameResult.isValid) {
        return { isValid: false, error: `Last name: ${lastNameResult.errors[0]}` };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'User validation service unavailable',
      };
    }
  }

  // === VALIDATION RULE FACTORY METHODS ===

  /**
   * Create password validation rule using PasswordValidator
   */
  static createPasswordValidationRule(field: string = 'password'): ValidationRule {
    return {
      field,
      validate: (value: string) => ValidatorIntegration.validatePasswordField(value),
    };
  }

  /**
   * Create email validation rule using UserValidator
   */
  static createEmailValidationRule(field: string = 'email'): ValidationRule {
    return {
      field,
      validate: (value: string) => ValidatorIntegration.validateEmailField(value),
    };
  }

  /**
   * Create user creation validation rules
   * Returns array of rules for comprehensive user validation
   */
  static createUserCreationValidationRules(): ValidationRule[] {
    return [
      {
        field: 'email',
        validate: (value: string) => ValidatorIntegration.validateEmailField(value),
      },
      {
        field: 'firstName',
        validate: (value: string) => {
          if (!value || typeof value !== 'string') {
            return { isValid: false, error: 'First name is required' };
          }
          try {
            const { UserValidator } = require('../../validators/user.validator');
            const result = UserValidator.validateName(value, 'firstName');
            return result.isValid 
              ? { isValid: true }
              : { isValid: false, error: result.errors[0] };
          } catch (error) {
            return { isValid: false, error: 'Name validation service unavailable' };
          }
        },
      },
      {
        field: 'lastName',
        validate: (value: string) => {
          if (!value || typeof value !== 'string') {
            return { isValid: false, error: 'Last name is required' };
          }
          try {
            const { UserValidator } = require('../../validators/user.validator');
            const result = UserValidator.validateName(value, 'lastName');
            return result.isValid 
              ? { isValid: true }
              : { isValid: false, error: result.errors[0] };
          } catch (error) {
            return { isValid: false, error: 'Name validation service unavailable' };
          }
        },
      },
      {
        field: 'password',
        validate: (value: string) => ValidatorIntegration.validatePasswordField(value),
      },
    ];
  }

  /**
   * Create enhanced registration validation rule
   * Validates entire user object using integrated validators
   */
  static createRegistrationValidationRule(): ValidationRule {
    return {
      field: 'userData',
      validate: (userData: any) => ValidatorIntegration.validateUserCreationField(userData),
    };
  }

  /**
   * Validate password strength using PasswordValidator
   * Returns detailed strength information
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    strength: 'weak' | 'medium' | 'strong';
    feedback: string[];
    score: number;
  } {
    try {
      const { PasswordValidator } = require('../../validators/password.validator');
      const result = PasswordValidator.validate(password);
      
      // Basic strength assessment based on validation result
      if (!result.isValid) {
        return {
          isValid: false,
          strength: 'weak',
          feedback: result.errors,
          score: 0,
        };
      }
      
      // Calculate strength score (simplified)
      let score = 0;
      if (password.length >= 12) score += 2;
      else if (password.length >= 8) score += 1;
      
      if (/[A-Z]/.test(password)) score += 1;
      if (/[a-z]/.test(password)) score += 1;
      if (/\d/.test(password)) score += 1;
      if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
      
      const strength = score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
      
      return {
        isValid: true,
        strength,
        feedback: ['Password meets security requirements'],
        score,
      };
    } catch (error) {
      return {
        isValid: false,
        strength: 'weak',
        feedback: ['Password validation service unavailable'],
        score: 0,
      };
    }
  }

  /**
   * Check if validators are available and working
   */
  static validateIntegrationHealth(): {
    passwordValidator: boolean;
    userValidator: boolean;
    overallHealth: boolean;
  } {
    let passwordValidator = false;
    let userValidator = false;
    
    try {
      const { PasswordValidator } = require('../../validators/password.validator');
      // Test basic functionality
      const testResult = PasswordValidator.validate('test123');
      passwordValidator = typeof testResult === 'object' && 'isValid' in testResult;
    } catch (error) {
      passwordValidator = false;
    }
    
    try {
      const { UserValidator } = require('../../validators/user.validator');
      // Test basic functionality  
      const testResult = UserValidator.validateEmail('test@example.com');
      userValidator = typeof testResult === 'object' && 'isValid' in testResult;
    } catch (error) {
      userValidator = false;
    }
    
    return {
      passwordValidator,
      userValidator,
      overallHealth: passwordValidator && userValidator,
    };
  }
}