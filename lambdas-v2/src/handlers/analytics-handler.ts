import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { AnalyticsService } from '../services/analytics-service';
import { 
  GetProgressAnalyticsRequest,
  GetPerformanceMetricsRequest,
  GetSessionAnalyticsRequest,
  GetTopicAnalyticsRequest,
  GetReadinessAssessmentRequest,
  GetRecommendationsRequest,
  GetComparisonAnalyticsRequest
} from '../types';

/**
 * Analytics Handler - Comprehensive performance tracking and analytics
 * Phase 4: Analytics & Progress Tracking Implementation
 */
class AnalyticsHandler extends BaseHandler {
  private analyticsService: AnalyticsService;

  constructor() {
    super('AnalyticsHandler');
    this.analyticsService = new AnalyticsService();
  }

  /**
   * GET /analytics/progress - User progress across providers/exams
   */
  public async getProgressAnalytics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const queryParams = event.queryStringParameters || {};
      const request: GetProgressAnalyticsRequest = {
        timeRange: (queryParams.timeRange as any) || 'all',
        includeProviders: queryParams.includeProviders ? queryParams.includeProviders.split(',') : undefined,
        includeExams: queryParams.includeExams ? queryParams.includeExams.split(',') : undefined
      };

      const analytics = await this.analyticsService.getUserProgressAnalytics(
        userId,
        request.timeRange,
        request.includeProviders,
        request.includeExams
      );

      return this.success(analytics);

    } catch (error) {
      this.logger.error('Failed to get progress analytics', { userId, error });
      return this.internalError('Failed to retrieve progress analytics');
    }
  }

  /**
   * GET /analytics/performance - Performance metrics and trends
   */
  public async getPerformanceMetrics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const queryParams = event.queryStringParameters || {};
      const request: GetPerformanceMetricsRequest = {
        timeRange: (queryParams.timeRange as any) || 'month',
        includeComparisons: queryParams.includeComparisons !== 'false',
        includeTrends: queryParams.includeTrends !== 'false'
      };

      const metrics = await this.analyticsService.getPerformanceMetrics(
        userId,
        request.timeRange,
        request.includeComparisons,
        request.includeTrends
      );

      return this.success(metrics);

    } catch (error) {
      this.logger.error('Failed to get performance metrics', { userId, error });
      return this.internalError('Failed to retrieve performance metrics');
    }
  }

  /**
   * GET /analytics/sessions - Session analytics and history
   */
  public async getSessionAnalytics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const queryParams = event.queryStringParameters || {};
      const request: GetSessionAnalyticsRequest = {
        timeRange: (queryParams.timeRange as any) || 'all',
        provider: queryParams.provider,
        exam: queryParams.exam,
        status: (queryParams.status as any),
        limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 50
      };

      const analytics = await this.analyticsService.getSessionAnalytics(
        userId,
        request.timeRange,
        request.provider,
        request.exam,
        request.status,
        request.limit
      );

      return this.success(analytics);

    } catch (error) {
      this.logger.error('Failed to get session analytics', { userId, error });
      return this.internalError('Failed to retrieve session analytics');
    }
  }

  /**
   * GET /analytics/topics - Topic mastery analysis
   */
  public async getTopicAnalytics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const queryParams = event.queryStringParameters || {};
      const request: GetTopicAnalyticsRequest = {
        provider: queryParams.provider,
        exam: queryParams.exam,
        topics: queryParams.topics ? queryParams.topics.split(',') : undefined,
        timeRange: (queryParams.timeRange as any) || 'all'
      };

      // For topic analytics, we'll get progress analytics filtered by the criteria
      const analytics = await this.analyticsService.getUserProgressAnalytics(
        userId,
        request.timeRange,
        request.provider ? [request.provider] : undefined,
        request.exam ? [request.exam] : undefined
      );

      // Extract topic mastery information
      const topicAnalytics = {
        userId,
        timeRange: request.timeRange,
        provider: request.provider,
        exam: request.exam,
        topics: analytics.examStats.flatMap(exam => exam.topicMastery)
          .filter(topic => !request.topics || request.topics.includes(topic.topic)),
        calculatedAt: analytics.calculatedAt
      };

      return this.success(topicAnalytics);

    } catch (error) {
      this.logger.error('Failed to get topic analytics', { userId, error });
      return this.internalError('Failed to retrieve topic analytics');
    }
  }

  /**
   * GET /analytics/recommendations - AI-powered study recommendations
   */
  public async getRecommendations(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const queryParams = event.queryStringParameters || {};
      const request: GetRecommendationsRequest = {
        includeStudyPlan: queryParams.includeStudyPlan !== 'false',
        planDuration: queryParams.planDuration ? parseInt(queryParams.planDuration, 10) : 30,
        focusAreas: queryParams.focusAreas ? queryParams.focusAreas.split(',') : undefined
      };

      const recommendations = await this.analyticsService.getStudyRecommendations(
        userId,
        request.includeStudyPlan,
        request.planDuration,
        request.focusAreas
      );

      return this.success(recommendations);

    } catch (error) {
      this.logger.error('Failed to get recommendations', { userId, error });
      return this.internalError('Failed to retrieve recommendations');
    }
  }

  /**
   * GET /analytics/readiness - Exam readiness assessment
   */
  public async getReadinessAssessment(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const queryParams = event.queryStringParameters || {};
      const request: GetReadinessAssessmentRequest = {
        provider: queryParams.provider!,
        exam: queryParams.exam!,
        includeTimeline: queryParams.includeTimeline !== 'false',
        includeDetailedFactors: queryParams.includeDetailedFactors !== 'false'
      };

      if (!request.provider || !request.exam) {
        return this.badRequest('Provider and exam are required for readiness assessment');
      }

      const assessment = await this.analyticsService.getExamReadinessAssessment(
        userId,
        request.provider,
        request.exam,
        request.includeTimeline,
        request.includeDetailedFactors
      );

      return this.success(assessment);

    } catch (error) {
      this.logger.error('Failed to get readiness assessment', { userId, error });
      return this.internalError('Failed to retrieve readiness assessment');
    }
  }

  /**
   * GET /analytics/achievements - User achievements and milestones
   */
  public async getAchievements(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const progressAnalytics = await this.analyticsService.getUserProgressAnalytics(userId);
      
      const achievementsData = {
        userId,
        achievements: progressAnalytics.achievements,
        overallStats: progressAnalytics.overallStats,
        calculatedAt: progressAnalytics.calculatedAt
      };

      return this.success(achievementsData);

    } catch (error) {
      this.logger.error('Failed to get achievements', { userId, error });
      return this.internalError('Failed to retrieve achievements');
    }
  }

  /**
   * GET /analytics/comparison - Cross-provider performance comparison
   */
  public async getComparisonAnalytics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const queryParams = event.queryStringParameters || {};
      const request: GetComparisonAnalyticsRequest = {
        providers: queryParams.providers ? queryParams.providers.split(',') : undefined,
        includeSkillTransfer: queryParams.includeSkillTransfer !== 'false',
        includeRecommendations: queryParams.includeRecommendations !== 'false'
      };

      const analytics = await this.analyticsService.getCrossProviderAnalytics(
        userId,
        request.providers,
        request.includeSkillTransfer,
        request.includeRecommendations
      );

      return this.success(analytics);

    } catch (error) {
      this.logger.error('Failed to get comparison analytics', { userId, error });
      return this.internalError('Failed to retrieve comparison analytics');
    }
  }

  /**
   * Legacy endpoint for backward compatibility
   * GET /analytics - Basic analytics overview
   */
  public async getAnalytics(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      this.logger.info('Getting legacy analytics overview', { userId });

      // Get basic progress analytics for overview
      const progressAnalytics = await this.analyticsService.getUserProgressAnalytics(userId, 'all');
      
      // Create legacy-compatible response
      const legacyAnalytics = {
        totalQuestions: progressAnalytics.overallStats.totalQuestions,
        correctAnswers: progressAnalytics.overallStats.correctAnswers,
        accuracy: Math.round(progressAnalytics.overallStats.overallAccuracy * 100) / 100,
        studyTime: progressAnalytics.overallStats.totalStudyTime,
        recentSessions: progressAnalytics.overallStats.totalSessions,
        // Additional enhanced data
        totalSessions: progressAnalytics.overallStats.totalSessions,
        completedSessions: progressAnalytics.overallStats.completedSessions,
        averageSessionScore: Math.round(progressAnalytics.overallStats.averageSessionScore * 100) / 100,
        bestSessionScore: Math.round(progressAnalytics.overallStats.bestSessionScore * 100) / 100,
        currentStreak: progressAnalytics.overallStats.currentStreak,
        longestStreak: progressAnalytics.overallStats.longestStreak,
        studyDaysCount: progressAnalytics.overallStats.studyDaysCount,
        lastActivityDate: progressAnalytics.overallStats.lastActivityDate,
        providers: progressAnalytics.providerStats.map(provider => ({
          name: provider.provider,
          accuracy: Math.round(provider.accuracy * 100) / 100,
          sessions: provider.totalSessions,
          questions: provider.totalQuestions
        }))
      };

      return this.success(legacyAnalytics);

    } catch (error) {
      this.logger.error('Failed to get legacy analytics', { userId, error });
      return this.internalError('Failed to retrieve analytics');
    }
  }
}

const analyticsHandler = new AnalyticsHandler();

// Export individual route handlers for different endpoints
export const progressHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getProgressAnalytics(event, userId)
);

export const performanceHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getPerformanceMetrics(event, userId)
);

export const sessionsHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getSessionAnalytics(event, userId)
);

export const topicsHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getTopicAnalytics(event, userId)
);

export const recommendationsHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getRecommendations(event, userId)
);

export const readinessHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getReadinessAssessment(event, userId)
);

export const achievementsHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getAchievements(event, userId)
);

export const comparisonHandler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getComparisonAnalytics(event, userId)
);

// Legacy handler for backward compatibility
export const handler = analyticsHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => analyticsHandler.getAnalytics(event, userId)
);