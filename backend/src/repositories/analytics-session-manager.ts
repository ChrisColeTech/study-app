import { DynamoDBDocumentClient, ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '../shared/logger';
import type { ServiceConfig } from '../shared/service-factory';
import type {
  SessionAnalyticsFilters,
  SessionAnalyticsData,
  UserProgressData,
} from '../shared/types/analytics.types';
import type { StudySession } from '../shared/types/domain.types';

/**
 * AnalyticsSessionManager - Handles session and user progress data access
 *
 * Single Responsibility: Pure DynamoDB operations for analytics data retrieval
 * Extracted from AnalyticsRepository as part of SRP compliance (Objective 13)
 */
export class AnalyticsSessionManager {
  private logger = createLogger({ component: 'AnalyticsSessionManager' });

  constructor(
    private dynamoClient: DynamoDBDocumentClient,
    private config: ServiceConfig
  ) {}

  /**
   * Get completed sessions with analytics data
   */
  async getCompletedSessions(filters: SessionAnalyticsFilters): Promise<SessionAnalyticsData[]> {
    this.logger.info('Getting completed sessions for analytics', { filters });

    try {
      // Validate configuration exists
      if (!this.config?.tables?.studySessions) {
        this.logger.error('Study sessions table configuration is missing');
        throw new Error('Study sessions table configuration is missing');
      }

      // Query completed sessions from DynamoDB
      const params: any = {
        TableName: this.config.tables.studySessions,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'completed',
        },
      };

      // Add additional filters with null safety
      if (filters?.userId) {
        params.FilterExpression += ' AND #userId = :userId';
        params.ExpressionAttributeNames['#userId'] = 'userId';
        params.ExpressionAttributeValues[':userId'] = filters.userId;
      }

      if (filters?.providerId) {
        params.FilterExpression += ' AND #providerId = :providerId';
        params.ExpressionAttributeNames['#providerId'] = 'providerId';
        params.ExpressionAttributeValues[':providerId'] = filters.providerId;
      }

      if (filters?.examId) {
        params.FilterExpression += ' AND #examId = :examId';
        params.ExpressionAttributeNames['#examId'] = 'examId';
        params.ExpressionAttributeValues[':examId'] = filters.examId;
      }

      if (filters?.startDate) {
        params.FilterExpression += ' AND #startTime >= :startDate';
        params.ExpressionAttributeNames['#startTime'] = 'startTime';
        params.ExpressionAttributeValues[':startDate'] = filters.startDate;
      }

      if (filters?.endDate) {
        params.FilterExpression += ' AND #startTime <= :endDate';
        params.ExpressionAttributeNames['#startTime'] = 'startTime';
        params.ExpressionAttributeValues[':endDate'] = filters.endDate;
      }

      if (filters?.limit && typeof filters.limit === 'number') {
        params.Limit = filters.limit;
      }

      const result = await this.dynamoClient.send(new ScanCommand(params));
      const sessions = result.Items || [];

      this.logger.info('Successfully retrieved sessions for analytics', {
        count: sessions.length,
        filters,
      });

      return sessions as SessionAnalyticsData[];
    } catch (error) {
      this.logger.error('Failed to get completed sessions for analytics', error as Error, {
        filters,
      });
      throw new Error(`Failed to retrieve session analytics data: ${(error as Error).message}`);
    }
  }

  /**
   * Get user progress data from UserProgress table
   */
  async getUserProgressData(userId?: string): Promise<UserProgressData[]> {
    this.logger.info('Getting user progress data', { ...(userId && { userId }) });

    try {
      // Validate configuration exists
      if (!this.config?.tables?.userProgress) {
        this.logger.warn('User progress table configuration is missing, returning empty array');
        return [];
      }

      const params: any = {
        TableName: this.config.tables.userProgress,
      };

      if (userId) {
        params.FilterExpression = '#userId = :userId';
        params.ExpressionAttributeNames = { '#userId': 'userId' };
        params.ExpressionAttributeValues = { ':userId': userId };
      }

      const result = await this.dynamoClient.send(new ScanCommand(params));
      const progressData = result.Items || [];

      this.logger.info('Successfully retrieved user progress data', {
        count: progressData.length,
        ...(userId && { userId }),
      });

      return progressData as UserProgressData[];
    } catch (error) {
      this.logger.error('Failed to get user progress data', error as Error, {
        ...(userId && { userId }),
      });
      
      // Return empty array instead of throwing to prevent 500 errors
      this.logger.warn('Returning empty user progress data due to error');
      return [];
    }
  }

  /**
   * Get session details for analytics
   */
  async getSessionDetails(sessionId: string): Promise<any> {
    this.logger.info('Getting session details for analytics', { sessionId });

    try {
      // Validate configuration exists
      if (!this.config?.tables?.studySessions) {
        this.logger.error('Study sessions table configuration is missing');
        throw new Error('Study sessions table configuration is missing');
      }

      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const params = {
        TableName: this.config.tables.studySessions,
        Key: { sessionId },
      };

      const response = await this.dynamoClient.send(new GetCommand(params));

      if (!response.Item) {
        this.logger.warn('Session not found for analytics', { sessionId });
        return null;
      }

      // Transform to analytics format with null safety
      const session = response.Item as StudySession;
      
      // Safe access to session properties
      const questions = Array.isArray(session.questions) ? session.questions : [];
      
      const correctAnswers = questions.filter((q: any) => {
        if (!q) return false;
        
        const userAnswer = q.userAnswer;
        const correctAnswer = q.correctAnswer;
        
        if (!userAnswer || !correctAnswer) return false;
        if (!Array.isArray(userAnswer) || !Array.isArray(correctAnswer)) return false;
        
        try {
          return JSON.stringify(userAnswer.sort()) === JSON.stringify(correctAnswer.sort());
        } catch {
          return false;
        }
      }).length;

      const totalTime = questions.reduce((sum: number, q: any) => {
        const timeSpent = typeof q?.timeSpent === 'number' ? q.timeSpent : 0;
        return sum + timeSpent;
      }, 0);

      return {
        sessionId: session.sessionId || sessionId,
        totalAnswers: questions.length,
        correctAnswers,
        totalTime,
        providerId: session.providerId || 'unknown',
        examId: session.examId || 'unknown',
        completedAt: session.updatedAt || session.endTime || new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get session details', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Get performance data for analytics
   */
  async getPerformanceData(params: any): Promise<any> {
    this.logger.info('Getting performance data for analytics', { params });

    try {
      // For now, return mock performance data structure
      return {
        sessions: [],
        accuracy: 0,
        averageTime: 0,
        competencyScores: {},
      };
    } catch (error) {
      this.logger.error('Failed to get performance data', error as Error, { params });
      throw error;
    }
  }
}
