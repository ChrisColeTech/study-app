import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

// Base Handler Types
export type PublicHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
export type AuthenticatedHandler = (event: APIGatewayProxyEvent, userId: string) => Promise<APIGatewayProxyResult>;
export type AuthorizerHandler = (event: APIGatewayTokenAuthorizerEvent) => Promise<APIGatewayAuthorizerResult>;

// Common API Response Structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
  version: string;
}

// Error Types
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMITED = 'RATE_LIMITED'
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// User Context
export interface UserContext {
  userId: string;
  email: string;
  role?: string;
  permissions?: string[];
}

// JWT Token Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role?: string;
  iat: number;
  exp: number;
}

// Database Entities
export interface User {
  userId: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

// Auth-related types
export interface UserRegistrationRequest {
  email: string;
  password: string;
  name?: string;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// Enhanced Session Types for comprehensive session management
export interface StudySession {
  sessionId: string;
  userId: string;
  provider: string;
  exam: string;
  status: 'active' | 'completed' | 'paused' | 'expired';
  startTime: string;
  endTime?: string;
  
  // Question Management
  totalQuestions: number;
  questionsAnswered: number;
  correctAnswers: number;
  currentQuestionIndex: number;
  selectedQuestionIds: string[]; // Pre-selected questions for the session
  
  // Session Configuration
  sessionConfig: SessionConfiguration;
  
  // Progress Tracking
  progress: SessionProgress;
  
  // Performance Analytics
  analytics: SessionAnalytics;
  
  // Timestamps and TTL
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  expiresAt: number; // DynamoDB TTL (Unix timestamp)
}

// Session configuration options
export interface SessionConfiguration {
  questionCount: number;
  timeLimit?: number; // in minutes, optional
  difficulty?: 'easy' | 'medium' | 'hard';
  topics?: string[];
  serviceCategories?: string[];
  awsServices?: string[];
  questionTypes?: ('single_choice' | 'multiple_choice')[];
  shuffleQuestions: boolean;
  immediateResultsFeedback: boolean;
  allowReview: boolean;
}

// Detailed progress tracking
export interface SessionProgress {
  percentage: number; // 0-100
  questionsCorrect: number;
  questionsIncorrect: number;
  questionsSkipped: number;
  averageTimePerQuestion: number; // in seconds
  timeSpent: number; // total time spent in seconds
  streakCurrent: number;
  streakBest: number;
}

// Session performance analytics
export interface SessionAnalytics {
  difficultyBreakdown: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
  topicPerformance: { [topic: string]: { correct: number; total: number } };
  servicePerformance: { [service: string]: { correct: number; total: number } };
  questionTypePerformance: {
    single_choice: { correct: number; total: number };
    multiple_choice: { correct: number; total: number };
  };
  timeAnalytics: {
    fastestAnswer: number; // in seconds
    slowestAnswer: number; // in seconds
    averageAnswerTime: number; // in seconds
  };
}

// Answer submission for a question in a session
export interface SessionAnswer {
  questionId: string;
  questionIndex: number;
  userAnswer: string | string[];
  isCorrect: boolean;
  timeSpent: number; // in seconds
  submittedAt: string;
  explanation?: string;
}

// Session state for current question delivery
export interface SessionState {
  sessionId: string;
  currentQuestion: Question;
  questionIndex: number;
  progress: SessionProgress;
  timeRemaining?: number; // if timed session
  canGoBack: boolean;
  canSkip: boolean;
}

// Session results when completed
export interface SessionResults {
  sessionId: string;
  finalScore: number; // percentage
  questionsCorrect: number;
  questionsTotal: number;
  timeSpent: number; // in seconds
  performance: SessionAnalytics;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passed: boolean;
  recommendations: string[];
  completedAt: string;
}

export interface StudyGoal {
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  targetDate: string;
  status: 'active' | 'completed' | 'paused';
  progress: number; // 0-100
  metrics: {
    questionsTarget: number;
    questionsCompleted: number;
    accuracyTarget: number;
    currentAccuracy: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsEvent {
  userId: string;
  eventType: string;
  eventData: any;
  timestamp: string;
  sessionId?: string;
  provider?: string;
  exam?: string;
  expiresAt: number; // TTL
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  exams: Exam[];
}

export interface Exam {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  duration?: number;
  passingScore?: number;
}

export interface Question {
  questionId: string;
  questionNumber: number;
  provider: string;
  exam: string;
  text: string;
  options: string[][];
  questionType: 'single_choice' | 'multiple_choice';
  expectedAnswers: number;
  correctAnswer: string | string[];
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topics: string[];
  serviceCategory?: string;
  awsServices?: string[];
  keywords?: string[];
  createdAt: string;
  parsingConfidence?: number;
  hasExplanation?: boolean;
}

// Raw question data from S3 (matches study_data_final.json structure)
export interface RawQuestionData {
  question_number: number;
  question: {
    text: string;
    options: string[][];
    question_type: 'single_choice' | 'multiple_choice';
    expected_answers: number;
    topic: string;
    service_category?: string;
    aws_services?: string[];
  };
  answer?: {
    correct_answer: string;
    explanation?: string;
    keywords?: string[];
    parsing_confidence?: number;
    source?: string;
  };
  study_metadata?: {
    difficulty: 'easy' | 'medium' | 'hard';
    completeness: string;
    question_preview: string;
    has_explanation: boolean;
    confidence_level: string;
  };
}

// Session Request/Response Types
export interface CreateSessionRequest {
  provider: string;
  exam: string;
  config?: Partial<SessionConfiguration>;
}

export interface UpdateSessionRequest {
  config?: Partial<SessionConfiguration>;
  status?: 'paused' | 'active';
}

export interface SubmitAnswerRequest {
  questionId: string;
  answer: string | string[];
  timeSpent?: number; // in seconds
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctAnswer: string | string[];
  explanation?: string;
  nextQuestion?: Question;
  sessionProgress: SessionProgress;
  sessionCompleted: boolean;
}

export interface GetSessionResponse {
  session: StudySession;
  currentState?: SessionState;
}

export interface ListSessionsRequest {
  status?: 'active' | 'completed' | 'paused';
  provider?: string;
  exam?: string;
  limit?: number;
  lastEvaluatedKey?: string;
}

export interface CompleteSessionResponse {
  results: SessionResults;
  achievements?: Achievement[];
}

// Achievement system for gamification
export interface Achievement {
  id: string;
  name: string;
  description: string;
  type: 'accuracy' | 'speed' | 'streak' | 'completion' | 'improvement';
  criteria: any;
  earnedAt: string;
}

export interface CreateGoalRequest {
  title: string;
  description?: string;
  targetDate: string;
  questionsTarget: number;
  accuracyTarget: number;
}

// ============================================================================
// AI-POWERED STUDY FEATURES TYPES - Phase 5
// ============================================================================

// Enhanced Goal Types with AI Features
export interface EnhancedStudyGoal extends StudyGoal {
  aiOptimized: boolean;
  adaptiveSettings: {
    difficultyLevel: 'adaptive' | 'fixed';
    spacedRepetition: boolean;
    personalizedSchedule: boolean;
  };
  milestones: GoalMilestone[];
  studyPlan: StudyPlanReference;
  aiRecommendations: AIRecommendation[];
  learningPath: LearningPathNode[];
  achievements: GoalAchievement[];
  analyticsSnapshot: GoalAnalyticsSnapshot;
}

export interface GoalMilestone {
  milestoneId: string;
  title: string;
  description?: string;
  targetDate: string;
  completed: boolean;
  completedAt?: string;
  requirements: MilestoneRequirement[];
  rewards: string[];
  aiGenerated: boolean;
}

export interface MilestoneRequirement {
  type: 'accuracy' | 'questions' | 'time' | 'topics' | 'sessions';
  target: number;
  current: number;
  description: string;
}

export interface StudyPlanReference {
  planId: string;
  generatedAt: string;
  duration: number; // days
  adaptiveAdjustments: number;
  lastOptimized: string;
}

export interface AIRecommendation {
  id: string;
  type: 'study_schedule' | 'difficulty_adjustment' | 'topic_focus' | 'break_suggestion';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  actionItems: string[];
  validUntil: string;
  applied: boolean;
  appliedAt?: string;
  effectiveness?: number; // 0-100, measured after application
}

export interface LearningPathNode {
  nodeId: string;
  topic: string;
  estimatedTime: number; // minutes
  prerequisites: string[];
  completed: boolean;
  completedAt?: string;
  difficultyLevel: number; // 1-5
  adaptiveWeight: number; // Higher weight = more important
  nextReviewDate?: string; // For spaced repetition
}

export interface GoalAchievement {
  achievementId: string;
  name: string;
  description: string;
  earnedAt: string;
  category: 'progress' | 'consistency' | 'improvement' | 'mastery';
  points: number;
}

export interface GoalAnalyticsSnapshot {
  lastUpdated: string;
  currentAccuracy: number;
  weeklyProgress: number;
  studyVelocity: number; // questions per day
  difficultyTrend: 'increasing' | 'decreasing' | 'stable';
  topicMastery: { [topic: string]: number }; // 0-100 mastery score
  predictedCompletionDate: string;
  confidenceScore: number; // 0-100
}

// Spaced Repetition and Adaptive Learning Types
export interface SpacedRepetitionItem {
  itemId: string;
  userId: string;
  conceptId: string; // Could be questionId, topicId, or skill
  conceptType: 'question' | 'topic' | 'skill';
  
  // SM-2 Algorithm fields
  easinessFactor: number; // 1.3 - 2.5, default 2.5
  interval: number; // Days until next review
  repetition: number; // Number of successful reviews
  nextReviewDate: string;
  
  // Performance tracking
  totalAttempts: number;
  correctAttempts: number;
  lastAttemptDate: string;
  averageResponseTime: number; // milliseconds
  masteryLevel: 'learning' | 'reviewing' | 'mastered';
  
  // Difficulty adaptation
  currentDifficulty: number; // 0-100
  optimalDifficulty: number; // Target difficulty for user
  difficultyAdjustments: DifficultyAdjustment[];
  
  // Context and metadata
  provider?: string;
  exam?: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DifficultyAdjustment {
  adjustmentDate: string;
  previousDifficulty: number;
  newDifficulty: number;
  reason: string;
  performanceMetrics: {
    accuracy: number;
    responseTime: number;
    confidence: number;
  };
}

export interface LearningSessionPlan {
  planId: string;
  userId: string;
  sessionType: 'review' | 'learning' | 'mixed' | 'assessment';
  
  // Content selection
  selectedItems: SpacedRepetitionItem[];
  questionPool: Question[];
  targetDifficulty: number;
  adaptiveDifficultyEnabled: boolean;
  
  // Session parameters
  estimatedDuration: number; // minutes
  targetQuestions: number;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  
  // Spaced repetition settings
  reviewPriority: 'overdue' | 'due_today' | 'upcoming' | 'mixed';
  newContentRatio: number; // 0-1, percentage of new vs review content
  
  // AI optimization
  personalizedOrder: string[]; // Question IDs in optimized order
  difficultyProgression: number[]; // Difficulty progression through session
  breakSuggestions: number[]; // Suggested break points (question indices)
  
  createdAt: string;
  validUntil: string;
}

// AI Recommendation System Types
export interface AIStudyRecommendation extends RecommendationItem {
  confidence: number; // 0-100, confidence in recommendation
  personalizedData: {
    userPerformanceFactors: UserPerformanceFactors;
    adaptiveLearningInsights: AdaptiveLearningInsights;
    behavioralPatterns: BehavioralPatterns;
  };
  dynamicAdjustments: DynamicAdjustment[];
  successMetrics: SuccessMetric[];
  followUpActions: FollowUpAction[];
}

export interface UserPerformanceFactors {
  overallAccuracy: number;
  accuracyTrend: 'improving' | 'stable' | 'declining';
  strongTopics: string[];
  weakTopics: string[];
  averageStudyTime: number; // minutes per day
  studyConsistency: number; // 0-100
  difficultyPreference: 'easy' | 'medium' | 'hard' | 'adaptive';
  learningVelocity: number; // questions mastered per week
}

export interface AdaptiveLearningInsights {
  spacedRepetitionEffectiveness: number; // 0-100
  optimalReviewInterval: number; // hours
  difficultyAdaptationSuccess: number; // 0-100
  masteredConcepts: number;
  strugglingConcepts: number;
  overdueReviews: number;
  predictedPerformanceGain: number; // Expected improvement with recommendation
}

export interface BehavioralPatterns {
  preferredStudyTimes: string[]; // e.g., ['morning', 'evening']
  averageSessionLength: number; // minutes
  studyFrequency: number; // sessions per week
  breakPreferences: BreakPreference;
  motivationFactors: MotivationFactor[];
  procrastinationRisk: 'low' | 'medium' | 'high';
  studyConsistency: number; // 0-100, consistency score
}

export interface BreakPreference {
  frequency: number; // minutes between breaks
  duration: number; // break duration in minutes
  type: 'short' | 'medium' | 'long';
}

export interface MotivationFactor {
  factor: 'achievements' | 'progress' | 'competition' | 'learning' | 'goals';
  weight: number; // 0-1, importance to user
  effectiveness: number; // 0-100, how well it works for user
}

export interface DynamicAdjustment {
  parameter: string;
  originalValue: any;
  adjustedValue: any;
  reason: string;
  expectedImpact: number; // 0-100
}

export interface SuccessMetric {
  metric: string;
  currentValue: number;
  targetValue: number;
  timeframe: string; // e.g., '1 week', '1 month'
  probability: number; // 0-100, probability of achieving target
}

export interface FollowUpAction {
  action: string;
  timing: string; // when to perform action
  condition: string; // condition that triggers action
  priority: 'high' | 'medium' | 'low';
}

// Enhanced Study Plan Types
export interface AIStudyPlan extends StudyPlan {
  aiOptimizations: {
    personalizedScheduling: boolean;
    adaptiveDifficulty: boolean;
    spacedRepetitionIntegration: boolean;
    behaviorBasedAdjustments: boolean;
  };
  performancePredictions: {
    expectedAccuracyImprovement: number;
    estimatedCompletionDate: string;
    confidenceLevel: number;
  };
  contingencyPlans: ContingencyPlan[];
  motivationalElements: MotivationalElement[];
}

export interface ContingencyPlan {
  trigger: string; // What triggers this plan
  adjustments: string[]; // What adjustments to make
  timeline: string; // How long to try adjustments
}

export interface MotivationalElement {
  type: 'achievement' | 'progress_visualization' | 'competition' | 'reward';
  description: string;
  triggerConditions: string[];
  impact: 'high' | 'medium' | 'low';
}

// Performance Prediction and Analytics
export interface PerformancePrediction {
  userId: string;
  conceptId: string;
  
  // Predictions
  predictedAccuracy: number; // 0-100
  predictedResponseTime: number; // milliseconds
  confidenceScore: number; // 0-100, confidence in predictions
  
  // Model factors
  factors: {
    historicalPerformance: number; // Weight: 40%
    timeSinceLastPractice: number; // Weight: 20%
    conceptDifficulty: number; // Weight: 15%
    userSkillLevel: number; // Weight: 15%
    contextualFactors: number; // Weight: 10%
  };
  
  // Recommendations
  recommendedAction: 'practice' | 'review' | 'skip' | 'intensive_study';
  optimalTimingHours: number; // Optimal time until next practice
  
  calculatedAt: string;
}

// Recommendation Feedback System
export interface RecommendationFeedback {
  recommendationId: string;
  userId: string;
  feedbackType: 'helpful' | 'not_helpful' | 'partially_helpful' | 'irrelevant';
  effectiveness: number; // 0-100, how effective was the recommendation
  appliedSuggestions: string[];
  ignoredSuggestions: string[];
  userComments?: string;
  performanceChange: {
    beforeAccuracy: number;
    afterAccuracy: number;
    beforeStudyTime: number;
    afterStudyTime: number;
    timeframe: string;
  };
  submittedAt: string;
}

// Achievement System for Gamification
export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  type: 'accuracy' | 'speed' | 'streak' | 'completion' | 'improvement' | 'consistency';
  criteria: AchievementCriteria;
  points: number;
  badge?: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface AchievementCriteria {
  metric: string;
  threshold: number;
  timeframe?: string;
  conditions?: { [key: string]: any };
}

export interface UserAchievementProgress {
  userId: string;
  achievementId: string;
  currentProgress: number;
  targetProgress: number;
  progressPercentage: number;
  isCompleted: boolean;
  completedAt?: string;
  lastUpdated: string;
}

// Study Session Enhancement Types
export interface EnhancedStudySession extends StudySession {
  aiEnhancements: {
    adaptiveDifficultyEnabled: boolean;
    spacedRepetitionIntegrated: boolean;
    personalizedOrdering: boolean;
    realTimeAdjustments: boolean;
  };
  learningMetrics: {
    conceptsMastered: string[];
    conceptsReviewed: string[];
    difficultyAdjustments: DifficultyAdjustment[];
    optimalBreakPoints: number[];
    retentionPrediction: number; // 0-100
  };
  aiRecommendations: {
    nextSessionType: 'review' | 'learning' | 'mixed' | 'assessment';
    optimalTimingHours: number;
    suggestedTopics: string[];
    difficultyRecommendation: 'increase' | 'decrease' | 'maintain';
  };
}

// API Request/Response Types for AI Features
export interface GenerateRecommendationsRequest {
  includeStudyPlan?: boolean;
  planDuration?: number; // days
  focusAreas?: string[];
  urgency?: 'low' | 'medium' | 'high';
  timeAvailable?: number; // minutes per day
}

export interface GenerateRecommendationsResponse {
  recommendations: AIStudyRecommendation[];
  studyPlan?: AIStudyPlan;
  lastUpdated: string;
  metadata: {
    totalRecommendations: number;
    highPriorityCount: number;
    averageConfidence: number;
    planIncluded: boolean;
  };
}

export interface SessionRecommendationsRequest {
  availableTime: number; // minutes
  preferredDifficulty?: 'easy' | 'medium' | 'hard' | 'adaptive';
  focusTopics?: string[];
  sessionType?: 'review' | 'learning' | 'mixed' | 'assessment';
}

export interface SessionRecommendationsResponse {
  sessionPlan: LearningSessionPlan;
  recommendations: AIStudyRecommendation[];
  sessionInfo: {
    estimatedDuration: number;
    targetQuestions: number;
    sessionType: string;
    difficultyDistribution: { easy: number; medium: number; hard: number };
    breakSuggestions: number[];
    personalizedOrder: boolean;
  };
}

// Learning Analytics Enhancement
export interface LearningAnalytics extends UserProgressAnalytics {
  aiInsights: {
    learningEfficiency: number; // 0-100
    retentionRate: number; // 0-100
    optimalStudyPattern: string;
    predictedPerformance: PerformancePrediction[];
    recommendedAdjustments: string[];
  };
  adaptiveLearningStats: {
    spacedRepetitionItems: number;
    masteryProgression: { [concept: string]: number };
    difficultyAdaptationSuccess: number;
    overallLearningVelocity: number;
  };
}

export interface GetQuestionsRequest {
  provider: string;
  exam: string;
  limit?: number;
  offset?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  topics?: string[];
  serviceCategory?: string;
  awsServices?: string[];
  search?: string;
  hasExplanation?: boolean;
  questionType?: 'single_choice' | 'multiple_choice';
}

export interface QuestionFilter {
  difficulty?: 'easy' | 'medium' | 'hard';
  topics?: string[];
  serviceCategory?: string;
  awsServices?: string[];
  search?: string;
  hasExplanation?: boolean;
  questionType?: 'single_choice' | 'multiple_choice';
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface QuestionSearchResult {
  questions: Question[];
  totalCount: number;
  hasMore: boolean;
  filters: {
    availableTopics: string[];
    availableServiceCategories: string[];
    availableAwsServices: string[];
    difficultyDistribution: { [key: string]: number };
  };
}

// ============================================================================
// ANALYTICS TYPES - Phase 4: Analytics & Progress Tracking
// ============================================================================

// User Progress Analytics
export interface UserProgressAnalytics {
  userId: string;
  overallStats: OverallProgressStats;
  providerStats: ProviderProgressStats[];
  examStats: ExamProgressStats[];
  recentActivity: RecentActivityStats;
  achievements: Achievement[];
  calculatedAt: string;
}

export interface OverallProgressStats {
  totalSessions: number;
  completedSessions: number;
  totalQuestions: number;
  correctAnswers: number;
  overallAccuracy: number;
  totalStudyTime: number; // in seconds
  averageSessionScore: number;
  bestSessionScore: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  studyDaysCount: number;
}

export interface ProviderProgressStats {
  provider: string;
  totalSessions: number;
  completedSessions: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyTime: number;
  averageScore: number;
  bestScore: number;
  lastSessionDate?: string;
  exams: ExamProgressStats[];
}

export interface ExamProgressStats {
  provider: string;
  exam: string;
  totalSessions: number;
  completedSessions: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyTime: number;
  averageScore: number;
  bestScore: number;
  lastSessionDate?: string;
  readinessScore: number; // 0-100, calculated readiness for this exam
  topicMastery: TopicMasteryStats[];
}

export interface TopicMasteryStats {
  topic: string;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  confidenceScore: number; // 0-100
  lastPracticed?: string;
  improvementTrend: 'improving' | 'stable' | 'declining';
}

export interface RecentActivityStats {
  last7Days: DailyActivityStats[];
  last30Days: DailyActivityStats[];
  currentWeekStats: WeeklyActivityStats;
  currentMonthStats: MonthlyActivityStats;
}

export interface DailyActivityStats {
  date: string; // YYYY-MM-DD
  sessionsCount: number;
  questionsAnswered: number;
  correctAnswers: number;
  studyTimeMinutes: number;
  accuracy: number;
}

export interface WeeklyActivityStats {
  weekStartDate: string;
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  totalStudyTime: number;
  averageAccuracy: number;
  studyDays: number;
}

export interface MonthlyActivityStats {
  month: string; // YYYY-MM
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  totalStudyTime: number;
  averageAccuracy: number;
  studyDays: number;
}

// Performance Metrics and Trends
export interface PerformanceMetrics {
  userId: string;
  timeRange: 'week' | 'month' | 'quarter' | 'year' | 'all';
  trends: PerformanceTrends;
  comparisons: PerformanceComparisons;
  insights: PerformanceInsights;
  calculatedAt: string;
}

export interface PerformanceTrends {
  accuracyTrend: TrendData[];
  speedTrend: TrendData[];
  studyTimeTrend: TrendData[];
  sessionCompletionTrend: TrendData[];
  difficultyProgressionTrend: DifficultyTrendData[];
}

export interface TrendData {
  date: string;
  value: number;
  change?: number; // percentage change from previous period
}

export interface DifficultyTrendData {
  date: string;
  easy: { accuracy: number; count: number };
  medium: { accuracy: number; count: number };
  hard: { accuracy: number; count: number };
}

export interface PerformanceComparisons {
  vsLastPeriod: ComparisonData;
  vsPersonalBest: ComparisonData;
  vsAverageUser: ComparisonData; // if available
}

export interface ComparisonData {
  accuracy: { current: number; comparison: number; change: number };
  speed: { current: number; comparison: number; change: number };
  studyTime: { current: number; comparison: number; change: number };
  completion: { current: number; comparison: number; change: number };
}

export interface PerformanceInsights {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  milestoneProgress: MilestoneProgress[];
}

export interface MilestoneProgress {
  milestone: string;
  description: string;
  progress: number; // 0-100
  target: number;
  current: number;
  estimatedCompletion?: string;
}

// Session Analytics and History
export interface SessionAnalyticsData {
  userId: string;
  sessions: SessionSummary[];
  aggregatedStats: SessionAggregatedStats;
  patterns: SessionPatterns;
  calculatedAt: string;
}

export interface SessionSummary {
  sessionId: string;
  provider: string;
  exam: string;
  startTime: string;
  endTime?: string;
  duration: number; // in seconds
  status: 'active' | 'completed' | 'paused' | 'expired';
  score: number;
  questionsTotal: number;
  questionsCorrect: number;
  accuracy: number;
  averageTimePerQuestion: number;
  difficultyBreakdown: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
}

export interface SessionAggregatedStats {
  totalSessions: number;
  completedSessions: number;
  averageScore: number;
  averageDuration: number;
  averageAccuracy: number;
  bestPerformance: SessionSummary;
  recentPerformance: SessionSummary[];
}

export interface SessionPatterns {
  preferredStudyTimes: TimeOfDayPattern[];
  sessionLengthDistribution: SessionLengthPattern;
  accuracyByTimeOfDay: TimeOfDayAccuracy[];
  studyStreak: StreakData;
}

export interface TimeOfDayPattern {
  hour: number;
  sessionCount: number;
  averageAccuracy: number;
}

export interface SessionLengthPattern {
  short: number; // < 15 minutes
  medium: number; // 15-60 minutes
  long: number; // > 60 minutes
}

export interface TimeOfDayAccuracy {
  timeRange: string; // e.g., "09:00-12:00"
  averageAccuracy: number;
  sessionCount: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streakDates: string[];
}

// Cross-Provider Comparison Analytics
export interface CrossProviderAnalytics {
  userId: string;
  providerComparisons: ProviderComparison[];
  skillTransferability: SkillTransferAnalysis[];
  recommendations: CrossProviderRecommendations;
  calculatedAt: string;
}

export interface ProviderComparison {
  provider: string;
  totalQuestions: number;
  accuracy: number;
  averageScore: number;
  studyTime: number;
  completionRate: number;
  strengthAreas: string[];
  weaknessAreas: string[];
  relativePerformance: number; // compared to user's average across all providers
}

export interface SkillTransferAnalysis {
  sharedTopic: string;
  providers: string[];
  consistencyScore: number; // 0-100, how consistent performance is across providers
  averageAccuracy: number;
  recommendations: string[];
}

export interface CrossProviderRecommendations {
  suggestedFocusProvider: string;
  reasonForSuggestion: string;
  skillGapAreas: string[];
  strengthLeverageOpportunities: string[];
}

// Predictive Analytics for Exam Readiness
export interface ExamReadinessAssessment {
  userId: string;
  provider: string;
  exam: string;
  readinessScore: number; // 0-100
  confidence: 'low' | 'medium' | 'high';
  prediction: ReadinessPrediction;
  factors: ReadinessFactors;
  timeline: ReadinessTimeline;
  calculatedAt: string;
}

export interface ReadinessPrediction {
  passLikelihood: number; // 0-100
  recommendedWaitTime: number; // days before attempting real exam
  minimumStudyHours: number;
  targetAccuracy: number;
}

export interface ReadinessFactors {
  currentAccuracy: { value: number; weight: number; impact: 'positive' | 'negative' | 'neutral' };
  topicCoverage: { value: number; weight: number; impact: 'positive' | 'negative' | 'neutral' };
  consistencyScore: { value: number; weight: number; impact: 'positive' | 'negative' | 'neutral' };
  recentPerformance: { value: number; weight: number; impact: 'positive' | 'negative' | 'neutral' };
  studyVolume: { value: number; weight: number; impact: 'positive' | 'negative' | 'neutral' };
  timeSpent: { value: number; weight: number; impact: 'positive' | 'negative' | 'neutral' };
}

export interface ReadinessTimeline {
  currentLevel: ReadinessLevel;
  milestones: ReadinessMilestone[];
  projectedReadyDate: string;
}

export interface ReadinessLevel {
  level: 'beginner' | 'intermediate' | 'advanced' | 'ready';
  description: string;
  requirements: string[];
}

export interface ReadinessMilestone {
  milestone: string;
  description: string;
  targetDate: string;
  completed: boolean;
  requirements: string[];
}

// Study Recommendations System
export interface StudyRecommendations {
  userId: string;
  recommendations: RecommendationItem[];
  priorityActions: PriorityAction[];
  studyPlan: StudyPlan;
  calculatedAt: string;
}

export interface RecommendationItem {
  id: string;
  type: 'topic_focus' | 'difficulty_adjustment' | 'study_pattern' | 'exam_preparation' | 'skill_development';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  actionItems: string[];
  estimatedImpact: number; // 0-100
  estimatedTimeInvestment: number; // in hours
  applicableProviders: string[];
  applicableExams: string[];
}

export interface PriorityAction {
  action: string;
  description: string;
  timeframe: string;
  expectedOutcome: string;
}

export interface StudyPlan {
  planId: string;
  duration: number; // in days
  dailyTargets: DailyStudyTarget[];
  weeklyGoals: WeeklyStudyGoal[];
  milestones: StudyMilestone[];
}

export interface DailyStudyTarget {
  date: string;
  targetQuestions: number;
  targetAccuracy: number;
  recommendedTopics: string[];
  estimatedTime: number; // in minutes
}

export interface WeeklyStudyGoal {
  weekStartDate: string;
  focusAreas: string[];
  targetSessions: number;
  targetQuestions: number;
  targetAccuracy: number;
}

export interface StudyMilestone {
  milestone: string;
  targetDate: string;
  criteria: MilestoneCriteria;
  rewards: string[];
}

export interface MilestoneCriteria {
  minimumSessions: number;
  minimumAccuracy: number;
  requiredTopics: string[];
  requiredQuestions: number;
}

// Analytics API Request/Response Types
export interface GetProgressAnalyticsRequest {
  timeRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  includeProviders?: string[];
  includeExams?: string[];
}

export interface GetPerformanceMetricsRequest {
  timeRange: 'week' | 'month' | 'quarter' | 'year' | 'all';
  includeComparisons?: boolean;
  includeTrends?: boolean;
}

export interface GetSessionAnalyticsRequest {
  timeRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  provider?: string;
  exam?: string;
  status?: 'active' | 'completed' | 'paused';
  limit?: number;
  lastEvaluatedKey?: string;
}

export interface GetTopicAnalyticsRequest {
  provider?: string;
  exam?: string;
  topics?: string[];
  timeRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
}

export interface GetReadinessAssessmentRequest {
  provider: string;
  exam: string;
  includeTimeline?: boolean;
  includeDetailedFactors?: boolean;
}

export interface GetRecommendationsRequest {
  includeStudyPlan?: boolean;
  planDuration?: number; // in days
  focusAreas?: string[];
}

export interface GetComparisonAnalyticsRequest {
  providers?: string[];
  includeSkillTransfer?: boolean;
  includeRecommendations?: boolean;
}

// Analytics Storage Types for DynamoDB
export interface AnalyticsRecord {
  PK: string; // Partition Key: userId
  SK: string; // Sort Key: analyticsType#provider#exam#date
  userId: string;
  analyticsType: 'progress' | 'performance' | 'session' | 'topic' | 'readiness' | 'recommendation';
  provider?: string;
  exam?: string;
  data: any;
  calculatedAt: string;
  expiresAt: number; // TTL
}

export interface AnalyticsAggregation {
  PK: string; // Partition Key: userId#provider#exam
  SK: string; // Sort Key: aggregationType#date
  aggregationType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  date: string;
  data: {
    sessions: number;
    questions: number;
    correct: number;
    studyTime: number;
    averageAccuracy: number;
  };
  expiresAt: number; // TTL
}

// ============================================================================
// HEALTH & MONITORING TYPES - Phase 6: System Health & Monitoring
// ============================================================================

// System Health Types
export interface SystemHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: EnvironmentInfo;
  dependencies: DependencyHealth;
  performance: HealthPerformanceMetrics;
  dataQuality: DataQualityStatus;
  alerts: HealthAlert[];
  recommendations: string[];
}

export interface EnvironmentInfo {
  stage: string;
  version: string;
  region: string;
  functionName: string;
  memorySize: string;
  logLevel: string;
  uptime: number; // in seconds
  coldStart: boolean;
}

export interface DependencyHealth {
  dynamodb: DatabaseHealthStatus;
  s3: S3HealthStatus;
  external: ExternalServiceHealthStatus[];
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  tables: TableHealthStatus[];
  connectivity: {
    canConnect: boolean;
    responseTime: number; // in milliseconds
    lastChecked: string;
  };
  performance: {
    readLatency: number;
    writeLatency: number;
    throughputUtilization: number; // percentage
    errorRate: number; // percentage
  };
  capacity: {
    consumedReadCapacity: number;
    consumedWriteCapacity: number;
    provisionedReadCapacity: number;
    provisionedWriteCapacity: number;
    utilizationPercentage: number;
  };
}

export interface TableHealthStatus {
  tableName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  itemCount?: number;
  sizeBytes?: number;
  readCapacityUtilization: number;
  writeCapacityUtilization: number;
  gsiStatus?: GSIHealthStatus[];
  errors: string[];
}

export interface GSIHealthStatus {
  indexName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  readCapacityUtilization: number;
  writeCapacityUtilization: number;
}

export interface S3HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  buckets: S3BucketHealthStatus[];
  connectivity: {
    canConnect: boolean;
    responseTime: number;
    lastChecked: string;
  };
  performance: {
    uploadLatency: number;
    downloadLatency: number;
    errorRate: number;
  };
}

export interface S3BucketHealthStatus {
  bucketName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  accessible: boolean;
  objectCount?: number;
  sizeBytes?: number;
  errors: string[];
}

export interface ExternalServiceHealthStatus {
  serviceName: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  statusCode?: number;
  lastChecked: string;
  uptime: number; // percentage over last 24 hours
  errors: string[];
}

// Performance Monitoring Types for Health System
export interface HealthPerformanceMetrics {
  memory: MemoryMetrics;
  execution: ExecutionMetrics;
  throughput: ThroughputMetrics;
  errors: ErrorMetrics;
  trends: HealthPerformanceTrends;
}

export interface MemoryMetrics {
  current: number; // MB
  peak: number; // MB
  limit: number; // MB
  utilizationPercentage: number;
  gcFrequency: number; // garbage collections per minute
}

export interface ExecutionMetrics {
  coldStartFrequency: number; // percentage of executions
  averageExecutionTime: number; // milliseconds
  p95ExecutionTime: number; // milliseconds
  p99ExecutionTime: number; // milliseconds
  timeouts: number; // count over last hour
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  peakThroughput: number;
  averageResponseTime: number; // milliseconds
}

export interface ErrorMetrics {
  errorRate: number; // percentage over last hour
  errorCount: number; // count over last hour
  errorsByType: { [errorType: string]: number };
  criticalErrors: number;
  warnings: number;
}

export interface HealthPerformanceTrends {
  responseTimeTrend: 'improving' | 'stable' | 'degrading';
  errorRateTrend: 'improving' | 'stable' | 'degrading';
  throughputTrend: 'increasing' | 'stable' | 'decreasing';
  memoryUsageTrend: 'improving' | 'stable' | 'degrading';
}

// Data Quality Types
export interface DataQualityStatus {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  checks: DataQualityCheck[];
  lastAssessment: string;
  trends: DataQualityTrends;
}

export interface DataQualityCheck {
  checkName: string;
  table: string;
  status: 'passed' | 'warning' | 'failed';
  result: {
    expected: number | string;
    actual: number | string;
    threshold?: number;
  };
  lastChecked: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface DataQualityTrends {
  dataConsistency: 'improving' | 'stable' | 'degrading';
  dataCompleteness: 'improving' | 'stable' | 'degrading';
  dataAccuracy: 'improving' | 'stable' | 'degrading';
  dataDuplication: 'improving' | 'stable' | 'degrading';
}

// Health Alert Types
export interface HealthAlert {
  alertId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'performance' | 'availability' | 'data_quality' | 'security' | 'capacity';
  title: string;
  description: string;
  source: string; // service or component that generated the alert
  threshold?: {
    metric: string;
    value: number;
    comparison: 'greater_than' | 'less_than' | 'equals';
  };
  currentValue: number | string;
  impact: string;
  recommendations: string[];
  createdAt: string;
  resolvedAt?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  tags: string[];
}

export interface AlertThreshold {
  metric: string;
  warningThreshold: number;
  errorThreshold: number;
  criticalThreshold: number;
  comparison: 'greater_than' | 'less_than';
  enabled: boolean;
}

// Health History and Reporting Types
export interface HealthHistoryEntry {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  componentStatuses: { [component: string]: 'healthy' | 'degraded' | 'unhealthy' };
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: number;
  };
  alerts: number; // count of active alerts
  incidents: number; // count of active incidents
}

export interface HealthReport {
  reportId: string;
  generatedAt: string;
  timeRange: {
    start: string;
    end: string;
    duration: string; // e.g., '24h', '7d', '30d'
  };
  summary: {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    uptimePercentage: number;
    totalIncidents: number;
    resolvedIncidents: number;
    averageResponseTime: number;
    errorRate: number;
  };
  trends: {
    availabilityTrend: 'improving' | 'stable' | 'degrading';
    performanceTrend: 'improving' | 'stable' | 'degrading';
    errorTrend: 'improving' | 'stable' | 'degrading';
    dataQualityTrend: 'improving' | 'stable' | 'degrading';
  };
  topIssues: HealthAlert[];
  recommendations: SystemRecommendation[];
  history: HealthHistoryEntry[];
}

export interface SystemRecommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'performance' | 'reliability' | 'cost' | 'security';
  title: string;
  description: string;
  reasoning: string;
  actionItems: string[];
  estimatedImpact: {
    performance: number; // percentage improvement
    cost: number; // dollar savings or cost
    reliability: number; // uptime improvement percentage
  };
  effort: 'low' | 'medium' | 'high';
  timeline: string;
}

// Health Check Configuration Types
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // seconds between checks
  timeout: number; // seconds before timeout
  retries: number;
  dependencies: {
    dynamodb: {
      enabled: boolean;
      tables: string[];
      performanceChecks: boolean;
    };
    s3: {
      enabled: boolean;
      buckets: string[];
      performanceChecks: boolean;
    };
    external: {
      enabled: boolean;
      services: ExternalServiceConfig[];
    };
  };
  dataQuality: {
    enabled: boolean;
    checks: DataQualityCheckConfig[];
  };
  alerts: {
    enabled: boolean;
    thresholds: AlertThreshold[];
  };
}

export interface ExternalServiceConfig {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  headers?: { [key: string]: string };
  timeout: number;
  expectedStatusCode: number;
}

export interface DataQualityCheckConfig {
  name: string;
  table: string;
  checkType: 'count' | 'consistency' | 'completeness' | 'accuracy' | 'duplication';
  query: string; // DynamoDB query or expression
  expectedValue?: number | string;
  threshold?: number;
  critical: boolean;
}

// Health API Request/Response Types
export interface GetHealthRequest {
  includeDetails?: boolean;
  includeHistory?: boolean;
  components?: string[];
}

export interface GetHealthResponse {
  health: SystemHealthCheck;
  history?: HealthHistoryEntry[];
  uptime: {
    current: number; // percentage
    last24h: number;
    last7d: number;
    last30d: number;
  };
}

export interface GetHealthPerformanceMetricsRequest {
  timeRange?: 'hour' | 'day' | 'week' | 'month';
  metrics?: string[];
  includeHistorical?: boolean;
}

export interface GetHealthPerformanceMetricsResponse {
  current: HealthPerformanceMetrics;
  historical?: { [timestamp: string]: HealthPerformanceMetrics };
  trends: HealthPerformanceTrends;
}

export interface GetAlertsRequest {
  severity?: 'info' | 'warning' | 'error' | 'critical';
  category?: 'performance' | 'availability' | 'data_quality' | 'security' | 'capacity';
  status?: 'active' | 'resolved' | 'acknowledged';
  limit?: number;
}

export interface GetAlertsResponse {
  alerts: HealthAlert[];
  summary: {
    total: number;
    active: number;
    resolved: number;
    acknowledged: number;
    bySeverity: { [severity: string]: number };
    byCategory: { [category: string]: number };
  };
}

export interface GetHealthHistoryRequest {
  timeRange: 'hour' | 'day' | 'week' | 'month';
  resolution?: 'minute' | 'hour' | 'day';
  components?: string[];
}

export interface GetHealthHistoryResponse {
  entries: HealthHistoryEntry[];
  summary: {
    totalDataPoints: number;
    averageHealth: number; // 0-100 score
    incidents: number;
    majorOutages: number;
  };
}

export interface GenerateHealthReportRequest {
  timeRange: {
    start: string;
    end: string;
  };
  includeRecommendations?: boolean;
  format?: 'json' | 'summary';
}

export interface GenerateHealthReportResponse {
  report: HealthReport;
  downloadUrl?: string; // if format is not json
}