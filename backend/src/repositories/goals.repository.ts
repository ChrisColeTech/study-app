// Goals repository for DynamoDB operations
// Phase 18: Goals Management System

import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { Goal } from '../shared/types/goals.types';
import { GetGoalsRequest } from '../shared/types/goals.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

export interface IGoalsRepository {
  create(goal: Goal): Promise<Goal>;
  findById(goalId: string): Promise<Goal | null>;
  findByUserId(userId: string, filters?: GetGoalsRequest): Promise<{ goals: Goal[], total: number }>;
  update(goalId: string, updateData: Partial<Goal>): Promise<Goal>;
  delete(goalId: string): Promise<boolean>;
  exists(goalId: string): Promise<boolean>;
}

export class GoalsRepository implements IGoalsRepository {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;
  private userIdIndexName: string;
  private logger = createLogger({ component: 'GoalsRepository' });

  constructor(dynamoClient: DynamoDBDocumentClient, config: ServiceConfig) {
    this.docClient = dynamoClient;
    this.tableName = config.tables.goals;
    this.userIdIndexName = 'UserGoalsIndex'; // GSI for querying by userId
  }

  /**
   * Create a new goal in the database
   */
  async create(goal: Goal): Promise<Goal> {
    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: goal,
        ConditionExpression: 'attribute_not_exists(goalId)'
      }));

      this.logger.info('Goal created successfully', { 
        goalId: goal.goalId, 
        userId: goal.userId,
        type: goal.type,
        targetValue: goal.targetValue
      });
      
      return goal;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Goal ID conflict occurred', { goalId: goal.goalId });
        throw new Error('Goal with this ID already exists');
      }

      this.logger.error('Failed to create goal', error, { goalId: goal.goalId, userId: goal.userId });
      throw new Error('Failed to create goal');
    }
  }

  /**
   * Find a goal by its ID
   */
  async findById(goalId: string): Promise<Goal | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { goalId }
      }));

      if (!result.Item) {
        this.logger.debug('Goal not found', { goalId });
        return null;
      }

      this.logger.debug('Goal retrieved successfully', { goalId });
      return result.Item as Goal;

    } catch (error) {
      this.logger.error('Failed to retrieve goal', error as Error, { goalId });
      throw new Error('Failed to retrieve goal');
    }
  }

  /**
   * Find goals by user ID with optional filtering and pagination
   */
  async findByUserId(userId: string, filters: GetGoalsRequest = {}): Promise<{ goals: Goal[], total: number }> {
    try {
      this.logger.debug('Querying goals by userId', { userId, filters });

      // Build query parameters
      let filterExpression = '';
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {
        ':userId': userId
      };

      // Build filter conditions
      const filterConditions: string[] = [];

      // Status filter
      if (filters.status && filters.status.length > 0) {
        const statusConditions = filters.status.map((status, index) => {
          const placeholder = `:status${index}`;
          expressionAttributeValues[placeholder] = status;
          return `#status = ${placeholder}`;
        }).join(' OR ');
        filterConditions.push(`(${statusConditions})`);
        expressionAttributeNames['#status'] = 'status';
      }

      // Type filter
      if (filters.type && filters.type.length > 0) {
        const typeConditions = filters.type.map((type, index) => {
          const placeholder = `:type${index}`;
          expressionAttributeValues[placeholder] = type;
          return `#type = ${placeholder}`;
        }).join(' OR ');
        filterConditions.push(`(${typeConditions})`);
        expressionAttributeNames['#type'] = 'type';
      }

      // Priority filter
      if (filters.priority && filters.priority.length > 0) {
        const priorityConditions = filters.priority.map((priority, index) => {
          const placeholder = `:priority${index}`;
          expressionAttributeValues[placeholder] = priority;
          return `priority = ${placeholder}`;
        }).join(' OR ');
        filterConditions.push(`(${priorityConditions})`);
      }

      // Reference filters
      if (filters.examId) {
        filterConditions.push('examId = :examId');
        expressionAttributeValues[':examId'] = filters.examId;
      }

      if (filters.topicId) {
        filterConditions.push('topicId = :topicId');
        expressionAttributeValues[':topicId'] = filters.topicId;
      }

      if (filters.providerId) {
        filterConditions.push('providerId = :providerId');
        expressionAttributeValues[':providerId'] = filters.providerId;
      }

      // Archived filter
      if (filters.isArchived !== undefined) {
        filterConditions.push('isArchived = :isArchived');
        expressionAttributeValues[':isArchived'] = filters.isArchived;
      }

      // Search filter (search in title and description)
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filterConditions.push('(contains(#title, :searchTerm) OR contains(description, :searchTerm))');
        expressionAttributeNames['#title'] = 'title';
        expressionAttributeValues[':searchTerm'] = searchTerm;
      }

      // Combine filter conditions
      if (filterConditions.length > 0) {
        filterExpression = filterConditions.join(' AND ');
      }

      // Query parameters
      const queryParams: any = {
        TableName: this.tableName,
        IndexName: this.userIdIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: expressionAttributeValues,
        Limit: filters.limit || 50
      };

      if (Object.keys(expressionAttributeNames).length > 0) {
        queryParams.ExpressionAttributeNames = expressionAttributeNames;
      }

      if (filterExpression) {
        queryParams.FilterExpression = filterExpression;
      }

      // Execute query
      let allGoals: Goal[] = [];
      let lastEvaluatedKey: any = undefined;
      let totalScanned = 0;

      // Handle pagination and collect all matching items
      do {
        if (lastEvaluatedKey) {
          queryParams.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await this.docClient.send(new QueryCommand(queryParams));
        
        if (result.Items) {
          allGoals.push(...(result.Items as Goal[]));
        }

        totalScanned += result.ScannedCount || 0;
        lastEvaluatedKey = result.LastEvaluatedKey;

      } while (lastEvaluatedKey && allGoals.length < (filters.limit || 50));

      // Sort results if requested
      if (filters.sortBy) {
        allGoals.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (filters.sortBy) {
            case 'created':
              aValue = new Date(a.createdAt).getTime();
              bValue = new Date(b.createdAt).getTime();
              break;
            case 'updated':
              aValue = new Date(a.updatedAt).getTime();
              bValue = new Date(b.updatedAt).getTime();
              break;
            case 'deadline':
              aValue = a.deadline ? new Date(a.deadline).getTime() : 0;
              bValue = b.deadline ? new Date(b.deadline).getTime() : 0;
              break;
            case 'priority':
              const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
              aValue = priorityOrder[a.priority];
              bValue = priorityOrder[b.priority];
              break;
            case 'progress':
              aValue = a.progressPercentage;
              bValue = b.progressPercentage;
              break;
            default:
              aValue = a.createdAt;
              bValue = b.createdAt;
          }

          if (filters.sortOrder === 'desc') {
            return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
          } else {
            return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          }
        });
      }

      // Apply offset and limit
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      const paginatedGoals = allGoals.slice(offset, offset + limit);

      this.logger.info('Goals retrieved successfully', { 
        userId,
        total: allGoals.length,
        returned: paginatedGoals.length,
        totalScanned,
        filters
      });

      return {
        goals: paginatedGoals,
        total: allGoals.length
      };

    } catch (error) {
      this.logger.error('Failed to query goals by userId', error as Error, { userId, filters });
      throw new Error('Failed to retrieve goals');
    }
  }

  /**
   * Update an existing goal
   */
  async update(goalId: string, updateData: Partial<Goal>): Promise<Goal> {
    try {
      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(updateData).forEach(([key, value]) => {
        if (value !== undefined) {
          const attributeName = `#${key}`;
          const valueName = `:${key}`;
          
          updateExpressions.push(`${attributeName} = ${valueName}`);
          expressionAttributeNames[attributeName] = key;
          expressionAttributeValues[valueName] = value;
        }
      });

      const result = await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { goalId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(goalId)'
      }));

      if (!result.Attributes) {
        throw new Error('Goal not found');
      }

      this.logger.info('Goal updated successfully', { 
        goalId,
        updatedFields: Object.keys(updateData)
      });

      return result.Attributes as Goal;

    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Goal not found for update', { goalId });
        throw new Error('Goal not found');
      }

      this.logger.error('Failed to update goal', error, { goalId, updateData });
      throw new Error('Failed to update goal');
    }
  }

  /**
   * Delete a goal
   */
  async delete(goalId: string): Promise<boolean> {
    try {
      await this.docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { goalId },
        ConditionExpression: 'attribute_exists(goalId)'
      }));

      this.logger.info('Goal deleted successfully', { goalId });
      return true;

    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        this.logger.warn('Goal not found for deletion', { goalId });
        throw new Error('Goal not found');
      }

      this.logger.error('Failed to delete goal', error, { goalId });
      throw new Error('Failed to delete goal');
    }
  }

  /**
   * Check if a goal exists
   */
  async exists(goalId: string): Promise<boolean> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: { goalId },
        ProjectionExpression: 'goalId'
      }));

      return !!result.Item;

    } catch (error) {
      this.logger.error('Failed to check goal existence', error as Error, { goalId });
      return false;
    }
  }
}