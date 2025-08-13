import { createLogger } from '../shared/logger';
import { AnalyticsSessionManager } from './analytics-session-manager';
import { AnalyticsDataTransformer } from './analytics-data-transformer';
import type {
  SessionAnalyticsData,
  TopicPerformanceHistory,
  TrendData,
} from '../shared/types/analytics.types';

/**
 * AnalyticsCalculator - Handles analytics calculations and trend analysis
 *
 * Single Responsibility: Mathematical computations and performance metrics
 * Extracted from AnalyticsRepository as part of SRP compliance (Objective 13)
 */
export class AnalyticsCalculator {
  private logger = createLogger({ component: 'AnalyticsCalculator' });

  constructor(
    private sessionManager: AnalyticsSessionManager,
    private dataTransformer: AnalyticsDataTransformer
  ) {}

  /**
   * Get topic performance history (calculated from sessions)
   */
  async getTopicPerformanceHistory(
    topicIds: string[],
    userId?: string
  ): Promise<TopicPerformanceHistory[]> {
    this.logger.info('Getting topic performance history', { topicIds, ...(userId && { userId }) });

    try {
      // Get completed sessions and extract topic performance over time
      const sessionFilters: any = { status: 'completed' };
      if (userId) sessionFilters.userId = userId;
      const sessions = await this.sessionManager.getCompletedSessions(sessionFilters);

      // Group by topic and date to calculate historical performance
      const historyMap = new Map<string, TopicPerformanceHistory>();

      for (const session of sessions) {
        const sessionDate = new Date(session.startTime).toISOString().split('T')[0];

        for (const topicData of session.topicBreakdown) {
          if (topicIds.length === 0 || topicIds.includes(topicData.topicId)) {
            const key = `${topicData.topicId}-${sessionDate}`;

            if (!historyMap.has(key)) {
              historyMap.set(key, {
                topicId: topicData.topicId,
                date: sessionDate,
                accuracy: 0,
                questionsAnswered: 0,
                averageTime: 0,
                masteryLevel: 'novice',
              });
            }

            const existing = historyMap.get(key)!;
            const totalQuestions = existing.questionsAnswered + topicData.questionsAnswered;
            const totalTime =
              existing.averageTime * existing.questionsAnswered +
              topicData.averageTime * topicData.questionsAnswered;

            existing.questionsAnswered = totalQuestions;
            existing.accuracy =
              (existing.accuracy * existing.questionsAnswered +
                topicData.accuracy * topicData.questionsAnswered) /
              totalQuestions;
            existing.averageTime = totalTime / totalQuestions;
            existing.masteryLevel = this.dataTransformer.calculateMasteryLevel(
              existing.accuracy,
              existing.questionsAnswered
            );
          }
        }
      }

      const history = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      this.logger.info('Successfully calculated topic performance history', {
        count: history.length,
        topicIds,
        ...(userId && { userId }),
      });

      return history;
    } catch (error) {
      this.logger.error('Failed to get topic performance history', error as Error, {
        topicIds,
        ...(userId && { userId }),
      });
      throw new Error(`Failed to retrieve topic performance history: ${(error as Error).message}`);
    }
  }

  /**
   * Calculate trend data for a specific metric over time
   */
  async calculateTrendData(
    metric: string,
    timeframe: string,
    userId?: string
  ): Promise<TrendData[]> {
    this.logger.info('Calculating trend data', { metric, timeframe, ...(userId && { userId }) });

    try {
      const sessionFilters: any = { status: 'completed' };
      if (userId) sessionFilters.userId = userId;
      const sessions = await this.sessionManager.getCompletedSessions(sessionFilters);

      // Group sessions by time period
      const periodMap = new Map<
        string,
        { sessions: SessionAnalyticsData[]; value: number; dataPoints: number }
      >();

      for (const session of sessions) {
        const period = this.dataTransformer.getPeriodKey(session.startTime, timeframe);

        if (!periodMap.has(period)) {
          periodMap.set(period, { sessions: [], value: 0, dataPoints: 0 });
        }

        periodMap.get(period)!.sessions.push(session);
      }

      // Calculate metric values for each period
      const trends: TrendData[] = [];
      const sortedPeriods = Array.from(periodMap.keys()).sort();

      for (let i = 0; i < sortedPeriods.length; i++) {
        const period = sortedPeriods[i];
        const data = periodMap.get(period)!;

        let value = 0;
        let dataPoints = data.sessions.length;

        switch (metric) {
          case 'accuracy':
            value = data.sessions.reduce((sum, s) => sum + s.accuracy, 0) / dataPoints;
            break;
          case 'studyTime':
            value = data.sessions.reduce((sum, s) => sum + s.duration, 0);
            break;
          case 'sessionCount':
            value = dataPoints;
            break;
          case 'questionsAnswered':
            value = data.sessions.reduce((sum, s) => sum + s.questionsAnswered, 0);
            break;
          default:
            value = 0;
        }

        // Calculate change from previous period
        let change = 0;
        if (i > 0) {
          const previousValue = trends[i - 1].value;
          change = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : 0;
        }

        trends.push({
          period,
          value,
          change,
          dataPoints,
        });
      }

      this.logger.info('Successfully calculated trend data', {
        metric,
        timeframe,
        pointsCount: trends.length,
        ...(userId && { userId }),
      });

      return trends;
    } catch (error) {
      this.logger.error('Failed to calculate trend data', error as Error, {
        metric,
        timeframe,
        ...(userId && { userId }),
      });
      throw new Error(`Failed to calculate trend data: ${(error as Error).message}`);
    }
  }
}
