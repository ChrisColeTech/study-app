// Unit tests for Health Handler

import { handler } from '../../../src/handlers/health';
import { createMockEvent, createMockContext } from '../../setup/jest.setup';
import { ServiceFactory } from '../../../src/shared/service-factory';

// Mock ServiceFactory
jest.mock('../../../src/shared/service-factory');

describe('Health Handler', () => {
  const mockServiceFactory = {
    getHealthService: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      region: 'us-east-1',
      environment: 'test',
      tables: {
        users: 'test-users-table',
        studySessions: 'test-study-sessions-table',
        userProgress: 'test-user-progress-table',
        goals: 'test-goals-table',
      },
      buckets: {
        questionData: 'test-question-data-bucket',
        assets: 'test-assets-bucket',
      },
    }),
  };

  const mockHealthService = {
    checkHealth: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ServiceFactory.getInstance as jest.Mock).mockReturnValue(mockServiceFactory);
    mockServiceFactory.getHealthService.mockReturnValue(mockHealthService);
  });

  describe('GET /health', () => {
    it('should return health status successfully', async () => {
      // Arrange
      const mockHealthData = {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00.000Z',
        environment: 'test',
        version: '1.0.0',
        dependencies: {
          database: { status: 'healthy', responseTime: 50 },
          storage: { status: 'healthy', responseTime: 30 },
        },
      };

      mockHealthService.checkHealth.mockResolvedValue(mockHealthData);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/health',
      });
      const context = createMockContext();

      // Act
      const result = await handler(event, context);

      // Assert
      expect(result).toBeValidApiResponse();
      expect(result).toHaveSuccessResponse();
      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toEqual(mockHealthData);
      expect(responseBody.message).toBe('Health check completed');
      expect(responseBody.timestamp).toBeDefined();
      expect(responseBody.requestId).toBe(context.awsRequestId);

      expect(mockHealthService.checkHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle health service errors', async () => {
      // Arrange
      const mockError = new Error('Database connection failed');
      mockHealthService.checkHealth.mockRejectedValue(mockError);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/health',
      });
      const context = createMockContext();

      // Act
      const result = await handler(event, context);

      // Assert
      expect(result).toBeValidApiResponse();
      expect(result).toHaveErrorResponse();
      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('INTERNAL_ERROR');
      expect(responseBody.error.message).toBe('Health check failed');

      expect(mockHealthService.checkHealth).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /health/status', () => {
    it('should return detailed system status', async () => {
      // Arrange
      const mockHealthData = {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00.000Z',
        environment: 'test',
        version: '1.0.0',
        dependencies: {
          database: { status: 'healthy', responseTime: 50 },
          storage: { status: 'healthy', responseTime: 30 },
        },
      };

      mockHealthService.checkHealth.mockResolvedValue(mockHealthData);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/health/status',
      });
      const context = createMockContext();

      // Act
      const result = await handler(event, context);

      // Assert
      expect(result).toBeValidApiResponse();
      expect(result).toHaveSuccessResponse();
      expect(result.statusCode).toBe(200);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        environment: 'test',
        system: {
          nodeVersion: expect.any(String),
          platform: expect.any(String),
          architecture: expect.any(String),
          uptime: expect.any(Number),
          memory: {
            used: expect.any(Number),
            total: expect.any(Number),
            external: expect.any(Number),
          },
        },
        configuration: {
          region: 'us-east-1',
          environment: 'test',
          tables: {
            users: true,
            studySessions: true,
            userProgress: true,
            goals: true,
          },
          buckets: {
            questionData: true,
            assets: true,
          },
        },
        lambda: expect.any(Object),
        dependencies: {
          database: { status: 'healthy', responseTime: 50 },
          storage: { status: 'healthy', responseTime: 30 },
        },
      });

      expect(mockHealthService.checkHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle system status errors', async () => {
      // Arrange
      const mockError = new Error('System check failed');
      mockHealthService.checkHealth.mockRejectedValue(mockError);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/health/status',
      });
      const context = createMockContext();

      // Act
      const result = await handler(event, context);

      // Assert
      expect(result).toBeValidApiResponse();
      expect(result).toHaveErrorResponse();
      expect(result.statusCode).toBe(500);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('INTERNAL_ERROR');
      expect(responseBody.error.message).toBe('System status check failed');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS request', async () => {
      // Arrange
      const event = createMockEvent({
        httpMethod: 'OPTIONS',
        path: '/health',
      });
      const context = createMockContext();

      // Act
      const result = await handler(event, context);

      // Assert
      expect(result).toBeValidApiResponse();
      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': expect.any(String),
        'Access-Control-Allow-Methods': expect.any(String),
      });
      expect(result.body).toBe('');

      // Should not call health service for OPTIONS
      expect(mockHealthService.checkHealth).not.toHaveBeenCalled();
    });
  });

  describe('Invalid routes', () => {
    it('should return 404 for unknown paths', async () => {
      // Arrange
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/health/unknown',
      });
      const context = createMockContext();

      // Act
      const result = await handler(event, context);

      // Assert
      expect(result).toBeValidApiResponse();
      expect(result).toHaveErrorResponse();
      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('NOT_FOUND');
      expect(responseBody.error.message).toBe('Endpoint not found');
    });

    it('should return 404 for unsupported HTTP methods', async () => {
      // Arrange
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/health',
      });
      const context = createMockContext();

      // Act
      const result = await handler(event, context);

      // Assert
      expect(result).toBeValidApiResponse();
      expect(result).toHaveErrorResponse();
      expect(result.statusCode).toBe(404);

      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('NOT_FOUND');
    });
  });
});
