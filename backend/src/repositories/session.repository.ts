// Session repository for DynamoDB operations

import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { StudySession } from '../shared/types/domain.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

export interface ISessionRepository {
  create(session: StudySession): Promise<StudySession>;
  findById(sessionId: string): Promise<StudySession | null>;
  findByUserId(userId: string, limit?: number, lastEvaluatedKey?: any): Promise<{ sessions: StudySession[], lastEvaluatedKey?: any }>;
  update(sessionId: string, updateData: Partial<StudySession>): Promise<StudySession>;
  delete(sessionId: string): Promise<boolean>;
  exists(sessionId: string): Promise<boolean>;
}

export class SessionRepository implements ISessionRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;
  private logger = createLogger({ component: 'SessionRepository' });

  constructor(dynamoClient: DynamoDBDocumentClient, config: ServiceConfig) {
    this.docClient = dynamoClient;
    this.tableName = config.tables.studySessions;
  }

  /**
   * Create a new session in the database
   */
  async create(session: StudySession): Promise<StudySession> {
    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: session,
        ConditionExpression: 'attribute_not_exists(sessionId)'
      }));

      this.logger.info('Session created successfully', { 
        sessionId: session.sessionId, 
        userId: session.userId,
        examId: session.examId,
        providerId: session.providerId
      });
      
      return session;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Session ID conflict occurred', { sessionId: session.sessionId });
        throw new Error('Session with this ID already exists');
      }
      this.logger.error('Failed to create session', error, { sessionId: session.sessionId });
      throw new Error('Failed to store session');
    }
  }

  /**
   * Find a session by sessionId (primary key)
   */
  async findById(sessionId: string): Promise<StudySession | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { sessionId }
      }));

      const session = result.Item as StudySession || null;
      this.logger.debug('Session lookup by ID', { sessionId, found: !!session });
      
      return session;
    } catch (error) {
      this.logger.error('Error finding session by ID', error as Error, { sessionId });
      return null;
    }
  }

  /**
   * Find sessions by userId using GSI
   */
  async findByUserId(userId: string, limit: number = 50, lastEvaluatedKey?: any): Promise<{ sessions: StudySession[], lastEvaluatedKey?: any }> {
    try {
      const queryParams: any = {
        TableName: this.tableName,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      };

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await this.docClient.send(new QueryCommand(queryParams));

      const sessions = (result.Items || []) as StudySession[];
      this.logger.debug('Sessions lookup by userId', { 
        userId, 
        found: sessions.length,
        hasMore: !!result.LastEvaluatedKey
      });
      
      return {
        sessions,
        lastEvaluatedKey: result.LastEvaluatedKey
      };
    } catch (error) {
      this.logger.error('Error finding sessions by userId', error as Error, { userId });
      return { sessions: [] };
    }
  }

  /**
   * Update session information
   */
  async update(sessionId: string, updateData: Partial<StudySession>): Promise<StudySession> {
    try {
      // Build update expression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      // Always update the updatedAt timestamp
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      // Handle specific fields that can be updated
      if (updateData.status !== undefined) {
        updateExpressions.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = updateData.status;
      }

      if (updateData.currentQuestionIndex !== undefined) {
        updateExpressions.push('#currentQuestionIndex = :currentQuestionIndex');
        expressionAttributeNames['#currentQuestionIndex'] = 'currentQuestionIndex';
        expressionAttributeValues[':currentQuestionIndex'] = updateData.currentQuestionIndex;
      }

      if (updateData.questions !== undefined) {
        updateExpressions.push('#questions = :questions');
        expressionAttributeNames['#questions'] = 'questions';
        expressionAttributeValues[':questions'] = updateData.questions;
      }

      if (updateData.correctAnswers !== undefined) {
        updateExpressions.push('#correctAnswers = :correctAnswers');
        expressionAttributeNames['#correctAnswers'] = 'correctAnswers';
        expressionAttributeValues[':correctAnswers'] = updateData.correctAnswers;
      }

      if (updateData.endTime !== undefined) {
        updateExpressions.push('#endTime = :endTime');
        expressionAttributeNames['#endTime'] = 'endTime';
        expressionAttributeValues[':endTime'] = updateData.endTime;
      }

      if (updateData.score !== undefined) {
        updateExpressions.push('#score = :score');
        expressionAttributeNames['#score'] = 'score';
        expressionAttributeValues[':score'] = updateData.score;
      }

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
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Session not found for update', { sessionId });
        throw new Error('Session not found');
      }
      this.logger.error('Failed to update session', error, { sessionId });
      throw error;
    }
  }

  /**
   * Delete a session (hard delete)
   */
  async delete(sessionId: string): Promise<boolean> {
    try {
      await this.docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { sessionId },
        ConditionExpression: 'attribute_exists(sessionId)'
      }));

      this.logger.info('Session deleted', { sessionId });
      return true;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Session not found for deletion', { sessionId });
        return false;
      }
      this.logger.error('Failed to delete session', error, { sessionId });
      throw error;
    }
  }

  /**
   * Check if a session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { sessionId },
        ProjectionExpression: 'sessionId'
      }));

      return !!result.Item;
    } catch (error) {
      this.logger.error('Error checking session existence', error as Error, { sessionId });
      return false;
    }
  }
}