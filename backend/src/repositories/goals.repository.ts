// Goals repository for DynamoDB operations
// Phase 18: Goals Management System

import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Goal } from '../shared/types/goals.types';
import { GetGoalsRequest } from '../shared/types/goals.types';
import { ServiceConfig } from '../shared/service-factory';
import { DynamoDBBaseRepository } from './base.repository';
import {
  IStandardCrudRepository,
  IUserScopedRepository,
  StandardQueryResult,
} from '../shared/types/repository.types';

/**
 * Helper class for building DynamoDB query expressions and filtering logic
 * Extracted from GoalsRepository to follow SRP (Single Responsibility Principle)
 */
class GoalsQueryBuilder {
  /**
   * Build comprehensive filter expression for goals query
   */
  buildFilterExpression(filters: GetGoalsRequest): {
    filterExpression: string;
    expressionAttributeNames: Record<string, string>;
    expressionAttributeValues: Record<string, any>;
  } {
    const filterConditions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Status filter
    if (filters.status && filters.status.length > 0) {
      const statusConditions = filters.status
        .map((status, index) => {
          const placeholder = `:status${index}`;
          expressionAttributeValues[placeholder] = status;
          return `#status = ${placeholder}`;
        })
        .join(' OR ');
      filterConditions.push(`(${statusConditions})`);
      expressionAttributeNames['#status'] = 'status';
    }

    // Type filter
    if (filters.type && filters.type.length > 0) {
      const typeConditions = filters.type
        .map((type, index) => {
          const placeholder = `:type${index}`;
          expressionAttributeValues[placeholder] = type;
          return `#type = ${placeholder}`;
        })
        .join(' OR ');
      filterConditions.push(`(${typeConditions})`);
      expressionAttributeNames['#type'] = 'type';
    }

    // Priority filter
    if (filters.priority && filters.priority.length > 0) {
      const priorityConditions = filters.priority
        .map((priority, index) => {
          const placeholder = `:priority${index}`;
          expressionAttributeValues[placeholder] = priority;
          return `priority = ${placeholder}`;
        })
        .join(' OR ');
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
      filterConditions.push(
        '(contains(#title, :searchTerm) OR contains(description, :searchTerm))'
      );
      expressionAttributeNames['#title'] = 'title';
      expressionAttributeValues[':searchTerm'] = searchTerm;
    }

    return {
      filterExpression: filterConditions.length > 0 ? filterConditions.join(' AND ') : '',
      expressionAttributeNames,
      expressionAttributeValues,
    };
  }

  /**
   * Build query parameters for DynamoDB query
   */
  buildQueryParams(
    tableName: string,
    indexName: string,
    userId: string,
    filters: GetGoalsRequest,
    filterData: {
      filterExpression: string;
      expressionAttributeNames: Record<string, string>;
      expressionAttributeValues: Record<string, any>;
    }
  ): any {
    const { filterExpression, expressionAttributeNames, expressionAttributeValues } = filterData;

    // Add userId to expression values
    expressionAttributeValues[':userId'] = userId;

    const queryParams: any = {
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: filters.limit || 50,
    };

    if (Object.keys(expressionAttributeNames).length > 0) {
      queryParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
    }

    return queryParams;
  }
}

/**
 * Helper class for processing and sorting goals data
 * Extracted from GoalsRepository to follow SRP (Single Responsibility Principle)
 */
class GoalsDataProcessor {
  /**
   * Sort goals array based on filter criteria
   */
  sortGoals(goals: Goal[], filters: GetGoalsRequest): Goal[] {
    if (!filters.sortBy) {
      return goals;
    }

    return goals.sort((a, b) => {
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
          const priorityOrder = { high: 3, medium: 2, low: 1 };
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

  /**
   * Apply pagination to sorted goals
   */
  applyPagination(goals: Goal[], filters: GetGoalsRequest): Goal[] {
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    return goals.slice(offset, offset + limit);
  }
}

/**
 * Helper class for building DynamoDB update expressions
 * Extracted from GoalsRepository to follow SRP (Single Responsibility Principle)
 */
class GoalsUpdateBuilder {
  /**
   * Build update expression for DynamoDB UpdateCommand
   */
  buildUpdateExpression(updateData: Partial<Goal>): {
    updateExpression: string;
    expressionAttributeNames: Record<string, string>;
    expressionAttributeValues: Record<string, any>;
  } {
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

    return {
      updateExpression: `SET ${updateExpressions.join(', ')}`,
      expressionAttributeNames,
      expressionAttributeValues,
    };
  }
}

export interface IGoalsRepository
  extends IStandardCrudRepository<Goal, Goal, Partial<Goal>>,
    IUserScopedRepository<Goal, GetGoalsRequest> {
  /**
   * Find goals by user ID with standardized filtering and pagination
   * @param userId - User identifier
   * @param filters - Optional filtering parameters with GetGoalsRequest structure
   * @returns Promise<StandardQueryResult<Goal>> - Standardized paginated results
   * @throws RepositoryError
   */
  findByUserId(userId: string, filters?: GetGoalsRequest): Promise<StandardQueryResult<Goal>>;
}

export class GoalsRepository extends DynamoDBBaseRepository implements IGoalsRepository {
  private docClient: DynamoDBDocumentClient;
  private userIdIndexName: string;

  // Helper classes for SRP compliance
  private queryBuilder: GoalsQueryBuilder;
  private dataProcessor: GoalsDataProcessor;
  private updateBuilder: GoalsUpdateBuilder;

  constructor(dynamoClient: DynamoDBDocumentClient, config: ServiceConfig) {
    super('GoalsRepository', config, config.tables.goals);
    this.docClient = dynamoClient;
    this.userIdIndexName = 'UserGoalsIndex'; // GSI for querying by userId

    // Initialize helper classes
    this.queryBuilder = new GoalsQueryBuilder();
    this.dataProcessor = new GoalsDataProcessor();
    this.updateBuilder = new GoalsUpdateBuilder();
  }

  /**
   * Perform health check operation for DynamoDB connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: this.userIdIndexName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': 'health-check-user' },
        Limit: 1,
      })
    );
  }

  /**
   * Create a new goal in the database
   */
  async create(goal: Goal): Promise<Goal> {
    return this.executeWithErrorHandling(
      'create',
      async () => {
        this.validateRequired(
          {
            goalId: goal.goalId,
            userId: goal.userId,
            type: goal.type,
            targetValue: goal.targetValue,
          },
          'create'
        );

        try {
          await this.docClient.send(
            new PutCommand({
              TableName: this.tableName,
              Item: goal,
              ConditionExpression: 'attribute_not_exists(goalId)',
            })
          );

          this.logger.info('Goal created successfully', {
            goalId: goal.goalId,
            userId: goal.userId,
            type: goal.type,
            targetValue: goal.targetValue,
          });

          return goal;
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            throw this.createRepositoryError(
              'create',
              new Error('Goal with this ID already exists'),
              { goalId: goal.goalId }
            );
          }
          throw error;
        }
      },
      { goalId: goal.goalId, userId: goal.userId }
    );
  }

  /**
   * Find a goal by its ID
   */
  async findById(goalId: string): Promise<Goal | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        this.validateRequired({ goalId }, 'findById');

        const result = await this.docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: { goalId },
          })
        );

        if (!result.Item) {
          this.logger.debug('Goal not found', { goalId });
          return null;
        }

        this.logger.debug('Goal retrieved successfully', { goalId });
        return result.Item as Goal;
      },
      { goalId }
    );
  }

  /**
   * Find goals by user ID with optional filtering and pagination
   * Refactored to use helper classes for SRP compliance
   */
  async findByUserId(
    userId: string,
    filters: GetGoalsRequest = {}
  ): Promise<StandardQueryResult<Goal>> {
    return this.executeWithErrorHandling(
      'findByUserId',
      async () => {
        this.validateRequired({ userId }, 'findByUserId');

        this.logger.debug('Querying goals by userId', { userId, filters });

        // Use GoalsQueryBuilder to build filter expressions
        const filterData = this.queryBuilder.buildFilterExpression(filters);
        const queryParams = this.queryBuilder.buildQueryParams(
          this.tableName,
          this.userIdIndexName,
          userId,
          filters,
          filterData
        );

        // Execute query with pagination handling
        let allGoals: Goal[] = [];
        let lastEvaluatedKey: any = undefined;
        let totalScanned = 0;

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

        // Use GoalsDataProcessor for sorting and pagination
        const sortedGoals = this.dataProcessor.sortGoals(allGoals, filters);
        const paginatedGoals = this.dataProcessor.applyPagination(sortedGoals, filters);

        this.logger.info('Goals retrieved successfully', {
          userId,
          total: allGoals.length,
          returned: paginatedGoals.length,
          totalScanned,
          filters,
        });

        // Return standardized format
        return {
          items: paginatedGoals,
          total: allGoals.length,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          lastEvaluatedKey,
          hasMore: (filters.offset || 0) + paginatedGoals.length < allGoals.length,
        };
      },
      { userId, filters }
    );
  }

  /**
   * Update an existing goal
   * Refactored to use GoalsUpdateBuilder for SRP compliance
   */
  async update(goalId: string, updateData: Partial<Goal>): Promise<Goal> {
    return this.executeWithErrorHandling(
      'update',
      async () => {
        this.validateRequired({ goalId }, 'update');

        // Use GoalsUpdateBuilder to build update expression
        const { updateExpression, expressionAttributeNames, expressionAttributeValues } =
          this.updateBuilder.buildUpdateExpression(updateData);

        try {
          const result = await this.docClient.send(
            new UpdateCommand({
              TableName: this.tableName,
              Key: { goalId },
              UpdateExpression: updateExpression,
              ExpressionAttributeNames: expressionAttributeNames,
              ExpressionAttributeValues: expressionAttributeValues,
              ReturnValues: 'ALL_NEW',
              ConditionExpression: 'attribute_exists(goalId)',
            })
          );

          if (!result.Attributes) {
            throw new Error('Goal not found');
          }

          this.logger.info('Goal updated successfully', {
            goalId,
            updatedFields: Object.keys(updateData),
          });

          return result.Attributes as Goal;
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            throw this.createRepositoryError('update', new Error('Goal not found'), { goalId });
          }
          throw error;
        }
      },
      { goalId, updateFields: Object.keys(updateData) }
    );
  }

  /**
   * Delete a goal
   */
  async delete(goalId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        this.validateRequired({ goalId }, 'delete');

        try {
          await this.docClient.send(
            new DeleteCommand({
              TableName: this.tableName,
              Key: { goalId },
              ConditionExpression: 'attribute_exists(goalId)',
            })
          );

          this.logger.info('Goal deleted successfully', { goalId });
          return true;
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            this.logger.warn('Goal not found for deletion', { goalId });
            return false;
          }
          throw error;
        }
      },
      { goalId }
    );
  }

  /**
   * Check if a goal exists
   */
  async exists(goalId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'exists',
      async () => {
        this.validateRequired({ goalId }, 'exists');

        const result = await this.docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: { goalId },
            ProjectionExpression: 'goalId',
          })
        );

        return !!result.Item;
      },
      { goalId }
    );
  }
}
