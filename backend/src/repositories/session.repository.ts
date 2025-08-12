// Session repository for DynamoDB operations

import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { StudySession } from '../shared/types/domain.types';
import { ServiceConfig } from '../shared/service-factory';
import { DynamoDBBaseRepository } from './base.repository';
import { IStandardCrudRepository, IUserScopedRepository, StandardQueryResult } from '../shared/types/repository.types';

export interface ISessionRepository extends IStandardCrudRepository<StudySession, StudySession, Partial<StudySession>>, IUserScopedRepository<StudySession> {
  /**
   * Find sessions by user ID with pagination - standardized return format
   * @param userId - User identifier
   * @param filters - Optional pagination and filtering
   * @returns Promise<StandardQueryResult<StudySession>> - Paginated results
   * @throws RepositoryError
   */
  findByUserId(userId: string, filters?: { limit?: number; lastEvaluatedKey?: any }): Promise<StandardQueryResult<StudySession>>;
}

export class SessionRepository extends DynamoDBBaseRepository implements ISessionRepository {
  private docClient: DynamoDBDocumentClient;

  constructor(dynamoClient: DynamoDBDocumentClient, config: ServiceConfig) {
    super('SessionRepository', config, config.tables.studySessions);
    this.docClient = dynamoClient;
  }

  /**
   * Perform health check operation for DynamoDB connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': 'health-check-user' },
      Limit: 1
    }));
  }

  /**
   * Create a new session in the database
   */
  async create(session: StudySession): Promise<StudySession> {
    return this.executeWithErrorHandling('create', async () => {
      this.validateRequired({ 
        sessionId: session.sessionId, 
        userId: session.userId 
      }, 'create');

      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: session,
        ConditionExpression: 'attribute_not_exists(sessionId)'
      }));

      this.logger.info('Session created successfully', { 
        sessionId: session.sessionId, 
        userId: session.userId 
      });
      return session;
    }, { sessionId: session.sessionId, userId: session.userId });
  }

  /**
   * Find a session by sessionId (primary key)
   */
  async findById(sessionId: string): Promise<StudySession | null> {
    return this.executeWithErrorHandling('findById', async () => {
      this.validateRequired({ sessionId }, 'findById');

      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { sessionId }
      }));

      const session = result.Item as StudySession || null;
      this.logger.debug('Session lookup by ID', { sessionId, found: !!session });
      
      return session;
    }, { sessionId });
  }

  /**
   * Find sessions by userId using GSI with pagination
   */
  async findByUserId(userId: string, filters?: { limit?: number; lastEvaluatedKey?: any }): Promise<StandardQueryResult<StudySession>> {
    return this.executeWithErrorHandling('findByUserId', async () => {
      this.validateRequired({ userId }, 'findByUserId');

      const limit = filters?.limit || 20;
      const lastEvaluatedKey = filters?.lastEvaluatedKey;

      const params = {
        TableName: this.tableName,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': userId },
        ScanIndexForward: false, // Sort by newest first
        ...this.buildPaginationParams(limit, lastEvaluatedKey)
      };

      const result = await this.docClient.send(new QueryCommand(params));

      const items = result.Items as StudySession[] || [];
      this.logger.debug('Sessions lookup by userId', { 
        userId, 
        count: items.length,
        hasMore: !!result.LastEvaluatedKey 
      });

      // Return standardized format
      return {
        items,
        total: items.length, // Note: DynamoDB doesn't give us total count, would need separate query
        limit,
        lastEvaluatedKey: result.LastEvaluatedKey
      };
    }, { userId, limit: filters?.limit });
  }

  /**
   * Update session information
   */
  async update(sessionId: string, updateData: Partial<StudySession>): Promise<StudySession> {
    return this.executeWithErrorHandling('update', async () => {
      this.validateRequired({ sessionId }, 'update');

      // Build update expression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      // Always update the updatedAt timestamp
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      // Handle other updateable fields
      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== 'sessionId' && key !== 'userId' && key !== 'createdAt') {
          const attributeKey = `#${key}`;
          const valueKey = `:${key}`;
          updateExpressions.push(`${attributeKey} = ${valueKey}`);
          expressionAttributeNames[attributeKey] = key;
          expressionAttributeValues[valueKey] = value;
        }
      });

      const result = await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { sessionId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(sessionId)',
        ReturnValues: 'ALL_NEW'
      }));

      const updatedSession = result.Attributes as StudySession;
      this.logger.info('Session updated successfully', { 
        sessionId, 
        updatedFields: Object.keys(updateData) 
      });
      
      return updatedSession;
    }, { sessionId, updateFields: Object.keys(updateData) });
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<boolean> {
    return this.executeWithErrorHandling('delete', async () => {
      this.validateRequired({ sessionId }, 'delete');

      try {
        await this.docClient.send(new DeleteCommand({
          TableName: this.tableName,
          Key: { sessionId },
          ConditionExpression: 'attribute_exists(sessionId)'
        }));

        this.logger.info('Session deleted successfully', { sessionId });
        return true;
      } catch (error: any) {
        if (error.name === 'ConditionalCheckFailedException') {
          this.logger.warn('Session not found for deletion', { sessionId });
          return false;
        }
        throw error;
      }
    }, { sessionId });
  }

  /**
   * Check if a session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    return this.executeWithErrorHandling('exists', async () => {
      this.validateRequired({ sessionId }, 'exists');

      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { sessionId },
        ProjectionExpression: 'sessionId'
      }));

      return !!result.Item;
    }, { sessionId });
  }
}