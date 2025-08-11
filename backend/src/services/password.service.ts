// Dedicated password management service
// Extracted from AuthService to follow Single Responsibility Principle

import * as bcrypt from 'bcryptjs';
import { createLogger } from '../shared/logger';

export interface IPasswordService {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
}

export class PasswordService implements IPasswordService {
  private logger = createLogger({ component: 'PasswordService' });
  private saltRounds = 12;

  /**
   * Hash password using bcrypt with configurable salt rounds
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      this.logger.error('Password hashing failed', error as Error);
      throw new Error('Password processing failed');
    }
  }

  /**
   * Verify password against hash using bcrypt
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      this.logger.error('Password verification failed', error as Error);
      return false;
    }
  }
}