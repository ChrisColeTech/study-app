// Analytics repository for progress data aggregation and retrieval

import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ServiceConfig } from '../shared/service-factory';
import { DynamoDBBaseRepository } from './base.repository';
import {
  IBaseRepository,
  StandardQueryParams,
  StandardQueryResult,
} from '../shared/types/repository.types';
import {
  SessionAnalyticsFilters as OriginalSessionAnalyticsFilters,
  SessionAnalyticsFilters,
  SessionAnalyticsData,
  UserProgressData,
  TopicPerformanceHistory,
  TrendData,
  AnalyticsSnapshot,
} from '../shared/types/analytics.types';
import { StudySession } from '../shared/types/domain.types';
import { AnalyticsSessionManager } from './analytics-session-manager';
import { AnalyticsCalculator } from './analytics-calculator';
import { AnalyticsDataTransformer } from './analytics-data-transformer';
import { AnalyticsSnapshotManager } from './analytics-snapshot-manager';

export interface IAnalyticsRepository extends IBaseRepository {
  /**
   * Get completed session analytics data with standardized result format
   * @param filters - Session analytics filters with pagination
   * @returns Promise<StandardQueryResult<SessionAnalyticsData>> - Standardized paginated results
   * @throws RepositoryError
   */
  getCompletedSessions(
    filters: SessionAnalyticsFilters & StandardQueryParams
  ): Promise<StandardQueryResult<SessionAnalyticsData>>;

  /**
   * Get user progress data with standardized result format
   * @param filters - User progress filters with pagination
   * @returns Promise<StandardQueryResult<UserProgressData>> - Standardized paginated results
   * @throws RepositoryError
   */
  getUserProgressData(
    filters?: StandardQueryParams & { userId?: string }
  ): Promise<StandardQueryResult<UserProgressData>>;

  /**
   * Get topic performance history with standardized result format
   * @param topicIds - Topic identifiers
   * @param filters - Optional filtering and pagination parameters
   * @returns Promise<StandardQueryResult<TopicPerformanceHistory>> - Standardized paginated results
   * @throws RepositoryError
   */
  getTopicPerformanceHistory(
    topicIds: string[],
    filters?: StandardQueryParams & { userId?: string }
  ): Promise<StandardQueryResult<TopicPerformanceHistory>>;

  /**
   * Calculate trend data for metrics with standardized result format
   * @param metric - Metric name
   * @param timeframe - Time range
   * @param filters - Optional filtering and pagination parameters
   * @returns Promise<StandardQueryResult<TrendData>> - Standardized paginated results
   * @throws RepositoryError
   */
  calculateTrendData(
    metric: string,
    timeframe: string,
    filters?: StandardQueryParams & { userId?: string }
  ): Promise<StandardQueryResult<TrendData>>;

  /**
   * Save analytics snapshot
   * @param snapshot - Analytics snapshot data
   * @returns Promise<void>
   * @throws RepositoryError
   */
  saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void>;

  /**
   * Get analytics snapshot
   * @param userId - Optional user ID filter
   * @returns Promise<AnalyticsSnapshot | null> - Analytics snapshot if found
   * @throws RepositoryError
   */
  getAnalyticsSnapshot(userId?: string): Promise<AnalyticsSnapshot | null>;

  /**
   * Get session details for analytics
   * @param sessionId - Session identifier
   * @returns Promise<any> - Session details
   * @throws RepositoryError
   */
  getSessionDetails(sessionId: string): Promise<any>;

  /**
   * Get performance data with standardized result format
   * @param filters - Performance query parameters with pagination
   * @returns Promise<StandardQueryResult<any>> - Standardized paginated results
   * @throws RepositoryError
   */
  getPerformanceData(
    filters: StandardQueryParams & { params?: any }
  ): Promise<StandardQueryResult<any>>;
}

export class AnalyticsRepository extends DynamoDBBaseRepository implements IAnalyticsRepository {
  // Helper classes for separated concerns
  private sessionManager: AnalyticsSessionManager;
  private calculator: AnalyticsCalculator;
  private dataTransformer: AnalyticsDataTransformer;
  private snapshotManager: AnalyticsSnapshotManager;

  constructor(
    private dynamoClient: DynamoDBDocumentClient,
    config: ServiceConfig
  ) {
    super('AnalyticsRepository', config, config.tables.studySessions);

    // Initialize helper classes with proper dependency injection
    this.dataTransformer = new AnalyticsDataTransformer();
    this.sessionManager = new AnalyticsSessionManager(dynamoClient, config);
    this.calculator = new AnalyticsCalculator(this.sessionManager, this.dataTransformer);
    this.snapshotManager = new AnalyticsSnapshotManager(dynamoClient, config);
  }

  /**
   * Perform health check operation for DynamoDB connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'sessionId = :sessionId',
        ExpressionAttributeValues: { ':sessionId': 'health-check-session' },
        Limit: 1,
      })
    );
  }

  /**
   * Get completed sessions with analytics data
   * Delegates to AnalyticsSessionManager for pure data access
   */
  async getCompletedSessions(
    filters: SessionAnalyticsFilters & StandardQueryParams
  ): Promise<StandardQueryResult<SessionAnalyticsData>> {
    return this.executeWithErrorHandling(
      'getCompletedSessions',
      async () => {
        this.logger.info('Delegating getCompletedSessions to AnalyticsSessionManager', { filters });

        const sessions = await this.sessionManager.getCompletedSessions(filters);

        // Transform sessions to analytics data format using data transformer
        const analyticsData: SessionAnalyticsData[] = sessions.map(session =>
          this.dataTransformer.transformSessionToAnalyticsData(session as unknown as StudySession)
        );

        // Return standardized result format
        return {
          items: analyticsData,
          total: analyticsData.length,
          limit: filters.limit || this.config.query?.defaultLimit || 20,
          offset: filters.offset || 0,
          hasMore: false, // Will be calculated properly when pagination is implemented
          executionTimeMs: 0, // Will be set by executeWithErrorHandling
        };
      },
      { filters }
    );
  }

  /**
   * Get user progress data from UserProgress table
   * Delegates to AnalyticsSessionManager for pure data access
   */
  async getUserProgressData(
    filters?: StandardQueryParams & { userId?: string }
  ): Promise<StandardQueryResult<UserProgressData>> {
    return this.executeWithErrorHandling(
      'getUserProgressData',
      async () => {
        this.logger.info('Delegating getUserProgressData to AnalyticsSessionManager', { filters });

        const progressData = await this.sessionManager.getUserProgressData(filters?.userId);

        // Return standardized result format
        return {
          items: progressData,
          total: progressData.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: false, // Will be calculated properly when pagination is implemented
          executionTimeMs: 0, // Will be set by executeWithErrorHandling
        };
      },
      { filters }
    );
  }

  /**
   * Get topic performance history (calculated from sessions)
   * Delegates to AnalyticsCalculator for analytical computations
   */
  async getTopicPerformanceHistory(
    topicIds: string[],
    filters?: StandardQueryParams & { userId?: string }
  ): Promise<StandardQueryResult<TopicPerformanceHistory>> {
    return this.executeWithErrorHandling(
      'getTopicPerformanceHistory',
      async () => {
        this.validateRequired({ topicIds }, 'getTopicPerformanceHistory');
        this.logger.info('Delegating getTopicPerformanceHistory to AnalyticsCalculator', {
          topicIds,
          filters,
        });

        const performanceHistory = await this.calculator.getTopicPerformanceHistory(
          topicIds,
          filters?.userId
        );

        // Return standardized result format
        return {
          items: performanceHistory,
          total: performanceHistory.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: false, // Will be calculated properly when pagination is implemented
          executionTimeMs: 0, // Will be set by executeWithErrorHandling
        };
      },
      { topicIds, filters }
    );
  }

  /**
   * Calculate trend data for a specific metric over time
   * Delegates to AnalyticsCalculator for analytical computations
   */
  async calculateTrendData(
    metric: string,
    timeframe: string,
    filters?: StandardQueryParams & { userId?: string }
  ): Promise<StandardQueryResult<TrendData>> {
    return this.executeWithErrorHandling(
      'calculateTrendData',
      async () => {
        this.validateRequired({ metric, timeframe }, 'calculateTrendData');
        this.logger.info('Delegating calculateTrendData to AnalyticsCalculator', {
          metric,
          timeframe,
          filters,
        });

        const trendData = await this.calculator.calculateTrendData(
          metric,
          timeframe,
          filters?.userId
        );

        // Return standardized result format
        return {
          items: trendData,
          total: trendData.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: false, // Will be calculated properly when pagination is implemented
          executionTimeMs: 0, // Will be set by executeWithErrorHandling
        };
      },
      { metric, timeframe, filters }
    );
  }

  /**
   * Save analytics snapshot for caching
   * Delegates to AnalyticsSnapshotManager for snapshot operations
   */
  async saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
    return this.executeWithErrorHandling(
      'saveAnalyticsSnapshot',
      async () => {
        this.validateRequired(
          {
            userId: snapshot.userId,
            snapshotDate: snapshot.snapshotDate,
          },
          'saveAnalyticsSnapshot'
        );

        this.logger.info('Delegating saveAnalyticsSnapshot to AnalyticsSnapshotManager', {
          userId: snapshot.userId,
          snapshotDate: snapshot.snapshotDate,
        });
        return this.snapshotManager.saveAnalyticsSnapshot(snapshot);
      },
      { userId: snapshot.userId, snapshotDate: snapshot.snapshotDate }
    );
  }

  /**
   * Get analytics snapshot from cache
   * Delegates to AnalyticsSnapshotManager for snapshot operations
   */
  async getAnalyticsSnapshot(userId?: string): Promise<AnalyticsSnapshot | null> {
    return this.executeWithErrorHandling(
      'getAnalyticsSnapshot',
      async () => {
        this.logger.info('Delegating getAnalyticsSnapshot to AnalyticsSnapshotManager', {
          ...(userId && { userId }),
        });
        return this.snapshotManager.getAnalyticsSnapshot(userId);
      },
      { ...(userId && { userId }) }
    );
  }

  /**
   * Get session details for analytics
   * Delegates to AnalyticsSessionManager for data access
   */
  async getSessionDetails(sessionId: string): Promise<any> {
    return this.executeWithErrorHandling(
      'getSessionDetails',
      async () => {
        this.validateRequired({ sessionId }, 'getSessionDetails');
        this.logger.info('Delegating getSessionDetails to AnalyticsSessionManager', { sessionId });
        return this.sessionManager.getSessionDetails(sessionId);
      },
      { sessionId }
    );
  }

  /**
   * Get performance data for analytics
   * Delegates to AnalyticsSessionManager for data access
   */
  async getPerformanceData(params: any): Promise<any> {
    return this.executeWithErrorHandling(
      'getPerformanceData',
      async () => {
        this.logger.info('Delegating getPerformanceData to AnalyticsSessionManager', { params });
        return this.sessionManager.getPerformanceData(params);
      },
      { params }
    );
  }
}
