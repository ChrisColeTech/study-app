import { createLogger } from '../shared/logger';
import {
  ICompetencyAnalyzer,
  IAnalyticsRepository,
  CompetencyAnalytics,
  TopicCompetency,
  ProviderCompetency,
  ExamCompetency,
  StrengthsWeaknesses,
  CompetencyArea,
  MasteryProgression,
  MasteryDistribution,
  MasteryProgressionPoint,
  MasteryProjection
} from '../shared/types/analytics.types';

export class CompetencyAnalyzer implements ICompetencyAnalyzer {
  private logger = createLogger({ service: 'CompetencyAnalyzer' });

  constructor(
    private analyticsRepository: IAnalyticsRepository
  ) {}

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
   * Calculate topic-specific competencies
   */
  async calculateTopicCompetencies(sessions: any[], progressData: any[]): Promise<TopicCompetency[]> {
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

  /**
   * Calculate provider-specific competencies
   */
  async calculateProviderCompetencies(sessions: any[]): Promise<ProviderCompetency[]> {
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

  /**
   * Analyze strengths and weaknesses across topics
   */
  analyzeStrengthsAndWeaknesses(topicCompetencies: TopicCompetency[]): StrengthsWeaknesses {
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

  /**
   * Calculate mastery progression over time
   */
  async calculateMasteryProgression(topicCompetencies: TopicCompetency[], userId?: string): Promise<MasteryProgression> {
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

  // Private helper methods

  private calculateMasteryLevel(accuracy: number, questionsAnswered: number): 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert' {
    if (questionsAnswered < 5) return 'novice';
    if (accuracy >= 90 && questionsAnswered >= 50) return 'expert';
    if (accuracy >= 80 && questionsAnswered >= 30) return 'advanced';
    if (accuracy >= 70 && questionsAnswered >= 20) return 'intermediate';
    if (accuracy >= 60 && questionsAnswered >= 10) return 'beginner';
    return 'novice';
  }
}

export type { ICompetencyAnalyzer };