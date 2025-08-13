// Unit tests for Health Service

import { HealthService } from '../../../src/services/health.service';
import { ServiceFactory } from '../../../src/shared/service-factory';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, DescribeTableCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

// Mock AWS SDK clients
const dynamoMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

describe('HealthService', () => {
  let healthService: HealthService;
  let mockServiceFactory: jest.Mocked<ServiceFactory>;

  beforeEach(() => {
    dynamoMock.reset();
    s3Mock.reset();

    // Create mock ServiceFactory
    mockServiceFactory = {
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
      getDynamoClient: jest.fn().mockReturnValue({}),
      getS3Client: jest.fn().mockReturnValue({}),
    } as any;

    healthService = new HealthService(mockServiceFactory);
  });

  describe('checkHealth', () => {
    it('should return healthy status when all dependencies are healthy', async () => {
      // Arrange
      dynamoMock.on(DescribeTableCommand).resolves({
        Table: { TableName: 'test-users-table', TableStatus: 'ACTIVE' },
      });
      s3Mock.on(HeadBucketCommand).resolves({});

      // Act
      const result = await healthService.checkHealth();

      // Assert
      expect(result).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        environment: 'test',
        version: expect.any(String),
        dependencies: {
          database: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
          storage: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
        },
      });

      expect(result.dependencies.database.responseTime).toBeGreaterThan(0);
      expect(result.dependencies.storage.responseTime).toBeGreaterThan(0);
    });

    it('should return degraded status when database is unhealthy', async () => {
      // Arrange
      dynamoMock.on(DescribeTableCommand).rejects(new Error('DynamoDB connection failed'));
      s3Mock.on(HeadBucketCommand).resolves({});

      // Act
      const result = await healthService.checkHealth();

      // Assert
      expect(result).toMatchObject({
        status: 'degraded',
        timestamp: expect.any(String),
        environment: 'test',
        dependencies: {
          database: {
            status: 'unhealthy',
            responseTime: expect.any(Number),
          },
          storage: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
        },
      });
    });

    it('should return degraded status when storage is unhealthy', async () => {
      // Arrange
      dynamoMock.on(DescribeTableCommand).resolves({
        Table: { TableName: 'test-users-table', TableStatus: 'ACTIVE' },
      });
      s3Mock.on(HeadBucketCommand).rejects(new Error('S3 connection failed'));

      // Act
      const result = await healthService.checkHealth();

      // Assert
      expect(result).toMatchObject({
        status: 'degraded',
        timestamp: expect.any(String),
        environment: 'test',
        dependencies: {
          database: {
            status: 'healthy',
            responseTime: expect.any(Number),
          },
          storage: {
            status: 'unhealthy',
            responseTime: expect.any(Number),
          },
        },
      });
    });

    it('should return degraded status when all dependencies are unhealthy', async () => {
      // Arrange
      dynamoMock.on(DescribeTableCommand).rejects(new Error('DynamoDB connection failed'));
      s3Mock.on(HeadBucketCommand).rejects(new Error('S3 connection failed'));

      // Act
      const result = await healthService.checkHealth();

      // Assert
      expect(result).toMatchObject({
        status: 'degraded',
        timestamp: expect.any(String),
        environment: 'test',
        dependencies: {
          database: {
            status: 'unhealthy',
            responseTime: expect.any(Number),
          },
          storage: {
            status: 'unhealthy',
            responseTime: expect.any(Number),
          },
        },
      });
    });
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy when DynamoDB is accessible', async () => {
      // Arrange
      dynamoMock.on(DescribeTableCommand).resolves({
        Table: { TableName: 'test-users-table', TableStatus: 'ACTIVE' },
      });

      // Act
      const result = await healthService.checkDatabaseHealth();

      // Assert
      expect(result).toEqual({
        status: 'healthy',
        responseTime: expect.any(Number),
      });
      expect(result.responseTime).toBeGreaterThan(0);

      expect(dynamoMock).toHaveReceivedCommandWith(DescribeTableCommand, {
        TableName: 'test-users-table',
      });
    });

    it('should return unhealthy when DynamoDB is not accessible', async () => {
      // Arrange
      dynamoMock.on(DescribeTableCommand).rejects(new Error('Connection failed'));

      // Act
      const result = await healthService.checkDatabaseHealth();

      // Assert
      expect(result).toEqual({
        status: 'unhealthy',
        responseTime: expect.any(Number),
      });
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should return unhealthy when users table name is not configured', async () => {
      // Arrange
      mockServiceFactory.getConfig.mockReturnValue({
        region: 'us-east-1',
        environment: 'test',
        tables: {
          users: '', // Empty table name
          studySessions: 'test-study-sessions-table',
          userProgress: 'test-user-progress-table',
          goals: 'test-goals-table',
        },
        buckets: {
          questionData: 'test-question-data-bucket',
          assets: 'test-assets-bucket',
        },
      });

      // Act
      const result = await healthService.checkDatabaseHealth();

      // Assert
      expect(result).toEqual({
        status: 'unhealthy',
        responseTime: expect.any(Number),
      });

      // Should not call DynamoDB
      expect(dynamoMock).not.toHaveReceivedCommand(DescribeTableCommand);
    });
  });

  describe('checkStorageHealth', () => {
    it('should return healthy when S3 is accessible', async () => {
      // Arrange
      s3Mock.on(HeadBucketCommand).resolves({});

      // Act
      const result = await healthService.checkStorageHealth();

      // Assert
      expect(result).toEqual({
        status: 'healthy',
        responseTime: expect.any(Number),
      });
      expect(result.responseTime).toBeGreaterThan(0);

      expect(s3Mock).toHaveReceivedCommandWith(HeadBucketCommand, {
        Bucket: 'test-question-data-bucket',
      });
    });

    it('should return unhealthy when S3 is not accessible', async () => {
      // Arrange
      s3Mock.on(HeadBucketCommand).rejects(new Error('Bucket not found'));

      // Act
      const result = await healthService.checkStorageHealth();

      // Assert
      expect(result).toEqual({
        status: 'unhealthy',
        responseTime: expect.any(Number),
      });
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should return unhealthy when question data bucket name is not configured', async () => {
      // Arrange
      mockServiceFactory.getConfig.mockReturnValue({
        region: 'us-east-1',
        environment: 'test',
        tables: {
          users: 'test-users-table',
          studySessions: 'test-study-sessions-table',
          userProgress: 'test-user-progress-table',
          goals: 'test-goals-table',
        },
        buckets: {
          questionData: '', // Empty bucket name
          assets: 'test-assets-bucket',
        },
      });

      // Act
      const result = await healthService.checkStorageHealth();

      // Assert
      expect(result).toEqual({
        status: 'unhealthy',
        responseTime: expect.any(Number),
      });

      // Should not call S3
      expect(s3Mock).not.toHaveReceivedCommand(HeadBucketCommand);
    });
  });
});
