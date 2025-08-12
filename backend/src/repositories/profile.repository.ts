// User profile repository implementation - Phase 26

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { 
  UserProfile, 
  ProfileStatistics, 
  Achievement, 
  IProfileRepository 
} from '../shared/types/profile.types';

export class ProfileRepository implements IProfileRepository {
  private dynamoClient: DynamoDBDocumentClient;
  private config: ServiceConfig;
  private logger = createLogger({ component: 'ProfileRepository' });

  constructor(config: ServiceConfig) {
    this.config = config;
    const client = new DynamoDBClient({ region: config.region });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    try {
      this.logger.debug('Finding user profile', { userId });

      const command = new GetCommand({
        TableName: this.config.tables.users, // Reuse existing users table
        Key: { userId }
      });

      const result = await this.dynamoClient.send(command);
      
      if (!result.Item) {
        this.logger.debug('User profile not found', { userId });
        return null;
      }

      // If profile data doesn't exist, create default profile
      const profile: UserProfile = {
        userId: result.Item.userId,
        email: result.Item.email,
        firstName: result.Item.firstName,
        lastName: result.Item.lastName,
        displayName: result.Item.displayName || `${result.Item.firstName || 'User'} ${result.Item.lastName || ''}`.trim(),
        avatarUrl: result.Item.avatarUrl,
        bio: result.Item.bio,
        timezone: result.Item.timezone || 'UTC',
        language: result.Item.language || 'en',
        studyPreferences: result.Item.studyPreferences || this.getDefaultStudyPreferences(),
        statistics: result.Item.statistics || this.getDefaultStatistics(),
        achievements: result.Item.achievements || [],
        createdAt: result.Item.createdAt,
        updatedAt: result.Item.updatedAt || new Date().toISOString()
      };

      this.logger.debug('User profile found', { userId, hasPreferences: !!result.Item.studyPreferences });
      return profile;
    } catch (error) {
      this.logger.error('Error finding user profile', error as Error, { userId });
      throw new Error(`Failed to find user profile: ${(error as Error).message}`);
    }
  }

  async create(profile: UserProfile): Promise<UserProfile> {
    try {
      this.logger.info('Creating user profile', { userId: profile.userId });

      const command = new PutCommand({
        TableName: this.config.tables.users,
        Item: profile,
        ConditionExpression: 'attribute_not_exists(userId)' // Prevent overwriting
      });

      await this.dynamoClient.send(command);
      
      this.logger.info('User profile created successfully', { userId: profile.userId });
      return profile;
    } catch (error) {
      this.logger.error('Error creating user profile', error as Error, { userId: profile.userId });
      throw new Error(`Failed to create user profile: ${(error as Error).message}`);
    }
  }

  async update(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      this.logger.info('Updating user profile', { userId, fields: Object.keys(updates) });

      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeNames: { [key: string]: string } = {};
      const expressionAttributeValues: { [key: string]: any } = {};

      Object.entries(updates).forEach(([key, value], index) => {
        if (value !== undefined && key !== 'userId') {
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          
          updateExpressions.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
        }
      });

      // Always update the updatedAt timestamp
      const timestampIndex = Object.keys(expressionAttributeValues).length;
      updateExpressions.push(`#updatedAt = :updatedAt`);
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const command = new UpdateCommand({
        TableName: this.config.tables.users,
        Key: { userId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      });

      const result = await this.dynamoClient.send(command);
      
      this.logger.info('User profile updated successfully', { userId });
      return result.Attributes as UserProfile;
    } catch (error) {
      this.logger.error('Error updating user profile', error as Error, { userId });
      throw new Error(`Failed to update user profile: ${(error as Error).message}`);
    }
  }

  async delete(userId: string): Promise<void> {
    try {
      this.logger.warn('Deleting user profile', { userId });

      const command = new DeleteCommand({
        TableName: this.config.tables.users,
        Key: { userId }
      });

      await this.dynamoClient.send(command);
      
      this.logger.warn('User profile deleted successfully', { userId });
    } catch (error) {
      this.logger.error('Error deleting user profile', error as Error, { userId });
      throw new Error(`Failed to delete user profile: ${(error as Error).message}`);
    }
  }

  async updateStatistics(userId: string, stats: Partial<ProfileStatistics>): Promise<void> {
    try {
      this.logger.debug('Updating profile statistics', { userId, metrics: Object.keys(stats) });

      const command = new UpdateCommand({
        TableName: this.config.tables.users,
        Key: { userId },
        UpdateExpression: 'SET statistics = if_not_exists(statistics, :defaultStats), updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':defaultStats': this.getDefaultStatistics(),
          ':updatedAt': new Date().toISOString()
        }
      });

      await this.dynamoClient.send(command);

      // Now merge the new statistics
      const mergeCommand = new UpdateCommand({
        TableName: this.config.tables.users,
        Key: { userId },
        UpdateExpression: `SET ${Object.keys(stats).map((key, i) => `statistics.#key${i} = :val${i}`).join(', ')}, updatedAt = :updatedAt`,
        ExpressionAttributeNames: Object.keys(stats).reduce((acc, key, i) => {
          acc[`#key${i}`] = key;
          return acc;
        }, {} as { [key: string]: string }),
        ExpressionAttributeValues: {
          ...Object.entries(stats).reduce((acc, [key, value], i) => {
            acc[`:val${i}`] = value;
            return acc;
          }, {} as { [key: string]: any }),
          ':updatedAt': new Date().toISOString()
        }
      });

      await this.dynamoClient.send(mergeCommand);
      
      this.logger.debug('Profile statistics updated successfully', { userId });
    } catch (error) {
      this.logger.error('Error updating profile statistics', error as Error, { userId });
      throw new Error(`Failed to update profile statistics: ${(error as Error).message}`);
    }
  }

  async addAchievement(userId: string, achievement: Achievement): Promise<void> {
    try {
      this.logger.info('Adding achievement to profile', { 
        userId, 
        achievementId: achievement.achievementId,
        type: achievement.type 
      });

      const command = new UpdateCommand({
        TableName: this.config.tables.users,
        Key: { userId },
        UpdateExpression: 'SET achievements = list_append(if_not_exists(achievements, :emptyList), :achievement), updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':achievement': [achievement],
          ':emptyList': [],
          ':updatedAt': new Date().toISOString()
        }
      });

      await this.dynamoClient.send(command);
      
      this.logger.info('Achievement added successfully', { userId, achievementId: achievement.achievementId });
    } catch (error) {
      this.logger.error('Error adding achievement', error as Error, { userId, achievementId: achievement.achievementId });
      throw new Error(`Failed to add achievement: ${(error as Error).message}`);
    }
  }

  private getDefaultStudyPreferences() {
    return {
      defaultSessionLength: 30,
      questionsPerSession: 20,
      difficulty: 'adaptive' as const,
      studyReminders: {
        enabled: false,
        frequency: 'daily' as const,
        daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
      },
      notifications: {
        goalMilestones: true,
        weeklyProgress: true,
        achievements: true,
        studyStreaks: true
      },
      uiPreferences: {
        theme: 'auto' as const,
        compactMode: false,
        showExplanations: true,
        autoAdvance: false
      }
    };
  }

  private getDefaultStatistics(): ProfileStatistics {
    return {
      totalStudyTime: 0,
      totalSessions: 0,
      totalQuestionsAnswered: 0,
      overallAccuracy: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageSessionLength: 0,
      favoriteTopics: [],
      weakestTopics: [],
      studyHeatmap: [],
      monthlyStats: []
    };
  }
}

// Re-export interfaces for external use
export type { IProfileRepository } from '../shared/types/profile.types';