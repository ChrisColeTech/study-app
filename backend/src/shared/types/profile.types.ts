// User profile management types - Phase 26

export interface UserProfile {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  timezone?: string;
  language: 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
  studyPreferences: StudyPreferences;
  statistics: ProfileStatistics;
  achievements: Achievement[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyPreferences {
  defaultSessionLength: number; // minutes
  questionsPerSession: number;
  difficulty: 'adaptive' | 'easy' | 'medium' | 'hard';
  studyReminders: {
    enabled: boolean;
    dailyTime?: string; // HH:MM format
    frequency: 'daily' | 'weekly' | 'custom';
    daysOfWeek?: number[]; // 0-6, Sunday=0
  };
  notifications: {
    goalMilestones: boolean;
    weeklyProgress: boolean;
    achievements: boolean;
    studyStreaks: boolean;
  };
  uiPreferences: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    showExplanations: boolean;
    autoAdvance: boolean;
  };
}

export interface ProfileStatistics {
  totalStudyTime: number; // minutes
  totalSessions: number;
  totalQuestionsAnswered: number;
  overallAccuracy: number; // percentage
  currentStreak: number; // days
  longestStreak: number; // days
  averageSessionLength: number; // minutes
  favoriteTopics: string[];
  weakestTopics: string[];
  studyHeatmap: StudyHeatmapData[];
  monthlyStats: MonthlyStatistics[];
}

export interface StudyHeatmapData {
  date: string; // YYYY-MM-DD
  sessionCount: number;
  minutesStudied: number;
  questionsAnswered: number;
}

export interface MonthlyStatistics {
  month: string; // YYYY-MM
  sessionsCompleted: number;
  totalMinutes: number;
  questionsAnswered: number;
  averageAccuracy: number;
  goalsAchieved: number;
}

export interface Achievement {
  achievementId: string;
  type: 'streak' | 'accuracy' | 'volume' | 'milestone' | 'special';
  title: string;
  description: string;
  iconUrl?: string;
  earnedAt: string;
  criteria: {
    metric: string;
    threshold: number;
    timeframe?: string;
  };
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// Request/Response types
export interface GetProfileResponse {
  profile: UserProfile;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  timezone?: string;
  language?: 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';
  studyPreferences?: Partial<StudyPreferences>;
}

export interface UpdateProfileResponse {
  profile: UserProfile;
  message: string;
}

export interface DeleteProfileRequest {
  confirmEmail: string;
  reason?: string;
}

export interface DeleteProfileResponse {
  success: boolean;
  message: string;
}

export interface GetProfileStatisticsResponse {
  statistics: ProfileStatistics;
  recentActivity: {
    lastSessionDate?: string;
    recentAchievements: Achievement[];
    weeklyProgress: {
      currentWeek: number;
      previousWeek: number;
      percentChange: number;
    };
  };
}

export interface UpdateAvatarRequest {
  imageData: string; // base64 encoded
  imageType: 'jpeg' | 'png' | 'gif';
}

export interface UpdateAvatarResponse {
  avatarUrl: string;
  message: string;
}

// Service interfaces
export interface IProfileService {
  getProfile(userId: string): Promise<GetProfileResponse>;
  updateProfile(userId: string, request: UpdateProfileRequest): Promise<UpdateProfileResponse>;
  deleteProfile(userId: string, request: DeleteProfileRequest): Promise<DeleteProfileResponse>;
  getStatistics(userId: string): Promise<GetProfileStatisticsResponse>;
  updateAvatar(userId: string, request: UpdateAvatarRequest): Promise<UpdateAvatarResponse>;
  calculateAchievements(userId: string): Promise<Achievement[]>;
}

export interface IProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  create(profile: UserProfile): Promise<UserProfile>;
  update(userId: string, updates: Partial<UserProfile>): Promise<UserProfile>;
  delete(userId: string): Promise<void>;
  updateStatistics(userId: string, stats: Partial<ProfileStatistics>): Promise<void>;
  addAchievement(userId: string, achievement: Achievement): Promise<void>;
}