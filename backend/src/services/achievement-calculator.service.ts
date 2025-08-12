import { createLogger } from '../shared/logger';
import { IAchievementCalculator, IProfileRepository, Achievement, UserProfile, ProfileStatistics, StudyHeatmapData } from '../shared/types/profile.types';

export class AchievementCalculator implements IAchievementCalculator {
  private logger = createLogger({ service: 'AchievementCalculator' });
  private profileRepository: IProfileRepository;

  constructor(profileRepository: IProfileRepository) {
    this.profileRepository = profileRepository;
  }

  async calculateAchievements(userId: string, profile?: UserProfile): Promise<Achievement[]> {
    this.logger.info('Calculating achievements for user', { userId });
    
    try {
      // Get profile if not provided
      const userProfile = profile || await this.profileRepository.findByUserId(userId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      const statistics = userProfile.statistics;
      const existingAchievements = userProfile.achievements;
      const newAchievements: Achievement[] = [];

      // Check for new achievements based on current statistics
      const achievementChecks = [
        this.checkStreakAchievements(statistics, existingAchievements),
        this.checkVolumeAchievements(statistics, existingAchievements),
        this.checkAccuracyAchievements(statistics, existingAchievements),
        this.checkMilestoneAchievements(statistics, existingAchievements)
      ];

      for (const achievements of achievementChecks) {
        newAchievements.push(...achievements);
      }

      // Add new achievements to profile
      for (const achievement of newAchievements) {
        await this.profileRepository.addAchievement(userId, achievement);
      }

      this.logger.info('Achievement calculation completed', { 
        userId, 
        newAchievements: newAchievements.length 
      });

      return newAchievements;
    } catch (error) {
      this.logger.error('Failed to calculate achievements', error as Error, { userId });
      throw error;
    }
  }

  private checkStreakAchievements(statistics: ProfileStatistics, existing: Achievement[]): Achievement[] {
    const achievements: Achievement[] = [];
    const currentStreak = statistics.currentStreak || 0;
    
    const streakMilestones = [
      { days: 7, title: 'Week Warrior', rarity: 'common' as const },
      { days: 30, title: 'Monthly Master', rarity: 'uncommon' as const },
      { days: 100, title: 'Century Studier', rarity: 'rare' as const },
      { days: 365, title: 'Year Champion', rarity: 'epic' as const }
    ];

    for (const milestone of streakMilestones) {
      if (currentStreak >= milestone.days) {
        const existingAchievement = existing.find(a => 
          a.type === 'streak' && a.criteria.threshold === milestone.days
        );
        
        if (!existingAchievement) {
          achievements.push({
            achievementId: `streak_${milestone.days}`,
            type: 'streak',
            title: milestone.title,
            description: `Maintained a ${milestone.days}-day study streak`,
            earnedAt: new Date().toISOString(),
            criteria: {
              metric: 'currentStreak',
              threshold: milestone.days
            },
            rarity: milestone.rarity
          });
        }
      }
    }

    return achievements;
  }

  private checkVolumeAchievements(statistics: ProfileStatistics, existing: Achievement[]): Achievement[] {
    const achievements: Achievement[] = [];
    const totalQuestions = statistics.totalQuestionsAnswered || 0;
    
    const volumeMilestones = [
      { count: 100, title: 'Century Club', rarity: 'common' as const },
      { count: 500, title: 'Knowledge Seeker', rarity: 'uncommon' as const },
      { count: 1000, title: 'Question Master', rarity: 'rare' as const },
      { count: 5000, title: 'Study Legend', rarity: 'epic' as const }
    ];

    for (const milestone of volumeMilestones) {
      if (totalQuestions >= milestone.count) {
        const existingAchievement = existing.find(a => 
          a.type === 'volume' && a.criteria.threshold === milestone.count
        );
        
        if (!existingAchievement) {
          achievements.push({
            achievementId: `volume_${milestone.count}`,
            type: 'volume',
            title: milestone.title,
            description: `Answered ${milestone.count}+ questions`,
            earnedAt: new Date().toISOString(),
            criteria: {
              metric: 'totalQuestionsAnswered',
              threshold: milestone.count
            },
            rarity: milestone.rarity
          });
        }
      }
    }

    return achievements;
  }

  private checkAccuracyAchievements(statistics: ProfileStatistics, existing: Achievement[]): Achievement[] {
    const achievements: Achievement[] = [];
    const accuracy = statistics.overallAccuracy || 0;
    const minQuestions = 50; // Minimum questions needed for accuracy achievements
    
    if (statistics.totalQuestionsAnswered < minQuestions) {
      return achievements; // Not enough questions answered yet
    }
    
    const accuracyMilestones = [
      { accuracy: 80, title: 'Sharpshooter', rarity: 'uncommon' as const },
      { accuracy: 90, title: 'Expert Marksman', rarity: 'rare' as const },
      { accuracy: 95, title: 'Precision Master', rarity: 'epic' as const },
      { accuracy: 99, title: 'Perfection Seeker', rarity: 'legendary' as const }
    ];

    for (const milestone of accuracyMilestones) {
      if (accuracy >= milestone.accuracy) {
        const existingAchievement = existing.find(a => 
          a.type === 'accuracy' && a.criteria.threshold === milestone.accuracy
        );
        
        if (!existingAchievement) {
          achievements.push({
            achievementId: `accuracy_${milestone.accuracy}`,
            type: 'accuracy',
            title: milestone.title,
            description: `Achieved ${milestone.accuracy}% overall accuracy`,
            earnedAt: new Date().toISOString(),
            criteria: {
              metric: 'overallAccuracy',
              threshold: milestone.accuracy
            },
            rarity: milestone.rarity
          });
        }
      }
    }

    return achievements;
  }

  private checkMilestoneAchievements(statistics: ProfileStatistics, existing: Achievement[]): Achievement[] {
    const achievements: Achievement[] = [];
    const totalSessions = statistics.totalSessions || 0;
    
    const sessionMilestones = [
      { sessions: 10, title: 'Getting Started', rarity: 'common' as const },
      { sessions: 50, title: 'Dedicated Student', rarity: 'uncommon' as const },
      { sessions: 100, title: 'Study Veteran', rarity: 'rare' as const },
      { sessions: 500, title: 'Learning Machine', rarity: 'epic' as const }
    ];

    for (const milestone of sessionMilestones) {
      if (totalSessions >= milestone.sessions) {
        const existingAchievement = existing.find(a => 
          a.type === 'milestone' && a.criteria.threshold === milestone.sessions
        );
        
        if (!existingAchievement) {
          achievements.push({
            achievementId: `milestone_${milestone.sessions}`,
            type: 'milestone',
            title: milestone.title,
            description: `Completed ${milestone.sessions} study sessions`,
            earnedAt: new Date().toISOString(),
            criteria: {
              metric: 'totalSessions',
              threshold: milestone.sessions
            },
            rarity: milestone.rarity
          });
        }
      }
    }

    return achievements;
  }
}