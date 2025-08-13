import { createLogger } from '../shared/logger';
import type {
  SessionAnalyticsData,
  QuestionAnalyticsData,
  SessionTopicAnalyticsData,
} from '../shared/types/analytics.types';
import type { StudySession } from '../shared/types/domain.types';

/**
 * AnalyticsDataTransformer - Handles data transformation and utility functions
 *
 * Single Responsibility: Data format conversion and utility calculations
 * Extracted from AnalyticsRepository as part of SRP compliance (Objective 13)
 */
export class AnalyticsDataTransformer {
  private logger = createLogger({ component: 'AnalyticsDataTransformer' });

  /**
   * Transform session data to analytics format
   */
  transformSessionToAnalyticsData(session: StudySession): SessionAnalyticsData {
    const duration = session.endTime
      ? Math.round(
          (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) /
            (1000 * 60)
        )
      : 0;

    const questions: QuestionAnalyticsData[] = session.questions.map((q: any) => ({
      questionId: q.questionId,
      topicId: 'unknown', // Will need to enrich with topic data
      difficulty: 'medium' as const, // Will need to enrich with question data
      isCorrect: q.isCorrect || false,
      timeSpent: q.timeSpent,
      userAnswer: q.userAnswer || [],
      correctAnswer: q.correctAnswer,
      skipped: q.skipped,
      markedForReview: q.markedForReview,
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
          totalScore: 0,
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
        topicData.averageTime =
          topicQuestions.reduce((sum: number, q: any) => sum + q.timeSpent, 0) /
          topicQuestions.length;
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
      questionsAnswered: session.questions.filter(q => q.userAnswer && q.userAnswer.length > 0)
        .length,
      correctAnswers: session.correctAnswers,
      accuracy:
        session.correctAnswers > 0 ? (session.correctAnswers / session.totalQuestions) * 100 : 0,
      score: session.score || 0,
      questions: questions,
      topicBreakdown: Array.from(topicMap.values()),
    };
  }

  /**
   * Get period key for trend analysis
   */
  getPeriodKey(dateString: string, timeframe: string): string {
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
  getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7);
  }

  /**
   * Calculate mastery level based on accuracy and questions answered
   */
  calculateMasteryLevel(accuracy: number, questionsAnswered: number): string {
    if (questionsAnswered < 5) return 'novice';
    if (accuracy >= 90 && questionsAnswered >= 50) return 'expert';
    if (accuracy >= 80 && questionsAnswered >= 30) return 'advanced';
    if (accuracy >= 70 && questionsAnswered >= 20) return 'intermediate';
    if (accuracy >= 60 && questionsAnswered >= 10) return 'beginner';
    return 'novice';
  }
}
