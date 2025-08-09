import * as bcrypt from 'bcryptjs';
import { Logger } from '../shared/logger';

/**
 * Password Service - Handles password hashing and validation
 */
export class PasswordService {
  private logger: Logger;
  private saltRounds: number;

  constructor() {
    this.logger = new Logger('PasswordService');
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    
    this.logger.debug('PasswordService initialized', {
      saltRounds: this.saltRounds
    });
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(password, this.saltRounds);
      
      this.logger.debug('Password hashed successfully');
      
      return hash;
    } catch (error: any) {
      this.logger.error('Failed to hash password', error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Validate a password against a hash
   */
  async validatePassword(password: string, hash: string): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(password, hash);
      
      this.logger.debug('Password validation completed', {
        isValid
      });
      
      return isValid;
    } catch (error: any) {
      this.logger.error('Failed to validate password', error);
      return false;
    }
  }

  /**
   * Check password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}