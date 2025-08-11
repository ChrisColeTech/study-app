// Authentication service for JWT and password management

import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { IUserService } from './user.service';
import { CreateUserRequest, UserResponse } from '../shared/types/user.types';
import { JwtPayload, LoginRequest, LoginResponse, AuthUser } from '../shared/types/auth.types';
import { createLogger } from '../shared/logger';

export interface IAuthService {
  registerUser(userData: CreateUserRequest): Promise<LoginResponse>;
  loginUser(loginData: LoginRequest): Promise<LoginResponse>;
  validateToken(token: string): Promise<JwtPayload>;
  refreshToken(refreshToken: string): Promise<LoginResponse>;
  logoutUser(token: string): Promise<void>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
}

export class AuthService implements IAuthService {
  private logger = createLogger({ component: 'AuthService' });
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private jwtExpiresIn: string;
  private jwtRefreshExpiresIn: string;
  private saltRounds = 12;

  constructor(private userService: IUserService) {
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (this.jwtSecret === 'default-secret-key' || this.jwtRefreshSecret === 'default-refresh-secret-key') {
      this.logger.warn('Using default JWT secrets - should be set via environment variables in production');
    }
  }

  /**
   * Register a new user and return authentication tokens
   */
  async registerUser(userData: CreateUserRequest): Promise<LoginResponse> {
    this.logger.info('Registering new user', { email: userData.email });

    try {
      // Validate password strength
      this.validatePassword(userData.password);

      // Hash password
      const passwordHash = await this.hashPassword(userData.password);

      // Create user
      const user = await this.userService.createUser(userData, passwordHash);

      // Generate authentication tokens
      const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user);

      const authUser: AuthUser = {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        roles: ['user'], // Default role
        permissions: [] // Will be populated based on roles in future phases
      };

      const loginResponse: LoginResponse = {
        user: authUser,
        accessToken,
        refreshToken,
        expiresIn
      };

      this.logger.info('User registered and authenticated successfully', { 
        userId: user.userId, 
        email: user.email 
      });

      return loginResponse;
    } catch (error) {
      this.logger.error('Registration failed', error as Error, { email: userData.email });
      throw error;
    }
  }

  /**
   * Authenticate user with email and password
   */
  async loginUser(loginData: LoginRequest): Promise<LoginResponse> {
    this.logger.info('User login attempt', { email: loginData.email });

    try {
      // Find user by email
      const user = await this.userService.getUserByEmail(loginData.email);
      if (!user || !user.isActive) {
        this.logger.warn('Login attempt with invalid email', { email: loginData.email });
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(loginData.password, user.passwordHash);
      if (!isPasswordValid) {
        this.logger.warn('Login attempt with invalid password', { 
          email: loginData.email,
          userId: user.userId 
        });
        throw new Error('Invalid email or password');
      }

      // Generate authentication tokens
      const userResponse = await this.userService.getUserById(user.userId);
      if (!userResponse) {
        throw new Error('User not found');
      }

      const { accessToken, refreshToken, expiresIn } = await this.generateTokens(userResponse);

      const authUser: AuthUser = {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        roles: ['user'], // Default role
        permissions: [] // Will be populated based on roles in future phases
      };

      const loginResponse: LoginResponse = {
        user: authUser,
        accessToken,
        refreshToken,
        expiresIn
      };

      this.logger.info('User authenticated successfully', { 
        userId: user.userId, 
        email: user.email 
      });

      return loginResponse;
    } catch (error) {
      this.logger.error('Login failed', error as Error, { email: loginData.email });
      throw error;
    }
  }

  /**
   * Validate JWT token
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
  async refreshToken(refreshTokenValue: string): Promise<LoginResponse> {
    this.logger.debug('Refreshing access token');

    try {
      const decoded = jwt.verify(refreshTokenValue, this.jwtRefreshSecret) as JwtPayload;
      
      // Get current user data
      const user = await this.userService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        this.logger.warn('Refresh token used for inactive user', { userId: decoded.userId });
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const { accessToken, refreshToken, expiresIn } = await this.generateTokens(user);

      const authUser: AuthUser = {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        roles: ['user'],
        permissions: []
      };

      const loginResponse: LoginResponse = {
        user: authUser,
        accessToken,
        refreshToken,
        expiresIn
      };

      this.logger.info('Access token refreshed successfully', { userId: user.userId });

      return loginResponse;
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

  /**
   * Hash password using bcrypt
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
   * Verify password against hash
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      this.logger.error('Password verification failed', error as Error);
      return false;
    }
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (!password) {
      throw new Error('Password is required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      throw new Error('Password must be 128 characters or less');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  /**
   * Logout user by invalidating token
   * In Phase 5, this will implement token blacklisting
   */
  async logoutUser(token: string): Promise<void> {
    try {
      // Validate the token first
      const decoded = await this.validateToken(token);
      
      this.logger.info('User logged out successfully', { 
        userId: decoded.userId,
        email: decoded.email 
      });

      // TODO: In Phase 5, implement token blacklisting using DynamoDB
      // For now, logout is handled client-side by removing the token
      // Future implementation will store blacklisted tokens in DynamoDB
      
    } catch (error) {
      this.logger.error('Logout failed', error as Error);
      throw new Error('Invalid token for logout');
    }
  }

  /**
   * Generate access and refresh tokens for a user
   */
  private async generateTokens(user: UserResponse): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
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
}