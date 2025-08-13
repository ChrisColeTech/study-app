// Unit tests for UserRepository

import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { UserRepository } from '../../../src/repositories/user.repository';
import { ServiceConfig } from '../../../src/shared/service-factory';
import { CreateUserRequest } from '../../../src/shared/types/user.types';

// Create mocked DynamoDB client
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('UserRepository', () => {
  let repository: UserRepository;
  let config: ServiceConfig;

  beforeEach(() => {
    // Reset mocks
    dynamoMock.reset();

    // Create test configuration
    config = {
      region: 'us-east-1',
      environment: 'test',
      tables: {
        users: 'test-users-table',
        studySessions: 'test-sessions-table',
        userProgress: 'test-progress-table',
        goals: 'test-goals-table',
      },
      buckets: {
        questionData: 'test-questions-bucket',
        assets: 'test-assets-bucket',
      },
    };

    // Create repository instance
    const mockDocClient = {} as DynamoDBDocumentClient;
    repository = new UserRepository(mockDocClient, config);
  });

  describe('create', () => {
    const testUserData: CreateUserRequest = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    };

    const testPasswordHash = '$2b$12$hashedpassword';

    it('should create a user successfully', async () => {
      // Mock successful DynamoDB put
      dynamoMock.on(PutCommand).resolves({});

      const result = await repository.create(testUserData, testPasswordHash);

      expect(result).toMatchObject({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: testPasswordHash,
        isActive: true,
      });
      expect(result.userId).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      // Verify DynamoDB was called correctly
      expect(dynamoMock.commandCalls(PutCommand)).toHaveLength(1);
      const putCall = dynamoMock.commandCalls(PutCommand)[0];
      expect(putCall.args[0].input).toMatchObject({
        TableName: 'test-users-table',
        ConditionExpression: 'attribute_not_exists(userId)',
      });
    });

    it('should normalize email to lowercase', async () => {
      dynamoMock.on(PutCommand).resolves({});

      const userDataWithUppercaseEmail = {
        ...testUserData,
        email: 'TEST@EXAMPLE.COM',
      };

      const result = await repository.create(userDataWithUppercaseEmail, testPasswordHash);

      expect(result.email).toBe('test@example.com');
    });

    it('should trim whitespace from names', async () => {
      dynamoMock.on(PutCommand).resolves({});

      const userDataWithWhitespace = {
        ...testUserData,
        firstName: '  John  ',
        lastName: '  Doe  ',
      };

      const result = await repository.create(userDataWithWhitespace, testPasswordHash);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('should throw error on user ID conflict', async () => {
      // Mock ConditionalCheckFailedException
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutCommand).rejects(error);

      await expect(repository.create(testUserData, testPasswordHash)).rejects.toThrow(
        'User ID conflict occurred'
      );
    });

    it('should rethrow other DynamoDB errors', async () => {
      const error = new Error('Some other error');
      dynamoMock.on(PutCommand).rejects(error);

      await expect(repository.create(testUserData, testPasswordHash)).rejects.toThrow(
        'Some other error'
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashedpassword',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        isActive: true,
      };

      dynamoMock.on(QueryCommand).resolves({
        Items: [mockUser],
      });

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);

      // Verify DynamoDB was called correctly
      expect(dynamoMock.commandCalls(QueryCommand)).toHaveLength(1);
      const queryCall = dynamoMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input).toMatchObject({
        TableName: 'test-users-table',
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': 'test@example.com',
        },
      });
    });

    it('should normalize email to lowercase when searching', async () => {
      dynamoMock.on(QueryCommand).resolves({ Items: [] });

      await repository.findByEmail('TEST@EXAMPLE.COM');

      const queryCall = dynamoMock.commandCalls(QueryCommand)[0];
      expect(queryCall.args[0].input.ExpressionAttributeValues).toMatchObject({
        ':email': 'test@example.com',
      });
    });

    it('should return null when user not found', async () => {
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should return null on DynamoDB error', async () => {
      dynamoMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

      const result = await repository.findByEmail('test@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const mockUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hashedpassword',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-01T00:00:00Z',
        isActive: true,
      };

      dynamoMock.on(GetCommand).resolves({
        Item: mockUser,
      });

      const result = await repository.findById('test-user-id');

      expect(result).toEqual(mockUser);

      // Verify DynamoDB was called correctly
      expect(dynamoMock.commandCalls(GetCommand)).toHaveLength(1);
      const getCall = dynamoMock.commandCalls(GetCommand)[0];
      expect(getCall.args[0].input).toMatchObject({
        TableName: 'test-users-table',
        Key: { userId: 'test-user-id' },
      });
    });

    it('should return null when user not found', async () => {
      dynamoMock.on(GetCommand).resolves({});

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null on DynamoDB error', async () => {
      dynamoMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      const result = await repository.findById('test-user-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user successfully', async () => {
      const updatedUser = {
        userId: 'test-user-id',
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        passwordHash: 'hashedpassword',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-02T00:00:00Z',
        isActive: true,
        preferences: { studyReminderEmail: true },
      };

      dynamoMock.on(UpdateCommand).resolves({
        Attributes: updatedUser,
      });

      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        preferences: { studyReminderEmail: true },
      };

      const result = await repository.update('test-user-id', updateData);

      expect(result).toEqual(updatedUser);

      // Verify DynamoDB was called correctly
      expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
      const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
      expect(updateCall.args[0].input).toMatchObject({
        TableName: 'test-users-table',
        Key: { userId: 'test-user-id' },
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW',
      });
    });

    it('should throw error when user not found', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      dynamoMock.on(UpdateCommand).rejects(error);

      await expect(repository.update('nonexistent-id', { firstName: 'Jane' })).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('delete', () => {
    it('should soft delete user successfully', async () => {
      dynamoMock.on(UpdateCommand).resolves({});

      const result = await repository.delete('test-user-id');

      expect(result).toBe(true);

      // Verify DynamoDB was called correctly
      expect(dynamoMock.commandCalls(UpdateCommand)).toHaveLength(1);
      const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
      expect(updateCall.args[0].input).toMatchObject({
        TableName: 'test-users-table',
        Key: { userId: 'test-user-id' },
        UpdateExpression: 'SET isActive = :inactive, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inactive': false,
        },
        ConditionExpression: 'attribute_exists(userId)',
      });
    });

    it('should return false when user not found', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      dynamoMock.on(UpdateCommand).rejects(error);

      const result = await repository.delete('nonexistent-id');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when user exists', async () => {
      dynamoMock.on(GetCommand).resolves({
        Item: { userId: 'test-user-id' },
      });

      const result = await repository.exists('test-user-id');

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      dynamoMock.on(GetCommand).resolves({});

      const result = await repository.exists('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false on DynamoDB error', async () => {
      dynamoMock.on(GetCommand).rejects(new Error('DynamoDB error'));

      const result = await repository.exists('test-user-id');

      expect(result).toBe(false);
    });
  });
});
