// Refactored authentication service using focused services and standardized error handling
// Eliminates multiple responsibilities: now coordinates authentication flow only

import { BaseService } from '../shared/base-service';
import { IUserService } from './user.service';
import { IPasswordService, PasswordService } from './password.service';
import { ITokenService, TokenService } from './token.service';
import { CreateUserRequest } from '../shared/types/user.types';
import { JwtPayload, LoginRequest, LoginResponse } from '../shared/types/auth.types';
import { PasswordValidator } from '../validators/password.validator';
import { AuthMapper } from '../mappers/auth.mapper';

export interface IAuthService {
  registerUser(userData: CreateUserRequest): Promise<LoginResponse>;
  loginUser(loginData: LoginRequest): Promise<LoginResponse>;
  validateToken(token: string): Promise<JwtPayload>;
  refreshToken(refreshToken: string): Promise<LoginResponse>;
  logoutUser(token: string): Promise<void>;
}

export class AuthService extends BaseService implements IAuthService {
  private passwordService: IPasswordService;
  private tokenService: ITokenService;

  constructor(private userService: IUserService) {
    super();
    this.passwordService = new PasswordService();
    this.tokenService = new TokenService();
  }

  /**
   * Register a new user and return authentication tokens
   */
  async registerUser(userData: CreateUserRequest): Promise<LoginResponse> {
    return this.executeWithErrorHandling(
      async () => {
        // Validate password strength using dedicated validator
        PasswordValidator.validateOrThrow(userData.password);

        // Hash password using dedicated service
        const passwordHash = await this.passwordService.hashPassword(userData.password);

        // Create user
        const user = await this.userService.createUser(userData, passwordHash);

        // Generate authentication tokens using dedicated service
        const tokens = await this.tokenService.generateTokens(user);

        // Create login response using dedicated mapper
        const loginResponse = AuthMapper.createLoginResponse(user, tokens);

        this.logSuccess('User registered and authenticated successfully', {
          userId: user.userId,
          email: user.email,
        });

        return loginResponse;
      },
      {
        operation: 'register user',
        entityType: 'User',
        requestData: { email: userData.email },
      }
    );
  }

  /**
   * Authenticate user with email and password
   */
  async loginUser(loginData: LoginRequest): Promise<LoginResponse> {
    return this.executeWithErrorHandling(
      async () => {
        // Find user by email
        const user = await this.userService.getUserByEmail(loginData.email);
        if (!user || !user.isActive) {
          this.logWarning('Login attempt with invalid email', { email: loginData.email });
          throw this.createBusinessError('Invalid email or password');
        }

        // Verify password using dedicated service
        const isPasswordValid = await this.passwordService.verifyPassword(
          loginData.password,
          user.passwordHash
        );
        if (!isPasswordValid) {
          this.logWarning('Login attempt with invalid password', {
            email: loginData.email,
            userId: user.userId,
          });
          throw this.createBusinessError('Invalid email or password');
        }

        // Get full user response for token generation
        const userResponse = await this.userService.getUserById(user.userId);
        this.validateEntityExists(userResponse, 'User', user.userId);

        // Generate authentication tokens using dedicated service
        const tokens = await this.tokenService.generateTokens(userResponse!);

        // Create login response using dedicated mapper
        const loginResponse = AuthMapper.createLoginResponse(userResponse!, tokens);

        this.logSuccess('User authenticated successfully', {
          userId: user.userId,
          email: user.email,
        });

        return loginResponse;
      },
      {
        operation: 'authenticate user',
        entityType: 'User',
        requestData: { email: loginData.email },
      }
    );
  }

  /**
   * Validate JWT token using dedicated service
   */
  async validateToken(token: string): Promise<JwtPayload> {
    return await this.tokenService.validateToken(token);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenValue: string): Promise<LoginResponse> {
    this.logger.debug('Refreshing access token');

    try {
      // Validate refresh token and get new tokens using dedicated service
      const tokenData = await this.tokenService.refreshToken(refreshTokenValue);

      // Extract user ID from the refresh token to get current user data
      const decoded = await this.tokenService.validateToken(tokenData.accessToken);

      // Get current user data to ensure user is still active
      const user = await this.userService.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        this.logWarning('Refresh token used for inactive user', { userId: decoded.userId });
        throw this.createBusinessError('User not found or inactive');
      }

      // Create login response using dedicated mapper
      const loginResponse = AuthMapper.createLoginResponse(user, tokenData);

      this.logger.info('Access token refreshed successfully', { userId: user.userId });

      return loginResponse;
    } catch (error: any) {
      this.logger.warn('Token refresh failed', { error: error.message });
      throw error; // Let the TokenService handle specific error types
    }
  }

  /**
   * Logout user by invalidating token
   * In Phase 5, this will implement token blacklisting
   */
  async logoutUser(token: string): Promise<void> {
    try {
      // Validate the token first using dedicated service
      const decoded = await this.tokenService.validateToken(token);

      this.logger.info('User logged out successfully', {
        userId: decoded.userId,
        email: decoded.email,
      });

      // TODO: In Phase 5, implement token blacklisting using DynamoDB
      // For now, logout is handled client-side by removing the token
      // Future implementation will store blacklisted tokens in DynamoDB
    } catch (error) {
      this.logger.error('Logout failed', error as Error);
      throw new Error('Invalid token for logout');
    }
  }
}
