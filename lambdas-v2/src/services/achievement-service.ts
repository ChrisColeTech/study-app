import { DynamoDBClient, QueryCommand, PutItemCommand, UpdateItemCommand, BatchWriteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { 
  StudySession,
  UserProgressAnalytics,
  AchievementDefinition,
  AchievementCriteria,
  UserAchievementProgress,
  Achievement,
  GoalAchievement
} from '../types';
import { AnalyticsService } from './analytics-service';
import { Logger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * User Achievement Status with detailed progress tracking
 */
export interface DetailedUserAchievement extends UserAchievementProgress {
  definition: AchievementDefinition;
  milestones: AchievementMilestone[];
  recentActivity: AchievementActivity[];
  nextTierInfo?: {
    nextTier: AchievementDefinition;
    progressToNext: number;
    estimatedTimeToNext?: string;
  };
}

export interface AchievementMilestone {
  milestoneId: string;
  threshold: number; // Progress threshold for this milestone
  description: string;
  reward: string;
  completed: boolean;
  completedAt?: string;
}

export interface AchievementActivity {
  activityId: string;
  activityType: 'progress' | 'milestone' | 'completion' | 'tier_unlock';
  description: string;
  progressChange: number;
  timestamp: string;
  sessionId?: string;
}

/**
 * Achievement Category for organization and display
 */
export interface AchievementCategory {
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  achievements: AchievementDefinition[];
  userProgress: { [achievementId: string]: UserAchievementProgress };
}

/**
 * Leaderboard and Social Features
 */
export interface LeaderboardEntry {
  userId: string;
  username?: string;
  totalPoints: number;
  totalAchievements: number;
  rank: number;
  recentAchievements: Achievement[];
  streak: {
    current: number;
    longest: number;
  };
}

export interface AchievementStats {
  userId: string;
  totalPoints: number;
  totalAchievements: number;
  categoryCounts: { [category: string]: number };
  rarityDistribution: { [rarity: string]: number };
  recentAchievements: Achievement[];
  currentStreaks: AchievementStreak[];
  upcomingAchievements: UserAchievementProgress[];
}

export interface AchievementStreak {
  streakType: 'daily_study' | 'accuracy' | 'completion' | 'improvement';
  currentCount: number;
  longestCount: number;
  lastActivityDate: string;
  nextMilestone: number;
}

/**
 * Achievement Service - Comprehensive gamification and achievement system
 */
export class AchievementService {
  private dynamoClient: DynamoDBClient;
  private analyticsService: AnalyticsService;
  private logger: Logger;
  private achievementsTableName: string;
  private userAchievementsTableName: string;
  private leaderboardTableName: string;

  // Built-in achievement definitions
  private builtInAchievements: AchievementDefinition[] = [];

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.analyticsService = new AnalyticsService();
    this.logger = new Logger('AchievementService');
    this.achievementsTableName = process.env.ACHIEVEMENTS_TABLE_NAME || 'StudyAchievements';
    this.userAchievementsTableName = process.env.USER_ACHIEVEMENTS_TABLE_NAME || 'UserAchievements';
    this.leaderboardTableName = process.env.LEADERBOARD_TABLE_NAME || 'AchievementLeaderboard';

    this.initializeBuiltInAchievements();
  }

  // ============================================================================
  // ACHIEVEMENT PROCESSING AND TRACKING
  // ============================================================================

  /**
   * Process user activity and check for new achievements
   */
  async processUserActivity(
    userId: string,
    activityType: 'session_complete' | 'goal_complete' | 'milestone_complete' | 'streak_update',
    activityData: {
      sessionId?: string;
      goalId?: string;
      milestoneId?: string;
      performance?: {
        accuracy: number;
        questionsAnswered: number;
        studyTime: number;
        streak: number;
      };
    }
  ): Promise<Achievement[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing user activity for achievements', { userId, activityType, activityData });

      // Get current user analytics for context
      const analytics = await this.analyticsService.getUserProgressAnalytics(userId);
      
      // Get current user achievements
      const currentAchievements = await this.getUserAchievements(userId);
      const currentAchievementIds = new Set(currentAchievements.map(a => a.id));

      // Check all achievement types for potential unlocks
      const newAchievements: Achievement[] = [];

      // Check accuracy-based achievements
      newAchievements.push(...await this.checkAccuracyAchievements(userId, analytics, currentAchievementIds, activityData));

      // Check streak-based achievements
      newAchievements.push(...await this.checkStreakAchievements(userId, analytics, currentAchievementIds, activityData));

      // Check completion-based achievements
      newAchievements.push(...await this.checkCompletionAchievements(userId, analytics, currentAchievementIds, activityData));

      // Check improvement-based achievements
      newAchievements.push(...await this.checkImprovementAchievements(userId, analytics, currentAchievementIds, activityData));

      // Check consistency-based achievements
      newAchievements.push(...await this.checkConsistencyAchievements(userId, analytics, currentAchievementIds, activityData));

      // Check speed-based achievements
      newAchievements.push(...await this.checkSpeedAchievements(userId, analytics, currentAchievementIds, activityData));

      // Award new achievements
      if (newAchievements.length > 0) {
        await this.awardAchievements(userId, newAchievements);
        await this.updateLeaderboard(userId);
      }

      this.logger.perf('processUserActivity', Date.now() - startTime, { 
        userId, 
        activityType,
        newAchievements: newAchievements.length 
      });

      return newAchievements;

    } catch (error) {
      this.logger.error('Failed to process user activity for achievements', { userId, activityType, error });
      throw error;
    }
  }

  /**
   * Get user's achievement statistics and progress
   */
  async getUserAchievementStats(userId: string): Promise<AchievementStats> {
    try {
      this.logger.info('Getting user achievement statistics', { userId });

      const [userAchievements, analytics] = await Promise.all([
        this.getUserAchievements(userId),
        this.analyticsService.getUserProgressAnalytics(userId)
      ]);

      const totalPoints = userAchievements.reduce((sum, a) => sum + (this.getAchievementPoints(a.id)), 0);
      const categoryCounts = this.calculateCategoryCounts(userAchievements);
      const rarityDistribution = await this.calculateRarityDistribution(userAchievements);

      // Get recent achievements (last 30 days)
      const recentAchievements = userAchievements.filter(a => 
        new Date(a.earnedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );

      // Calculate current streaks
      const currentStreaks = await this.calculateCurrentStreaks(userId, analytics);

      // Get upcoming achievements (achievements user is close to earning)
      const upcomingAchievements = await this.getUpcomingAchievements(userId, analytics);

      const stats: AchievementStats = {
        userId,
        totalPoints,
        totalAchievements: userAchievements.length,
        categoryCounts,
        rarityDistribution,
        recentAchievements,
        currentStreaks,
        upcomingAchievements
      };

      return stats;

    } catch (error) {
      this.logger.error('Failed to get user achievement stats', { userId, error });
      throw error;
    }
  }

  /**
   * Get achievement categories with user progress
   */
  async getAchievementCategories(userId: string): Promise<AchievementCategory[]> {
    try {
      this.logger.info('Getting achievement categories', { userId });

      const [allAchievements, userProgress] = await Promise.all([
        this.getAllAchievements(),
        this.getUserAchievementProgress(userId)
      ]);

      // Group achievements by category
      const categories = this.groupAchievementsByCategory(allAchievements, userProgress);

      return categories;

    } catch (error) {
      this.logger.error('Failed to get achievement categories', { userId, error });
      throw error;
    }
  }

  /**
   * Get achievement points by ID
   */
  private getAchievementPoints(achievementId: string): number {
    // Map achievement IDs to points
    const pointsMap: { [key: string]: number } = {
      // Accuracy achievements
      'accuracy_70': 50,
      'accuracy_80': 100,
      'accuracy_90': 200,
      'accuracy_95': 500,
      'perfect_session': 100,
      
      // Streak achievements
      'streak_3': 25,
      'streak_7': 75,
      'streak_14': 150,
      'streak_30': 300,
      'streak_100': 1000,
      'longest_streak_50': 750,
      
      // Completion achievements
      'sessions_10': 50,
      'sessions_50': 200,
      'sessions_100': 500,
      'sessions_250': 1000,
      'sessions_500': 2000,
      'questions_100': 100,
      'questions_500': 400,
      'questions_1000': 800,
      'questions_2500': 1500,
      'questions_5000': 2500,
      
      // Others
      'consistent_learner': 300,
      'speed_learner': 250,
      'first_excellent_session': 150
    };
    
    return pointsMap[achievementId] || 10; // Default 10 points
  }

  /**
   * Get leaderboard with rankings
   */
  async getLeaderboard(
    limit: number = 50,
    timeframe: 'all_time' | 'monthly' | 'weekly' = 'all_time'
  ): Promise<LeaderboardEntry[]> {
    try {
      this.logger.info('Getting achievement leaderboard', { limit, timeframe });

      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.leaderboardTableName,
        IndexName: 'TimeframeIndex',
        KeyConditionExpression: 'timeframe = :timeframe',
        ExpressionAttributeValues: marshall({
          ':timeframe': timeframe
        }),
        ScanIndexForward: false, // Descending order by points
        Limit: limit
      }));

      const leaderboardEntries = result.Items?.map(item => unmarshall(item) as LeaderboardEntry) || [];

      // Add rank information
      leaderboardEntries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return leaderboardEntries;

    } catch (error) {
      this.logger.error('Failed to get leaderboard', { limit, timeframe, error });
      throw error;
    }
  }

  // ============================================================================
  // ACHIEVEMENT CHECKING LOGIC
  // ============================================================================

  /**
   * Check accuracy-based achievements
   */
  private async checkAccuracyAchievements(
    userId: string,
    analytics: UserProgressAnalytics,
    currentAchievements: Set<string>,
    activityData: any
  ): Promise<Achievement[]> {
    const achievements: Achievement[] = [];
    const accuracy = analytics.overallStats.overallAccuracy;

    // High accuracy achievements
    const accuracyThresholds = [
      { threshold: 70, name: 'Accurate Learner', description: 'Achieve 70% overall accuracy' },
      { threshold: 80, name: 'Precision Master', description: 'Achieve 80% overall accuracy' },
      { threshold: 90, name: 'Excellence Achiever', description: 'Achieve 90% overall accuracy' },
      { threshold: 95, name: 'Perfection Seeker', description: 'Achieve 95% overall accuracy' }
    ];

    for (const threshold of accuracyThresholds) {
      const achievementId = `accuracy_${threshold.threshold}`;
      if (accuracy >= threshold.threshold && !currentAchievements.has(achievementId)) {
        achievements.push({
          id: achievementId,
          name: threshold.name,
          description: threshold.description,
          type: 'accuracy',
          criteria: { metric: 'accuracy', threshold: threshold.threshold },
          earnedAt: new Date().toISOString()
        });
      }
    }

    // Session-specific accuracy achievements
    if (activityData.performance && activityData.performance.accuracy >= 100) {
      const perfectSessionId = 'perfect_session';
      if (!currentAchievements.has(perfectSessionId)) {
        achievements.push({
          id: perfectSessionId,
          name: 'Perfect Score',
          description: 'Complete a session with 100% accuracy',
          type: 'accuracy',
          criteria: { metric: 'session_accuracy', threshold: 100 },
          earnedAt: new Date().toISOString()
        });
      }
    }

    return achievements;
  }

  /**
   * Check streak-based achievements
   */
  private async checkStreakAchievements(
    userId: string,
    analytics: UserProgressAnalytics,
    currentAchievements: Set<string>,
    activityData: any
  ): Promise<Achievement[]> {
    const achievements: Achievement[] = [];
    const currentStreak = analytics.overallStats.currentStreak;
    const longestStreak = analytics.overallStats.longestStreak;

    // Study streak achievements
    const streakThresholds = [
      { threshold: 3, name: 'Streak Starter', description: 'Study for 3 days in a row' },
      { threshold: 7, name: 'Week Warrior', description: 'Study for 7 days in a row' },
      { threshold: 14, name: 'Fortnight Fighter', description: 'Study for 14 days in a row' },
      { threshold: 30, name: 'Month Master', description: 'Study for 30 days in a row' },
      { threshold: 100, name: 'Century Achiever', description: 'Study for 100 days in a row' }
    ];

    for (const threshold of streakThresholds) {
      const achievementId = `streak_${threshold.threshold}`;
      if (currentStreak >= threshold.threshold && !currentAchievements.has(achievementId)) {
        achievements.push({
          id: achievementId,
          name: threshold.name,
          description: threshold.description,
          type: 'streak',
          criteria: { metric: 'study_streak', threshold: threshold.threshold },
          earnedAt: new Date().toISOString()
        });
      }
    }

    // Longest streak achievements
    if (longestStreak >= 50) {
      const longStreakId = 'longest_streak_50';
      if (!currentAchievements.has(longStreakId)) {
        achievements.push({
          id: longStreakId,
          name: 'Streak Legend',
          description: 'Achieve a 50+ day study streak',
          type: 'streak',
          criteria: { metric: 'longest_streak', threshold: 50 },
          earnedAt: new Date().toISOString()
        });
      }
    }

    return achievements;
  }

  /**
   * Check completion-based achievements
   */
  private async checkCompletionAchievements(
    userId: string,
    analytics: UserProgressAnalytics,
    currentAchievements: Set<string>,
    activityData: any
  ): Promise<Achievement[]> {
    const achievements: Achievement[] = [];
    const completedSessions = analytics.overallStats.completedSessions;
    const totalQuestions = analytics.overallStats.totalQuestions;

    // Session completion achievements
    const sessionThresholds = [
      { threshold: 10, name: 'Session Starter', description: 'Complete 10 study sessions' },
      { threshold: 50, name: 'Dedicated Learner', description: 'Complete 50 study sessions' },
      { threshold: 100, name: 'Century Club', description: 'Complete 100 study sessions' },
      { threshold: 250, name: 'Study Champion', description: 'Complete 250 study sessions' },
      { threshold: 500, name: 'Study Legend', description: 'Complete 500 study sessions' }
    ];

    for (const threshold of sessionThresholds) {
      const achievementId = `sessions_${threshold.threshold}`;
      if (completedSessions >= threshold.threshold && !currentAchievements.has(achievementId)) {
        achievements.push({
          id: achievementId,
          name: threshold.name,
          description: threshold.description,
          type: 'completion',
          criteria: { metric: 'sessions_completed', threshold: threshold.threshold },
          earnedAt: new Date().toISOString()
        });
      }
    }

    // Question completion achievements
    const questionThresholds = [
      { threshold: 100, name: 'Question Conqueror', description: 'Answer 100 questions correctly' },
      { threshold: 500, name: 'Knowledge Seeker', description: 'Answer 500 questions correctly' },
      { threshold: 1000, name: 'Thousand Club', description: 'Answer 1000 questions correctly' },
      { threshold: 2500, name: 'Master Learner', description: 'Answer 2500 questions correctly' },
      { threshold: 5000, name: 'Knowledge Titan', description: 'Answer 5000 questions correctly' }
    ];

    const correctAnswers = analytics.overallStats.correctAnswers;
    for (const threshold of questionThresholds) {
      const achievementId = `questions_${threshold.threshold}`;
      if (correctAnswers >= threshold.threshold && !currentAchievements.has(achievementId)) {
        achievements.push({
          id: achievementId,
          name: threshold.name,
          description: threshold.description,
          type: 'completion',
          criteria: { metric: 'questions_answered', threshold: threshold.threshold },
          earnedAt: new Date().toISOString()
        });
      }
    }

    return achievements;
  }

  /**
   * Check improvement-based achievements
   */
  private async checkImprovementAchievements(
    userId: string,
    analytics: UserProgressAnalytics,
    currentAchievements: Set<string>,
    activityData: any
  ): Promise<Achievement[]> {
    const achievements: Achievement[] = [];

    // This would require comparing current performance with historical performance
    // For now, implementing basic improvement detection

    const bestSessionScore = analytics.overallStats.bestSessionScore;
    if (bestSessionScore >= 95) {
      const improvementId = 'first_excellent_session';
      if (!currentAchievements.has(improvementId)) {
        achievements.push({
          id: improvementId,
          name: 'Excellence Unlocked',
          description: 'Achieve your first 95%+ session score',
          type: 'improvement',
          criteria: { metric: 'best_session_score', threshold: 95 },
          earnedAt: new Date().toISOString()
        });
      }
    }

    return achievements;
  }

  /**
   * Check consistency-based achievements
   */
  private async checkConsistencyAchievements(
    userId: string,
    analytics: UserProgressAnalytics,
    currentAchievements: Set<string>,
    activityData: any
  ): Promise<Achievement[]> {
    const achievements: Achievement[] = [];

    const studyDays = analytics.overallStats.studyDaysCount;
    const totalSessions = analytics.overallStats.totalSessions;

    // Regular study pattern achievements
    if (studyDays >= 30 && (totalSessions / studyDays) >= 1.5) {
      const consistencyId = 'consistent_learner';
      if (!currentAchievements.has(consistencyId)) {
        achievements.push({
          id: consistencyId,
          name: 'Consistent Learner',
          description: 'Maintain regular study habits for 30 days',
          type: 'completion',
          criteria: { metric: 'study_consistency', threshold: 30 },
          earnedAt: new Date().toISOString()
        });
      }
    }

    return achievements;
  }

  /**
   * Check speed-based achievements
   */
  private async checkSpeedAchievements(
    userId: string,
    analytics: UserProgressAnalytics,
    currentAchievements: Set<string>,
    activityData: any
  ): Promise<Achievement[]> {
    const achievements: Achievement[] = [];

    // Fast learner achievement (high volume in short time)
    const totalQuestions = analytics.overallStats.totalQuestions;
    const studyDays = analytics.overallStats.studyDaysCount;

    if (studyDays > 0 && (totalQuestions / studyDays) >= 50) {
      const speedId = 'speed_learner';
      if (!currentAchievements.has(speedId)) {
        achievements.push({
          id: speedId,
          name: 'Speed Learner',
          description: 'Average 50+ questions per day',
          type: 'speed',
          criteria: { metric: 'questions_per_day', threshold: 50 },
          earnedAt: new Date().toISOString()
        });
      }
    }

    return achievements;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Award achievements to user
   */
  private async awardAchievements(userId: string, achievements: Achievement[]): Promise<void> {
    try {
      const writeRequests = achievements.map(achievement => ({
        PutRequest: {
          Item: marshall({
            userId,
            achievementId: achievement.id,
            ...achievement,
            awardedAt: new Date().toISOString()
          }, { removeUndefinedValues: true })
        }
      }));

      // Batch write achievements
      await this.dynamoClient.send(new BatchWriteItemCommand({
        RequestItems: {
          [this.userAchievementsTableName]: writeRequests
        }
      }));

      this.logger.info('Awarded achievements to user', { userId, achievementCount: achievements.length });

    } catch (error) {
      this.logger.error('Failed to award achievements', { userId, achievements, error });
      throw error;
    }
  }

  /**
   * Get user's current achievements
   */
  private async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.userAchievementsTableName,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: marshall({
          ':userId': userId
        })
      }));

      return result.Items?.map(item => unmarshall(item) as Achievement) || [];

    } catch (error) {
      this.logger.error('Failed to get user achievements', { userId, error });
      return [];
    }
  }

  /**
   * Get user achievement progress for all achievements
   */
  private async getUserAchievementProgress(userId: string): Promise<{ [achievementId: string]: UserAchievementProgress }> {
    try {
      const achievements = await this.getUserAchievements(userId);
      const progress: { [achievementId: string]: UserAchievementProgress } = {};

      achievements.forEach(achievement => {
        progress[achievement.id] = {
          userId,
          achievementId: achievement.id,
          currentProgress: 100, // Already earned
          targetProgress: 100,
          progressPercentage: 100,
          isCompleted: true,
          completedAt: achievement.earnedAt,
          lastUpdated: achievement.earnedAt
        };
      });

      return progress;

    } catch (error) {
      this.logger.error('Failed to get user achievement progress', { userId, error });
      return {};
    }
  }

  /**
   * Get all available achievements
   */
  private async getAllAchievements(): Promise<AchievementDefinition[]> {
    // For now, return built-in achievements
    // In a full implementation, this would also query the database for custom achievements
    return this.builtInAchievements;
  }

  /**
   * Group achievements by category
   */
  private groupAchievementsByCategory(
    achievements: AchievementDefinition[],
    userProgress: { [achievementId: string]: UserAchievementProgress }
  ): AchievementCategory[] {
    const categories: { [categoryName: string]: AchievementCategory } = {};

    achievements.forEach(achievement => {
      const categoryName = this.getCategoryForAchievement(achievement.type);
      
      if (!categories[categoryName]) {
        categories[categoryName] = {
          categoryId: categoryName.toLowerCase().replace(/\s+/g, '_'),
          name: categoryName,
          description: this.getCategoryDescription(categoryName),
          icon: this.getCategoryIcon(categoryName),
          achievements: [],
          userProgress: {}
        };
      }

      categories[categoryName]!.achievements.push(achievement);
      if (userProgress[achievement.id]) {
        categories[categoryName]!.userProgress[achievement.id] = userProgress[achievement.id]!;
      }
    });

    return Object.values(categories);
  }

  /**
   * Calculate category counts for user achievements
   */
  private calculateCategoryCounts(achievements: Achievement[]): { [category: string]: number } {
    const counts: { [category: string]: number } = {};
    
    achievements.forEach(achievement => {
      const category = this.getCategoryForAchievement(achievement.type);
      counts[category] = (counts[category] || 0) + 1;
    });

    return counts;
  }

  /**
   * Calculate rarity distribution
   */
  private async calculateRarityDistribution(achievements: Achievement[]): Promise<{ [rarity: string]: number }> {
    const distribution: { [rarity: string]: number } = {};
    
    // For now, assigning rarities based on achievement type and criteria
    achievements.forEach(achievement => {
      const rarity = this.determineAchievementRarity(achievement);
      distribution[rarity] = (distribution[rarity] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Calculate current achievement streaks
   */
  private async calculateCurrentStreaks(userId: string, analytics: UserProgressAnalytics): Promise<AchievementStreak[]> {
    return [
      {
        streakType: 'daily_study',
        currentCount: analytics.overallStats.currentStreak,
        longestCount: analytics.overallStats.longestStreak,
        lastActivityDate: analytics.overallStats.lastActivityDate,
        nextMilestone: this.getNextStreakMilestone(analytics.overallStats.currentStreak)
      }
    ];
  }

  /**
   * Get upcoming achievements user is close to earning
   */
  private async getUpcomingAchievements(userId: string, analytics: UserProgressAnalytics): Promise<UserAchievementProgress[]> {
    const upcoming: UserAchievementProgress[] = [];

    // Example: Next accuracy milestone
    const currentAccuracy = analytics.overallStats.overallAccuracy;
    const nextAccuracyMilestone = this.getNextAccuracyMilestone(currentAccuracy);
    
    if (nextAccuracyMilestone) {
      upcoming.push({
        userId,
        achievementId: `accuracy_${nextAccuracyMilestone}`,
        currentProgress: currentAccuracy,
        targetProgress: nextAccuracyMilestone,
        progressPercentage: (currentAccuracy / nextAccuracyMilestone) * 100,
        isCompleted: false,
        lastUpdated: new Date().toISOString()
      });
    }

    return upcoming;
  }

  /**
   * Update leaderboard with user's current stats
   */
  private async updateLeaderboard(userId: string): Promise<void> {
    try {
      const stats = await this.getUserAchievementStats(userId);
      
      const leaderboardEntry: LeaderboardEntry = {
        userId,
        totalPoints: stats.totalPoints,
        totalAchievements: stats.totalAchievements,
        rank: 0, // Will be calculated when fetching leaderboard
        recentAchievements: stats.recentAchievements,
        streak: {
          current: stats.currentStreaks[0]?.currentCount || 0,
          longest: stats.currentStreaks[0]?.longestCount || 0
        }
      };

      await this.dynamoClient.send(new PutItemCommand({
        TableName: this.leaderboardTableName,
        Item: marshall({
          ...leaderboardEntry,
          timeframe: 'all_time',
          lastUpdated: new Date().toISOString()
        }, { removeUndefinedValues: true })
      }));

    } catch (error) {
      this.logger.error('Failed to update leaderboard', { userId, error });
      // Don't throw - leaderboard update failure shouldn't break achievement processing
    }
  }

  /**
   * Initialize built-in achievements
   */
  private initializeBuiltInAchievements(): void {
    // This would be loaded from a configuration file or database in a full implementation
    // For now, defining a few example achievements
    this.builtInAchievements = [
      {
        id: 'first_session',
        name: 'Getting Started',
        description: 'Complete your first study session',
        type: 'completion',
        criteria: { metric: 'sessions_completed', threshold: 1 },
        points: 10,
        rarity: 'common'
      },
      {
        id: 'accuracy_80',
        name: 'Precision Master',
        description: 'Achieve 80% overall accuracy',
        type: 'accuracy',
        criteria: { metric: 'accuracy', threshold: 80 },
        points: 100,
        rarity: 'uncommon'
      },
      {
        id: 'streak_7',
        name: 'Week Warrior',
        description: 'Study for 7 days in a row',
        type: 'streak',
        criteria: { metric: 'study_streak', threshold: 7 },
        points: 75,
        rarity: 'uncommon'
      }
    ];
  }

  // Utility methods for achievement categorization and rarity
  private getCategoryForAchievement(type: string): string {
    const categoryMap: { [key: string]: string } = {
      'accuracy': 'Precision',
      'speed': 'Speed',
      'streak': 'Consistency',
      'completion': 'Progress',
      'improvement': 'Growth',
      'consistency': 'Dedication'
    };
    return categoryMap[type] || 'General';
  }

  private getCategoryDescription(categoryName: string): string {
    const descriptions: { [key: string]: string } = {
      'Precision': 'Achievements for high accuracy and correct answers',
      'Speed': 'Achievements for fast learning and quick progress',
      'Consistency': 'Achievements for regular study habits and streaks',
      'Progress': 'Achievements for completing sessions and milestones',
      'Growth': 'Achievements for showing improvement over time',
      'Dedication': 'Achievements for long-term commitment to learning'
    };
    return descriptions[categoryName] || 'General achievements';
  }

  private getCategoryIcon(categoryName: string): string {
    const icons: { [key: string]: string } = {
      'Precision': '🎯',
      'Speed': '⚡',
      'Consistency': '🔥',
      'Progress': '📈',
      'Growth': '🌱',
      'Dedication': '💪'
    };
    return icons[categoryName] || '🏆';
  }

  private determineAchievementRarity(achievement: Achievement): string {
    // Simple rarity determination based on type and criteria
    if (achievement.type === 'accuracy' && achievement.criteria.threshold >= 95) return 'legendary';
    if (achievement.type === 'streak' && achievement.criteria.threshold >= 100) return 'epic';
    if (achievement.type === 'completion' && achievement.criteria.threshold >= 1000) return 'rare';
    if (achievement.criteria.threshold >= 50) return 'uncommon';
    return 'common';
  }

  private getNextStreakMilestone(currentStreak: number): number {
    const milestones = [3, 7, 14, 30, 50, 100];
    return milestones.find(m => m > currentStreak) || (Math.floor(currentStreak / 100) + 1) * 100;
  }

  private getNextAccuracyMilestone(currentAccuracy: number): number | null {
    const milestones = [70, 80, 85, 90, 95];
    return milestones.find(m => m > currentAccuracy) || null;
  }
}