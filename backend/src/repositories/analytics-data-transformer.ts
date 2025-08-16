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
    // Add null safety checks for session object and required properties
    if (!session) {
      throw new Error('Session data is required for analytics transformation');
    }

    if (!session.sessionId) {
      throw new Error('Session ID is required for analytics transformation');
    }

    // Safe access to time properties with fallbacks
    const startTime = session.startTime || new Date().toISOString();
    const endTime = session.endTime || null;
    
    const duration = endTime
      ? Math.round(
          (new Date(endTime).getTime() - new Date(startTime).getTime()) /
            (1000 * 60)
        )
      : 0;

    // Safe access to questions array with null check
    const questionsArray = Array.isArray(session.questions) ? session.questions : [];
    
    const questions: QuestionAnalyticsData[] = questionsArray.map((q: any) => ({
      questionId: q?.questionId || 'unknown',
      topicId: q?.topicId || 'unknown', 
      difficulty: (q?.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
      isCorrect: Boolean(q?.isCorrect),
      timeSpent: typeof q?.timeSpent === 'number' ? q.timeSpent : 0,
      userAnswer: Array.isArray(q?.userAnswer) ? q.userAnswer : [],
      correctAnswer: Array.isArray(q?.correctAnswer) ? q.correctAnswer : [],
      skipped: Boolean(q?.skipped),
      markedForReview: Boolean(q?.markedForReview),
    }));

    // Calculate topic breakdown from questions with null safety
    const topicBreakdown: SessionTopicAnalyticsData[] = [];
    const topicMap = new Map<string, SessionTopicAnalyticsData>();

    for (const question of questions) {
      const topicId = question.topicId || 'unknown';
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
      if (question.userAnswer && question.userAnswer.length > 0) {
        topicData.questionsAnswered++;
        if (question.isCorrect) {
          topicData.questionsCorrect++;
          topicData.totalScore += 1; // Assuming 1 point per correct answer
        }
      }
    }

    // Calculate averages for each topic with null safety
    for (const [, topicData] of topicMap) {
      if (topicData.questionsAnswered > 0) {
        topicData.accuracy = (topicData.questionsCorrect / topicData.questionsAnswered) * 100;
        const topicQuestions = questions.filter(q => q.topicId === topicData.topicId);
        const totalTime = topicQuestions.reduce((sum: number, q: any) => sum + (q.timeSpent || 0), 0);
        topicData.averageTime = topicQuestions.length > 0 ? totalTime / topicQuestions.length : 0;
      }
    }

    // Safe access to all session properties with defaults
    const totalQuestions = typeof session.totalQuestions === 'number' ? session.totalQuestions : questionsArray.length;
    const correctAnswers = typeof session.correctAnswers === 'number' ? session.correctAnswers 
      : questionsArray.filter(q => q?.isCorrect).length;
    const questionsAnswered = questionsArray.filter(q => q?.userAnswer && Array.isArray(q.userAnswer) && q.userAnswer.length > 0).length;

    return {
      sessionId: session.sessionId,
      ...(session.userId && { userId: session.userId }),
      providerId: session.providerId || 'unknown',
      examId: session.examId || 'unknown',
      startTime: startTime,
      endTime: endTime || '',
      duration: duration,
      totalQuestions: totalQuestions,
      questionsAnswered: questionsAnswered,
      correctAnswers: correctAnswers,
      accuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,
      score: typeof session.score === 'number' ? session.score : 0,
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
