import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../shared/logger';
import { User, ApiError, ErrorCode } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * User Service - Handles all user-related DynamoDB operations
 */
export class UserService {
  private client: DynamoDBDocumentClient;
  private logger: Logger;
  private tableName: string;

  constructor() {
    this.logger = new Logger('UserService');
    
    // Initialize DynamoDB client
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    
    this.tableName = process.env.USERS_TABLE_NAME || 'StudyApp-Users';
    
    this.logger.info('UserService initialized', {
      tableName: this.tableName,
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Create a new user in DynamoDB
   */
  async createUser(userData: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<User> {
    const now = new Date().toISOString();
    const userWithPassword = {
      userId: uuidv4(),
      email: userData.email.toLowerCase(),
      passwordHash: userData.passwordHash,
      name: userData.name,
      role: 'user',
      createdAt: now,
      updatedAt: now,
      isActive: true
    };

    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: userWithPassword,
        ConditionExpression: 'attribute_not_exists(email)' // Prevent duplicate emails
      });

      await this.client.send(command);

      this.logger.info('User created successfully', {
        userId: userWithPassword.userId,
        email: userWithPassword.email
      });

      // Return user without password hash
      const { passwordHash, ...user } = userWithPassword;
      return user as User;

    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('User creation failed - email already exists', {
          email: userData.email
        });
        throw new ApiError(ErrorCode.VALIDATION_ERROR, 'User with this email already exists');
      }

      this.logger.error('Failed to create user', {
        error: error.message,
        email: userData.email
      });
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to create user account');
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    try {
      // Using query on GSI with email as partition key
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'email-index', // Assuming we have a GSI on email
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.toLowerCase()
        }
      });

      const result = await this.client.send(command);
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const user = result.Items[0] as (User & { passwordHash: string });
      
      this.logger.debug('User found by email', {
        userId: user.userId,
        email: user.email
      });

      return user;

    } catch (error: any) {
      this.logger.error('Failed to find user by email', {
        error: error.message,
        email
      });
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to lookup user');
    }
  }

  /**
   * Find user by userId
   */
  async findUserById(userId: string): Promise<User | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      });

      const result = await this.client.send(command);
      
      if (!result.Item) {
        return null;
      }

      const { passwordHash, ...user } = result.Item as (User & { passwordHash: string });
      
      this.logger.debug('User found by ID', {
        userId: user.userId,
        email: user.email
      });

      return user;

    } catch (error: any) {
      this.logger.error('Failed to find user by ID', {
        error: error.message,
        userId
      });
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to lookup user');
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: 'SET lastLoginAt = :lastLogin, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':lastLogin': now,
          ':updatedAt': now
        }
      });

      await this.client.send(command);

      this.logger.debug('Updated user last login', {
        userId,
        lastLoginAt: now
      });

    } catch (error: any) {
      this.logger.error('Failed to update last login', {
        error: error.message,
        userId
      });
      // Don't throw error for last login update - it's not critical
    }
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'isActive'>>): Promise<User | null> {
    try {
      const now = new Date().toISOString();
      
      // Build update expression dynamically
      const updateExpressions: string[] = ['updatedAt = :updatedAt'];
      const expressionAttributeValues: Record<string, any> = {
        ':updatedAt': now
      };

      if (updates.name !== undefined) {
        updateExpressions.push('name = :name');
        expressionAttributeValues[':name'] = updates.name;
      }

      if (updates.isActive !== undefined) {
        updateExpressions.push('isActive = :isActive');
        expressionAttributeValues[':isActive'] = updates.isActive;
      }

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      });

      const result = await this.client.send(command);
      
      if (!result.Attributes) {
        return null;
      }

      const { passwordHash, ...user } = result.Attributes as (User & { passwordHash: string });

      this.logger.info('User updated successfully', {
        userId,
        updates
      });

      return user;

    } catch (error: any) {
      this.logger.error('Failed to update user', {
        error: error.message,
        userId,
        updates
      });
      throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Failed to update user');
    }
  }
}