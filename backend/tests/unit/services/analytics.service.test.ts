// Unit tests for Analytics Service - Phase 22 Implementation

import { AnalyticsService } from '../../../src/services/analytics.service';
import { ProgressAnalyzer } from '../../../src/services/progress-analyzer.service';
import { CompetencyAnalyzer } from '../../../src/services/competency-analyzer.service';
import { PerformanceAnalyzer } from '../../../src/services/performance-analyzer.service';
import { InsightGenerator } from '../../../src/services/insight-generator.service';
import {
  IAnalyticsRepository,
  IProgressAnalyzer,
  ICompetencyAnalyzer,
  IPerformanceAnalyzer,
  IInsightGenerator,
  SessionAnalyticsData,
  UserProgressData,
  ProgressAnalyticsRequest,
  ProgressOverview,
  CompetencyAnalytics,
  LearningInsights
} from '../../../src/shared/types/analytics.types';

// Mock repository
class MockAnalyticsRepository implements IAnalyticsRepository {
  private mockSessions: SessionAnalyticsData[] = [
    {
      sessionId: 'session-1',
      providerId: 'aws',
      examId: 'saa-c03',
      startTime: '2024-01-15T10:00:00Z',
      endTime: '2024-01-15T11:30:00Z',
      duration: 90,
      totalQuestions: 10,
      questionsAnswered: 10,
      correctAnswers: 8,
      accuracy: 80,
      score: 80,
      questions: [],
      topicBreakdown: [
        {
          topicId: 'ec2',
          topicName: 'EC2 Instances',
          questionsTotal: 5,
          questionsAnswered: 5,
          questionsCorrect: 4,
          accuracy: 80,
          averageTime: 120,
          totalScore: 4
        },
        {
          topicId: 's3',
          topicName: 'S3 Storage',
          questionsTotal: 5,
          questionsAnswered: 5,
          questionsCorrect: 4,
          accuracy: 80,
          averageTime: 130,
          totalScore: 4
        }
      ]
    },
    {
      sessionId: 'session-2',
      providerId: 'aws',
      examId: 'saa-c03',
      startTime: '2024-01-16T10:00:00Z',
      endTime: '2024-01-16T11:45:00Z',
      duration: 105,
      totalQuestions: 10,
      questionsAnswered: 10,
      correctAnswers: 9,
      accuracy: 90,
      score: 90,
      questions: [],
      topicBreakdown: [
        {
          topicId: 'ec2',
          topicName: 'EC2 Instances',
          questionsTotal: 5,
          questionsAnswered: 5,
          questionsCorrect: 5,
          accuracy: 100,
          averageTime: 110,
          totalScore: 5
        },
        {
          topicId: 's3',
          topicName: 'S3 Storage',
          questionsTotal: 5,
          questionsAnswered: 5,
          questionsCorrect: 4,
          accuracy: 80,
          averageTime: 125,
          totalScore: 4
        }
      ]
    }
  ];

  private mockProgressData: UserProgressData[] = [
    {
      userId: 'user-1',
      topicId: 'ec2',
      examId: 'saa-c03',
      providerId: 'aws',
      questionsAttempted: 10,
      questionsCorrect: 9,
      accuracy: 90,
      averageTimePerQuestion: 115,
      lastStudiedAt: '2024-01-16T11:45:00Z',
      masteryLevel: 'advanced',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-16T11:45:00Z'
    },
    {
      userId: 'user-1',
      topicId: 's3',
      examId: 'saa-c03',
      providerId: 'aws',
      questionsAttempted: 10,
      questionsCorrect: 8,
      accuracy: 80,
      averageTimePerQuestion: 127,
      lastStudiedAt: '2024-01-16T11:45:00Z',
      masteryLevel: 'intermediate',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-16T11:45:00Z'
    }
  ];

  async getCompletedSessions(filters: any): Promise<SessionAnalyticsData[]> {
    return this.mockSessions;
  }

  async getUserProgressData(userId?: string): Promise<UserProgressData[]> {
    return this.mockProgressData;
  }

  async getTopicPerformanceHistory(topicIds: string[], userId?: string): Promise<any[]> {
    return [
      {
        topicId: 'ec2',
        date: '2024-01-15',
        accuracy: 80,
        questionsAnswered: 5,
        averageTime: 120,
        masteryLevel: 'intermediate'
      },
      {
        topicId: 'ec2',
        date: '2024-01-16',
        accuracy: 100,
        questionsAnswered: 5,
        averageTime: 110,
        masteryLevel: 'advanced'
      }
    ];
  }

  async calculateTrendData(metric: string, timeframe: string, userId?: string): Promise<any[]> {
    return [
      {
        period: '2024-01-15',
        value: 80,
        change: 0,
        dataPoints: 1
      },
      {
        period: '2024-01-16',
        value: 90,
        change: 12.5,
        dataPoints: 1
      }
    ];
  }

  async saveAnalyticsSnapshot(snapshot: any): Promise<void> {
    // Mock implementation
  }

  async getAnalyticsSnapshot(userId?: string): Promise<any | null> {
    return null;
  }

  async getSessionDetails(sessionId: string): Promise<any> {
    return {
      sessionId,
      correctAnswers: 8,
      totalAnswers: 10,
      totalTime: 1200,
      startTime: '2024-01-15T10:00:00Z'
    };
  }

  async getPerformanceData(params: any): Promise<any> {
    return {
      sessions: this.mockSessions,
      metrics: {
        accuracy: 85,
        speed: 120,
        consistency: 0.8
      }
    };
  }
}

// Mock services
const mockProviderService = {};
const mockExamService = {};
const mockTopicService = {};

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockRepository: MockAnalyticsRepository;
  let progressAnalyzer: IProgressAnalyzer;
  let competencyAnalyzer: ICompetencyAnalyzer;
  let performanceAnalyzer: IPerformanceAnalyzer;
  let insightGenerator: IInsightGenerator;

  beforeEach(() => {
    mockRepository = new MockAnalyticsRepository();
    
    // Create instances of decomposed services
    progressAnalyzer = new ProgressAnalyzer(mockRepository);
    competencyAnalyzer = new CompetencyAnalyzer(mockRepository);
    performanceAnalyzer = new PerformanceAnalyzer(mockRepository);
    insightGenerator = new InsightGenerator(mockRepository);
    
    analyticsService = new AnalyticsService(
      mockRepository,
      progressAnalyzer,
      competencyAnalyzer,
      performanceAnalyzer,
      insightGenerator
    );
  });

  describe('calculateProgressOverview', () => {
    it('should calculate correct progress overview metrics', async () => {
      const overview: ProgressOverview = await analyticsService.calculateProgressOverview('user-1');

      expect(overview.totalSessionsCompleted).toBe(2);
      expect(overview.totalQuestionsAnswered).toBe(20);
      expect(overview.overallAccuracy).toBe(85); // (80 + 90) / 2
      expect(overview.totalStudyTime).toBe(195); // 90 + 105
      expect(overview.averageSessionDuration).toBe(97.5); // 195 / 2
    });

    it('should return empty overview when no sessions exist', async () => {
      // Mock empty sessions
      jest.spyOn(mockRepository, 'getCompletedSessions').mockResolvedValue([]);
      
      const overview: ProgressOverview = await analyticsService.calculateProgressOverview('user-1');

      expect(overview.totalSessionsCompleted).toBe(0);
      expect(overview.totalQuestionsAnswered).toBe(0);
      expect(overview.overallAccuracy).toBe(0);
      expect(overview.totalStudyTime).toBe(0);
    });
  });

  describe('generateProgressTrends', () => {
    it('should generate progress trends for different timeframes', async () => {
      const trends = await analyticsService.generateProgressTrends('week', 'user-1');

      expect(trends).toHaveProperty('accuracyTrend');
      expect(trends).toHaveProperty('studyTimeTrend');
      expect(trends).toHaveProperty('sessionFrequencyTrend');
      expect(trends).toHaveProperty('difficultyProgressTrend');
      expect(trends).toHaveProperty('competencyGrowthTrend');
      
      expect(Array.isArray(trends.accuracyTrend)).toBe(true);
      expect(Array.isArray(trends.studyTimeTrend)).toBe(true);
    });
  });

  describe('analyzeCompetencies', () => {
    it('should analyze competencies across topics and providers', async () => {
      const competencies: CompetencyAnalytics = await analyticsService.analyzeCompetencies('user-1');

      expect(competencies).toHaveProperty('topicCompetencies');
      expect(competencies).toHaveProperty('providerCompetencies');
      expect(competencies).toHaveProperty('strengthsAndWeaknesses');
      expect(competencies).toHaveProperty('masteryProgression');

      expect(Array.isArray(competencies.topicCompetencies)).toBe(true);
      expect(Array.isArray(competencies.providerCompetencies)).toBe(true);
      expect(competencies.topicCompetencies.length).toBeGreaterThan(0);
    });
  });

  describe('generateLearningInsights', () => {
    it('should generate comprehensive learning insights', async () => {
      const insights: LearningInsights = await analyticsService.generateLearningInsights('user-1');

      expect(insights).toHaveProperty('patterns');
      expect(insights).toHaveProperty('recommendations');
      expect(insights).toHaveProperty('milestones');
      expect(insights).toHaveProperty('warnings');

      expect(Array.isArray(insights.patterns)).toBe(true);
      expect(Array.isArray(insights.recommendations)).toBe(true);
      expect(Array.isArray(insights.milestones)).toBe(true);
      expect(Array.isArray(insights.warnings)).toBe(true);
    });
  });

  describe('prepareVisualizationData', () => {
    it('should prepare comprehensive visualization data', async () => {
      // Mock analytics data
      const mockAnalyticsData = {
        overview: {
          overallProgress: 85,
          totalSessionsCompleted: 2,
          overallAccuracy: 85
        },
        trends: {
          accuracyTrend: [
            { period: '2024-01-15', value: 80, change: 0, dataPoints: 1 },
            { period: '2024-01-16', value: 90, change: 12.5, dataPoints: 1 }
          ],
          studyTimeTrend: [
            { period: '2024-01-15', value: 90, change: 0, dataPoints: 1 },
            { period: '2024-01-16', value: 105, change: 16.7, dataPoints: 1 }
          ],
          difficultyProgressTrend: [],
          sessionFrequencyTrend: [],
          competencyGrowthTrend: []
        },
        competencyData: {
          topicCompetencies: [
            {
              topicId: 'ec2',
              topicName: 'EC2 Instances',
              currentAccuracy: 90,
              averageTimePerQuestion: 115,
              confidence: 0.8
            }
          ],
          providerCompetencies: [
            {
              providerId: 'aws',
              providerName: 'AWS',
              examCompetencies: [
                {
                  examId: 'saa-c03',
                  examName: 'Solutions Architect Associate',
                  estimatedReadiness: 85
                }
              ]
            }
          ]
        },
        historicalData: [
          {
            date: '2024-01-15',
            accuracy: 80,
            studyTime: 90
          }
        ]
      };

      const visualizationData = await analyticsService.prepareVisualizationData(mockAnalyticsData);

      expect(visualizationData).toHaveProperty('charts');
      expect(visualizationData).toHaveProperty('heatmaps');
      expect(visualizationData).toHaveProperty('gauges');

      // Check charts
      expect(visualizationData.charts).toHaveProperty('accuracyOverTime');
      expect(visualizationData.charts).toHaveProperty('studyTimeDistribution');
      expect(visualizationData.charts).toHaveProperty('topicMasteryRadar');

      // Check gauges
      expect(visualizationData.gauges).toHaveProperty('overallProgress');
      expect(visualizationData.gauges).toHaveProperty('examReadiness');

      // Verify chart data structure
      expect(Array.isArray(visualizationData.charts.accuracyOverTime)).toBe(true);
      if (visualizationData.charts.accuracyOverTime.length > 0) {
        const chartPoint = visualizationData.charts.accuracyOverTime[0];
        expect(chartPoint).toHaveProperty('x');
        expect(chartPoint).toHaveProperty('y');
        expect(chartPoint).toHaveProperty('label');
      }
    });
  });

  describe('getProgressAnalytics', () => {
    it('should return comprehensive progress analytics response', async () => {
      const request: ProgressAnalyticsRequest = {
        timeframe: 'month'
      };

      const response = await analyticsService.getProgressAnalytics(request);

      expect(response.success).toBe(true);
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('metadata');

      // Check data structure
      expect(response.data).toHaveProperty('overview');
      expect(response.data).toHaveProperty('trends');
      expect(response.data).toHaveProperty('competencyData');
      expect(response.data).toHaveProperty('historicalData');
      expect(response.data).toHaveProperty('insights');
      expect(response.data).toHaveProperty('visualizationData');

      // Check metadata
      expect(response.metadata).toHaveProperty('timeframe');
      expect(response.metadata).toHaveProperty('totalSessions');
      expect(response.metadata).toHaveProperty('calculatedAt');
      expect(response.metadata.timeframe).toBe('month');
    });

    it('should handle different timeframes correctly', async () => {
      const timeframes = ['week', 'month', 'quarter', 'year'];

      for (const timeframe of timeframes) {
        const request: ProgressAnalyticsRequest = { timeframe: timeframe as any };
        const response = await analyticsService.getProgressAnalytics(request);

        expect(response.success).toBe(true);
        expect(response.metadata.timeframe).toBe(timeframe);
      }
    });

    it('should handle filters correctly', async () => {
      const request: ProgressAnalyticsRequest = {
        timeframe: 'month',
        providerId: 'aws',
        examId: 'saa-c03',
        topics: ['ec2', 's3']
      };

      const response = await analyticsService.getProgressAnalytics(request);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('overview');
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Mock repository error
      jest.spyOn(mockRepository, 'getCompletedSessions').mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.calculateProgressOverview('user-1')).rejects.toThrow('Database error');
    });

    it('should handle empty data gracefully', async () => {
      // Mock empty data
      jest.spyOn(mockRepository, 'getCompletedSessions').mockResolvedValue([]);
      jest.spyOn(mockRepository, 'getUserProgressData').mockResolvedValue([]);

      const overview = await analyticsService.calculateProgressOverview('user-1');
      
      expect(overview.totalSessionsCompleted).toBe(0);
      expect(overview.overallAccuracy).toBe(0);
    });
  });
});