import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { UserService } from '../services/user-service';
import { PasswordService } from '../services/password-service';
import { JwtService } from '../services/jwt-service';
import { ValidationService } from '../services/validation-service';
import { 
  UserRegistrationRequest, 
  UserLoginRequest, 
  AuthResponse, 
  RefreshTokenRequest,
  ApiError,
  ErrorCode
} from '../types';

/**
 * Auth Handler - Real JWT token generation and user authentication with DynamoDB
 */
class AuthHandler extends BaseHandler {
  private userService: UserService;
  private passwordService: PasswordService;
  private jwtService: JwtService;
  private validationService: ValidationService;

  constructor() {
    super('AuthHandler');
    this.userService = new UserService();
    this.passwordService = new PasswordService();
    this.jwtService = new JwtService();
    this.validationService = new ValidationService();
  }

  /**
   * Handle user registration - POST /auth/register
   */
  public async register(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const requestId = event.requestContext.requestId;
    
    try {
      // Parse and validate request body
      const body = this.parseJsonBody<UserRegistrationRequest>(event);
      if (!body) {
        return this.error('Request body is required', ErrorCode.VALIDATION_ERROR);
      }

      this.validationService.validateRegistration(body);

      // Validate password strength
      const passwordStrength = this.passwordService.validatePasswordStrength(body.password);
      if (!passwordStrength.isValid) {
        return this.error('Password does not meet requirements', ErrorCode.VALIDATION_ERROR, {
          errors: passwordStrength.errors
        });
      }

      // Check if user already exists
      const existingUser = await this.userService.findUserByEmail(body.email);
      if (existingUser) {
        return this.error('User with this email already exists', ErrorCode.VALIDATION_ERROR);
      }

      // Hash password
      const passwordHash = await this.passwordService.hashPassword(body.password);

      // Create user
      const user = await this.userService.createUser({
        email: body.email,
        passwordHash,
        name: body.name
      });

      // Generate tokens
      const { accessToken, refreshToken, expiresIn } = this.jwtService.generateTokenPair(
        user.userId,
        user.email,
        user.role
      );

      // Update last login
      await this.userService.updateLastLogin(user.userId);

      const response: AuthResponse = {
        user,
        token: accessToken,
        refreshToken,
        expiresIn
      };

      this.logger.info(`[${requestId}] User registration successful`, {
        userId: user.userId,
        email: user.email
      });

      return this.created(response, 'User registered successfully');

    } catch (error) {
      if (error instanceof ApiError) {
        return this.error(error.message, error.code, error.details);
      }
      
      this.logger.error(`[${requestId}] Registration failed`, error);
      return this.error('Registration failed', ErrorCode.INTERNAL_ERROR);
    }
  }

  /**
   * Handle user login - POST /auth/login
   */
  public async login(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const requestId = event.requestContext.requestId;
    
    try {
      // Parse and validate request body
      const body = this.parseJsonBody<UserLoginRequest>(event);
      if (!body) {
        return this.error('Request body is required', ErrorCode.VALIDATION_ERROR);
      }

      this.validationService.validateLogin(body);

      // Find user by email
      const userWithPassword = await this.userService.findUserByEmail(body.email);
      if (!userWithPassword) {
        this.logger.warn(`[${requestId}] Login attempt with non-existent email`, {
          email: body.email
        });
        return this.error('Invalid email or password', ErrorCode.UNAUTHORIZED);
      }

      // Check if user is active
      if (!userWithPassword.isActive) {
        this.logger.warn(`[${requestId}] Login attempt with inactive user`, {
          userId: userWithPassword.userId,
          email: userWithPassword.email
        });
        return this.error('Account is disabled', ErrorCode.FORBIDDEN);
      }

      // Validate password
      const isPasswordValid = await this.passwordService.validatePassword(
        body.password,
        userWithPassword.passwordHash
      );

      if (!isPasswordValid) {
        this.logger.warn(`[${requestId}] Login attempt with invalid password`, {
          userId: userWithPassword.userId,
          email: userWithPassword.email
        });
        return this.error('Invalid email or password', ErrorCode.UNAUTHORIZED);
      }

      // Extract user data without password hash
      const { passwordHash, ...user } = userWithPassword;

      // Generate tokens
      const { accessToken, refreshToken, expiresIn } = this.jwtService.generateTokenPair(
        user.userId,
        user.email,
        user.role
      );

      // Update last login
      await this.userService.updateLastLogin(user.userId);

      const response: AuthResponse = {
        user,
        token: accessToken,
        refreshToken,
        expiresIn
      };

      this.logger.info(`[${requestId}] User login successful`, {
        userId: user.userId,
        email: user.email
      });

      return this.success(response, 'Login successful');

    } catch (error) {
      if (error instanceof ApiError) {
        return this.error(error.message, error.code, error.details);
      }
      
      this.logger.error(`[${requestId}] Login failed`, error);
      return this.error('Login failed', ErrorCode.INTERNAL_ERROR);
    }
  }

  /**
   * Handle token refresh - POST /auth/refresh
   */
  public async refresh(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    const requestId = event.requestContext.requestId;
    
    try {
      // Parse and validate request body
      const body = this.parseJsonBody<RefreshTokenRequest>(event);
      if (!body) {
        return this.error('Request body is required', ErrorCode.VALIDATION_ERROR);
      }

      this.validationService.validateRefreshToken(body);

      // Validate refresh token
      const refreshTokenResult = this.jwtService.validateRefreshToken(body.refreshToken);
      if (!refreshTokenResult.isValid || !refreshTokenResult.userId) {
        this.logger.warn(`[${requestId}] Invalid refresh token`, {
          error: refreshTokenResult.error
        });
        return this.error(refreshTokenResult.error || 'Invalid refresh token', ErrorCode.UNAUTHORIZED);
      }

      // Find user
      const user = await this.userService.findUserById(refreshTokenResult.userId);
      if (!user) {
        this.logger.warn(`[${requestId}] Refresh token for non-existent user`, {
          userId: refreshTokenResult.userId
        });
        return this.error('User not found', ErrorCode.UNAUTHORIZED);
      }

      // Check if user is active
      if (!user.isActive) {
        this.logger.warn(`[${requestId}] Refresh token for inactive user`, {
          userId: user.userId
        });
        return this.error('Account is disabled', ErrorCode.FORBIDDEN);
      }

      // Generate new tokens
      const { accessToken, refreshToken, expiresIn } = this.jwtService.generateTokenPair(
        user.userId,
        user.email,
        user.role
      );

      const response: AuthResponse = {
        user,
        token: accessToken,
        refreshToken,
        expiresIn
      };

      this.logger.info(`[${requestId}] Token refresh successful`, {
        userId: user.userId,
        email: user.email
      });

      return this.success(response, 'Token refreshed successfully');

    } catch (error) {
      if (error instanceof ApiError) {
        return this.error(error.message, error.code, error.details);
      }
      
      this.logger.error(`[${requestId}] Token refresh failed`, error);
      return this.error('Token refresh failed', ErrorCode.INTERNAL_ERROR);
    }
  }

  /**
   * Helper method to create error responses
   */
  private error(message: string, code: ErrorCode, details?: any): APIGatewayProxyResult {
    throw new ApiError(code, message, details);
  }
}

const authHandler = new AuthHandler();

// Export different endpoints based on HTTP method and path
export const handler = authHandler.withoutAuth(async (event: APIGatewayProxyEvent) => {
  const method = event.httpMethod;
  const path = event.resource;

  // Route to appropriate handler based on method and path
  if (method === 'POST' && path === '/auth/register') {
    return authHandler.register(event);
  } else if (method === 'POST' && path === '/auth/login') {
    return authHandler.login(event);
  } else if (method === 'POST' && path === '/auth/refresh') {
    return authHandler.refresh(event);
  } else {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Auth handler is working',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      })
    };
  }
});