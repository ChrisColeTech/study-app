import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
import { Logger } from '../shared/logger';

/**
 * JWT Service - V2
 * Centralized JWT token validation and user context extraction
 */
export class JwtService {
  private logger: Logger;
  private jwtSecret: string;

  constructor() {
    this.logger = new Logger('JwtService');
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret'; // TODO: Use Parameter Store
  }

  /**
   * Validate JWT token and extract user context
   */
  public validateToken(token: string): { isValid: boolean; payload?: JwtPayload; error?: string } {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');

      if (!cleanToken) {
        return { isValid: false, error: 'Token is empty' };
      }

      // Verify and decode token
      const decoded = jwt.verify(cleanToken, this.jwtSecret) as JwtPayload;

      // Validate required fields
      if (!decoded.userId || !decoded.email) {
        return { isValid: false, error: 'Token missing required fields' };
      }

      // Check expiration
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return { isValid: false, error: 'Token has expired' };
      }

      this.logger.debug('Token validated successfully', {
        userId: decoded.userId,
        email: decoded.email,
        exp: decoded.exp
      });

      return { isValid: true, payload: decoded };

    } catch (error) {
      let errorMessage = 'Token validation failed';
      
      if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid token format';
      } else if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token has expired';
      } else if (error instanceof jwt.NotBeforeError) {
        errorMessage = 'Token not active yet';
      }

      this.logger.warn('Token validation failed', {
        error: error instanceof Error ? error.message : error,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });

      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Generate JWT token for testing purposes
   */
  public generateToken(userId: string, email: string, expiresIn: string = '24h'): string {
    const payload = {
      userId,
      email,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn });
  }

  /**
   * Extract user ID from token without full validation (for logging)
   */
  public extractUserIdUnsafe(token: string): string | null {
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      const decoded = jwt.decode(cleanToken) as JwtPayload;
      return decoded?.userId || null;
    } catch {
      return null;
    }
  }
}