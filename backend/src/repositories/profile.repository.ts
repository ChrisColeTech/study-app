// User profile repository implementation - Phase 26

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { ServiceConfig } from '../shared/service-factory';
import { DynamoDBBaseRepository } from './base.repository';
import {
  UserProfile,
  ProfileStatistics,
  Achievement,
  IProfileRepository,
} from '../shared/types/profile.types';

export class ProfileRepository extends DynamoDBBaseRepository implements IProfileRepository {
  private dynamoClient: DynamoDBDocumentClient;

  constructor(config: ServiceConfig) {
    super('ProfileRepository', config, config.tables.users);
    const client = new DynamoDBClient({ region: config.region });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
  }

  /**
   * Perform health check operation for DynamoDB connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: { ':userId': 'health-check-user' },
        Limit: 1,
      })
    );
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.executeWithErrorHandling(
      'findByUserId',
      async () => {
        this.validateRequired({ userId }, 'findByUserId');
        this.logger.debug('Finding user profile', { userId });

        const command = new GetCommand({
          TableName: this.tableName,
          Key: { userId },
        });

        const result = await this.dynamoClient.send(command);

        if (!result.Item) {
          this.logger.debug('Profile not found', { userId });
          return null;
        }

        // Convert DynamoDB item to UserProfile
        const profile: UserProfile = {
          userId: result.Item.userId,
          email: result.Item.email,
          firstName: result.Item.firstName,
          lastName: result.Item.lastName,
          displayName:
            result.Item.displayName || `${result.Item.firstName} ${result.Item.lastName}`,
          avatarUrl: result.Item.avatarUrl,
          bio: result.Item.bio,
          language: result.Item.language || 'en',
          studyPreferences: result.Item.studyPreferences || {
            defaultSessionLength: 30,
            questionsPerSession: 20,
            difficulty: 'adaptive',
            studyReminders: {
              enabled: false,
              frequency: 'daily',
            },
            notifications: {
              goalMilestones: true,
              weeklyProgress: true,
              achievements: true,
              studyStreaks: true,
            },
            uiPreferences: {
              theme: 'auto',
              compactMode: false,
              showExplanations: true,
              autoAdvance: false,
            },
          },
          statistics: result.Item.statistics || {
            totalSessions: 0,
            correctAnswers: 0,
            totalQuestions: 0,
            averageScore: 0,
            studyStreak: 0,
            totalStudyTime: 0,
            averageSessionTime: 0,
            difficultyBreakdown: {},
            topicPerformance: {},
            providerProgress: {},
          },
          achievements: result.Item.achievements || [],
          createdAt: result.Item.createdAt || new Date().toISOString(),
          updatedAt: result.Item.updatedAt || new Date().toISOString(),
        };

        this.logger.debug('Profile found', { userId, profileExists: true });
        return profile;
      },
      { userId }
    );
  }

  async create(profile: UserProfile): Promise<UserProfile> {
    return this.executeWithErrorHandling(
      'create',
      async () => {
        this.validateRequired(
          {
            userId: profile.userId,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
          },
          'create'
        );

        this.logger.debug('Creating user profile', { userId: profile.userId });

        const command = new PutCommand({
          TableName: this.tableName,
          Item: {
            ...profile,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ConditionExpression: 'attribute_not_exists(userId)',
        });

        await this.dynamoClient.send(command);

        this.logger.info('Profile created successfully', { userId: profile.userId });
        return {
          ...profile,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
      { userId: profile.userId }
    );
  }

  async update(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return this.executeWithErrorHandling(
      'update',
      async () => {
        this.validateRequired({ userId }, 'update');
        this.logger.debug('Updating user profile', { userId, updates: Object.keys(updates) });

        // Build update expression
        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        // Always update timestamp
        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = new Date().toISOString();

        // Handle dynamic updates
        Object.entries(updates).forEach(([key, value]) => {
          if (key !== 'userId' && key !== 'createdAt' && value !== undefined) {
            const attributeKey = `#${key}`;
            const valueKey = `:${key}`;
            updateExpressions.push(`${attributeKey} = ${valueKey}`);
            expressionAttributeNames[attributeKey] = key;
            expressionAttributeValues[valueKey] = value;
          }
        });

        const command = new UpdateCommand({
          TableName: this.tableName,
          Key: { userId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ConditionExpression: 'attribute_exists(userId)',
          ReturnValues: 'ALL_NEW',
        });

        const result = await this.dynamoClient.send(command);

        if (!result.Attributes) {
          throw this.createRepositoryError('update', new Error('Profile not found'), { userId });
        }

        this.logger.info('Profile updated successfully', { userId });
        return result.Attributes as UserProfile;
      },
      { userId, updateFields: Object.keys(updates) }
    );
  }

  async delete(userId: string): Promise<boolean> {
    return this.executeWithErrorHandling(
      'delete',
      async () => {
        this.validateRequired({ userId }, 'delete');
        this.logger.debug('Deleting user profile', { userId });

        try {
          const command = new DeleteCommand({
            TableName: this.tableName,
            Key: { userId },
            ConditionExpression: 'attribute_exists(userId)',
          });

          await this.dynamoClient.send(command);

          this.logger.info('Profile deleted successfully', { userId });
          return true;
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            this.logger.debug('Profile not found for deletion', { userId });
            return false;
          }
          throw error;
        }
      },
      { userId }
    );
  }

  async updateStatistics(userId: string, stats: Partial<ProfileStatistics>): Promise<void> {
    return this.executeWithErrorHandling(
      'updateStatistics',
      async () => {
        this.validateRequired({ userId }, 'updateStatistics');
        this.logger.debug('Updating profile statistics', { userId, stats: Object.keys(stats) });

        // Build nested update for statistics
        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = new Date().toISOString();

        Object.entries(stats).forEach(([key, value]) => {
          if (value !== undefined) {
            const attributeKey = `#statistics.#${key}`;
            const valueKey = `:${key}`;
            updateExpressions.push(`${attributeKey} = ${valueKey}`);
            expressionAttributeNames['#statistics'] = 'statistics';
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[valueKey] = value;
          }
        });

        const command = new UpdateCommand({
          TableName: this.tableName,
          Key: { userId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ConditionExpression: 'attribute_exists(userId)',
        });

        await this.dynamoClient.send(command);

        this.logger.info('Profile statistics updated successfully', { userId });
      },
      { userId, statFields: Object.keys(stats) }
    );
  }

  async addAchievement(userId: string, achievement: Achievement): Promise<void> {
    return this.executeWithErrorHandling(
      'addAchievement',
      async () => {
        this.validateRequired(
          {
            userId,
            achievementId: achievement.achievementId,
          },
          'addAchievement'
        );

        this.logger.debug('Adding achievement to profile', {
          userId,
          achievementId: achievement.achievementId,
        });

        const command = new UpdateCommand({
          TableName: this.tableName,
          Key: { userId },
          UpdateExpression:
            'SET #achievements = list_append(if_not_exists(#achievements, :empty_list), :achievement), #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#achievements': 'achievements',
            '#updatedAt': 'updatedAt',
          },
          ExpressionAttributeValues: {
            ':achievement': [achievement],
            ':empty_list': [],
            ':updatedAt': new Date().toISOString(),
          },
          ConditionExpression: 'attribute_exists(userId)',
        });

        await this.dynamoClient.send(command);

        this.logger.info('Achievement added successfully', {
          userId,
          achievementId: achievement.achievementId,
        });
      },
      { userId, achievementId: achievement.achievementId }
    );
  }

  // Required by IStandardCrudRepository
  async findById(id: string): Promise<UserProfile | null> {
    return this.findByUserId(id);
  }

  async exists(id: string): Promise<boolean> {
    const profile = await this.findByUserId(id);
    return profile !== null;
  }
}

// Re-export interfaces for external use
export type { IProfileRepository } from '../shared/types/profile.types';
