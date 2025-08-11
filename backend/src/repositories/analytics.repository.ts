// Analytics repository for progress data aggregation and retrieval

import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { QueryCommand, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { 
  IAnalyticsRepository,
  SessionAnalyticsFilters,
  SessionAnalyticsData,
  UserProgressData,
  TopicPerformanceHistory,
  TrendData,
  AnalyticsSnapshot,
  QuestionAnalyticsData,
  SessionTopicAnalyticsData
} from '../shared/types/analytics.types';
import { StudySession } from '../shared/types/domain.types';

export class AnalyticsRepository implements IAnalyticsRepository {
  private logger = createLogger({ repository: 'AnalyticsRepository' });

  constructor(
    private dynamoClient: DynamoDBDocumentClient,
    private config: ServiceConfig
  ) {}

  /**
   * Get completed sessions with analytics data
   */
  async getCompletedSessions(filters: SessionAnalyticsFilters): Promise<SessionAnalyticsData[]> {
    this.logger.info('Getting completed sessions for analytics', { filters });

    try {
      // Query completed sessions from DynamoDB
      const params: any = {
        TableName: this.config.tables.studySessions,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'completed'
        }
      };

      // Add additional filters
      if (filters.userId) {
        params.FilterExpression += ' AND #userId = :userId';
        params.ExpressionAttributeNames['#userId'] = 'userId';
        params.ExpressionAttributeValues[':userId'] = filters.userId;
      }

      if (filters.providerId) {
        params.FilterExpression += ' AND #providerId = :providerId';
        params.ExpressionAttributeNames['#providerId'] = 'providerId';
        params.ExpressionAttributeValues[':providerId'] = filters.providerId;
      }

      if (filters.examId) {
        params.FilterExpression += ' AND #examId = :examId';
        params.ExpressionAttributeNames['#examId'] = 'examId';
        params.ExpressionAttributeValues[':examId'] = filters.examId;
      }

      if (filters.startDate) {
        params.FilterExpression += ' AND #startTime >= :startDate';
        params.ExpressionAttributeNames['#startTime'] = 'startTime';
        params.ExpressionAttributeValues[':startDate'] = filters.startDate;
      }

      if (filters.endDate) {
        params.FilterExpression += ' AND #startTime <= :endDate';
        params.ExpressionAttributeNames['#startTime'] = 'startTime';
        params.ExpressionAttributeValues[':endDate'] = filters.endDate;
      }

      if (filters.limit) {
        params.Limit = filters.limit;
      }

      const result = await this.dynamoClient.send(new ScanCommand(params));
      const sessions = result.Items || [];

      // Transform sessions to analytics data format
      const analyticsData: SessionAnalyticsData[] = sessions.map(session => 
        this.transformSessionToAnalyticsData(session as StudySession)
      );

      this.logger.info('Successfully retrieved sessions for analytics', { 
        count: analyticsData.length,
        filters 
      });

      return analyticsData;

    } catch (error) {
      this.logger.error('Failed to get completed sessions for analytics', error as Error, { filters });
      throw new Error(`Failed to retrieve session analytics data: ${(error as Error).message}`);
    }
  }

  /**
   * Get user progress data from UserProgress table
   */
  async getUserProgressData(userId?: string): Promise<UserProgressData[]> {
    this.logger.info('Getting user progress data', { ...(userId && { userId }) });

    try {
      const params: any = {
        TableName: this.config.tables.userProgress
      };

      if (userId) {
        params.FilterExpression = '#userId = :userId';
        params.ExpressionAttributeNames = { '#userId': 'userId' };
        params.ExpressionAttributeValues = { ':userId': userId };
      }

      const result = await this.dynamoClient.send(new ScanCommand(params));
      const progressData = result.Items || [];

      this.logger.info('Successfully retrieved user progress data', { 
        count: progressData.length,
        ...(userId && { userId })
      });

      return progressData as UserProgressData[];

    } catch (error) {
      this.logger.error('Failed to get user progress data', error as Error, { ...(userId && { userId }) });
      throw new Error(`Failed to retrieve user progress data: ${(error as Error).message}`);
    }
  }

  /**
   * Get topic performance history (calculated from sessions)
   */
  async getTopicPerformanceHistory(topicIds: string[], userId?: string): Promise<TopicPerformanceHistory[]> {
    this.logger.info('Getting topic performance history', { topicIds, ...(userId && { userId }) });

    try {
      // Get completed sessions and extract topic performance over time  
      const sessionFilters: any = { status: 'completed' };
      if (userId) sessionFilters.userId = userId;
      const sessions = await this.getCompletedSessions(sessionFilters);

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
                masteryLevel: 'novice'
              });
            }

            const existing = historyMap.get(key)!;
            const totalQuestions = existing.questionsAnswered + topicData.questionsAnswered;
            const totalTime = (existing.averageTime * existing.questionsAnswered) + (topicData.averageTime * topicData.questionsAnswered);
            
            existing.questionsAnswered = totalQuestions;
            existing.accuracy = ((existing.accuracy * existing.questionsAnswered) + (topicData.accuracy * topicData.questionsAnswered)) / totalQuestions;
            existing.averageTime = totalTime / totalQuestions;
            existing.masteryLevel = this.calculateMasteryLevel(existing.accuracy, existing.questionsAnswered);
          }
        }
      }

      const history = Array.from(historyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      this.logger.info('Successfully calculated topic performance history', { 
        count: history.length,
        topicIds,
        ...(userId && { userId })
      });

      return history;

    } catch (error) {
      this.logger.error('Failed to get topic performance history', error as Error, { topicIds, ...(userId && { userId }) });
      throw new Error(`Failed to retrieve topic performance history: ${(error as Error).message}`);
    }
  }

  /**
   * Calculate trend data for a specific metric over time
   */
  async calculateTrendData(metric: string, timeframe: string, userId?: string): Promise<TrendData[]> {
    this.logger.info('Calculating trend data', { metric, timeframe, ...(userId && { userId }) });

    try {
      const sessionFilters: any = { status: 'completed' };
      if (userId) sessionFilters.userId = userId;
      const sessions = await this.getCompletedSessions(sessionFilters);

      // Group sessions by time period
      const periodMap = new Map<string, { sessions: SessionAnalyticsData[]; value: number; dataPoints: number }>();

      for (const session of sessions) {
        const period = this.getPeriodKey(session.startTime, timeframe);
        
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
          dataPoints
        });
      }

      this.logger.info('Successfully calculated trend data', { 
        metric,
        timeframe,
        pointsCount: trends.length,
        ...(userId && { userId })
      });

      return trends;

    } catch (error) {
      this.logger.error('Failed to calculate trend data', error as Error, { metric, timeframe, ...(userId && { userId }) });
      throw new Error(`Failed to calculate trend data: ${(error as Error).message}`);
    }
  }

  /**
   * Save analytics snapshot for caching
   */
  async saveAnalyticsSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
    this.logger.info('Saving analytics snapshot', { 
      userId: snapshot.userId,
      snapshotDate: snapshot.snapshotDate 
    });

    try {
      // Use a separate table or extend existing table for analytics snapshots
      // For now, using userProgress table with a special record type
      await this.dynamoClient.send(new PutCommand({
        TableName: this.config.tables.userProgress,
        Item: {
          userId: snapshot.userId,
          topicId: `ANALYTICS_SNAPSHOT_${snapshot.snapshotDate}`,
          examId: 'ANALYTICS',
          providerId: 'SYSTEM',
          snapshotData: snapshot,
          recordType: 'analytics_snapshot',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }));

      this.logger.info('Successfully saved analytics snapshot', { 
        userId: snapshot.userId,
        snapshotDate: snapshot.snapshotDate 
      });

    } catch (error) {
      this.logger.error('Failed to save analytics snapshot', error as Error, { 
        userId: snapshot.userId,
        snapshotDate: snapshot.snapshotDate 
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
      
      const result = await this.dynamoClient.send(new GetCommand({
        TableName: this.config.tables.userProgress,
        Key: {
          userId: userId,
          topicId: `ANALYTICS_SNAPSHOT_${today}`
        }
      }));

      if (result.Item && result.Item.snapshotData) {
        this.logger.info('Successfully retrieved analytics snapshot', { ...(userId && { userId }) });
        return result.Item.snapshotData as AnalyticsSnapshot;
      }

      this.logger.info('No analytics snapshot found', { ...(userId && { userId }) });
      return null;

    } catch (error) {
      this.logger.error('Failed to get analytics snapshot', error as Error, { ...(userId && { userId }) });
      throw new Error(`Failed to retrieve analytics snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * Transform session data to analytics format
   */
  private transformSessionToAnalyticsData(session: StudySession): SessionAnalyticsData {
    const duration = session.endTime 
      ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))
      : 0;

    const questions: QuestionAnalyticsData[] = session.questions.map(q => ({
      questionId: q.questionId,
      topicId: 'unknown', // Will need to enrich with topic data
      difficulty: 'medium' as const, // Will need to enrich with question data
      isCorrect: q.isCorrect || false,
      timeSpent: q.timeSpent,
      userAnswer: q.userAnswer || [],
      correctAnswer: q.correctAnswer,
      skipped: q.skipped,
      markedForReview: q.markedForReview
    }));

    // Calculate topic breakdown from questions
    const topicBreakdown: SessionTopicAnalyticsData[] = [];
    const topicMap = new Map<string, SessionTopicAnalyticsData>();

    for (const question of questions) {
      const topicId = question.topicId;
      if (!topicMap.has(topicId)) {
        topicMap.set(topicId, {
          topicId: topicId,
          topicName: topicId, // Will need to enrich with actual topic name
          questionsTotal: 0,
          questionsAnswered: 0,
          questionsCorrect: 0,
          accuracy: 0,
          averageTime: 0,
          totalScore: 0
        });
      }

      const topicData = topicMap.get(topicId)!;
      topicData.questionsTotal++;
      if (question.userAnswer.length > 0) {
        topicData.questionsAnswered++;
        if (question.isCorrect) {
          topicData.questionsCorrect++;
          topicData.totalScore += 1; // Assuming 1 point per correct answer
        }
      }
    }

    // Calculate averages for each topic
    for (const [, topicData] of topicMap) {
      if (topicData.questionsAnswered > 0) {
        topicData.accuracy = (topicData.questionsCorrect / topicData.questionsAnswered) * 100;
        const topicQuestions = questions.filter(q => q.topicId === topicData.topicId);
        topicData.averageTime = topicQuestions.reduce((sum, q) => sum + q.timeSpent, 0) / topicQuestions.length;
      }
    }

    return {
      sessionId: session.sessionId,
      ...(session.userId && { userId: session.userId }),
      providerId: session.providerId,
      examId: session.examId,
      startTime: session.startTime,
      endTime: session.endTime || '',
      duration: duration,
      totalQuestions: session.totalQuestions,
      questionsAnswered: session.questions.filter(q => q.userAnswer && q.userAnswer.length > 0).length,
      correctAnswers: session.correctAnswers,
      accuracy: session.correctAnswers > 0 ? (session.correctAnswers / session.totalQuestions) * 100 : 0,
      score: session.score || 0,
      questions: questions,
      topicBreakdown: Array.from(topicMap.values())
    };
  }

  /**
   * Get period key for trend analysis
   */
  private getPeriodKey(dateString: string, timeframe: string): string {
    const date = new Date(dateString);
    
    switch (timeframe) {
      case 'week':
        const weekNumber = this.getWeekNumber(date);
        return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
      case 'month':
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${quarter}`;
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toISOString().split('T')[0]; // Daily by default
    }
  }

  /**
   * Get week number of the year
   */
  private getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }

  /**
   * Calculate mastery level based on accuracy and questions answered
   */
  private calculateMasteryLevel(accuracy: number, questionsAnswered: number): string {
    if (questionsAnswered < 5) return 'novice';
    if (accuracy >= 90 && questionsAnswered >= 50) return 'expert';
    if (accuracy >= 80 && questionsAnswered >= 30) return 'advanced';
    if (accuracy >= 70 && questionsAnswered >= 20) return 'intermediate';
    if (accuracy >= 60 && questionsAnswered >= 10) return 'beginner';
    return 'novice';
  }

  /**
   * Get session details for analytics - Phase 24 implementation
   */
  async getSessionDetails(sessionId: string): Promise<any> {
    this.logger.info('Getting session details for analytics', { sessionId });

    try {
      const params = {
        TableName: this.config.tables.studySessions,
        Key: { sessionId }
      };

      const response = await this.dynamoClient.send(new GetCommand(params));
      
      if (!response.Item) {
        return null;
      }

      // Transform to analytics format
      const session = response.Item as StudySession;
      return {
        sessionId: session.sessionId,
        totalAnswers: session.questions.length,
        correctAnswers: session.questions.filter(q => q.userAnswer && q.correctAnswer && 
          JSON.stringify(q.userAnswer.sort()) === JSON.stringify(q.correctAnswer.sort())).length,
        totalTime: session.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0),
        providerId: session.providerId,
        examId: session.examId,
        completedAt: session.updatedAt
      };
    } catch (error) {
      this.logger.error('Failed to get session details', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Get performance data for analytics - Phase 25 implementation
   */
  async getPerformanceData(params: any): Promise<any> {
    this.logger.info('Getting performance data for analytics', { params });

    try {
      // For now, return mock performance data structure
      return {
        sessions: [],
        accuracy: 0,
        averageTime: 0,
        competencyScores: {}
      };
    } catch (error) {
      this.logger.error('Failed to get performance data', error as Error, { params });
      throw error;
    }
  }
}

export type { IAnalyticsRepository };