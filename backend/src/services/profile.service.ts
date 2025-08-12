// User profile service implementation - Phase 26

import { IProfileService, IProfileRepository } from '../shared/types/profile.types';
import { 
  UserProfile,
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  DeleteProfileRequest, 
  DeleteProfileResponse,
  GetProfileStatisticsResponse,
  UpdateAvatarRequest,
  UpdateAvatarResponse,
  Achievement,
  StudyHeatmapData,
  MonthlyStatistics
} from '../shared/types/profile.types';
import { createLogger } from '../shared/logger';

export class ProfileService implements IProfileService {
  private logger = createLogger({ service: 'ProfileService' });
  private profileRepository: IProfileRepository;

  constructor(profileRepository: IProfileRepository) {
    this.profileRepository = profileRepository;
  }

  async getProfile(userId: string): Promise<GetProfileResponse> {
    this.logger.info('Getting user profile', { userId });
    
    try {
      const profile = await this.profileRepository.findByUserId(userId);
      
      if (!profile) {
        throw new Error('User profile not found');
      }

      // Ensure display name is set
      if (!profile.displayName && (profile.firstName || profile.lastName)) {
        profile.displayName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
      }

      this.logger.info('Profile retrieved successfully', { 
        userId, 
        hasAvatar: !!profile.avatarUrl,
        achievementCount: profile.achievements.length 
      });

      return { profile };
    } catch (error) {
      this.logger.error('Failed to get user profile', error as Error, { userId });
      throw error;
    }
  }

  async updateProfile(userId: string, request: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    this.logger.info('Updating user profile', { userId, fields: Object.keys(request) });
    
    try {
      // Get current profile to merge updates
      const currentProfile = await this.profileRepository.findByUserId(userId);
      if (!currentProfile) {
        throw new Error('User profile not found');
      }

      // Build update object
      const updates: Partial<UserProfile> = {
        ...(request.firstName !== undefined && { firstName: request.firstName }),
        ...(request.lastName !== undefined && { lastName: request.lastName }),
        ...(request.displayName !== undefined && { displayName: request.displayName }),
        ...(request.bio !== undefined && { bio: request.bio }),
        ...(request.timezone !== undefined && { timezone: request.timezone }),
        ...(request.language !== undefined && { language: request.language })
      };

      // Handle study preferences merge
      if (request.studyPreferences) {
        updates.studyPreferences = {
          ...currentProfile.studyPreferences,
          ...request.studyPreferences,
          // Handle nested objects
          studyReminders: {
            ...currentProfile.studyPreferences.studyReminders,
            ...(request.studyPreferences.studyReminders || {})
          },
          notifications: {
            ...currentProfile.studyPreferences.notifications,
            ...(request.studyPreferences.notifications || {})
          },
          uiPreferences: {
            ...currentProfile.studyPreferences.uiPreferences,
            ...(request.studyPreferences.uiPreferences || {})
          }
        };
      }

      // Auto-generate display name if not provided but first/last name changed
      if (!updates.displayName && (request.firstName || request.lastName)) {
        const firstName = request.firstName || currentProfile.firstName || '';
        const lastName = request.lastName || currentProfile.lastName || '';
        updates.displayName = `${firstName} ${lastName}`.trim();
      }

      const updatedProfile = await this.profileRepository.update(userId, updates);

      this.logger.info('Profile updated successfully', { userId });

      return {
        profile: updatedProfile,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update user profile', error as Error, { userId });
      throw error;
    }
  }

  async deleteProfile(userId: string, request: DeleteProfileRequest): Promise<DeleteProfileResponse> {
    this.logger.warn('Deleting user profile', { userId, hasReason: !!request.reason });
    
    try {
      // Get profile to verify email
      const profile = await this.profileRepository.findByUserId(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      // Verify email confirmation
      if (profile.email !== request.confirmEmail) {
        throw new Error('Email confirmation does not match profile email');
      }

      // Log deletion reason if provided
      if (request.reason) {
        this.logger.warn('Profile deletion reason', { userId, reason: request.reason });
      }

      await this.profileRepository.delete(userId);

      this.logger.warn('Profile deleted successfully', { userId });

      return {
        success: true,
        message: 'Profile deleted successfully'
      };
    } catch (error) {
      this.logger.error('Failed to delete user profile', error as Error, { userId });
      throw error;
    }
  }

  async getStatistics(userId: string): Promise<GetProfileStatisticsResponse> {
    this.logger.info('Getting profile statistics', { userId });
    
    try {
      const profile = await this.profileRepository.findByUserId(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      const statistics = profile.statistics;
      
      // Calculate recent activity
      const recentAchievements = profile.achievements
        .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
        .slice(0, 5);

      const lastSessionDate = this.calculateLastSessionDate(statistics);
      const weeklyProgress = this.calculateWeeklyProgress(statistics);

      this.logger.info('Statistics retrieved successfully', { 
        userId,
        totalSessions: statistics.totalSessions,
        recentAchievements: recentAchievements.length
      });

      return {
        statistics,
        recentActivity: {
          ...(lastSessionDate && { lastSessionDate }),
          recentAchievements,
          weeklyProgress
        }
      };
    } catch (error) {
      this.logger.error('Failed to get profile statistics', error as Error, { userId });
      throw error;
    }
  }

  async updateAvatar(userId: string, request: UpdateAvatarRequest): Promise<UpdateAvatarResponse> {
    this.logger.info('Updating user avatar', { userId, imageType: request.imageType });
    
    try {
      // In a real implementation, you would:
      // 1. Validate image data and type
      // 2. Upload to S3 with proper naming and permissions
      // 3. Generate and return the S3 URL
      
      // For now, we'll simulate the avatar upload
      const avatarUrl = `https://s3.amazonaws.com/study-app-v3-avatars/${userId}.${request.imageType}`;
      
      await this.profileRepository.update(userId, { avatarUrl });

      this.logger.info('Avatar updated successfully', { userId, avatarUrl });

      return {
        avatarUrl,
        message: 'Avatar updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update avatar', error as Error, { userId });
      throw error;
    }
  }

  async calculateAchievements(userId: string): Promise<Achievement[]> {
    this.logger.info('Calculating achievements for user', { userId });
    
    try {
      const profile = await this.profileRepository.findByUserId(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      const statistics = profile.statistics;
      const existingAchievements = profile.achievements;
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

  private calculateLastSessionDate(statistics: any): string | undefined {
    if (!statistics.studyHeatmap || statistics.studyHeatmap.length === 0) {
      return undefined;
    }

    // Find the most recent date with activity
    const sortedDates = statistics.studyHeatmap
      .filter((day: StudyHeatmapData) => day.sessionCount > 0)
      .sort((a: StudyHeatmapData, b: StudyHeatmapData) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

    return sortedDates.length > 0 ? sortedDates[0].date : undefined;
  }

  private calculateWeeklyProgress(statistics: any) {
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week

    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);

    // Calculate sessions for current and previous week
    const currentWeek = statistics.studyHeatmap?.filter((day: StudyHeatmapData) => {
      const date = new Date(day.date);
      return date >= currentWeekStart && date < now;
    }).reduce((sum: number, day: StudyHeatmapData) => sum + day.sessionCount, 0) || 0;

    const previousWeek = statistics.studyHeatmap?.filter((day: StudyHeatmapData) => {
      const date = new Date(day.date);
      return date >= lastWeekStart && date < currentWeekStart;
    }).reduce((sum: number, day: StudyHeatmapData) => sum + day.sessionCount, 0) || 0;

    const percentChange = previousWeek > 0 
      ? ((currentWeek - previousWeek) / previousWeek) * 100 
      : currentWeek > 0 ? 100 : 0;

    return {
      currentWeek,
      previousWeek,
      percentChange: Math.round(percentChange)
    };
  }

  private checkStreakAchievements(statistics: any, existing: Achievement[]): Achievement[] {
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

  private checkVolumeAchievements(statistics: any, existing: Achievement[]): Achievement[] {
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

  private checkAccuracyAchievements(statistics: any, existing: Achievement[]): Achievement[] {
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

  private checkMilestoneAchievements(statistics: any, existing: Achievement[]): Achievement[] {
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