// Unit tests for AuthHandler

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { AuthHandler } from '../../../src/handlers/auth';
import { ServiceFactory } from '../../../src/shared/service-factory';
import { IAuthService } from '../../../src/services/auth.service';
import { CreateUserRequest } from '../../../src/shared/types/user.types';
import { LoginRequest, LoginResponse } from '../../../src/shared/types/auth.types';
import { ERROR_CODES } from '../../../src/shared/constants/error.constants';

// Mock ServiceFactory
jest.mock('../../../src/shared/service-factory');
const MockServiceFactory = ServiceFactory as jest.MockedClass<typeof ServiceFactory>;

// Mock AuthService
const mockAuthService: jest.Mocked<IAuthService> = {
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  validateToken: jest.fn(),
  refreshToken: jest.fn(),
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
};

describe('AuthHandler', () => {
  let authHandler: AuthHandler;
  let mockServiceFactoryInstance: jest.Mocked<ServiceFactory>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock ServiceFactory
    mockServiceFactoryInstance = {
      getAuthService: jest.fn().mockReturnValue(mockAuthService),
    } as any;

    MockServiceFactory.getInstance.mockReturnValue(mockServiceFactoryInstance);

    // Create handler instance
    authHandler = new AuthHandler();
  });

  const createMockEvent = (
    method: string = 'POST',
    path: string = '/auth/register',
    body: string | null = null,
    headers: Record<string, string> = {}
  ): APIGatewayProxyEvent => ({
    httpMethod: method,
    path,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    queryStringParameters: null,
    pathParameters: null,
    requestContext: {} as any,
    resource: '',
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
  });

  const createMockContext = (): Context =>
    ({
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      functionVersion: '1',
      getRemainingTimeInMillis: () => 30000,
    }) as any;

  describe('register endpoint', () => {
    const validRegistrationData: CreateUserRequest = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockLoginResponse: LoginResponse = {
      user: {
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        roles: ['user'],
        permissions: [],
      },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
    };

    it('should register user successfully', async () => {
      const event = createMockEvent(
        'POST',
        '/auth/register',
        JSON.stringify(validRegistrationData)
      );
      const context = createMockContext();

      mockAuthService.registerUser.mockResolvedValue(mockLoginResponse);

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: mockLoginResponse,
        message: 'User registered successfully',
      });

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(validRegistrationData);
    });

    it('should return validation error for missing body', async () => {
      const event = createMockEvent('POST', '/auth/register', null);
      const context = createMockContext();

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Request body is required',
        },
      });

      expect(mockAuthService.registerUser).not.toHaveBeenCalled();
    });

    it('should return validation error for missing required fields', async () => {
      const incompleteData = { email: 'test@example.com', password: 'Password123!' };
      const event = createMockEvent('POST', '/auth/register', JSON.stringify(incompleteData));
      const context = createMockContext();

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Missing required fields: email, password, firstName, lastName',
        },
      });
    });

    it('should return conflict error for duplicate email', async () => {
      const event = createMockEvent(
        'POST',
        '/auth/register',
        JSON.stringify(validRegistrationData)
      );
      const context = createMockContext();

      mockAuthService.registerUser.mockRejectedValue(
        new Error('User with this email already exists')
      );

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(409);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.CONFLICT,
          message: 'User with this email already exists',
        },
      });
    });

    it('should return validation error for invalid password', async () => {
      const event = createMockEvent(
        'POST',
        '/auth/register',
        JSON.stringify(validRegistrationData)
      );
      const context = createMockContext();

      mockAuthService.registerUser.mockRejectedValue(
        new Error('Password must be at least 8 characters long')
      );

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Password must be at least 8 characters long',
        },
      });
    });

    it('should return internal error for unexpected errors', async () => {
      const event = createMockEvent(
        'POST',
        '/auth/register',
        JSON.stringify(validRegistrationData)
      );
      const context = createMockContext();

      mockAuthService.registerUser.mockRejectedValue(new Error('Unexpected database error'));

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'Registration failed',
        },
      });
    });
  });

  describe('login endpoint', () => {
    const validLoginData: LoginRequest = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const mockLoginResponse: LoginResponse = {
      user: {
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        roles: ['user'],
        permissions: [],
      },
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
    };

    it('should login user successfully', async () => {
      const event = createMockEvent('POST', '/auth/login', JSON.stringify(validLoginData));
      const context = createMockContext();

      mockAuthService.loginUser.mockResolvedValue(mockLoginResponse);

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: mockLoginResponse,
        message: 'Login successful',
      });

      expect(mockAuthService.loginUser).toHaveBeenCalledWith(validLoginData);
    });

    it('should return validation error for missing body', async () => {
      const event = createMockEvent('POST', '/auth/login', null);
      const context = createMockContext();

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Request body is required',
        },
      });
    });

    it('should return validation error for missing credentials', async () => {
      const incompleteData = { email: 'test@example.com' };
      const event = createMockEvent('POST', '/auth/login', JSON.stringify(incompleteData));
      const context = createMockContext();

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Email and password are required',
        },
      });
    });

    it('should return unauthorized error for invalid credentials', async () => {
      const event = createMockEvent('POST', '/auth/login', JSON.stringify(validLoginData));
      const context = createMockContext();

      mockAuthService.loginUser.mockRejectedValue(new Error('Invalid email or password'));

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid email or password',
        },
      });
    });
  });

  describe('refresh endpoint', () => {
    const validRefreshData = { refreshToken: 'valid-refresh-token' };

    const mockLoginResponse: LoginResponse = {
      user: {
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isActive: true,
        roles: ['user'],
        permissions: [],
      },
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    };

    it('should refresh token successfully', async () => {
      const event = createMockEvent('POST', '/auth/refresh', JSON.stringify(validRefreshData));
      const context = createMockContext();

      mockAuthService.refreshToken.mockResolvedValue(mockLoginResponse);

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toMatchObject({
        success: true,
        data: mockLoginResponse,
        message: 'Token refreshed successfully',
      });

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should return validation error for missing refresh token', async () => {
      const event = createMockEvent('POST', '/auth/refresh', JSON.stringify({}));
      const context = createMockContext();

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Refresh token is required',
        },
      });
    });

    it('should return unauthorized error for invalid refresh token', async () => {
      const event = createMockEvent('POST', '/auth/refresh', JSON.stringify(validRefreshData));
      const context = createMockContext();

      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid or expired refresh token'));

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Invalid or expired refresh token',
        },
      });
    });
  });

  describe('OPTIONS request (CORS)', () => {
    it('should handle CORS preflight request', async () => {
      const event = createMockEvent('OPTIONS', '/auth/register');
      const context = createMockContext();

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      });
    });
  });

  describe('Route not found', () => {
    it('should return 404 for unknown route', async () => {
      const event = createMockEvent('GET', '/auth/unknown');
      const context = createMockContext();

      const result = await authHandler.handle(event, context);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toMatchObject({
        success: false,
        error: {
          message: 'Endpoint not found',
        },
      });
    });
  });
});
