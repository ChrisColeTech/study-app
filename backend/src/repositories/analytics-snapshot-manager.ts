import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { createLogger } from '../shared/logger';
import type { ServiceConfig } from '../shared/service-factory';
import type { AnalyticsSnapshot } from '../shared/types/analytics.types';

/**
 * AnalyticsSnapshotManager - Handles analytics snapshot management
 *
 * Single Responsibility: Analytics snapshot caching and retrieval
 * Extracted from AnalyticsRepository as part of SRP compliance (Objective 13)
 */
export class AnalyticsSnapshotManager {
  private logger = createLogger({ component: 'AnalyticsSnapshotManager' });

  constructor(
    private dynamoClient: DynamoDBDocumentClient,
    private config: ServiceConfig
  ) {}

  /**
   * Save analytics snapshot for caching
   */
  async saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
    this.logger.info('Saving analytics snapshot', {
      userId: snapshot.userId,
      snapshotDate: snapshot.snapshotDate,
    });

    try {
      // Use a separate table or extend existing table for analytics snapshots
      // For now, using userProgress table with a special record type
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.config.tables.userProgress,
          Item: {
            userId: snapshot.userId,
            topicId: `ANALYTICS_SNAPSHOT_${snapshot.snapshotDate}`,
            examId: 'ANALYTICS',
            providerId: 'SYSTEM',
            snapshotData: snapshot,
            recordType: 'analytics_snapshot',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        })
      );

      this.logger.info('Successfully saved analytics snapshot', {
        userId: snapshot.userId,
        snapshotDate: snapshot.snapshotDate,
      });
    } catch (error) {
      this.logger.error('Failed to save analytics snapshot', error as Error, {
        userId: snapshot.userId,
        snapshotDate: snapshot.snapshotDate,
      });
      throw new Error(`Failed to save analytics snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * Get analytics snapshot from cache
   */
  async getAnalyticsSnapshot(userId?: string): Promise<AnalyticsSnapshot | null> {
    if (!userId) return null;

    this.logger.info('Getting analytics snapshot', { ...(userId && { userId }) });

    try {
      // Get the most recent snapshot
      const today = new Date().toISOString().split('T')[0];

      const result = await this.dynamoClient.send(
        new GetCommand({
          TableName: this.config.tables.userProgress,
          Key: {
            userId: userId,
            topicId: `ANALYTICS_SNAPSHOT_${today}`,
          },
        })
      );

      if (result.Item && result.Item.snapshotData) {
        this.logger.info('Successfully retrieved analytics snapshot', {
          ...(userId && { userId }),
        });
        return result.Item.snapshotData as AnalyticsSnapshot;
      }

      this.logger.info('No analytics snapshot found', { ...(userId && { userId }) });
      return null;
    } catch (error) {
      this.logger.error('Failed to get analytics snapshot', error as Error, {
        ...(userId && { userId }),
      });
      throw new Error(`Failed to retrieve analytics snapshot: ${(error as Error).message}`);
    }
  }
}
