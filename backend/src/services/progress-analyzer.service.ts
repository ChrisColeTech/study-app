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
      
      const sessionResults = await this.analyticsRepository.getCompletedSessions(sessionFilters);
      
      // Add null safety checks for session results
      if (!sessionResults || !sessionResults.items) {
        this.logger.warn('No session results found, returning empty progress overview');
        return this.getEmptyProgressOverview();
      }
      
      const sessions = Array.isArray(sessionResults.items) ? sessionResults.items : [];
      
      const progressResults = await this.analyticsRepository.getUserProgressData(userId);
      const progressData = progressResults?.items && Array.isArray(progressResults.items) ? progressResults.items : [];

      if (sessions.length === 0) {
        this.logger.info('No completed sessions found, returning empty progress overview');
        return this.getEmptyProgressOverview();
      }

      // Calculate basic metrics with null safety
      const totalSessionsCompleted = sessions.length;
      
      // Safe calculation of questions answered with null checks
      const totalQuestionsAnswered = sessions.reduce((sum, s) => {
        const questionsAnswered = typeof s?.questionsAnswered === 'number' ? s.questionsAnswered : 0;
        return sum + questionsAnswered;
      }, 0);
      
      // Safe calculation of correct answers
      const totalCorrectAnswers = sessions.reduce((sum, s) => {
        const correctAnswers = typeof s?.correctAnswers === 'number' ? s.correctAnswers : 0;
        return sum + correctAnswers;
      }, 0);
      
      const overallAccuracy = totalQuestionsAnswered > 0 ? (totalCorrectAnswers / totalQuestionsAnswered) * 100 : 0;
      
      // Safe calculation of study time
      const totalStudyTime = sessions.reduce((sum, s) => {
        const duration = typeof s?.duration === 'number' ? s.duration : 0;
        return sum + duration;
      }, 0);
      
      const averageSessionDuration = totalSessionsCompleted > 0 ? totalStudyTime / totalSessionsCompleted : 0;

      // Calculate streaks with null safety
      const { currentStreak, longestStreak } = this.calculateStudyStreaks(sessions);

      // Calculate improvement velocity with null safety
      const improvementVelocity = this.calculateImprovementVelocity(sessions);

      // Calculate overall progress percentage with null safety
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
      
      // Return empty overview instead of throwing to prevent 500 errors
      this.logger.warn('Returning empty progress overview due to error');
      return this.getEmptyProgressOverview();
    }
  }

  /**
   * Generate progress trends over time
   */
  async generateProgressTrends(timeframe: string, userId?: string): Promise<ProgressTrends> {
  this.logger.info('Generating progress trends', { timeframe, ...(userId && { userId }) });

  try {
    // Get trend data for different metrics with null safety
    const [accuracyTrendResults, studyTimeTrendResults, sessionFrequencyTrendResults] = await Promise.all([
      this.analyticsRepository.calculateTrendData('accuracy', timeframe, userId),
      this.analyticsRepository.calculateTrendData('studyTime', timeframe, userId),
      this.analyticsRepository.calculateTrendData('sessionCount', timeframe, userId),
    ]);

    // Add null safety checks for trend results
    const accuracyTrend = accuracyTrendResults?.items && Array.isArray(accuracyTrendResults.items) ? accuracyTrendResults.items : [];
    const studyTimeTrend = studyTimeTrendResults?.items && Array.isArray(studyTimeTrendResults.items) ? studyTimeTrendResults.items : [];
    const sessionFrequencyTrend = sessionFrequencyTrendResults?.items && Array.isArray(sessionFrequencyTrendResults.items) ? sessionFrequencyTrendResults.items : [];

    // Get difficulty progression trends with null safety
    const difficultyProgressTrend = await this.calculateDifficultyProgressTrend(timeframe, userId);

    // Get competency growth trends with null safety
    const competencyGrowthTrend = await this.calculateCompetencyGrowthTrend(timeframe, userId);

    return {
      accuracyTrend,
      studyTimeTrend,
      sessionFrequencyTrend,
      difficultyProgressTrend: Array.isArray(difficultyProgressTrend) ? difficultyProgressTrend : [],
      competencyGrowthTrend: Array.isArray(competencyGrowthTrend) ? competencyGrowthTrend : [],
    };
  } catch (error) {
    this.logger.error('Failed to generate progress trends', error as Error, {
      timeframe,
      ...(userId && { userId }),
    });
    
    // Return empty trends instead of throwing to prevent 500 errors
    this.logger.warn('Returning empty progress trends due to error');
    return {
      accuracyTrend: [],
      studyTimeTrend: [],
      sessionFrequencyTrend: [],
      difficultyProgressTrend: [],
      competencyGrowthTrend: [],
    };
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
      const sessionResults = await this.analyticsRepository.getCompletedSessions(sessionFilters);
      const sessions = sessionResults.items; // Fix: extract items array from result object

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
    // Add null safety checks
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    try {
      // Filter sessions with valid startTime and sort by date
      const validSessions = sessions.filter(s => s?.startTime && typeof s.startTime === 'string');
      
      if (validSessions.length === 0) {
        return { currentStreak: 0, longestStreak: 0 };
      }
      
      const sortedSessions = validSessions.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      // Get unique study days with null safety
      const studyDates = [
        ...new Set(sortedSessions.map(s => {
          try {
            return new Date(s.startTime).toDateString();
          } catch {
            return null;
          }
        }).filter(date => date !== null)),
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
        try {
          const prevDate = new Date(studyDates[i - 1]);
          const currDate = new Date(studyDates[i]);
          const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

          if (dayDiff === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        } catch (error) {
          // Skip invalid dates
          continue;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      return { currentStreak, longestStreak };
    } catch (error) {
      // Return safe defaults if calculation fails
      return { currentStreak: 0, longestStreak: 0 };
    }
  }

  private calculateImprovementVelocity(sessions: any[]): number {
    // Add null safety checks
    if (!Array.isArray(sessions) || sessions.length < 2) return 0;

    try {
      // Filter sessions with valid data and sort by date
      const validSessions = sessions.filter(s => 
        s?.startTime && 
        typeof s.startTime === 'string' && 
        typeof s.accuracy === 'number'
      );

      if (validSessions.length < 2) return 0;

      const sortedSessions = validSessions.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      const firstWeekSessions = sortedSessions.slice(0, Math.min(5, sortedSessions.length / 2));
      const lastWeekSessions = sortedSessions.slice(-Math.min(5, sortedSessions.length / 2));

      if (firstWeekSessions.length === 0 || lastWeekSessions.length === 0) return 0;

      // Safe calculation of accuracy with null checks
      const firstWeekAccuracy = firstWeekSessions.reduce((sum, s) => {
        const accuracy = typeof s?.accuracy === 'number' ? s.accuracy : 0;
        return sum + accuracy;
      }, 0) / firstWeekSessions.length;
      
      const lastWeekAccuracy = lastWeekSessions.reduce((sum, s) => {
        const accuracy = typeof s?.accuracy === 'number' ? s.accuracy : 0;
        return sum + accuracy;
      }, 0) / lastWeekSessions.length;

      // Safe time calculation
      const firstSessionTime = firstWeekSessions[0]?.startTime;
      const lastSessionTime = lastWeekSessions[0]?.startTime;
      
      if (!firstSessionTime || !lastSessionTime) return 0;

      const timeDiff = (new Date(lastSessionTime).getTime() - new Date(firstSessionTime).getTime()) / (1000 * 60 * 60 * 24 * 7);

      return timeDiff > 0 ? (lastWeekAccuracy - firstWeekAccuracy) / timeDiff : 0;
    } catch (error) {
      // Return safe default if calculation fails
      return 0;
    }
  }

  private calculateOverallProgress(progressData: any[], accuracy: number): number {
    // Add null safety checks
    const safeAccuracy = typeof accuracy === 'number' && !isNaN(accuracy) ? accuracy : 0;
    const safeProgressData = Array.isArray(progressData) ? progressData : [];
    
    // Combine accuracy, consistency, and topic coverage for overall progress
    const accuracyScore = Math.min(Math.max(safeAccuracy, 0), 100);
    const topicCoverage = safeProgressData.length > 0 ? Math.min(safeProgressData.length * 10, 100) : 0;

    // Weight accuracy more heavily
    const overallProgress = (accuracyScore * 0.7 + topicCoverage * 0.3);
    return Math.round(overallProgress * 100) / 100;
  }

  private async calculateDifficultyProgressTrend(
    timeframe: string,
    userId?: string
  ): Promise<DifficultyTrendData[]> {
    // Simplified implementation - would need actual question difficulty data
    const sessionResults = await this.analyticsRepository.getCompletedSessions({
      ...(userId && { userId }),
    });
    const sessions = sessionResults.items; // Fix: extract items array from result object
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
    const progressResults = await this.analyticsRepository.getUserProgressData(userId);
    const progressData = progressResults.items; // Fix: extract items array from result object

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
