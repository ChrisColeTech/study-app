// User repository for DynamoDB operations

import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
} from '../shared/types/user.types';
import { DifficultyLevel } from '../shared/types/domain.types';
import { ServiceConfig } from '../shared/service-factory';
import { DynamoDBBaseRepository } from './base.repository';
import { IStandardCrudRepository } from '../shared/types/repository.types';
import { v4 as uuidv4 } from 'uuid';

export interface IUserRepository
  extends Omit<IStandardCrudRepository<User, CreateUserRequest, UpdateUserRequest>, 'create'> {
  /**
   * Create a new user with password hash
   * @param userData - User creation data
   * @param passwordHash - Hashed password
   * @returns Promise<User> - Created user
   * @throws RepositoryError
   */
  create(userData: CreateUserRequest, passwordHash: string): Promise<User>;

  /**
   * Find user by email address (unique business identifier)
   * @param email - User email address
   * @returns Promise<User | null> - User if found, null otherwise
   * @throws RepositoryError
   */
  findByEmail(email: string): Promise<User | null>;
}

export class UserRepository extends DynamoDBBaseRepository implements IUserRepository {
  private docClient: DynamoDBDocumentClient;

  constructor(dynamoClient: DynamoDBDocumentClient, config: ServiceConfig) {
    super('UserRepository', config, config.tables.users);
    this.docClient = dynamoClient;
  }

  /**
   * Perform health check operation for DynamoDB connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': 'health-check@example.com' },
        Limit: 1,
      })
    );
  }

  /**
   * Create a new user in the database
   */
  async create(userData: CreateUserRequest, passwordHash: string): Promise<User> {
    return this.executeWithErrorHandling(
      'create',
      async () => {
        this.validateRequired(
          {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            passwordHash,
          },
          'create'
        );

        const user: User = {
          userId: uuidv4(),
          email: userData.email.toLowerCase(),
          passwordHash,
          firstName: userData.firstName.trim(),
          lastName: userData.lastName.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
          preferences: {
            studyMode: 'practice',
            difficulty: DifficultyLevel.MEDIUM,
            timePerQuestion: 60,
            showExplanations: true,
            shuffleQuestions: false,
            shuffleAnswers: false
          }
        };

        try {
          await this.docClient.send(
            new PutCommand({
              TableName: this.tableName,
              Item: user,
              ConditionExpression: 'attribute_not_exists(userId)',
            })
          );

          this.logger.info('User created successfully', { userId: user.userId, email: user.email });
          return user;
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            throw this.createRepositoryError('create', new Error('User ID conflict occurred'), {
              userId: user.userId,
            });
          }
          throw error;
        }
      },
      { email: userData.email }
    );
  }

  /**
   * Find a user by email address using GSI
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findByEmail',
      async () => {
        this.validateRequired({ email }, 'findByEmail');

        const result = await this.docClient.send(
          new QueryCommand({
            TableName: this.tableName,
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
              ':email': email.toLowerCase(),
            },
          })
        );

        const user = (result.Items?.[0] as User) || null;
        this.logger.debug('User lookup by email', {
          email,
          found: !!user,
          userId: user?.userId,
        });

        return user;
      },
      { email }
    );
  }

  /**
   * Find a user by userId (primary key)
   */
  async findById(userId: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        this.validateRequired({ userId }, 'findById');

        const result = await this.docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: { userId },
          })
        );

        const user = (result.Item as User) || null;
        this.logger.debug('User lookup by ID', { userId, found: !!user });

        return user;
      },
      { userId }
    );
  }

  /**
   * Update user information
   */
  async update(userId: string, updateData: UpdateUserRequest): Promise<User> {
    return this.executeWithErrorHandling(
      'update',
      async () => {
        this.validateRequired({ userId }, 'update');

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

        try {
          const result = await this.docClient.send(
            new UpdateCommand({
              TableName: this.tableName,
              Key: { userId },
              UpdateExpression: `SET ${updateExpressions.join(', ')}`,
              ExpressionAttributeNames: expressionAttributeNames,
              ExpressionAttributeValues: expressionAttributeValues,
              ConditionExpression: 'attribute_exists(userId)',
              ReturnValues: 'ALL_NEW',
            })
          );

          const updatedUser = result.Attributes as User;
          this.logger.info('User updated successfully', {
            userId,
            updatedFields: Object.keys(updateData),
          });

          return updatedUser;
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            throw this.createRepositoryError('update', new Error('User not found'), { userId });
          }
          throw error;
        }
      },
      { userId, updateFields: Object.keys(updateData) }
    );
  }

  /**
   * Delete a user (soft delete by marking inactive)
   */
  async delete(userId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        this.validateRequired({ userId }, 'delete');

        try {
          await this.docClient.send(
            new UpdateCommand({
              TableName: this.tableName,
              Key: { userId },
              UpdateExpression: 'SET isActive = :inactive, updatedAt = :updatedAt',
              ExpressionAttributeValues: {
                ':inactive': false,
                ':updatedAt': new Date().toISOString(),
              },
              ConditionExpression: 'attribute_exists(userId)',
            })
          );

          this.logger.info('User soft deleted', { userId });
          return true;
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            this.logger.warn('User not found for deletion', { userId });
            return false;
          }
          throw error;
        }
      },
      { userId }
    );
  }

  /**
   * Check if a user exists
   */
  async exists(userId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'exists',
      async () => {
        this.validateRequired({ userId }, 'exists');

        const result = await this.docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: { userId },
            ProjectionExpression: 'userId',
          })
        );

        return !!result.Item;
      },
      { userId }
    );
  }
}
