// Analytics service for progress tracking and insights generation

import { createLogger } from '../shared/logger';
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
  VisualizationData
} from '../shared/types/analytics.types';

export class AnalyticsService implements IAnalyticsService {
  private logger = createLogger({ service: 'AnalyticsService' });

  constructor(
    private analyticsRepository: IAnalyticsRepository,
    private progressAnalyzer: IProgressAnalyzer,
    private competencyAnalyzer: ICompetencyAnalyzer,
    private performanceAnalyzer: IPerformanceAnalyzer,
    private insightGenerator: IInsightGenerator
  ) {}

  /**
   * Get detailed session analytics - Phase 24 implementation
   */
  async getSessionAnalytics(sessionId: string): Promise<any> {
    this.logger.info('Getting session analytics', { sessionId });

    try {
      // Get session details and calculate analytics
      const sessionDetails = await this.analyticsRepository.getSessionDetails(sessionId);
      
      if (!sessionDetails) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Calculate detailed session metrics
      const analytics = {
        sessionDetails,
        performance: {
          accuracy: sessionDetails.correctAnswers / sessionDetails.totalAnswers || 0,
          averageTime: sessionDetails.totalTime / sessionDetails.totalAnswers || 0,
          difficultyBreakdown: this.performanceAnalyzer.calculateDifficultyBreakdown(sessionDetails),
          topicBreakdown: this.performanceAnalyzer.calculateTopicBreakdown(sessionDetails)
        },
        insights: this.insightGenerator.generateSessionInsights(sessionDetails)
      };

      return analytics;
    } catch (error) {
      this.logger.error('Failed to get session analytics', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Get performance analytics - Phase 25 implementation
   */
  async getPerformanceAnalytics(params: any): Promise<any> {
    this.logger.info('Getting performance analytics', { params });

    try {
      return await this.performanceAnalyzer.getPerformanceAnalytics(params);
    } catch (error) {
      this.logger.error('Failed to get performance analytics', error as Error, { params });
      throw error;
    }
  }

  /**
   * Get comprehensive progress analytics - Main orchestration method
   */
  async getProgressAnalytics(request: ProgressAnalyticsRequest): Promise<ProgressAnalyticsResponse> {
    this.logger.info('Getting progress analytics', { request });

    try {
      const userId = undefined; // Will be extracted from auth context in Phase 30
      const timeframe = request.timeframe || 'month';
      const startDate = request.startDate || this.getTimeframeStartDate(timeframe);
      const endDate = request.endDate || new Date().toISOString();

      // Calculate all analytics components in parallel for better performance using decomposed services
      const [
        overview,
        trends,
        competencyData,
        historicalData,
        insights,
      ] = await Promise.all([
        this.progressAnalyzer.calculateProgressOverview(userId),
        this.progressAnalyzer.generateProgressTrends(timeframe, userId),
        this.competencyAnalyzer.analyzeCompetencies(userId),
        this.progressAnalyzer.getHistoricalPerformance(startDate, endDate, userId),
        this.insightGenerator.generateLearningInsights(userId)
      ]);

      // Prepare visualization data
      const visualizationData = await this.insightGenerator.prepareVisualizationData({
        overview,
        trends,
        competencyData,
        historicalData
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
          visualizationData
        },
        metadata: {
          timeframe: timeframe,
          periodStart: startDate,
          periodEnd: endDate,
          totalSessions: sessions.length,
          dataPoints: historicalData.length,
          calculatedAt: new Date().toISOString()
        }
      };

      this.logger.info('Successfully generated progress analytics', { 
        totalSessions: sessions.length,
        overallAccuracy: overview.overallAccuracy,
        topicCount: competencyData.topicCompetencies.length
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to generate progress analytics', error as Error, { request });
      throw new Error(`Failed to generate progress analytics: ${(error as Error).message}`);
    }
  }

  /**
   * Calculate progress overview metrics - Delegated to ProgressAnalyzer
   */
  async calculateProgressOverview(userId?: string): Promise<ProgressOverview> {
    return await this.progressAnalyzer.calculateProgressOverview(userId);
  }

  /**
   * Generate progress trends over time - Delegated to ProgressAnalyzer
   */
  async generateProgressTrends(timeframe: string, userId?: string): Promise<ProgressTrends> {
    return await this.progressAnalyzer.generateProgressTrends(timeframe, userId);
  }

  /**
   * Analyze competencies across topics and providers - Delegated to CompetencyAnalyzer
   */
  async analyzeCompetencies(userId?: string): Promise<CompetencyAnalytics> {
    return await this.competencyAnalyzer.analyzeCompetencies(userId);
  }

  /**
   * Get historical performance data - Delegated to ProgressAnalyzer
   */
  async getHistoricalPerformance(startDate: string, endDate: string, userId?: string): Promise<HistoricalPerformance[]> {
    return await this.progressAnalyzer.getHistoricalPerformance(startDate, endDate, userId);
  }

  /**
   * Generate learning insights and recommendations - Delegated to InsightGenerator
   */
  async generateLearningInsights(userId?: string): Promise<LearningInsights> {
    return await this.insightGenerator.generateLearningInsights(userId);
  }

  /**
   * Prepare data for visualizations - Delegated to InsightGenerator
   */
  async prepareVisualizationData(analyticsData: any): Promise<VisualizationData> {
    return await this.insightGenerator.prepareVisualizationData(analyticsData);
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