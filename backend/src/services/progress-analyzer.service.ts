import { createLogger } from '../shared/logger';
import {
  IProgressAnalyzer,
  IAnalyticsRepository,
  ProgressOverview,
  ProgressTrends,
  HistoricalPerformance,
  TrendData,
  DifficultyTrendData,
  CompetencyTrendData,
} from '../shared/types/analytics.types';

export class ProgressAnalyzer implements IProgressAnalyzer {
  private logger = createLogger({ service: 'ProgressAnalyzer' });

  constructor(private analyticsRepository: IAnalyticsRepository) {}

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
      const overallAccuracy =
        totalQuestionsAnswered > 0 ? (totalCorrectAnswers / totalQuestionsAnswered) * 100 : 0;
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
        improvementVelocity: Math.round(improvementVelocity * 100) / 100,
      };
    } catch (error) {
      this.logger.error('Failed to calculate progress overview', error as Error, {
        ...(userId && { userId }),
      });
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
      const [accuracyTrend, studyTimeTrend, sessionFrequencyTrend] = await Promise.all([
        this.analyticsRepository.calculateTrendData('accuracy', timeframe, userId),
        this.analyticsRepository.calculateTrendData('studyTime', timeframe, userId),
        this.analyticsRepository.calculateTrendData('sessionCount', timeframe, userId),
      ]);

      // Get difficulty progression trends
      const difficultyProgressTrend = await this.calculateDifficultyProgressTrend(
        timeframe,
        userId
      );

      // Get competency growth trends
      const competencyGrowthTrend = await this.calculateCompetencyGrowthTrend(timeframe, userId);

      return {
        accuracyTrend,
        studyTimeTrend,
        sessionFrequencyTrend,
        difficultyProgressTrend,
        competencyGrowthTrend,
      };
    } catch (error) {
      this.logger.error('Failed to generate progress trends', error as Error, {
        timeframe,
        ...(userId && { userId }),
      });
      throw error;
    }
  }

  /**
   * Get historical performance data
   */
  async getHistoricalPerformance(
    startDate: string,
    endDate: string,
    userId?: string
  ): Promise<HistoricalPerformance[]> {
    this.logger.info('Getting historical performance', {
      startDate,
      endDate,
      ...(userId && { userId }),
    });

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
            regressions: [],
          });
        }

        const daily = dailyPerformance.get(date)!;
        daily.sessionsCompleted++;
        daily.questionsAnswered += session.questionsAnswered;
        daily.studyTime += session.duration;

        // Calculate weighted accuracy
        const totalQuestions = daily.questionsAnswered;
        const totalCorrect =
          daily.accuracy * (totalQuestions - session.questionsAnswered) +
          (session.accuracy * session.questionsAnswered) / 100;
        daily.accuracy = (totalCorrect / totalQuestions) * 100;

        // Track topics
        const sessionTopics = session.topicBreakdown.map((t: any) => t.topicName);
        daily.topicsFocused = [...new Set([...daily.topicsFocused, ...sessionTopics])];

        // Calculate average score
        daily.averageScore =
          (daily.averageScore * (daily.sessionsCompleted - 1) + session.score) /
          daily.sessionsCompleted;
      }

      // Sort by date and identify improvements/regressions
      const history = Array.from(dailyPerformance.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

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
      this.logger.error('Failed to get historical performance', error as Error, {
        startDate,
        endDate,
        ...(userId && { userId }),
      });
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
      improvementVelocity: 0,
    };
  }

  private calculateStudyStreaks(sessions: any[]): { currentStreak: number; longestStreak: number } {
    if (sessions.length === 0) return { currentStreak: 0, longestStreak: 0 };

    // Sort sessions by date
    const sortedSessions = sessions.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Get unique study days
    const studyDates = [
      ...new Set(sortedSessions.map(s => new Date(s.startTime).toDateString())),
    ].sort();

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
    const sortedSessions = sessions.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const firstWeekSessions = sortedSessions.slice(0, Math.min(5, sessions.length / 2));
    const lastWeekSessions = sortedSessions.slice(-Math.min(5, sessions.length / 2));

    const firstWeekAccuracy =
      firstWeekSessions.reduce((sum, s) => sum + s.accuracy, 0) / firstWeekSessions.length;
    const lastWeekAccuracy =
      lastWeekSessions.reduce((sum, s) => sum + s.accuracy, 0) / lastWeekSessions.length;

    const timeDiff =
      (new Date(lastWeekSessions[0].startTime).getTime() -
        new Date(firstWeekSessions[0].startTime).getTime()) /
      (1000 * 60 * 60 * 24 * 7);

    return timeDiff > 0 ? (lastWeekAccuracy - firstWeekAccuracy) / timeDiff : 0;
  }

  private calculateOverallProgress(progressData: any[], accuracy: number): number {
    // Combine accuracy, consistency, and topic coverage for overall progress
    const accuracyScore = Math.min(accuracy, 100);
    const topicCoverage = progressData.length > 0 ? Math.min(progressData.length * 10, 100) : 0;

    // Weight accuracy more heavily
    return Math.round((accuracyScore * 0.7 + topicCoverage * 0.3) * 100) / 100;
  }

  private async calculateDifficultyProgressTrend(
    timeframe: string,
    userId?: string
  ): Promise<DifficultyTrendData[]> {
    // Simplified implementation - would need actual question difficulty data
    const sessions = await this.analyticsRepository.getCompletedSessions({
      ...(userId && { userId }),
    });
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
        questionsAnswered: Math.floor(sessions.length * Math.random() * 50),
      });
    }

    return trends;
  }

  private async calculateCompetencyGrowthTrend(
    timeframe: string,
    userId?: string
  ): Promise<CompetencyTrendData[]> {
    const progressData = await this.analyticsRepository.getUserProgressData(userId);

    return progressData.slice(0, 5).map((progress, index) => ({
      period: `2024-${(index + 1).toString().padStart(2, '0')}`,
      value: progress.accuracy,
      change: Math.random() * 10 - 5,
      dataPoints: progress.questionsAttempted,
      topicId: progress.topicId,
      topicName: progress.topicId, // Would need to enrich with actual topic name
      masteryLevel: progress.masteryLevel as any,
      questionsAnswered: progress.questionsAttempted,
    }));
  }
}

export type { IProgressAnalyzer };
