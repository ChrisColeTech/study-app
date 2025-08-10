import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { AuthService } from './auth-service';
import { UserRepository } from './user-repository';
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  APIResponse,
  ValidationErrorInfo,
  RefreshTokenRequest,
  RefreshTokenResponse,
  LogoutRequest,
  LogoutResponse
} from './types';

export class AuthHandler {
  private authService: AuthService;
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.authService = new AuthService(this.userRepository);
  }

  async handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    console.log('Auth Handler - Event:', JSON.stringify(event, null, 2));
    console.log('Auth Handler - Context:', JSON.stringify(context, null, 2));

    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };

    try {
      // Handle CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'CORS preflight successful' })
        };
      }

      const path = event.path || '';
      const method = event.httpMethod;

      // Route handling
      if (method === 'POST' && path.includes('/register')) {
        return await this.handleRegister(event, headers);
      } else if (method === 'POST' && path.includes('/login')) {
        return await this.handleLogin(event, headers);
      } else if (method === 'POST' && path.includes('/refresh')) {
        return await this.handleRefreshToken(event, headers);
      } else if (method === 'POST' && path.includes('/logout')) {
        return await this.handleLogout(event, headers);
      } else if (method === 'GET' && path.includes('/verify')) {
        return await this.handleVerifyToken(event, headers);
      }

      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Auth endpoint not found',
            path,
            method,
            availableEndpoints: ['/register', '/login', '/refresh', '/logout', '/verify']
          },
          timestamp: new Date().toISOString()
        } as APIResponse<null>)
      };

    } catch (error) {
      console.error('Auth Handler - Unexpected error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          timestamp: new Date().toISOString()
        } as APIResponse<null>)
      };
    }
  }

  private async handleLogin(event: APIGatewayProxyEvent, headers: any): Promise<APIGatewayProxyResult> {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Request body is required',
              code: 'MISSING_BODY'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      const loginRequest: LoginRequest = JSON.parse(event.body);
      
      // Validate request
      const validationError = this.validateLoginRequest(loginRequest);
      if (validationError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: validationError,
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      // Attempt login
      const authResponse = await this.authService.login(loginRequest);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: authResponse,
          message: 'Login successful',
          timestamp: new Date().toISOString()
        } as APIResponse<AuthResponse>)
      };

    } catch (error) {
      console.error('Login error:', error);
      
      if (error instanceof Error) {
        // Handle specific auth errors
        if (error.message.includes('Invalid credentials') || error.message.includes('User not found')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('User not active')) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Account is not active. Please contact support.',
                code: 'ACCOUNT_INACTIVE'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Login failed due to server error',
            code: 'LOGIN_ERROR'
          },
          timestamp: new Date().toISOString()
        } as APIResponse<null>)
      };
    }
  }

  private async handleRegister(event: APIGatewayProxyEvent, headers: any): Promise<APIGatewayProxyResult> {
    try {
      if (!event.body) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Request body is required',
              code: 'MISSING_BODY'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      const registerRequest: RegisterRequest = JSON.parse(event.body);
      
      // Validate request
      const validationError = this.validateRegisterRequest(registerRequest);
      if (validationError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: validationError,
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      // Attempt registration
      const authResponse = await this.authService.register(registerRequest);

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          data: authResponse,
          message: 'User registered successfully',
          timestamp: new Date().toISOString()
        } as APIResponse<AuthResponse>)
      };

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            success: false,
            error: {
              message: 'User with this email already exists',
              code: 'USER_EXISTS'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Registration failed due to server error',
            code: 'REGISTRATION_ERROR'
          },
          timestamp: new Date().toISOString()
        } as APIResponse<null>)
      };
    }
  }

  private async handleRefreshToken(event: APIGatewayProxyEvent, headers: any): Promise<APIGatewayProxyResult> {
    try {
      // Check for refresh token in body or Authorization header
      let refreshToken: string | undefined;
      
      if (event.body) {
        try {
          const requestBody: RefreshTokenRequest = JSON.parse(event.body);
          refreshToken = requestBody.refreshToken;
        } catch (parseError) {
          console.warn('Failed to parse refresh token request body:', parseError);
        }
      }
      
      // If not in body, check Authorization header
      if (!refreshToken && event.headers?.Authorization) {
        const authHeader = event.headers.Authorization;
        if (authHeader.startsWith('Bearer ')) {
          refreshToken = authHeader.substring(7);
        }
      }
      
      // Alternative header check (lowercase)
      if (!refreshToken && event.headers?.authorization) {
        const authHeader = event.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          refreshToken = authHeader.substring(7);
        }
      }

      if (!refreshToken || refreshToken.trim().length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Refresh token is required in request body or Authorization header',
              code: 'MISSING_REFRESH_TOKEN'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      // Validate refresh token format
      const validationError = this.validateRefreshTokenRequest({ refreshToken });
      if (validationError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: validationError,
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      // Attempt token refresh
      const refreshResponse = await this.authService.refreshTokens({ refreshToken });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: refreshResponse,
          message: 'Tokens refreshed successfully',
          timestamp: new Date().toISOString()
        } as APIResponse<RefreshTokenResponse>)
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      
      if (error instanceof Error) {
        // Handle specific refresh token errors
        if (error.message.includes('Invalid refresh token') || error.message.includes('INVALID_REFRESH_TOKEN')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Invalid refresh token',
                code: 'INVALID_REFRESH_TOKEN'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('expired') || error.message.includes('EXPIRED_REFRESH_TOKEN')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Refresh token has expired',
                code: 'EXPIRED_REFRESH_TOKEN'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('revoked') || error.message.includes('REVOKED_REFRESH_TOKEN')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Refresh token has been revoked',
                code: 'REVOKED_REFRESH_TOKEN'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('User not found') || error.message.includes('USER_NOT_FOUND')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Invalid refresh token - user not found',
                code: 'INVALID_REFRESH_TOKEN'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('Account inactive') || error.message.includes('ACCOUNT_INACTIVE')) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Account is not active',
                code: 'ACCOUNT_INACTIVE'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Token refresh failed due to server error',
            code: 'REFRESH_ERROR'
          },
          timestamp: new Date().toISOString()
        } as APIResponse<null>)
      };
    }
  }

  private async handleLogout(event: APIGatewayProxyEvent, headers: any): Promise<APIGatewayProxyResult> {
    try {
      // Extract access token from Authorization header
      let accessToken: string | undefined;
      
      if (event.headers?.Authorization) {
        const authHeader = event.headers.Authorization;
        if (authHeader.startsWith('Bearer ')) {
          accessToken = authHeader.substring(7);
        }
      }
      
      // Alternative header check (lowercase)
      if (!accessToken && event.headers?.authorization) {
        const authHeader = event.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          accessToken = authHeader.substring(7);
        }
      }

      if (!accessToken || accessToken.trim().length === 0) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            success: false,
            error: {
              message: 'Access token is required in Authorization header',
              code: 'MISSING_AUTHORIZATION'
            },
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      // Parse request body for logout options
      let logoutRequest: LogoutRequest = {};
      if (event.body) {
        try {
          logoutRequest = JSON.parse(event.body);
        } catch (parseError) {
          console.warn('Failed to parse logout request body:', parseError);
          // Continue with default logout behavior
        }
      }

      // Validate request
      const validationError = this.validateLogoutRequest(logoutRequest);
      if (validationError) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: validationError,
            timestamp: new Date().toISOString()
          } as APIResponse<null>)
        };
      }

      // Attempt logout
      const logoutResponse = await this.authService.logout(accessToken, logoutRequest.logoutAll || false);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: logoutResponse,
          message: logoutResponse.message,
          timestamp: new Date().toISOString()
        } as APIResponse<LogoutResponse>)
      };

    } catch (error) {
      console.error('Logout error:', error);
      
      if (error instanceof Error) {
        // Handle specific logout errors
        if (error.message.includes('Invalid access token') || error.message.includes('INVALID_ACCESS_TOKEN')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Invalid access token',
                code: 'INVALID_ACCESS_TOKEN'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('Token has been revoked') || error.message.includes('TOKEN_BLACKLISTED')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Token has already been revoked',
                code: 'TOKEN_BLACKLISTED'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('Token expired') || error.message.includes('TOKEN_EXPIRED')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Access token has expired',
                code: 'TOKEN_EXPIRED'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }

        if (error.message.includes('User not found') || error.message.includes('USER_NOT_FOUND')) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
              success: false,
              error: {
                message: 'Invalid access token',
                code: 'INVALID_ACCESS_TOKEN'
              },
              timestamp: new Date().toISOString()
            } as APIResponse<null>)
          };
        }
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Logout failed due to server error',
            code: 'LOGOUT_ERROR'
          },
          timestamp: new Date().toISOString()
        } as APIResponse<null>)
      };
    }
  }

  private async handleVerifyToken(event: APIGatewayProxyEvent, headers: any): Promise<APIGatewayProxyResult> {
    // Placeholder for Phase 3+ - token verification functionality
    return {
      statusCode: 501,
      headers,
      body: JSON.stringify({
        success: false,
        error: {
          message: 'Token verification not implemented yet - Phase 3+',
          code: 'NOT_IMPLEMENTED'
        },
        timestamp: new Date().toISOString()
      } as APIResponse<null>)
    };
  }

  private validateLoginRequest(request: LoginRequest): ValidationErrorInfo | null {
    const errors: string[] = [];

    if (!request.email || typeof request.email !== 'string') {
      errors.push('Email is required and must be a string');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
      errors.push('Email must be a valid email address');
    }

    if (!request.password || typeof request.password !== 'string') {
      errors.push('Password is required and must be a string');
    } else if (request.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (errors.length > 0) {
      return {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      };
    }

    return null;
  }

  private validateRegisterRequest(request: RegisterRequest): ValidationErrorInfo | null {
    const errors: string[] = [];

    if (!request.email || typeof request.email !== 'string') {
      errors.push('Email is required and must be a string');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
      errors.push('Email must be a valid email address');
    }

    if (!request.password || typeof request.password !== 'string') {
      errors.push('Password is required and must be a string');
    } else if (request.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!request.firstName || typeof request.firstName !== 'string') {
      errors.push('First name is required and must be a string');
    } else if (request.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!request.lastName || typeof request.lastName !== 'string') {
      errors.push('Last name is required and must be a string');
    } else if (request.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    if (errors.length > 0) {
      return {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      };
    }

    return null;
  }

  private validateRefreshTokenRequest(request: RefreshTokenRequest): ValidationErrorInfo | null {
    const errors: string[] = [];

    if (!request.refreshToken || typeof request.refreshToken !== 'string') {
      errors.push('Refresh token is required and must be a string');
    } else if (request.refreshToken.trim().length === 0) {
      errors.push('Refresh token cannot be empty');
    }

    if (errors.length > 0) {
      return {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      };
    }

    return null;
  }

  private validateLogoutRequest(request: LogoutRequest): ValidationErrorInfo | null {
    const errors: string[] = [];

    if (request.logoutAll !== undefined && typeof request.logoutAll !== 'boolean') {
      errors.push('logoutAll must be a boolean if provided');
    }

    if (errors.length > 0) {
      return {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors
      };
    }

    return null;
  }
}

// Export the handler function for Lambda
const authHandler = new AuthHandler();
export const handler = (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  return authHandler.handler(event, context);
};