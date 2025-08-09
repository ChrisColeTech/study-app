import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
import { Logger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * JWT Service - V2
 * Centralized JWT token validation, generation, and refresh token management
 */
export class JwtService {
  private logger: Logger;
  private jwtSecret: string;
  private refreshSecret: string;

  constructor() {
    this.logger = new Logger('JwtService');
    this.jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret'; // TODO: Use Parameter Store
    this.refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret'; // TODO: Use Parameter Store
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
   * Generate access token
   */
  public generateAccessToken(userId: string, email: string, role?: string): string {
    const payload = {
      userId,
      email,
      role,
      iat: Math.floor(Date.now() / 1000),
      tokenId: uuidv4() // For token revocation if needed
    };

    const expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
    
    const token = jwt.sign(payload, this.jwtSecret, { expiresIn } as jwt.SignOptions);
    
    this.logger.debug('Access token generated', {
      userId,
      email,
      expiresIn
    });

    return token;
  }

  /**
   * Generate refresh token
   */
  public generateRefreshToken(userId: string): string {
    const payload = {
      userId,
      tokenType: 'refresh',
      tokenId: uuidv4(),
      iat: Math.floor(Date.now() / 1000)
    };

    const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    
    const token = jwt.sign(payload, this.refreshSecret, { expiresIn } as jwt.SignOptions);
    
    this.logger.debug('Refresh token generated', {
      userId,
      expiresIn
    });

    return token;
  }

  /**
   * Generate both access and refresh tokens
   */
  public generateTokenPair(userId: string, email: string, role?: string): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const accessToken = this.generateAccessToken(userId, email, role);
    const refreshToken = this.generateRefreshToken(userId);
    
    // Parse expiration from environment or default to 15 minutes
    const expiresInStr = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
    const expiresIn = this.parseExpirationTime(expiresInStr);

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Validate refresh token
   */
  public validateRefreshToken(token: string): { isValid: boolean; userId?: string; error?: string } {
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, '');

      if (!cleanToken) {
        return { isValid: false, error: 'Refresh token is empty' };
      }

      const decoded = jwt.verify(cleanToken, this.refreshSecret) as any;

      // Validate required fields
      if (!decoded.userId || decoded.tokenType !== 'refresh') {
        return { isValid: false, error: 'Invalid refresh token format' };
      }

      // Check expiration
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        return { isValid: false, error: 'Refresh token has expired' };
      }

      this.logger.debug('Refresh token validated successfully', {
        userId: decoded.userId
      });

      return { isValid: true, userId: decoded.userId };

    } catch (error) {
      let errorMessage = 'Refresh token validation failed';
      
      if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid refresh token format';
      } else if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Refresh token has expired';
      }

      this.logger.warn('Refresh token validation failed', {
        error: error instanceof Error ? error.message : error
      });

      return { isValid: false, error: errorMessage };
    }
  }

  /**
   * Parse expiration time string to seconds
   */
  private parseExpirationTime(expiresIn: string): number {
    const timeUnit = expiresIn.slice(-1);
    const timeValue = parseInt(expiresIn.slice(0, -1), 10);

    switch (timeUnit) {
      case 's': return timeValue;
      case 'm': return timeValue * 60;
      case 'h': return timeValue * 60 * 60;
      case 'd': return timeValue * 24 * 60 * 60;
      default: return 900; // Default 15 minutes
    }
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