import { createLogger } from '../shared/logger';
import {
  IInsightGenerator,
  IAnalyticsRepository,
  LearningInsights,
  LearningPattern,
  LearningRecommendation,
  LearningMilestone,
  LearningWarning,
  VisualizationData,
  ChartDataPoint,
  RadarChartData,
  MatrixData,
  HeatmapData,
  GaugeData,
  TrendData,
  HistoricalPerformance,
  TopicCompetency,
  ProviderCompetency,
  ExamCompetency,
} from '../shared/types/analytics.types';

export class InsightGenerator implements IInsightGenerator {
  private logger = createLogger({ service: 'InsightGenerator' });

  constructor(private analyticsRepository: IAnalyticsRepository) {}

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
        warnings,
      };
    } catch (error) {
      this.logger.error('Failed to generate learning insights', error as Error, {
        ...(userId && { userId }),
      });
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
        label: `${Math.round(point.value * 100) / 100}%`,
      }));

      const studyTimeDistribution: ChartDataPoint[] = trends.studyTimeTrend.map(
        (point: TrendData) => ({
          x: point.period,
          y: Math.round(point.value),
          label: `${Math.round(point.value)} min`,
        })
      );

      const weeklyProgress: ChartDataPoint[] = historicalData.map((day: HistoricalPerformance) => ({
        x: day.date,
        y: day.accuracy,
        label: `${Math.round(day.accuracy)}% accuracy`,
      }));

      // Prepare radar chart for topic mastery
      const topicMasteryRadar: RadarChartData = {
        labels: competencyData.topicCompetencies
          .slice(0, 8)
          .map((topic: TopicCompetency) => topic.topicName),
        datasets: [
          {
            label: 'Current Mastery',
            data: competencyData.topicCompetencies
              .slice(0, 8)
              .map((topic: TopicCompetency) => topic.currentAccuracy),
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
          },
        ],
      };

      // Prepare difficulty progression
      const difficultyProgression: ChartDataPoint[] = [];
      for (const diffTrend of trends.difficultyProgressTrend) {
        difficultyProgression.push({
          x: diffTrend.period,
          y: diffTrend.value,
          label: `${diffTrend.difficulty}: ${Math.round(diffTrend.value)}%`,
        });
      }

      // Prepare competency matrix
      const competencyMatrix: MatrixData = {
        rows: competencyData.topicCompetencies
          .slice(0, 10)
          .map((t: TopicCompetency) => t.topicName),
        columns: ['Accuracy', 'Speed', 'Consistency', 'Improvement'],
        data: competencyData.topicCompetencies.slice(0, 10).map((topic: TopicCompetency) => [
          topic.currentAccuracy,
          Math.max(0, 100 - topic.averageTimePerQuestion / 10), // Speed score
          topic.confidence * 100, // Consistency score
          Math.max(0, topic.improvementRate), // Improvement score
        ]),
        colorScale: {
          min: 0,
          max: 100,
          colors: ['#ff4444', '#ffaa00', '#44ff44'],
        },
      };

      // Prepare study activity heatmap
      const studyActivity: HeatmapData = {
        data: historicalData.slice(-30).map((day: HistoricalPerformance) => ({
          x: day.date,
          y: 'Study Time',
          value: day.studyTime,
        })),
        scale: {
          min: 0,
          max: Math.max(...historicalData.map((d: HistoricalPerformance) => d.studyTime)),
        },
      };

      // Prepare topic accuracy heatmap
      const topicAccuracy: HeatmapData = {
        data: competencyData.topicCompetencies.map((topic: TopicCompetency) => ({
          x: topic.topicName,
          y: 'Accuracy',
          value: topic.currentAccuracy,
        })),
        scale: {
          min: 0,
          max: 100,
        },
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
          green: 85,
        },
      };

      const examReadinessGauges: GaugeData[] = competencyData.providerCompetencies
        .slice(0, 3)
        .flatMap((provider: ProviderCompetency) =>
          provider.examCompetencies.slice(0, 2).map((exam: ExamCompetency) => ({
            label: `${exam.examName} Readiness`,
            value: exam.estimatedReadiness,
            min: 0,
            max: 100,
            thresholds: {
              red: 50,
              yellow: 75,
              green: 85,
            },
          }))
        );

      return {
        charts: {
          accuracyOverTime,
          studyTimeDistribution,
          topicMasteryRadar,
          difficultyProgression,
          weeklyProgress,
          competencyMatrix,
        },
        heatmaps: {
          studyActivity,
          topicAccuracy,
        },
        gauges: {
          overallProgress: overallProgressGauge,
          examReadiness: examReadinessGauges,
        },
      };
    } catch (error) {
      this.logger.error('Failed to prepare visualization data', error as Error);
      throw error;
    }
  }

  /**
   * Identify learning patterns from session data
   */
  identifyLearningPatterns(sessions: any[]): LearningPattern[] {
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
        evidence: [
          `${Math.round((morningCount / sessions.length) * 100)}% of sessions in morning hours`,
        ],
        impact: 'positive',
      });
    }

    // Learning velocity pattern
    const recentSessions = sessions.slice(-10);
    const avgAccuracy =
      recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length;

    if (avgAccuracy > 75) {
      patterns.push({
        type: 'learning_velocity',
        description: 'Fast learner with high retention',
        strength: avgAccuracy / 100,
        evidence: [`Average accuracy of ${Math.round(avgAccuracy)}% in recent sessions`],
        impact: 'positive',
      });
    }

    return patterns;
  }

  /**
   * Generate learning recommendations
   */
  generateLearningRecommendations(sessions: any[], progressData: any[]): LearningRecommendation[] {
    const recommendations: LearningRecommendation[] = [];

    // Study schedule recommendation
    if (sessions.length > 0) {
      const avgSessionDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;

      if (avgSessionDuration < 30) {
        recommendations.push({
          type: 'study_schedule',
          title: 'Extend Study Sessions',
          description:
            'Consider longer study sessions for better retention and deeper understanding',
          priority: 'medium',
          expectedImpact: 'Improved knowledge retention and better performance on complex topics',
          actionItems: [
            'Aim for 45-60 minute study sessions',
            'Take 5-10 minute breaks every 25 minutes',
            'Focus on one topic per session',
          ],
          timeframe: '1_week',
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
        actionItems: weakTopics.map(
          t => `Study ${t.topicId} - current accuracy: ${Math.round(t.accuracy)}%`
        ),
        timeframe: 'immediate',
      });
    }

    return recommendations;
  }

  /**
   * Identify learning milestones
   */
  identifyLearningMilestones(sessions: any[], progressData: any[]): LearningMilestone[] {
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
          estimatedTime: `${Math.ceil((100 - sessionCount) / 5)} weeks at current pace`,
        },
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
          estimatedTime: '2-4 weeks with focused practice',
        },
      });
    }

    return milestones;
  }

  /**
   * Detect learning warnings
   */
  detectLearningWarnings(sessions: any[], progressData: any[]): LearningWarning[] {
    const warnings: LearningWarning[] = [];

    // Declining performance warning
    if (sessions.length >= 10) {
      const recentSessions = sessions.slice(-5);
      const olderSessions = sessions.slice(-10, -5);

      const recentAccuracy =
        recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentSessions.length;
      const olderAccuracy =
        olderSessions.reduce((sum, s) => sum + s.accuracy, 0) / olderSessions.length;

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
            'Focus on fundamental concepts',
          ],
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Study gap warning
    const lastSession = sessions[sessions.length - 1];
    const daysSinceLastStudy = Math.floor(
      (Date.now() - new Date(lastSession.startTime).getTime()) / (1000 * 60 * 60 * 24)
    );

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
          'Set daily study reminders',
        ],
        detectedAt: new Date().toISOString(),
      });
    }

    return warnings;
  }

  /**
   * Generate session insights for individual sessions
   */
  generateSessionInsights(session: any): any {
    // Implementation for session insights
    return {
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };
  }
}

export type { IInsightGenerator };
