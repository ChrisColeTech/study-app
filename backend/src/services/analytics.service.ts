// Analytics service for progress tracking and insights generation

import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';
import {
  IAnalyticsService,
  IAnalyticsRepository,
  IProgressAnalyzer,
  ICompetencyAnalyzer,
  IPerformanceAnalyzer,
  IInsightGenerator,
  ProgressAnalyticsRequest,
  ProgressAnalyticsResponse,
  ProgressOverview,
  ProgressTrends,
  CompetencyAnalytics,
  HistoricalPerformance,
  LearningInsights,
  VisualizationData,
  SessionPerformanceAnalytics,
} from '../shared/types/analytics.types';

export class AnalyticsService extends BaseService implements IAnalyticsService {
  constructor(
    private analyticsRepository: IAnalyticsRepository,
    private progressAnalyzer: IProgressAnalyzer,
    private competencyAnalyzer: ICompetencyAnalyzer,
    private performanceAnalyzer: IPerformanceAnalyzer,
    private insightGenerator: IInsightGenerator
  ) {
    super();
  }

  /**
   * Get detailed session analytics - Phase 24 implementation
   */
  async getSessionAnalytics(sessionId: string): Promise<SessionPerformanceAnalytics> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(sessionId, 'sessionId');

        // Get session details and calculate analytics
        const sessionDetails = await this.analyticsRepository.getSessionDetails(sessionId);
        this.validateEntityExists(sessionDetails, 'Session', sessionId);

        // Calculate detailed session metrics
        const analytics: SessionPerformanceAnalytics = {
          difficulty: this.performanceAnalyzer.calculateDifficultyBreakdown(sessionDetails),
          topics: this.performanceAnalyzer.calculateTopicBreakdown(sessionDetails),
          timeDistribution: {
            fastQuestions: 0, // Would calculate from actual session data
            normalQuestions: 0,
            slowQuestions: 0,
            averageTimeEasy: 0,
            averageTimeMedium: 0,
            averageTimeHard: 0,
          },
          progressUpdates: [], // Would calculate from user progress data
        };

        this.logSuccess('Session analytics generated successfully', {
          sessionId,
          difficultyCount: analytics.difficulty.length,
          topicCount: analytics.topics.length,
        });

        return analytics;
      },
      {
        operation: 'get session analytics',
        entityType: 'Session',
        entityId: sessionId,
      }
    );
  }

  /**
   * Get performance analytics - Phase 25 implementation
   */
  async getPerformanceAnalytics(params: any): Promise<any> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(params, 'params');

        const result = await this.performanceAnalyzer.getPerformanceAnalytics(params);

        this.logSuccess('Performance analytics generated successfully', {
          paramsCount: Object.keys(params).length,
        });

        return result;
      },
      {
        operation: 'get performance analytics',
        entityType: 'PerformanceAnalytics',
        requestData: params,
      }
    );
  }

  /**
   * Get comprehensive progress analytics - Main orchestration method
   */
  async getProgressAnalytics(
    request: ProgressAnalyticsRequest
  ): Promise<ProgressAnalyticsResponse> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(request, 'request');

        const userId = undefined; // Will be extracted from auth context in Phase 30
        const timeframe = request.timeframe || 'month';
        const startDate = request.startDate || this.getTimeframeStartDate(timeframe);
        const endDate = request.endDate || new Date().toISOString();

        // Calculate all analytics components in parallel for better performance using decomposed services
        const [overview, trends, competencyData, historicalData, insights] = await Promise.all([
          this.progressAnalyzer.calculateProgressOverview(userId),
          this.progressAnalyzer.generateProgressTrends(timeframe, userId),
          this.competencyAnalyzer.analyzeCompetencies(userId),
          this.progressAnalyzer.getHistoricalPerformance(startDate, endDate, userId),
          this.insightGenerator.generateLearningInsights(userId),
        ]);

        // Prepare visualization data
        const visualizationData = await this.insightGenerator.prepareVisualizationData({
          overview,
          trends,
          competencyData,
          historicalData,
        });

        // Get session count for metadata
        const sessionFilters: any = { startDate, endDate };
        if (userId) sessionFilters.userId = userId;
        const sessions = await this.analyticsRepository.getCompletedSessions(sessionFilters);

        const response: ProgressAnalyticsResponse = {
          success: true,
          data: {
            overview,
            trends,
            competencyData,
            historicalData,
            insights,
            visualizationData,
          },
          metadata: {
            timeframe: timeframe,
            periodStart: startDate,
            periodEnd: endDate,
            totalSessions: sessions.length,
            dataPoints: historicalData.length,
            calculatedAt: new Date().toISOString(),
          },
        };

        this.logSuccess('Progress analytics generated successfully', {
          totalSessions: sessions.length,
          overallAccuracy: overview.overallAccuracy,
          topicCount: competencyData.topicCompetencies.length,
        });

        return response;
      },
      {
        operation: 'generate progress analytics',
        entityType: 'ProgressAnalytics',
        requestData: { timeframe: request.timeframe },
      }
    );
  }

  /**
   * Calculate progress overview metrics - Delegated to ProgressAnalyzer
   */
  async calculateProgressOverview(userId?: string): Promise<ProgressOverview> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.progressAnalyzer.calculateProgressOverview(userId);
      },
      {
        operation: 'calculate progress overview',
        entityType: 'ProgressOverview',
        ...(userId && { userId }),
      }
    );
  }

  /**
   * Generate progress trends over time - Delegated to ProgressAnalyzer
   */
  async generateProgressTrends(timeframe: string, userId?: string): Promise<ProgressTrends> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(timeframe, 'timeframe');
        return await this.progressAnalyzer.generateProgressTrends(timeframe, userId);
      },
      {
        operation: 'generate progress trends',
        entityType: 'ProgressTrends',
        requestData: { timeframe },
        ...(userId && { userId }),
      }
    );
  }

  /**
   * Analyze competencies across topics and providers - Delegated to CompetencyAnalyzer
   */
  async analyzeCompetencies(userId?: string): Promise<CompetencyAnalytics> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.competencyAnalyzer.analyzeCompetencies(userId);
      },
      {
        operation: 'analyze competencies',
        entityType: 'CompetencyAnalytics',
        ...(userId && { userId }),
      }
    );
  }

  /**
   * Get historical performance data - Delegated to ProgressAnalyzer
   */
  async getHistoricalPerformance(
    startDate: string,
    endDate: string,
    userId?: string
  ): Promise<HistoricalPerformance[]> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(startDate, 'startDate');
        this.validateRequired(endDate, 'endDate');
        return await this.progressAnalyzer.getHistoricalPerformance(startDate, endDate, userId);
      },
      {
        operation: 'get historical performance',
        entityType: 'HistoricalPerformance',
        requestData: { startDate, endDate },
        ...(userId && { userId }),
      }
    );
  }

  /**
   * Generate learning insights and recommendations - Delegated to InsightGenerator
   */
  async generateLearningInsights(userId?: string): Promise<LearningInsights> {
    return this.executeWithErrorHandling(
      async () => {
        return await this.insightGenerator.generateLearningInsights(userId);
      },
      {
        operation: 'generate learning insights',
        entityType: 'LearningInsights',
        ...(userId && { userId }),
      }
    );
  }

  /**
   * Prepare data for visualizations - Delegated to InsightGenerator
   */
  async prepareVisualizationData(analyticsData: any): Promise<VisualizationData> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(analyticsData, 'analyticsData');
        return await this.insightGenerator.prepareVisualizationData(analyticsData);
      },
      {
        operation: 'prepare visualization data',
        entityType: 'VisualizationData',
        requestData: analyticsData,
      }
    );
  }

  // Private helper methods

  private getTimeframeStartDate(timeframe: string): string {
    const now = new Date();
    const start = new Date();

    switch (timeframe) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setMonth(now.getMonth() - 1);
    }

    return start.toISOString();
  }
}

export type { IAnalyticsService };
