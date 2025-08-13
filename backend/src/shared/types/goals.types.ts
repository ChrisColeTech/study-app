// Goals management system types for Study App V3
// Phase 18: Goals Management System

// Core goal types
export type GoalType =
  | 'exam_preparation' // Goals for passing specific exams
  | 'topic_mastery' // Goals for mastering specific topics
  | 'daily_practice' // Daily study practice goals
  | 'score_target' // Target score achievement goals
  | 'streak'; // Study streak maintenance goals;

export type GoalTargetType =
  | 'exam' // Target a specific exam
  | 'topic' // Target a specific topic
  | 'questions' // Target number of questions
  | 'score' // Target score achievement
  | 'days'; // Target number of days

export type GoalPriority = 'low' | 'medium' | 'high';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type ReminderType = 'daily' | 'weekly' | 'deadline' | 'milestone';

// Core domain interfaces
export interface Goal {
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  type: GoalType;
  priority: GoalPriority;
  status: GoalStatus;

  // Target configuration
  targetType: GoalTargetType;
  targetValue: number;
  currentValue: number;

  // Optional target references
  examId?: string;
  topicId?: string;
  providerId?: string;

  // Dates
  deadline?: string;
  startDate: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Progress tracking
  progressPercentage: number;
  milestones: GoalMilestone[];

  // Settings
  reminders: GoalReminder[];
  isArchived: boolean;
}

export interface GoalMilestone {
  milestoneId: string;
  title: string;
  description?: string;
  targetValue: number;
  isCompleted: boolean;
  completedAt?: string;
  order: number;
}

export interface GoalReminder {
  reminderId: string;
  type: ReminderType;
  message: string;
  scheduledFor?: string; // For specific date reminders
  isActive: boolean;
  lastSent?: string;
}

// API Request/Response types
export interface CreateGoalRequest {
  title: string;
  description?: string;
  type: GoalType;
  priority: GoalPriority;
  targetType: GoalTargetType;
  targetValue: number;
  examId?: string;
  topicId?: string;
  providerId?: string;
  deadline?: string;
  milestones?: Omit<GoalMilestone, 'milestoneId' | 'isCompleted' | 'completedAt'>[];
  reminders?: Omit<GoalReminder, 'reminderId' | 'lastSent'>[];
}

export interface UpdateGoalRequest {
  title?: string;
  description?: string;
  priority?: GoalPriority;
  status?: GoalStatus;
  targetValue?: number;
  currentValue?: number;
  deadline?: string;
  milestones?: GoalMilestone[];
  reminders?: GoalReminder[];
  isArchived?: boolean;
}

export interface GetGoalsRequest {
  status?: GoalStatus[];
  type?: GoalType[];
  priority?: GoalPriority[];
  examId?: string;
  topicId?: string;
  providerId?: string;
  isArchived?: boolean;
  search?: string;
  sortBy?: 'created' | 'updated' | 'deadline' | 'priority' | 'progress';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface GoalResponse {
  goal: Goal;
}

export interface GetGoalsResponse {
  goals: Goal[];
  total: number;
  limit: number;
  offset: number;
  filters: GetGoalsRequest;
}

export interface CreateGoalResponse {
  goal: Goal;
}

export interface UpdateGoalResponse {
  goal: Goal;
}

export interface DeleteGoalResponse {
  success: boolean;
  message: string;
}

// Goal Statistics
export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  completionRate: number;
  averageCompletionTime: number; // days
  goalsByType: { [key in GoalType]: number };
  goalsByPriority: { [key in GoalPriority]: number };
  upcomingDeadlines: Goal[];
  recentCompletions: Goal[];
}

// Service interface
export interface IGoalsService {
  createGoal(userId: string, request: CreateGoalRequest): Promise<CreateGoalResponse>;
  getGoals(userId: string, request?: GetGoalsRequest): Promise<GetGoalsResponse>;
  getGoal(goalId: string, userId: string): Promise<GoalResponse>;
  updateGoal(
    goalId: string,
    userId: string,
    request: UpdateGoalRequest
  ): Promise<UpdateGoalResponse>;
  deleteGoal(goalId: string, userId: string): Promise<DeleteGoalResponse>;
  getGoalStats(userId: string): Promise<GoalStats>;
  updateGoalProgress(goalId: string, progress: number): Promise<void>;
}

/**
 * Interface for goals progress tracking and analytics service
 */
export interface IGoalsProgressTracker {
  getGoalStats(userId: string): Promise<GoalStats>;
  updateGoalProgress(goalId: string, progress: number): Promise<void>;
}
