// Analytics repository for progress data aggregation and retrieval

import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { 
  IAnalyticsRepository,
  SessionAnalyticsFilters,
  SessionAnalyticsData,
  UserProgressData,
  TopicPerformanceHistory,
  TrendData,
  AnalyticsSnapshot
} from '../shared/types/analytics.types';
import { StudySession } from '../shared/types/domain.types';
import { AnalyticsSessionManager } from './analytics-session-manager';
import { AnalyticsCalculator } from './analytics-calculator';
import { AnalyticsDataTransformer } from './analytics-data-transformer';
import { AnalyticsSnapshotManager } from './analytics-snapshot-manager';

export class AnalyticsRepository implements IAnalyticsRepository {
  private logger = createLogger({ repository: 'AnalyticsRepository' });

  // Helper classes for separated concerns
  private sessionManager: AnalyticsSessionManager;
  private calculator: AnalyticsCalculator;
  private dataTransformer: AnalyticsDataTransformer;
  private snapshotManager: AnalyticsSnapshotManager;

  constructor(
    private dynamoClient: DynamoDBDocumentClient,
    private config: ServiceConfig
  ) {
    // Initialize helper classes with proper dependency injection
    this.dataTransformer = new AnalyticsDataTransformer();
    this.sessionManager = new AnalyticsSessionManager(dynamoClient, config);
    this.calculator = new AnalyticsCalculator(this.sessionManager, this.dataTransformer);
    this.snapshotManager = new AnalyticsSnapshotManager(dynamoClient, config);
  }

  /**
   * Get completed sessions with analytics data
   * Delegates to AnalyticsSessionManager for pure data access
   */
  async getCompletedSessions(filters: SessionAnalyticsFilters): Promise<SessionAnalyticsData[]> {
    this.logger.info('Delegating getCompletedSessions to AnalyticsSessionManager', { filters });
    
    try {
      const sessions = await this.sessionManager.getCompletedSessions(filters);
      
      // Transform sessions to analytics data format using data transformer
      const analyticsData: SessionAnalyticsData[] = sessions.map(session => 
        this.dataTransformer.transformSessionToAnalyticsData(session as unknown as StudySession)
      );

      return analyticsData;
    } catch (error) {
      this.logger.error('Failed in AnalyticsRepository.getCompletedSessions delegation', error as Error);
      throw error;
    }
  }

  /**
   * Get user progress data from UserProgress table
   * Delegates to AnalyticsSessionManager for pure data access
   */
  async getUserProgressData(userId?: string): Promise<UserProgressData[]> {
    this.logger.info('Delegating getUserProgressData to AnalyticsSessionManager', { ...(userId && { userId }) });
    return this.sessionManager.getUserProgressData(userId);
  }

  /**
   * Get topic performance history (calculated from sessions)
   * Delegates to AnalyticsCalculator for analytical computations
   */
  async getTopicPerformanceHistory(topicIds: string[], userId?: string): Promise<TopicPerformanceHistory[]> {
    this.logger.info('Delegating getTopicPerformanceHistory to AnalyticsCalculator', { topicIds, ...(userId && { userId }) });
    return this.calculator.getTopicPerformanceHistory(topicIds, userId);
  }

  /**
   * Calculate trend data for a specific metric over time
   * Delegates to AnalyticsCalculator for analytical computations
   */
  async calculateTrendData(metric: string, timeframe: string, userId?: string): Promise<TrendData[]> {
    this.logger.info('Delegating calculateTrendData to AnalyticsCalculator', { metric, timeframe, ...(userId && { userId }) });
    return this.calculator.calculateTrendData(metric, timeframe, userId);
  }

  /**
   * Save analytics snapshot for caching
   * Delegates to AnalyticsSnapshotManager for snapshot operations
   */
  async saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
    this.logger.info('Delegating saveAnalyticsSnapshot to AnalyticsSnapshotManager', { 
      userId: snapshot.userId,
      snapshotDate: snapshot.snapshotDate 
    });
    return this.snapshotManager.saveAnalyticsSnapshot(snapshot);
  }

  /**
   * Get analytics snapshot from cache
   * Delegates to AnalyticsSnapshotManager for snapshot operations
   */
  async getAnalyticsSnapshot(userId?: string): Promise<AnalyticsSnapshot | null> {
    this.logger.info('Delegating getAnalyticsSnapshot to AnalyticsSnapshotManager', { ...(userId && { userId }) });
    return this.snapshotManager.getAnalyticsSnapshot(userId);
  }

  /**
   * Get session details for analytics
   * Delegates to AnalyticsSessionManager for data access
   */
  async getSessionDetails(sessionId: string): Promise<any> {
    this.logger.info('Delegating getSessionDetails to AnalyticsSessionManager', { sessionId });
    return this.sessionManager.getSessionDetails(sessionId);
  }

  /**
   * Get performance data for analytics
   * Delegates to AnalyticsSessionManager for data access
   */
  async getPerformanceData(params: any): Promise<any> {
    this.logger.info('Delegating getPerformanceData to AnalyticsSessionManager', { params });
    return this.sessionManager.getPerformanceData(params);
  }
}

export type { IAnalyticsRepository };