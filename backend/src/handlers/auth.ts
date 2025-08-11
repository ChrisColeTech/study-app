// Refactored Authentication handler using middleware pattern
// Eliminates architecture violations: mixed concerns, repetitive validation patterns

import { BaseHandler, RouteConfig } from '../shared/base-handler';
import { HandlerContext, ApiResponse } from '../shared/types/api.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { ERROR_CODES } from '../shared/constants/error.constants';
import { CreateUserRequest } from '../shared/types/user.types';
import { LoginRequest } from '../shared/types/auth.types';

// Import new middleware
import {
  ParsingMiddleware,
  ValidationMiddleware,
  ValidationRules,
  ErrorHandlingMiddleware,
  AuthMiddleware,
  ErrorContexts,
  CommonParsing
} from '../shared/middleware';

export class AuthHandler extends BaseHandler {
  private serviceFactory: ServiceFactory;
  private logger = createLogger({ handler: 'AuthHandler' });

  constructor() {
    super();
    this.serviceFactory = ServiceFactory.getInstance();
  }

  protected setupRoutes(): void {
    this.routes = [
      {
        method: 'POST',
        path: '/v1/auth/register',
        handler: this.register.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/auth/login',
        handler: this.login.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/auth/refresh',
        handler: this.refresh.bind(this),
        requireAuth: false,
      },
      {
        method: 'POST',
        path: '/v1/auth/logout',
        handler: this.logout.bind(this),
        requireAuth: false,
      },
    ];
  }

  /**
   * User registration endpoint - now clean and focused
   */
  private async register(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: userData, error: parseError } = ParsingMiddleware.parseRequestBody<CreateUserRequest>(context, true);
    if (parseError) return parseError;

    // Validate using middleware - just check required fields here, detailed validation in service
    if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Missing required fields: email, password, firstName, lastName'
      );
    }

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const authService = this.serviceFactory.getAuthService();
        return await authService.registerUser(userData);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Auth.REGISTER,
        additionalInfo: { email: userData.email }
      }
    );

    if (error) return error;

    this.logger.info('User registered successfully', {
      requestId: context.requestId,
      userId: result!.user.userId,
      email: result!.user.email,
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'User registered successfully');
  }

  /**
   * User login endpoint - now clean and focused
   */
  private async login(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: loginData, error: parseError } = ParsingMiddleware.parseRequestBody<LoginRequest>(context, true);
    if (parseError) return parseError;

    // Validate using middleware - just check required fields here
    if (!loginData.email || !loginData.password) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Email and password are required'
      );
    }

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const authService = this.serviceFactory.getAuthService();
        return await authService.loginUser(loginData);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Auth.LOGIN,
        additionalInfo: { email: loginData.email }
      }
    );

    if (error) return error;

    this.logger.info('User logged in successfully', {
      requestId: context.requestId,
      userId: result!.user.userId,
      email: result!.user.email,
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Login successful');
  }

  /**
   * Token refresh endpoint - now clean and focused
   */
  private async refresh(context: HandlerContext): Promise<ApiResponse> {
    // Parse and validate request body using middleware
    const { data: refreshData, error: parseError } = ParsingMiddleware.parseRequestBody<{ refreshToken: string }>(context, true);
    if (parseError) return parseError;

    // Validate using middleware - just check required fields here
    if (!refreshData.refreshToken) {
      return ErrorHandlingMiddleware.createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Refresh token is required'
      );
    }

    // Business logic only - delegate error handling to middleware
    const { result, error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const authService = this.serviceFactory.getAuthService();
        return await authService.refreshToken(refreshData.refreshToken);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Auth.REFRESH
      }
    );

    if (error) return error;

    this.logger.info('Token refreshed successfully', {
      requestId: context.requestId,
      userId: result!.user.userId,
    });

    return ErrorHandlingMiddleware.createSuccessResponse(result, 'Token refreshed successfully');
  }

  /**
   * User logout endpoint - now clean and focused
   */
  private async logout(context: HandlerContext): Promise<ApiResponse> {
    // Extract token using middleware
    const { token, error: tokenError } = AuthMiddleware.extractToken(context);
    if (tokenError) return tokenError;

    // Business logic only - delegate error handling to middleware
    const { error } = await ErrorHandlingMiddleware.withErrorHandling(
      async () => {
        const authService = this.serviceFactory.getAuthService();
        await authService.logoutUser(token!);
      },
      {
        requestId: context.requestId,
        operation: ErrorContexts.Auth.LOGOUT
      }
    );

    if (error) return error;

    this.logger.info('User logged out successfully', {
      requestId: context.requestId,
    });

    return ErrorHandlingMiddleware.createSuccessResponse(
      { message: 'Logged out successfully' }, 
      'Logout successful'
    );
  }
}

// Export handler function for Lambda
const authHandler = new AuthHandler();
export const handler = authHandler.handle;