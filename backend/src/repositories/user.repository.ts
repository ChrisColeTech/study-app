// User repository for DynamoDB operations

import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { User, CreateUserRequest, UpdateUserRequest, UserResponse } from '../shared/types/user.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

export interface IUserRepository {
  create(userData: CreateUserRequest, passwordHash: string): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
  update(userId: string, updateData: UpdateUserRequest): Promise<User>;
  delete(userId: string): Promise<boolean>;
  exists(userId: string): Promise<boolean>;
}

export class UserRepository implements IUserRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;
  private logger = createLogger({ component: 'UserRepository' });

  constructor(dynamoClient: DynamoDBDocumentClient, config: ServiceConfig) {
    this.docClient = dynamoClient;
    this.tableName = config.tables.users;
  }

  /**
   * Create a new user in the database
   */
  async create(userData: CreateUserRequest, passwordHash: string): Promise<User> {
    const user: User = {
      userId: uuidv4(),
      email: userData.email.toLowerCase(),
      passwordHash,
      firstName: userData.firstName.trim(),
      lastName: userData.lastName.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: user,
        ConditionExpression: 'attribute_not_exists(userId)'
      }));

      this.logger.info('User created successfully', { userId: user.userId, email: user.email });
      return user;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('User ID conflict occurred', { userId: user.userId });
        throw new Error('User ID conflict occurred');
      }
      this.logger.error('Failed to create user', error, { email: userData.email });
      throw error;
    }
  }

  /**
   * Find a user by email address using GSI
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.toLowerCase()
        }
      }));

      const user = result.Items?.[0] as User || null;
      this.logger.debug('User lookup by email', { 
        email, 
        found: !!user,
        userId: user?.userId 
      });
      
      return user;
    } catch (error) {
      this.logger.error('Error finding user by email', error as Error, { email });
      return null;
    }
  }

  /**
   * Find a user by userId (primary key)
   */
  async findById(userId: string): Promise<User | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      }));

      const user = result.Item as User || null;
      this.logger.debug('User lookup by ID', { userId, found: !!user });
      
      return user;
    } catch (error) {
      this.logger.error('Error finding user by ID', error as Error, { userId });
      return null;
    }
  }

  /**
   * Update user information
   */
  async update(userId: string, updateData: UpdateUserRequest): Promise<User> {
    try {
      // Build update expression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      // Always update the updatedAt timestamp
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      if (updateData.firstName !== undefined) {
        updateExpressions.push('#firstName = :firstName');
        expressionAttributeNames['#firstName'] = 'firstName';
        expressionAttributeValues[':firstName'] = updateData.firstName.trim();
      }

      if (updateData.lastName !== undefined) {
        updateExpressions.push('#lastName = :lastName');
        expressionAttributeNames['#lastName'] = 'lastName';
        expressionAttributeValues[':lastName'] = updateData.lastName.trim();
      }

      if (updateData.preferences !== undefined) {
        updateExpressions.push('#preferences = :preferences');
        expressionAttributeNames['#preferences'] = 'preferences';
        expressionAttributeValues[':preferences'] = updateData.preferences;
      }

      const result = await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(userId)',
        ReturnValues: 'ALL_NEW'
      }));

      const updatedUser = result.Attributes as User;
      this.logger.info('User updated successfully', { userId, updatedFields: Object.keys(updateData) });
      
      return updatedUser;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('User not found for update', { userId });
        throw new Error('User not found');
      }
      this.logger.error('Failed to update user', error, { userId });
      throw error;
    }
  }

  /**
   * Delete a user (soft delete by marking inactive)
   */
  async delete(userId: string): Promise<boolean> {
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression: 'SET isActive = :inactive, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':inactive': false,
          ':updatedAt': new Date().toISOString()
        },
        ConditionExpression: 'attribute_exists(userId)'
      }));

      this.logger.info('User soft deleted', { userId });
      return true;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('User not found for deletion', { userId });
        return false;
      }
      this.logger.error('Failed to delete user', error, { userId });
      throw error;
    }
  }

  /**
   * Check if a user exists
   */
  async exists(userId: string): Promise<boolean> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { userId },
        ProjectionExpression: 'userId'
      }));

      return !!result.Item;
    } catch (error) {
      this.logger.error('Error checking user existence', error as Error, { userId });
      return false;
    }
  }
}