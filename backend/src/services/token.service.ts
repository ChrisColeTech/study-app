// Dedicated JWT token management service
// Extracted from AuthService to follow Single Responsibility Principle

import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '../shared/types/auth.types';
import { UserResponse } from '../shared/types/user.types';
import { createLogger } from '../shared/logger';

export interface TokenGenerationResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ITokenService {
  generateTokens(user: UserResponse): Promise<TokenGenerationResult>;
  validateToken(token: string): Promise<JwtPayload>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>;
}

export class TokenService implements ITokenService {
  private logger = createLogger({ component: 'TokenService' });
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private jwtExpiresIn: string;
  private jwtRefreshExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (this.jwtSecret === 'default-secret-key' || this.jwtRefreshSecret === 'default-refresh-secret-key') {
      this.logger.warn('Using default JWT secrets - should be set via environment variables in production');
    }
  }

  /**
   * Generate access and refresh tokens for a user
   */
  async generateTokens(user: UserResponse): Promise<TokenGenerationResult> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.userId,
      email: user.email,
      aud: 'study-app-v3',
      iss: 'study-app-v3-auth'
    };

    const signOptions: SignOptions = { expiresIn: this.jwtExpiresIn as any };
    const refreshSignOptions: SignOptions = { expiresIn: this.jwtRefreshExpiresIn as any };

    const accessToken = jwt.sign(payload, this.jwtSecret, signOptions);
    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, refreshSignOptions);

    // Calculate expiration time in seconds
    const decoded = jwt.decode(accessToken) as JwtPayload;
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Validate JWT access token
   */
  async validateToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      
      this.logger.debug('Token validated successfully', { userId: decoded.userId });
      
      return decoded;
    } catch (error: any) {
      this.logger.warn('Token validation failed', { error: error.message });
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token validation failed');
      }
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenValue: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const decoded = jwt.verify(refreshTokenValue, this.jwtRefreshSecret) as JwtPayload;
      
      this.logger.debug('Refresh token validated successfully', { userId: decoded.userId });
      
      // Create new payload with same user data but fresh timestamps
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        userId: decoded.userId,
        email: decoded.email,
        aud: decoded.aud,
        iss: decoded.iss
      };

      const signOptions: SignOptions = { expiresIn: this.jwtExpiresIn as any };
      const refreshSignOptions: SignOptions = { expiresIn: this.jwtRefreshExpiresIn as any };

      const accessToken = jwt.sign(payload, this.jwtSecret, signOptions);
      const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, refreshSignOptions);

      // Calculate expiration time in seconds
      const decodedNew = jwt.decode(accessToken) as JwtPayload;
      const expiresIn = decodedNew.exp - Math.floor(Date.now() / 1000);

      return {
        accessToken,
        refreshToken,
        expiresIn
      };
    } catch (error: any) {
      this.logger.warn('Token refresh failed', { error: error.message });
      
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error('Token refresh failed');
      }
    }
  }
}