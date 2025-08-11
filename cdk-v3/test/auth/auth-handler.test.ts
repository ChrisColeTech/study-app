import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { AuthHandler } from '../../src/lambdas/auth/handler';
import { AuthService } from '../../src/lambdas/auth/auth-service';
import { UserRepository } from '../../src/lambdas/auth/user-repository';
import {
  AuthResponse,
  InvalidCredentialsError,
  UserExistsError,
  UserNotFoundError,
  AccountInactiveError,
  RefreshTokenResponse,
  InvalidRefreshTokenError,
  ExpiredRefreshTokenError,
  RevokedRefreshTokenError,
  LogoutResponse,
  InvalidAccessTokenError,
  BlacklistedTokenError,
  MissingAuthorizationError
} from '../../src/lambdas/auth/types';

// Mock the dependencies
jest.mock('../../src/lambdas/auth/auth-service');
jest.mock('../../src/lambdas/auth/user-repository');

const mockAuthService = AuthService as jest.MockedClass<typeof AuthService>;
const mockUserRepository = UserRepository as jest.MockedClass<typeof UserRepository>;

describe('AuthHandler', () => {
  let authHandler: AuthHandler;
  let mockAuthServiceInstance: jest.Mocked<AuthService>;
  let mockUserRepoInstance: jest.Mocked<UserRepository>;

  const mockContext: Context = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-auth-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-auth-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-auth-function',
    logStreamName: 'test-log-stream',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUserRepoInstance = new mockUserRepository() as jest.Mocked<UserRepository>;
    mockAuthServiceInstance = new mockAuthService(mockUserRepoInstance) as jest.Mocked<AuthService>;
    
    // Mock the constructor to return our mock instances
    mockUserRepository.mockImplementation(() => mockUserRepoInstance);
    mockAuthService.mockImplementation(() => mockAuthServiceInstance);
    
    authHandler = new AuthHandler();
  });

  describe('CORS preflight handling', () => {
    it('should handle OPTIONS request', async () => {
      const event: APIGatewayProxyEvent = {
        httpMethod: 'OPTIONS',
        path: '/v1/auth/login',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await authHandler.handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toEqual(expect.objectContaining({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      }));

      const body = JSON.parse(result.body);
      expect(body.message).toBe('CORS preflight successful');
    });
  });

  describe('login endpoint', () => {
    const loginEvent: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      path: '/v1/auth/login',
      headers: { 'Content-Type': 'application/json' },
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      }),
      isBase64Encoded: false
    };

    const mockAuthResponse: AuthResponse = {
      user: {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      },
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 3600,
      tokenType: 'Bearer'
    };

    it('should successfully login with valid credentials', async () => {
      mockAuthServiceInstance.login.mockResolvedValue(mockAuthResponse);

      const result = await authHandler.handler(loginEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockAuthServiceInstance.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockAuthResponse);
      expect(body.message).toBe('Login successful');
    });

    it('should return 400 for missing request body', async () => {
      const eventWithoutBody = { ...loginEvent, body: null };

      const result = await authHandler.handler(eventWithoutBody, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockAuthServiceInstance.login).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('MISSING_BODY');
    });

    it('should return 400 for invalid email format', async () => {
      const eventWithInvalidEmail = {
        ...loginEvent,
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'password123'
        })
      };

      const result = await authHandler.handler(eventWithInvalidEmail, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockAuthServiceInstance.login).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContain('Email must be a valid email address');
    });

    it('should return 400 for short password', async () => {
      const eventWithShortPassword = {
        ...loginEvent,
        body: JSON.stringify({
          email: 'test@example.com',
          password: '123'
        })
      };

      const result = await authHandler.handler(eventWithShortPassword, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockAuthServiceInstance.login).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContain('Password must be at least 8 characters long');
    });

    it('should return 401 for invalid credentials', async () => {
      mockAuthServiceInstance.login.mockRejectedValue(new InvalidCredentialsError());

      const result = await authHandler.handler(loginEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 403 for inactive account', async () => {
      mockAuthServiceInstance.login.mockRejectedValue(new AccountInactiveError());

      const result = await authHandler.handler(loginEvent, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('register endpoint', () => {
    const registerEvent: APIGatewayProxyEvent = {
      httpMethod: 'POST',
      path: '/v1/auth/register',
      headers: { 'Content-Type': 'application/json' },
      multiValueHeaders: {},
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      pathParameters: null,
      stageVariables: null,
      requestContext: {} as any,
      resource: '',
      body: JSON.stringify({
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User'
      }),
      isBase64Encoded: false
    };

    const mockAuthResponse: AuthResponse = {
      user: {
        userId: 'user-456',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        isActive: true,
        isEmailVerified: false,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      },
      accessToken: 'access-token-456',
      refreshToken: 'refresh-token-456',
      expiresIn: 3600,
      tokenType: 'Bearer'
    };

    it('should successfully register new user', async () => {
      mockAuthServiceInstance.register.mockResolvedValue(mockAuthResponse);

      const result = await authHandler.handler(registerEvent, mockContext);

      expect(result.statusCode).toBe(201);
      expect(mockAuthServiceInstance.register).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User'
      });

      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockAuthResponse);
      expect(body.message).toBe('User registered successfully');
    });

    it('should return 400 for missing required fields', async () => {
      const eventMissingFields = {
        ...registerEvent,
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'password123'
          // Missing firstName and lastName
        })
      };

      const result = await authHandler.handler(eventMissingFields, mockContext);

      expect(result.statusCode).toBe(400);
      expect(mockAuthServiceInstance.register).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for existing user', async () => {
      mockAuthServiceInstance.register.mockRejectedValue(new UserExistsError('newuser@example.com'));

      const result = await authHandler.handler(registerEvent, mockContext);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('unknown endpoints', () => {
    it('should return 404 for unknown paths', async () => {
      const unknownEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/auth/unknown',
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await authHandler.handler(unknownEvent, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Auth endpoint not found');
      expect(body.error.availableEndpoints).toEqual([
        '/register', '/login', '/refresh', '/logout', '/verify'
      ]);
    });
  });

  describe('placeholder endpoints', () => {
    const placeholderPaths = [
      '/v1/auth/refresh',
      '/v1/auth/logout',
      '/v1/auth/verify'
    ];

    placeholderPaths.forEach(path => {
      it(`should return 501 for ${path}`, async () => {
        const event: APIGatewayProxyEvent = {
          httpMethod: 'POST',
          path,
          headers: {},
          multiValueHeaders: {},
          queryStringParameters: null,
          multiValueQueryStringParameters: null,
          pathParameters: null,
          stageVariables: null,
          requestContext: {} as any,
          resource: '',
          body: null,
          isBase64Encoded: false
        };

        const result = await authHandler.handler(event, mockContext);

        expect(result.statusCode).toBe(501);
        const body = JSON.parse(result.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('NOT_IMPLEMENTED');
      });
    });
  });

  describe('error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      const loginEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.login.mockRejectedValue(new Error('Unexpected database error'));

      const result = await authHandler.handler(loginEvent, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('LOGIN_ERROR');
    });

    it('should handle JSON parsing errors', async () => {
      const eventWithInvalidJson: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: '{ invalid json }',
        isBase64Encoded: false
      };

      const result = await authHandler.handler(eventWithInvalidJson, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Internal server error');
    });
  });

  describe('/auth/refresh endpoint', () => {
    const mockRefreshTokenResponse: RefreshTokenResponse = {
      user: {
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      },
      accessToken: 'new-access-token-123',
      refreshToken: 'new-refresh-token-123',
      expiresIn: 86400,
      tokenType: 'Bearer'
    };

    it('should successfully refresh token with valid refresh token in body', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'valid-refresh-token-123' }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockResolvedValue(mockRefreshTokenResponse);

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockRefreshTokenResponse);
      expect(body.message).toBe('Tokens refreshed successfully');
      
      expect(mockAuthServiceInstance.refreshTokens).toHaveBeenCalledWith({
        refreshToken: 'valid-refresh-token-123'
      });
    });

    it('should successfully refresh token with valid refresh token in Authorization header', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-refresh-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockResolvedValue(mockRefreshTokenResponse);

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockRefreshTokenResponse);
      
      expect(mockAuthServiceInstance.refreshTokens).toHaveBeenCalledWith({
        refreshToken: 'valid-refresh-token-123'
      });
    });

    it('should handle lowercase authorization header', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-refresh-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockResolvedValue(mockRefreshTokenResponse);

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
    });

    it('should return 400 when refresh token is missing', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Refresh token is required in request body or Authorization header');
      expect(body.error.code).toBe('MISSING_REFRESH_TOKEN');
    });

    it('should return 400 when refresh token is empty', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: '' }),
        isBase64Encoded: false
      };

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContain('Refresh token cannot be empty');
    });

    it('should return 401 for invalid refresh token', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'invalid-refresh-token' }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockRejectedValue(new InvalidRefreshTokenError());

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Invalid refresh token');
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return 401 for expired refresh token', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'expired-refresh-token' }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockRejectedValue(new ExpiredRefreshTokenError());

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Refresh token has expired');
      expect(body.error.code).toBe('EXPIRED_REFRESH_TOKEN');
    });

    it('should return 401 for revoked refresh token', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'revoked-refresh-token' }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockRejectedValue(new RevokedRefreshTokenError());

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Refresh token has been revoked');
      expect(body.error.code).toBe('REVOKED_REFRESH_TOKEN');
    });

    it('should return 401 for user not found', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'valid-token-nonexistent-user' }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockRejectedValue(new UserNotFoundError());

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Invalid refresh token - user not found');
      expect(body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should return 403 for inactive account', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'valid-token-inactive-user' }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockRejectedValue(new AccountInactiveError());

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(403);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Account is not active');
      expect(body.error.code).toBe('ACCOUNT_INACTIVE');
    });

    it('should return 500 for internal server error', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ refreshToken: 'valid-refresh-token' }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockRejectedValue(new Error('Database connection error'));

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Token refresh failed due to server error');
      expect(body.error.code).toBe('REFRESH_ERROR');
    });

    it('should handle malformed JSON in request body gracefully', async () => {
      const refreshEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/refresh',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-refresh-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: '{ invalid json }',
        isBase64Encoded: false
      };

      mockAuthServiceInstance.refreshTokens.mockResolvedValue(mockRefreshTokenResponse);

      const result = await authHandler.handler(refreshEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      // Should use token from Authorization header when body parsing fails
    });
  });

  describe('logout endpoint', () => {
    const mockLogoutResponse: LogoutResponse = {
      message: 'Logout successful',
      loggedOutTokens: 1
    };

    const mockLogoutAllResponse: LogoutResponse = {
      message: 'Logout from all devices successful',
      loggedOutTokens: 3
    };

    it('should handle successful single logout', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-access-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({}),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.logout.mockResolvedValue(mockLogoutResponse);

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockAuthServiceInstance.logout).toHaveBeenCalledWith('valid-access-token-123', false);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockLogoutResponse);
      expect(body.message).toBe('Logout successful');
    });

    it('should handle successful logout all devices', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-access-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ logoutAll: true }),
        isBase64Encoded: false
      };

      mockAuthServiceInstance.logout.mockResolvedValue(mockLogoutAllResponse);

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockAuthServiceInstance.logout).toHaveBeenCalledWith('valid-access-token-123', true);
      
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockLogoutAllResponse);
      expect(body.message).toBe('Logout from all devices successful');
    });

    it('should handle logout with lowercase authorization header', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-access-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockAuthServiceInstance.logout.mockResolvedValue(mockLogoutResponse);

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockAuthServiceInstance.logout).toHaveBeenCalledWith('valid-access-token-123', false);
    });

    it('should return 401 for missing authorization header', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Access token is required in Authorization header');
      expect(body.error.code).toBe('MISSING_AUTHORIZATION');
    });

    it('should return 401 for empty access token', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer    '
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Access token is required in Authorization header');
      expect(body.error.code).toBe('MISSING_AUTHORIZATION');
    });

    it('should return 401 for invalid access token', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-access-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockAuthServiceInstance.logout.mockRejectedValue(new InvalidAccessTokenError());

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Invalid access token');
      expect(body.error.code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('should return 401 for blacklisted token', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer blacklisted-access-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockAuthServiceInstance.logout.mockRejectedValue(new BlacklistedTokenError());

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Token has already been revoked');
      expect(body.error.code).toBe('TOKEN_BLACKLISTED');
    });

    it('should return 401 for expired token', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer expired-access-token'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      const expiredError = new Error('Token expired');
      mockAuthServiceInstance.logout.mockRejectedValue(expiredError);

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Access token has expired');
      expect(body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should return 400 for invalid logoutAll parameter', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-access-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: JSON.stringify({ logoutAll: 'invalid' }),
        isBase64Encoded: false
      };

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Validation failed');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContain('logoutAll must be a boolean if provided');
    });

    it('should handle malformed JSON in request body gracefully', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-access-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: '{ invalid json }',
        isBase64Encoded: false
      };

      mockAuthServiceInstance.logout.mockResolvedValue(mockLogoutResponse);

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockAuthServiceInstance.logout).toHaveBeenCalledWith('valid-access-token-123', false);
      // Should use default behavior when body parsing fails
    });

    it('should return 500 for internal server error', async () => {
      const logoutEvent: APIGatewayProxyEvent = {
        httpMethod: 'POST',
        path: '/auth/logout',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-access-token-123'
        },
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        body: null,
        isBase64Encoded: false
      };

      mockAuthServiceInstance.logout.mockRejectedValue(new Error('Database connection error'));

      const result = await authHandler.handler(logoutEvent, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toBe('Logout failed due to server error');
      expect(body.error.code).toBe('LOGOUT_ERROR');
    });
  });
});