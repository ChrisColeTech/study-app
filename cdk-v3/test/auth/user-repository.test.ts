import { UserRepository } from '../../src/lambdas/auth/user-repository';
import { User } from '../../src/lambdas/auth/types';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// Mock the DynamoDB client
const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('UserRepository', () => {
  let userRepository: UserRepository;

  const mockUser: User = {
    userId: 'user-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    passwordHash: 'hashed-password-123',
    isActive: true,
    isEmailVerified: true,
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z'
  };

  beforeEach(() => {
    dynamoMock.reset();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.AWS_REGION = 'us-east-1';
    userRepository = new UserRepository();
  });

  afterEach(() => {
    delete process.env.USERS_TABLE_NAME;
    delete process.env.AWS_REGION;
  });

  describe('createUser', () => {
    it('should successfully create a new user', async () => {
      dynamoMock.on(PutCommand).resolves({});

      await userRepository.createUser(mockUser);

      expect(dynamoMock.calls()).toHaveLength(1);
      const putCall = dynamoMock.call(0);
      expect(putCall.args[0].input).toEqual({
        TableName: 'test-users-table',
        Item: {
          ...mockUser,
          GSI1PK: 'EMAIL#test@example.com',
          GSI1SK: 'test@example.com'
        },
        ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(GSI1PK)'
      });
    });

    it('should throw error when user already exists', async () => {
      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutCommand).rejects(conditionalCheckError);

      await expect(userRepository.createUser(mockUser))
        .rejects
        .toThrow('User with email test@example.com already exists');
    });

    it('should throw error for other DynamoDB errors', async () => {
      const dbError = new Error('DynamoDB service error');
      dynamoMock.on(PutCommand).rejects(dbError);

      await expect(userRepository.createUser(mockUser))
        .rejects
        .toThrow('Failed to create user: DynamoDB service error');
    });
  });

  describe('getUserById', () => {
    it('should successfully get user by ID', async () => {
      const dynamoUser = {
        ...mockUser,
        GSI1PK: 'EMAIL#test@example.com',
        GSI1SK: 'test@example.com'
      };

      dynamoMock.on(GetCommand).resolves({ Item: dynamoUser });

      const result = await userRepository.getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(dynamoMock.calls()).toHaveLength(1);
      const getCall = dynamoMock.call(0);
      expect(getCall.args[0].input).toEqual({
        TableName: 'test-users-table',
        Key: { userId: 'user-123' }
      });
    });

    it('should return null when user not found', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined });

      const result = await userRepository.getUserById('non-existent-user');

      expect(result).toBeNull();
    });

    it('should throw error for DynamoDB errors', async () => {
      const dbError = new Error('DynamoDB service error');
      dynamoMock.on(GetCommand).rejects(dbError);

      await expect(userRepository.getUserById('user-123'))
        .rejects
        .toThrow('Failed to get user: DynamoDB service error');
    });
  });

  describe('getUserByEmail', () => {
    it('should successfully get user by email', async () => {
      const dynamoUser = {
        ...mockUser,
        GSI1PK: 'EMAIL#test@example.com',
        GSI1SK: 'test@example.com'
      };

      dynamoMock.on(QueryCommand).resolves({ Items: [dynamoUser] });

      const result = await userRepository.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(dynamoMock.calls()).toHaveLength(1);
      const queryCall = dynamoMock.call(0);
      expect(queryCall.args[0].input).toEqual({
        TableName: 'test-users-table',
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': 'test@example.com'
        }
      });
    });

    it('should handle email case insensitivity and trimming', async () => {
      const dynamoUser = {
        ...mockUser,
        GSI1PK: 'EMAIL#test@example.com',
        GSI1SK: 'test@example.com'
      };

      dynamoMock.on(QueryCommand).resolves({ Items: [dynamoUser] });

      const result = await userRepository.getUserByEmail('  TEST@EXAMPLE.COM  ');

      expect(result).toEqual(mockUser);
      const queryCall = dynamoMock.call(0);
      expect(queryCall.args[0].input.ExpressionAttributeValues).toEqual({
        ':email': 'test@example.com'
      });
    });

    it('should return null when user not found by email', async () => {
      dynamoMock.on(QueryCommand).resolves({ Items: [] });

      const result = await userRepository.getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should handle multiple users with same email (should not happen)', async () => {
      const dynamoUser = {
        ...mockUser,
        GSI1PK: 'EMAIL#test@example.com',
        GSI1SK: 'test@example.com'
      };

      // Simulate multiple users (edge case)
      dynamoMock.on(QueryCommand).resolves({ Items: [dynamoUser, dynamoUser] });

      const result = await userRepository.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      // Should still return the first user, but log a warning
    });

    it('should throw error for DynamoDB errors', async () => {
      const dbError = new Error('DynamoDB service error');
      dynamoMock.on(QueryCommand).rejects(dbError);

      await expect(userRepository.getUserByEmail('test@example.com'))
        .rejects
        .toThrow('Failed to get user by email: DynamoDB service error');
    });
  });

  describe('updateUser', () => {
    it('should successfully update user', async () => {
      dynamoMock.on(UpdateCommand).resolves({});

      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        lastLoginAt: '2023-01-02T00:00:00.000Z'
      };

      await userRepository.updateUser('user-123', updates);

      expect(dynamoMock.calls()).toHaveLength(1);
      const updateCall = dynamoMock.call(0);
      const input = updateCall.args[0].input;
      
      expect(input.TableName).toBe('test-users-table');
      expect(input.Key).toEqual({ userId: 'user-123' });
      expect(input.ConditionExpression).toBe('attribute_exists(userId)');
      expect(input.UpdateExpression).toBe('SET #attr0 = :val0, #attr1 = :val1, #attr2 = :val2, #updatedAt = :updatedAt');
      expect(input.ExpressionAttributeNames).toEqual({
        '#attr0': 'firstName',
        '#attr1': 'lastName', 
        '#attr2': 'lastLoginAt',
        '#updatedAt': 'updatedAt'
      });
      expect(input.ExpressionAttributeValues['#attr0']).toBeUndefined();
      expect(input.ExpressionAttributeValues[':val0']).toBe('Updated');
      expect(input.ExpressionAttributeValues[':val1']).toBe('Name');
      expect(input.ExpressionAttributeValues[':val2']).toBe('2023-01-02T00:00:00.000Z');
    });

    it('should throw error when user not found', async () => {
      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      dynamoMock.on(UpdateCommand).rejects(conditionalCheckError);

      await expect(userRepository.updateUser('non-existent-user', { firstName: 'Test' }))
        .rejects
        .toThrow('User not found: non-existent-user');
    });

    it('should throw error for other DynamoDB errors', async () => {
      const dbError = new Error('DynamoDB service error');
      dynamoMock.on(UpdateCommand).rejects(dbError);

      await expect(userRepository.updateUser('user-123', { firstName: 'Test' }))
        .rejects
        .toThrow('Failed to update user: DynamoDB service error');
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user by setting isActive to false', async () => {
      dynamoMock.on(UpdateCommand).resolves({});

      await userRepository.deleteUser('user-123');

      expect(dynamoMock.calls()).toHaveLength(1);
      const updateCall = dynamoMock.call(0);
      const input = updateCall.args[0].input;
      
      expect(input.TableName).toBe('test-users-table');
      expect(input.Key).toEqual({ userId: 'user-123' });
      
      // Should update isActive to false
      expect(input.ExpressionAttributeValues[':val0']).toBe(false);
    });
  });

  describe('checkUserExists', () => {
    it('should return true when user exists', async () => {
      const dynamoUser = {
        ...mockUser,
        GSI1PK: 'EMAIL#test@example.com',
        GSI1SK: 'test@example.com'
      };

      dynamoMock.on(QueryCommand).resolves({ Items: [dynamoUser] });

      const result = await userRepository.checkUserExists('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      dynamoMock.on(QueryCommand).resolves({ Items: [] });

      const result = await userRepository.checkUserExists('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status on successful connection', async () => {
      dynamoMock.on(GetCommand).resolves({ Item: undefined });

      const result = await userRepository.healthCheck();

      expect(result.status).toBe('healthy');
      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status on connection failure', async () => {
      const dbError = new Error('DynamoDB connection failed');
      dynamoMock.on(GetCommand).rejects(dbError);

      const result = await userRepository.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(typeof result.responseTime).toBe('number');
    });
  });
});