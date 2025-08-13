// User profile service implementation - Phase 26

import {
  IProfileService,
  IProfileRepository,
  IAchievementCalculator,
  ProfileStatistics,
} from '../shared/types/profile.types';
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
} from '../shared/types/profile.types';
import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';

export class ProfileService extends BaseService implements IProfileService {
  private profileRepository: IProfileRepository;
  private achievementCalculator: IAchievementCalculator;

  constructor(
    profileRepository: IProfileRepository,
    achievementCalculator: IAchievementCalculator
  ) {
    super();
    this.profileRepository = profileRepository;
    this.achievementCalculator = achievementCalculator;
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
        achievementCount: profile.achievements.length,
      });

      return { profile };
    } catch (error) {
      this.logger.error('Failed to get user profile', error as Error, { userId });
      throw error;
    }
  }

  async updateProfile(
    userId: string,
    request: UpdateProfileRequest
  ): Promise<UpdateProfileResponse> {
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
        ...(request.language !== undefined && { language: request.language }),
      };

      // Handle study preferences merge
      if (request.studyPreferences) {
        updates.studyPreferences = {
          ...currentProfile.studyPreferences,
          ...request.studyPreferences,
          // Handle nested objects
          studyReminders: {
            ...currentProfile.studyPreferences.studyReminders,
            ...(request.studyPreferences.studyReminders || {}),
          },
          notifications: {
            ...currentProfile.studyPreferences.notifications,
            ...(request.studyPreferences.notifications || {}),
          },
          uiPreferences: {
            ...currentProfile.studyPreferences.uiPreferences,
            ...(request.studyPreferences.uiPreferences || {}),
          },
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
        message: 'Profile updated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to update user profile', error as Error, { userId });
      throw error;
    }
  }

  async deleteProfile(
    userId: string,
    request: DeleteProfileRequest
  ): Promise<DeleteProfileResponse> {
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
        message: 'Profile deleted successfully',
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
        recentAchievements: recentAchievements.length,
      });

      return {
        statistics,
        recentActivity: {
          ...(lastSessionDate && { lastSessionDate }),
          recentAchievements,
          weeklyProgress,
        },
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
        message: 'Avatar updated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to update avatar', error as Error, { userId });
      throw error;
    }
  }

  async calculateAchievements(userId: string): Promise<Achievement[]> {
    this.logger.info('Delegating achievement calculation', { userId });

    try {
      // Get profile first, then delegate to AchievementCalculator
      const profile = await this.profileRepository.findByUserId(userId);
      if (!profile) {
        throw new Error('User profile not found');
      }

      return await this.achievementCalculator.calculateAchievements(userId, profile);
    } catch (error) {
      this.logger.error('Failed to calculate achievements', error as Error, { userId });
      throw error;
    }
  }

  private calculateLastSessionDate(statistics: ProfileStatistics): string | undefined {
    if (!statistics.studyHeatmap || statistics.studyHeatmap.length === 0) {
      return undefined;
    }

    // Find the most recent date with activity
    const sortedDates = statistics.studyHeatmap
      .filter((day: StudyHeatmapData) => day.sessionCount > 0)
      .sort(
        (a: StudyHeatmapData, b: StudyHeatmapData) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );

    return sortedDates.length > 0 ? sortedDates[0].date : undefined;
  }

  private calculateWeeklyProgress(statistics: ProfileStatistics) {
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week

    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);

    // Calculate sessions for current and previous week
    const currentWeek =
      statistics.studyHeatmap
        ?.filter((day: StudyHeatmapData) => {
          const date = new Date(day.date);
          return date >= currentWeekStart && date < now;
        })
        .reduce((sum: number, day: StudyHeatmapData) => sum + day.sessionCount, 0) || 0;

    const previousWeek =
      statistics.studyHeatmap
        ?.filter((day: StudyHeatmapData) => {
          const date = new Date(day.date);
          return date >= lastWeekStart && date < currentWeekStart;
        })
        .reduce((sum: number, day: StudyHeatmapData) => sum + day.sessionCount, 0) || 0;

    const percentChange =
      previousWeek > 0
        ? ((currentWeek - previousWeek) / previousWeek) * 100
        : currentWeek > 0
          ? 100
          : 0;

    return {
      currentWeek,
      previousWeek,
      percentChange: Math.round(percentChange),
    };
  }
}
