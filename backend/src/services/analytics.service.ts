// Analytics service for progress tracking and insights generation

import { createLogger } from '../shared/logger';
import {
  IAnalyticsService,
  IAnalyticsRepository,
  ProgressAnalyticsRequest,
  ProgressAnalyticsResponse,
  ProgressOverview,
  ProgressTrends,
  CompetencyAnalytics,
  HistoricalPerformance,
  LearningInsights,
  VisualizationData,
  TopicCompetency,
  ProviderCompetency,
  ExamCompetency,
  StrengthsWeaknesses,
  CompetencyArea,
  MasteryProgression,
  MasteryDistribution,
  MasteryProgressionPoint,
  MasteryProjection,
  LearningPattern,
  LearningRecommendation,
  LearningMilestone,
  LearningWarning,
  ChartDataPoint,
  RadarChartData,
  MatrixData,
  HeatmapData,
  GaugeData,
  TrendData,
  DifficultyTrendData,
  CompetencyTrendData
} from '../shared/types/analytics.types';

export class AnalyticsService implements IAnalyticsService {
  private logger = createLogger({ service: 'AnalyticsService' });

  constructor(
    private analyticsRepository: IAnalyticsRepository,
    private providerService: any, // Will inject proper service interface
    private examService: any, // Will inject proper service interface
    private topicService: any // Will inject proper service interface
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
          difficultyBreakdown: this.calculateDifficultyBreakdown(sessionDetails),
          topicBreakdown: this.calculateTopicBreakdown(sessionDetails)
        },
        insights: this.generateSessionInsights(sessionDetails)
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
      // Get performance data based on filters
      const performanceData = await this.analyticsRepository.getPerformanceData(params);
      
      const analytics = {
        competencyScoring: await this.calculateCompetencyScores(performanceData),
        performanceTrends: await this.calculatePerformanceTrends(performanceData),
        insights: this.generatePerformanceInsights(performanceData)
      };

      return analytics;
    } catch (error) {
      this.logger.error('Failed to get performance analytics', error as Error, { params });
      throw error;
    }
  }

  private calculateDifficultyBreakdown(session: any): any {
    // Implementation for difficulty breakdown
    return {
      easy: { correct: 0, total: 0, accuracy: 0 },
      medium: { correct: 0, total: 0, accuracy: 0 },
      hard: { correct: 0, total: 0, accuracy: 0 }
    };
  }

  private calculateTopicBreakdown(session: any): any {
    // Implementation for topic breakdown
    return {};
  }

  private generateSessionInsights(session: any): any {
    // Implementation for session insights
    return {
      strengths: [],
      weaknesses: [],
      recommendations: []
    };
  }

  private async calculateCompetencyScores(data: any): Promise<any> {
    // Implementation for competency scoring
    return {
      overall: 0,
      byTopic: {},
      byProvider: {}
    };
  }

  private async calculatePerformanceTrends(data: any): Promise<any> {
    // Implementation for performance trends
    return {
      accuracy: [],
      speed: [],
      difficulty: []
    };
  }

  private generatePerformanceInsights(data: any): any {
    // Implementation for performance insights
    return {
      patterns: [],
      recommendations: [],
      goals: []
    };
  }

  /**
   * Get comprehensive progress analytics
   */
  async getProgressAnalytics(request: ProgressAnalyticsRequest): Promise<ProgressAnalyticsResponse> {
    this.logger.info('Getting progress analytics', { request });

    try {
      const userId = undefined; // Will be extracted from auth context in Phase 30
      const timeframe = request.timeframe || 'month';
      const startDate = request.startDate || this.getTimeframeStartDate(timeframe);
      const endDate = request.endDate || new Date().toISOString();

      // Calculate all analytics components in parallel for better performance
      const [
        overview,
        trends,
        competencyData,
        historicalData,
        insights,
      ] = await Promise.all([
        this.calculateProgressOverview(userId),
        this.generateProgressTrends(timeframe, userId),
        this.analyzeCompetencies(userId),
        this.getHistoricalPerformance(startDate, endDate, userId),
        this.generateLearningInsights(userId)
      ]);

      // Prepare visualization data
      const visualizationData = await this.prepareVisualizationData({
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
   * Calculate progress overview metrics
   */
  async calculateProgressOverview(userId?: string): Promise<ProgressOverview> {
    this.logger.info('Calculating progress overview', { ...(userId && { userId }) });

    try {
      const sessionFilters: any = {};
      if (userId) sessionFilters.userId = userId;
      const sessions = await this.analyticsRepository.getCompletedSessions(sessionFilters);
      const progressData = await this.analyticsRepository.getUserProgressData(userId);

      if (sessions.length === 0) {
        return this.getEmptyProgressOverview();
      }

      // Calculate basic metrics
      const totalSessionsCompleted = sessions.length;
      const totalQuestionsAnswered = sessions.reduce((sum, s) => sum + s.questionsAnswered, 0);
      const totalCorrectAnswers = sessions.reduce((sum, s) => sum + s.correctAnswers, 0);
      const overallAccuracy = totalQuestionsAnswered > 0 ? (totalCorrectAnswers / totalQuestionsAnswered) * 100 : 0;
      const totalStudyTime = sessions.reduce((sum, s) => sum + s.duration, 0);
      const averageSessionDuration = totalStudyTime / totalSessionsCompleted;

      // Calculate streaks
      const { currentStreak, longestStreak } = this.calculateStudyStreaks(sessions);

      // Calculate improvement velocity
      const improvementVelocity = this.calculateImprovementVelocity(sessions);

      // Calculate overall progress percentage
      const overallProgress = this.calculateOverallProgress(progressData, overallAccuracy);

      return {
        overallProgress,
        totalSessionsCompleted,
        totalQuestionsAnswered,
        overallAccuracy: Math.round(overallAccuracy * 100) / 100,
        totalStudyTime,
        currentStreak,
        longestStreak,
        averageSessionDuration: Math.round(averageSessionDuration * 100) / 100,
        improvementVelocity: Math.round(improvementVelocity * 100) / 100
      };

    } catch (error) {
      this.logger.error('Failed to calculate progress overview', error as Error, { ...(userId && { userId }) });
      throw error;
    }
  }

  /**
   * Generate progress trends over time
   */
  async generateProgressTrends(timeframe: string, userId?: string): Promise<ProgressTrends> {
    this.logger.info('Generating progress trends', { timeframe, ...(userId && { userId }) });

    try {
      // Get trend data for different metrics
      const [
        accuracyTrend,
        studyTimeTrend,
        sessionFrequencyTrend
      ] = await Promise.all([
        this.analyticsRepository.calculateTrendData('accuracy', timeframe, userId),
        this.analyticsRepository.calculateTrendData('studyTime', timeframe, userId),
        this.analyticsRepository.calculateTrendData('sessionCount', timeframe, userId)
      ]);

      // Get difficulty progression trends
      const difficultyProgressTrend = await this.calculateDifficultyProgressTrend(timeframe, userId);

      // Get competency growth trends
      const competencyGrowthTrend = await this.calculateCompetencyGrowthTrend(timeframe, userId);

      return {
        accuracyTrend,
        studyTimeTrend,
        sessionFrequencyTrend,
        difficultyProgressTrend,
        competencyGrowthTrend
      };

    } catch (error) {
      this.logger.error('Failed to generate progress trends', error as Error, { timeframe, ...(userId && { userId }) });
      throw error;
    }
  }

  /**
   * Analyze competencies across topics and providers
   */
  async analyzeCompetencies(userId?: string): Promise<CompetencyAnalytics> {
    this.logger.info('Analyzing competencies', { ...(userId && { userId }) });

    try {
      const sessionFilters: any = {};
      if (userId) sessionFilters.userId = userId;
      const [sessions, progressData] = await Promise.all([
        this.analyticsRepository.getCompletedSessions(sessionFilters),
        this.analyticsRepository.getUserProgressData(userId)
      ]);

      // Calculate topic competencies
      const topicCompetencies = await this.calculateTopicCompetencies(sessions, progressData);

      // Calculate provider competencies
      const providerCompetencies = await this.calculateProviderCompetencies(sessions);

      // Analyze strengths and weaknesses
      const strengthsAndWeaknesses = this.analyzeStrengthsAndWeaknesses(topicCompetencies);

      // Calculate mastery progression
      const masteryProgression = await this.calculateMasteryProgression(topicCompetencies, userId);

      return {
        topicCompetencies,
        providerCompetencies,
        strengthsAndWeaknesses,
        masteryProgression
      };

    } catch (error) {
      this.logger.error('Failed to analyze competencies', error as Error, { ...(userId && { userId }) });
      throw error;
    }
  }

  /**
   * Get historical performance data
   */
  async getHistoricalPerformance(startDate: string, endDate: string, userId?: string): Promise<HistoricalPerformance[]> {
    this.logger.info('Getting historical performance', { startDate, endDate, ...(userId && { userId }) });

    try {
      const sessionFilters: any = { startDate, endDate };
      if (userId) sessionFilters.userId = userId;
      const sessions = await this.analyticsRepository.getCompletedSessions(sessionFilters);

      // Group sessions by date
      const dailyPerformance = new Map<string, HistoricalPerformance>();

      for (const session of sessions) {
        const date = new Date(session.startTime).toISOString().split('T')[0];
        
        if (!dailyPerformance.has(date)) {
          dailyPerformance.set(date, {
            date,
            sessionsCompleted: 0,
            questionsAnswered: 0,
            accuracy: 0,
            studyTime: 0,
            topicsFocused: [],
            averageScore: 0,
            improvements: [],
            regressions: []
          });
        }

        const daily = dailyPerformance.get(date)!;
        daily.sessionsCompleted++;
        daily.questionsAnswered += session.questionsAnswered;
        daily.studyTime += session.duration;

        // Calculate weighted accuracy
        const totalQuestions = daily.questionsAnswered;
        const totalCorrect = (daily.accuracy * (totalQuestions - session.questionsAnswered)) + 
                            (session.accuracy * session.questionsAnswered / 100);
        daily.accuracy = totalCorrect / totalQuestions * 100;

        // Track topics
        const sessionTopics = session.topicBreakdown.map(t => t.topicName);
        daily.topicsFocused = [...new Set([...daily.topicsFocused, ...sessionTopics])];

        // Calculate average score
        daily.averageScore = (daily.averageScore * (daily.sessionsCompleted - 1) + session.score) / daily.sessionsCompleted;
      }

      // Sort by date and identify improvements/regressions
      const history = Array.from(dailyPerformance.values()).sort((a, b) => a.date.localeCompare(b.date));
      
      // Add improvement/regression analysis
      for (let i = 1; i < history.length; i++) {
        const current = history[i];
        const previous = history[i - 1];
        
        if (current.accuracy > previous.accuracy + 5) {
          current.improvements.push('Overall accuracy improved');
        }
        if (current.accuracy < previous.accuracy - 5) {
          current.regressions.push('Overall accuracy declined');
        }
        
        if (current.averageScore > previous.averageScore) {
          current.improvements.push('Average score improved');
        }
        if (current.averageScore < previous.averageScore) {
          current.regressions.push('Average score declined');
        }
      }

      return history;

    } catch (error) {
      this.logger.error('Failed to get historical performance', error as Error, { startDate, endDate, ...(userId && { userId }) });
      throw error;
    }
  }

  /**
   * Generate learning insights and recommendations
   */
  async generateLearningInsights(userId?: string): Promise<LearningInsights> {
    this.logger.info('Generating learning insights', { ...(userId && { userId }) });

    try {
      const sessionFilters: any = {};
      if (userId) sessionFilters.userId = userId;
      const sessions = await this.analyticsRepository.getCompletedSessions(sessionFilters);
      const progressData = await this.analyticsRepository.getUserProgressData(userId);

      const patterns = this.identifyLearningPatterns(sessions);
      const recommendations = this.generateLearningRecommendations(sessions, progressData);
      const milestones = this.identifyLearningMilestones(sessions, progressData);
      const warnings = this.detectLearningWarnings(sessions, progressData);

      return {
        patterns,
        recommendations,
        milestones,
        warnings
      };

    } catch (error) {
      this.logger.error('Failed to generate learning insights', error as Error, { ...(userId && { userId }) });
      throw error;
    }
  }

  /**
   * Prepare data for visualizations
   */
  async prepareVisualizationData(analyticsData: any): Promise<VisualizationData> {
    this.logger.info('Preparing visualization data');

    try {
      const { overview, trends, competencyData, historicalData } = analyticsData;

      // Prepare chart data
      const accuracyOverTime: ChartDataPoint[] = trends.accuracyTrend.map((point: TrendData) => ({
        x: point.period,
        y: Math.round(point.value * 100) / 100,
        label: `${Math.round(point.value * 100) / 100}%`
      }));

      const studyTimeDistribution: ChartDataPoint[] = trends.studyTimeTrend.map((point: TrendData) => ({
        x: point.period,
        y: Math.round(point.value),
        label: `${Math.round(point.value)} min`
      }));

      const weeklyProgress: ChartDataPoint[] = historicalData.map((day: HistoricalPerformance) => ({
        x: day.date,
        y: day.accuracy,
        label: `${Math.round(day.accuracy)}% accuracy`
      }));

      // Prepare radar chart for topic mastery
      const topicMasteryRadar: RadarChartData = {
        labels: competencyData.topicCompetencies.slice(0, 8).map((topic: TopicCompetency) => topic.topicName),
        datasets: [{
          label: 'Current Mastery',
          data: competencyData.topicCompetencies.slice(0, 8).map((topic: TopicCompetency) => topic.currentAccuracy),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)'
        }]
      };

      // Prepare difficulty progression
      const difficultyProgression: ChartDataPoint[] = [];
      for (const diffTrend of trends.difficultyProgressTrend) {
        difficultyProgression.push({
          x: diffTrend.period,
          y: diffTrend.value,
          label: `${diffTrend.difficulty}: ${Math.round(diffTrend.value)}%`
        });
      }

      // Prepare competency matrix
      const competencyMatrix: MatrixData = {
        rows: competencyData.topicCompetencies.slice(0, 10).map((t: TopicCompetency) => t.topicName),
        columns: ['Accuracy', 'Speed', 'Consistency', 'Improvement'],
        data: competencyData.topicCompetencies.slice(0, 10).map((topic: TopicCompetency) => [
          topic.currentAccuracy,
          Math.max(0, 100 - topic.averageTimePerQuestion / 10), // Speed score
          topic.confidence * 100, // Consistency score
          Math.max(0, topic.improvementRate) // Improvement score
        ]),
        colorScale: {
          min: 0,
          max: 100,
          colors: ['#ff4444', '#ffaa00', '#44ff44']
        }
      };

      // Prepare study activity heatmap
      const studyActivity: HeatmapData = {
        data: historicalData.slice(-30).map((day: HistoricalPerformance) => ({
          x: day.date,
          y: 'Study Time',
          value: day.studyTime
        })),
        scale: {
          min: 0,
          max: Math.max(...historicalData.map((d: HistoricalPerformance) => d.studyTime))
        }
      };

      // Prepare topic accuracy heatmap
      const topicAccuracy: HeatmapData = {
        data: competencyData.topicCompetencies.map((topic: TopicCompetency) => ({
          x: topic.topicName,
          y: 'Accuracy',
          value: topic.currentAccuracy
        })),
        scale: {
          min: 0,
          max: 100
        }
      };

      // Prepare gauges
      const overallProgressGauge: GaugeData = {
        label: 'Overall Progress',
        value: overview.overallProgress,
        min: 0,
        max: 100,
        thresholds: {
          red: 40,
          yellow: 70,
          green: 85
        }
      };

      const examReadinessGauges: GaugeData[] = competencyData.providerCompetencies.slice(0, 3).flatMap((provider: ProviderCompetency) =>
        provider.examCompetencies.slice(0, 2).map((exam: ExamCompetency) => ({
          label: `${exam.examName} Readiness`,
          value: exam.estimatedReadiness,
          min: 0,
          max: 100,
          thresholds: {
            red: 50,
            yellow: 75,
            green: 85
          }
        }))
      );

      return {
        charts: {
          accuracyOverTime,
          studyTimeDistribution,
          topicMasteryRadar,
          difficultyProgression,
          weeklyProgress,
          competencyMatrix
        },
        heatmaps: {
          studyActivity,
          topicAccuracy
        },
        gauges: {
          overallProgress: overallProgressGauge,
          examReadiness: examReadinessGauges
        }
      };

    } catch (error) {
      this.logger.error('Failed to prepare visualization data', error as Error);
      throw error;
    }
  }

  // Private helper methods

  private getEmptyProgressOverview(): ProgressOverview {
    return {
      overallProgress: 0,
      totalSessionsCompleted: 0,
      totalQuestionsAnswered: 0,
      overallAccuracy: 0,
      totalStudyTime: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageSessionDuration: 0,
      improvementVelocity: 0
    };
  }

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

  private calculateStudyStreaks(sessions: any[]): { currentStreak: number; longestStreak: number } {
    if (sessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // Sort sessions by date
    const sortedSessions = sessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    // Get unique study days
    const studyDates = [...new Set(sortedSessions.map(s => new Date(s.startTime).toDateString()))].sort();
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;
    
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

    // Calculate current streak
    if (studyDates.includes(today) || studyDates.includes(yesterday)) {
      currentStreak = 1;
      const latestDate = studyDates.includes(today) ? today : yesterday;
      let checkDate = new Date(latestDate);
      
      for (let i = studyDates.length - (studyDates.includes(today) ? 1 : 2); i >= 0; i--) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (studyDates[i] === checkDate.toDateString()) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    for (let i = 1; i < studyDates.length; i++) {
      const prevDate = new Date(studyDates[i - 1]);
      const currDate = new Date(studyDates[i]);
      const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { currentStreak, longestStreak };
  }

  private calculateImprovementVelocity(sessions: any[]): number {
    if (sessions.length < 2) return 0;

    // Calculate weekly improvement in accuracy
    const sortedSessions = sessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    const firstWeekSessions = sortedSessions.slice(0, Math.min(5, sessions.length / 2));
    const lastWeekSessions = sortedSessions.slice(-Math.min(5, sessions.length / 2));
    
    const firstWeekAccuracy = firstWeekSessions.reduce((sum, s) => sum + s.accuracy, 0) / firstWeekSessions.length;
    const lastWeekAccuracy = lastWeekSessions.reduce((sum, s) => sum + s.accuracy, 0) / lastWeekSessions.length;
    
    const timeDiff = (new Date(lastWeekSessions[0].startTime).getTime() - new Date(firstWeekSessions[0].startTime).getTime()) / (1000 * 60 * 60 * 24 * 7);
    
    return timeDiff > 0 ? (lastWeekAccuracy - firstWeekAccuracy) / timeDiff : 0;
  }

  private calculateOverallProgress(progressData: any[], accuracy: number): number {
    // Combine accuracy, consistency, and topic coverage for overall progress
    const accuracyScore = Math.min(accuracy, 100);
    const topicCoverage = progressData.length > 0 ? Math.min(progressData.length * 10, 100) : 0;
    
    // Weight accuracy more heavily
    return Math.round((accuracyScore * 0.7 + topicCoverage * 0.3) * 100) / 100;
  }

  private async calculateDifficultyProgressTrend(timeframe: string, userId?: string): Promise<DifficultyTrendData[]> {
    // Simplified implementation - would need actual question difficulty data
    const sessions = await this.analyticsRepository.getCompletedSessions({ ...(userId && { userId }) });
    const trends: DifficultyTrendData[] = [];
    
    // Mock difficulty progression data - in real implementation, would analyze actual question difficulties
    const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    
    for (const difficulty of difficulties) {
      trends.push({
        period: '2024-01',
        value: 70 + Math.random() * 20,
        change: (Math.random() - 0.5) * 10,
        dataPoints: sessions.length,
        difficulty: difficulty,
        questionsAnswered: Math.floor(sessions.length * Math.random() * 50)
      });
    }
    
    return trends;
  }

  private async calculateCompetencyGrowthTrend(timeframe: string, userId?: string): Promise<CompetencyTrendData[]> {
    const progressData = await this.analyticsRepository.getUserProgressData(userId);
    
    return progressData.slice(0, 5).map((progress, index) => ({
      period: `2024-${(index + 1).toString().padStart(2, '0')}`,
      value: progress.accuracy,
      change: Math.random() * 10 - 5,
      dataPoints: progress.questionsAttempted,
      topicId: progress.topicId,
      topicName: progress.topicId, // Would need to enrich with actual topic name
      masteryLevel: progress.masteryLevel as any,
      questionsAnswered: progress.questionsAttempted
    }));
  }

  private async calculateTopicCompetencies(sessions: any[], progressData: any[]): Promise<TopicCompetency[]> {
    const topicMap = new Map<string, any>();
    
    // Aggregate data from sessions
    for (const session of sessions) {
      for (const topicData of session.topicBreakdown) {
        const topicId = topicData.topicId;
        
        if (!topicMap.has(topicId)) {
          topicMap.set(topicId, {
            topicId: topicId,
            topicName: topicData.topicName,
            examId: session.examId,
            providerId: session.providerId,
            questionsAnswered: 0,
            correctAnswers: 0,
            totalTime: 0,
            studySessions: 0,
            lastStudied: session.startTime
          });
        }

        const topic = topicMap.get(topicId);
        topic.questionsAnswered += topicData.questionsAnswered;
        topic.correctAnswers += topicData.questionsCorrect;
        topic.totalTime += topicData.averageTime * topicData.questionsAnswered;
        topic.studySessions++;
        
        if (new Date(session.startTime) > new Date(topic.lastStudied)) {
          topic.lastStudied = session.startTime;
        }
      }
    }

    // Convert to TopicCompetency format
    const competencies: TopicCompetency[] = [];
    
    for (const [topicId, data] of topicMap) {
      const currentAccuracy = data.questionsAnswered > 0 ? (data.correctAnswers / data.questionsAnswered) * 100 : 0;
      const averageTimePerQuestion = data.questionsAnswered > 0 ? data.totalTime / data.questionsAnswered : 0;
      
      competencies.push({
        topicId: data.topicId,
        topicName: data.topicName,
        examId: data.examId,
        providerId: data.providerId,
        currentAccuracy: Math.round(currentAccuracy * 100) / 100,
        improvementRate: Math.random() * 10 - 5, // Would calculate from historical data
        questionsAnswered: data.questionsAnswered,
        averageTimePerQuestion: Math.round(averageTimePerQuestion),
        masteryLevel: this.calculateMasteryLevel(currentAccuracy, data.questionsAnswered),
        confidence: Math.min(data.questionsAnswered / 20, 1), // Confidence based on sample size
        lastStudied: data.lastStudied,
        studySessions: data.studySessions,
        timeSpent: Math.round(data.totalTime / 60), // Convert to minutes
        difficultyBreakdown: {
          easy: { answered: Math.floor(data.questionsAnswered * 0.4), correct: Math.floor(data.correctAnswers * 0.5), accuracy: currentAccuracy + 10 },
          medium: { answered: Math.floor(data.questionsAnswered * 0.4), correct: Math.floor(data.correctAnswers * 0.35), accuracy: currentAccuracy },
          hard: { answered: Math.floor(data.questionsAnswered * 0.2), correct: Math.floor(data.correctAnswers * 0.15), accuracy: Math.max(0, currentAccuracy - 15) }
        }
      });
    }

    return competencies.sort((a, b) => b.questionsAnswered - a.questionsAnswered);
  }

  private async calculateProviderCompetencies(sessions: any[]): Promise<ProviderCompetency[]> {
    const providerMap = new Map<string, any>();
    
    for (const session of sessions) {
      const providerId = session.providerId;
      
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, {
          providerId: providerId,
          providerName: providerId, // Would need to enrich with actual provider name
          sessions: [],
          examMap: new Map()
        });
      }

      providerMap.get(providerId).sessions.push(session);
      
      const examId = session.examId;
      const examMap = providerMap.get(providerId).examMap;
      
      if (!examMap.has(examId)) {
        examMap.set(examId, {
          examId: examId,
          examName: examId, // Would need to enrich with actual exam name
          sessions: []
        });
      }
      
      examMap.get(examId).sessions.push(session);
    }

    const providerCompetencies: ProviderCompetency[] = [];
    
    for (const [providerId, providerData] of providerMap) {
      const sessions = providerData.sessions;
      const overallAccuracy = sessions.reduce((sum: number, s: any) => sum + s.accuracy, 0) / sessions.length;
      const questionsAnswered = sessions.reduce((sum: number, s: any) => sum + s.questionsAnswered, 0);
      const studyTime = sessions.reduce((sum: number, s: any) => sum + s.duration, 0);

      const examCompetencies: ExamCompetency[] = [];
      for (const [examId, examData] of providerData.examMap) {
        const examSessions = examData.sessions;
        const examAccuracy = examSessions.reduce((sum: number, s: any) => sum + s.accuracy, 0) / examSessions.length;
        const examQuestions = examSessions.reduce((sum: number, s: any) => sum + s.questionsAnswered, 0);
        const examStudyTime = examSessions.reduce((sum: number, s: any) => sum + s.duration, 0);

        examCompetencies.push({
          examId: examData.examId,
          examName: examData.examName,
          accuracy: Math.round(examAccuracy * 100) / 100,
          questionsAnswered: examQuestions,
          studyTime: examStudyTime,
          estimatedReadiness: Math.min(examAccuracy * 1.2, 100), // Simple readiness calculation
          recommendedStudyTime: Math.max(0, (80 - examAccuracy) * 10) // Hours needed to reach 80%
        });
      }

      // Calculate strengths and weaknesses from topics
      const topicAccuracies = new Map<string, number>();
      for (const session of sessions) {
        for (const topic of session.topicBreakdown) {
          if (!topicAccuracies.has(topic.topicName)) {
            topicAccuracies.set(topic.topicName, 0);
          }
          topicAccuracies.set(topic.topicName, topic.accuracy);
        }
      }

      const strengths = Array.from(topicAccuracies.entries())
        .filter(([, accuracy]) => accuracy > 80)
        .map(([topicName]) => topicName);
      
      const weaknesses = Array.from(topicAccuracies.entries())
        .filter(([, accuracy]) => accuracy < 60)
        .map(([topicName]) => topicName);

      providerCompetencies.push({
        providerId: providerData.providerId,
        providerName: providerData.providerName,
        overallAccuracy: Math.round(overallAccuracy * 100) / 100,
        questionsAnswered: questionsAnswered,
        studyTime: studyTime,
        examCompetencies: examCompetencies,
        strengths: strengths,
        weaknesses: weaknesses
      });
    }

    return providerCompetencies;
  }

  private analyzeStrengthsAndWeaknesses(topicCompetencies: TopicCompetency[]): StrengthsWeaknesses {
    const strengths: CompetencyArea[] = [];
    const weaknesses: CompetencyArea[] = [];
    const opportunities: CompetencyArea[] = [];

    for (const topic of topicCompetencies) {
      const area: CompetencyArea = {
        topicId: topic.topicId,
        topicName: topic.topicName,
        accuracy: topic.currentAccuracy,
        questionsAnswered: topic.questionsAnswered,
        improvementPotential: 0,
        priority: 'medium',
        recommendedActions: []
      };

      if (topic.currentAccuracy >= 80) {
        area.priority = 'low';
        area.recommendedActions = ['Maintain current level', 'Review periodically'];
        strengths.push(area);
      } else if (topic.currentAccuracy < 60) {
        area.priority = 'high';
        area.improvementPotential = 100 - topic.currentAccuracy;
        area.recommendedActions = ['Focus study time here', 'Review fundamentals', 'Practice more questions'];
        weaknesses.push(area);
      } else {
        area.priority = 'medium';
        area.improvementPotential = Math.min(30, 85 - topic.currentAccuracy);
        area.recommendedActions = ['Regular practice', 'Focus on weak areas'];
        opportunities.push(area);
      }
    }

    return { strengths, weaknesses, opportunities };
  }

  private async calculateMasteryProgression(topicCompetencies: TopicCompetency[], userId?: string): Promise<MasteryProgression> {
    const currentDistribution: MasteryDistribution = {
      novice: 0,
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0
    };

    // Count current mastery levels
    for (const topic of topicCompetencies) {
      currentDistribution[topic.masteryLevel as keyof MasteryDistribution]++;
    }

    // Mock historical data - in real implementation would fetch from database
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const progressionHistory: MasteryProgressionPoint[] = [
      {
        date: thirtyDaysAgo.toISOString(),
        distribution: { novice: 5, beginner: 3, intermediate: 2, advanced: 0, expert: 0 }
      },
      {
        date: new Date().toISOString(),
        distribution: currentDistribution
      }
    ];

    // Simple projection - in real implementation would use ML/statistical models
    const projectedGrowth: MasteryProjection[] = [
      {
        timeframe: '1_month',
        projectedDistribution: {
          novice: Math.max(0, currentDistribution.novice - 1),
          beginner: currentDistribution.beginner,
          intermediate: currentDistribution.intermediate + 1,
          advanced: currentDistribution.advanced,
          expert: currentDistribution.expert
        },
        confidence: 0.7
      },
      {
        timeframe: '3_months',
        projectedDistribution: {
          novice: Math.max(0, currentDistribution.novice - 2),
          beginner: Math.max(0, currentDistribution.beginner - 1),
          intermediate: currentDistribution.intermediate + 1,
          advanced: currentDistribution.advanced + 2,
          expert: currentDistribution.expert
        },
        confidence: 0.5
      }
    ];

    return {
      currentDistribution,
      progressionHistory,
      projectedGrowth
    };
  }

  private identifyLearningPatterns(sessions: any[]): LearningPattern[] {
    const patterns: LearningPattern[] = [];

    // Time preference pattern
    const sessionTimes = sessions.map(s => new Date(s.startTime).getHours());
    const morningCount = sessionTimes.filter(h => h >= 6 && h < 12).length;
    const eveningCount = sessionTimes.filter(h => h >= 18 && h < 24).length;
    
    if (morningCount > sessions.length * 0.6) {
      patterns.push({
        type: 'time_preference',
        description: 'Prefers studying in the morning',
        strength: morningCount / sessions.length,
        evidence: [`${Math.round(morningCount / sessions.length * 100)}% of sessions in morning hours`],
        impact: 'positive'
      });
    }

    // Learning velocity pattern
    const recentSessions = sessions.slice(-10);
    const avgAccuracy = recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length;
    
    if (avgAccuracy > 75) {
      patterns.push({
        type: 'learning_velocity',
        description: 'Fast learner with high retention',
        strength: avgAccuracy / 100,
        evidence: [`Average accuracy of ${Math.round(avgAccuracy)}% in recent sessions`],
        impact: 'positive'
      });
    }

    return patterns;
  }

  private generateLearningRecommendations(sessions: any[], progressData: any[]): LearningRecommendation[] {
    const recommendations: LearningRecommendation[] = [];

    // Study schedule recommendation
    if (sessions.length > 0) {
      const avgSessionDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
      
      if (avgSessionDuration < 30) {
        recommendations.push({
          type: 'study_schedule',
          title: 'Extend Study Sessions',
          description: 'Consider longer study sessions for better retention and deeper understanding',
          priority: 'medium',
          expectedImpact: 'Improved knowledge retention and better performance on complex topics',
          actionItems: [
            'Aim for 45-60 minute study sessions',
            'Take 5-10 minute breaks every 25 minutes',
            'Focus on one topic per session'
          ],
          timeframe: '1_week'
        });
      }
    }

    // Topic focus recommendation
    const weakTopics = progressData.filter(p => p.accuracy < 60).slice(0, 3);
    if (weakTopics.length > 0) {
      recommendations.push({
        type: 'topic_focus',
        title: 'Focus on Weak Areas',
        description: `Concentrate study time on ${weakTopics.length} topics that need improvement`,
        priority: 'high',
        expectedImpact: 'Significant improvement in overall accuracy and exam readiness',
        actionItems: weakTopics.map(t => `Study ${t.topicId} - current accuracy: ${Math.round(t.accuracy)}%`),
        timeframe: 'immediate'
      });
    }

    return recommendations;
  }

  private identifyLearningMilestones(sessions: any[], progressData: any[]): LearningMilestone[] {
    const milestones: LearningMilestone[] = [];

    // Session count milestone
    const sessionCount = sessions.length;
    if (sessionCount >= 50) {
      milestones.push({
        type: 'study_time_milestone',
        title: '50 Sessions Completed!',
        description: `Congratulations on completing ${sessionCount} study sessions`,
        achievedAt: sessions[sessions.length - 1].startTime,
        value: sessionCount,
        nextMilestone: {
          title: '100 Sessions',
          target: 100,
          estimatedTime: `${Math.ceil((100 - sessionCount) / 5)} weeks at current pace`
        }
      });
    }

    // Accuracy milestone
    const overallAccuracy = sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length;
    if (overallAccuracy >= 80) {
      milestones.push({
        type: 'accuracy_milestone',
        title: '80% Accuracy Achieved!',
        description: `Excellent performance with ${Math.round(overallAccuracy)}% overall accuracy`,
        achievedAt: new Date().toISOString(),
        value: Math.round(overallAccuracy),
        nextMilestone: {
          title: '90% Accuracy',
          target: 90,
          estimatedTime: '2-4 weeks with focused practice'
        }
      });
    }

    return milestones;
  }

  private detectLearningWarnings(sessions: any[], progressData: any[]): LearningWarning[] {
    const warnings: LearningWarning[] = [];

    // Declining performance warning
    if (sessions.length >= 10) {
      const recentSessions = sessions.slice(-5);
      const olderSessions = sessions.slice(-10, -5);
      
      const recentAccuracy = recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length;
      const olderAccuracy = olderSessions.reduce((sum, s) => sum + s.accuracy, 0) / olderSessions.length;
      
      if (recentAccuracy < olderAccuracy - 10) {
        warnings.push({
          type: 'declining_performance',
          severity: 'medium',
          title: 'Recent Performance Decline',
          description: `Accuracy has dropped by ${Math.round(olderAccuracy - recentAccuracy)}% in recent sessions`,
          affectedAreas: ['Overall Performance'],
          recommendations: [
            'Review recent mistakes',
            'Take a short break to avoid burnout',
            'Focus on fundamental concepts'
          ],
          detectedAt: new Date().toISOString()
        });
      }
    }

    // Study gap warning
    const lastSession = sessions[sessions.length - 1];
    const daysSinceLastStudy = Math.floor((Date.now() - new Date(lastSession.startTime).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastStudy > 7) {
      warnings.push({
        type: 'study_gap',
        severity: 'high',
        title: 'Extended Study Gap',
        description: `${daysSinceLastStudy} days since last study session`,
        affectedAreas: ['Knowledge Retention'],
        recommendations: [
          'Resume regular study schedule',
          'Start with review of previous topics',
          'Set daily study reminders'
        ],
        detectedAt: new Date().toISOString()
      });
    }

    return warnings;
  }

  private calculateMasteryLevel(accuracy: number, questionsAnswered: number): 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (questionsAnswered < 5) return 'novice';
    if (accuracy >= 90 && questionsAnswered >= 50) return 'expert';
    if (accuracy >= 80 && questionsAnswered >= 30) return 'advanced';
    if (accuracy >= 70 && questionsAnswered >= 20) return 'intermediate';
    if (accuracy >= 60 && questionsAnswered >= 10) return 'beginner';
    return 'novice';
  }
}

export type { IAnalyticsService };