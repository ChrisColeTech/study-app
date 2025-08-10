// Authentication handler for user registration and login

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { CreateUserRequest } from '../shared/types/user.types';
import { LoginRequest } from '../shared/types/auth.types';

export class AuthHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'AuthHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      // User registration endpoint
      {
        method: 'POST',
        path: '/auth/register',
        handler: this.register.bind(this),
        requireAuth: false, // Public endpoint
      },
      // User login endpoint
      {
        method: 'POST',
        path: '/auth/login',
        handler: this.login.bind(this),
        requireAuth: false, // Public endpoint
      },
      // Token refresh endpoint
      {
        method: 'POST',
        path: '/auth/refresh',
        handler: this.refresh.bind(this),
        requireAuth: false, // Public endpoint (uses refresh token)
      },
    ];
  }

  /**
   * User registration endpoint
   */
  private async register(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('User registration attempt', { 
        requestId: context.requestId,
        userAgent: context.event.headers['User-Agent'],
      });

      // Parse request body
      const userData = this.parseBody<CreateUserRequest>(context);
      if (!userData) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Request body is required'
        );
      }

      // Validate required fields
      if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
        this.logger.warn('Registration attempt with missing fields', { 
          requestId: context.requestId,
          hasEmail: !!userData.email,
          hasPassword: !!userData.password,
          hasFirstName: !!userData.firstName,
          hasLastName: !!userData.lastName,
        });

        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Missing required fields: email, password, firstName, lastName'
        );
      }

      // Register user
      const authService = this.serviceFactory.getAuthService();
      const result = await authService.registerUser(userData);

      this.logger.info('User registered successfully', { 
        requestId: context.requestId,
        userId: result.user.userId,
        email: result.user.email,
      });

      return this.success(result, 'User registered successfully');

    } catch (error: any) {
      this.logger.error('Registration failed', error, { 
        requestId: context.requestId,
        email: context.event.body ? JSON.parse(context.event.body)?.email : 'unknown'
      });

      // Handle specific error types
      if (error.message.includes('already exists')) {
        return this.error(
          ERROR_CODES.CONFLICT,
          error.message
        );
      }

      if (error.message.includes('Invalid email') || 
          error.message.includes('Password must') ||
          error.message.includes('required') ||
          error.message.includes('invalid characters')) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          error.message
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Registration failed'
      );
    }
  }

  /**
   * User login endpoint
   */
  private async login(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('User login attempt', { 
        requestId: context.requestId,
        userAgent: context.event.headers['User-Agent'],
      });

      // Parse request body
      const loginData = this.parseBody<LoginRequest>(context);
      if (!loginData) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Request body is required'
        );
      }

      // Validate required fields
      if (!loginData.email || !loginData.password) {
        this.logger.warn('Login attempt with missing fields', { 
          requestId: context.requestId,
          hasEmail: !!loginData.email,
          hasPassword: !!loginData.password,
        });

        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Email and password are required'
        );
      }

      // Authenticate user
      const authService = this.serviceFactory.getAuthService();
      const result = await authService.loginUser(loginData);

      this.logger.info('User logged in successfully', { 
        requestId: context.requestId,
        userId: result.user.userId,
        email: result.user.email,
      });

      return this.success(result, 'Login successful');

    } catch (error: any) {
      this.logger.error('Login failed', error, { 
        requestId: context.requestId,
        email: context.event.body ? JSON.parse(context.event.body)?.email : 'unknown'
      });

      // Handle specific error types
      if (error.message.includes('Invalid email or password')) {
        return this.error(
          ERROR_CODES.UNAUTHORIZED,
          'Invalid email or password'
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Login failed'
      );
    }
  }

  /**
   * Token refresh endpoint
   */
  private async refresh(context: HandlerContext): Promise<ApiResponse> {
    try {
      this.logger.info('Token refresh attempt', { 
        requestId: context.requestId,
      });

      // Parse request body
      const refreshData = this.parseBody<{ refreshToken: string }>(context);
      if (!refreshData || !refreshData.refreshToken) {
        return this.error(
          ERROR_CODES.VALIDATION_ERROR,
          'Refresh token is required'
        );
      }

      // Refresh token
      const authService = this.serviceFactory.getAuthService();
      const result = await authService.refreshToken(refreshData.refreshToken);

      this.logger.info('Token refreshed successfully', { 
        requestId: context.requestId,
        userId: result.user.userId,
      });

      return this.success(result, 'Token refreshed successfully');

    } catch (error: any) {
      this.logger.error('Token refresh failed', error, { 
        requestId: context.requestId,
      });

      // Handle specific error types
      if (error.message.includes('expired') || error.message.includes('Invalid')) {
        return this.error(
          ERROR_CODES.UNAUTHORIZED,
          'Invalid or expired refresh token'
        );
      }

      return this.error(
        ERROR_CODES.INTERNAL_ERROR,
        'Token refresh failed'
      );
    }
  }
}

// Export handler function for Lambda
const authHandler = new AuthHandler();
export const handler = authHandler.handle;