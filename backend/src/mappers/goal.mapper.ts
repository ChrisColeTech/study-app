// Dedicated mapper for goal data transformations
// Standardized transformation patterns for goals-related data objects

import {
  Goal,
  GoalResponse,
  CreateGoalResponse,
  GetGoalsResponse,
  UpdateGoalResponse,
  DeleteGoalResponse,
  GoalStats,
  GoalType,
  GoalPriority
} from '../shared/types/goals.types';

/**
 * GoalMapper - Dedicated mapper for goal data transformations
 * 
 * Provides standardized transformation patterns for goal-related data objects
 * with consistent response formatting and metrics calculation.
 * 
 * @responsibilities
 * - Transform Goal objects to various response formats
 * - Calculate goal progress and completion metrics
 * - Format goal collections with pagination metadata
 */
export class GoalMapper {
  /**
   * Create GoalResponse from Goal object
   * 
   * @param goal - Goal domain object
   * @returns Formatted goal response
   */
  static toGoalResponse(goal: Goal): GoalResponse {
    return {
      goal,
    };
  }

  /**
   * Create CreateGoalResponse from Goal object
   * 
   * @param goal - Created goal object
   * @returns Create goal response
   */
  static toCreateGoalResponse(goal: Goal): CreateGoalResponse {
    return {
      goal,
    };
  }

  /**
   * Create GetGoalsResponse from goals array and metadata
   * 
   * @param goals - Array of goal objects
   * @param total - Total number of goals (before pagination)
   * @param limit - Pagination limit
   * @param offset - Pagination offset
   * @param filters - Applied filters
   * @returns Complete GetGoalsResponse with pagination
   */
  static toGetGoalsResponse(
    goals: Goal[],
    total: number,
    limit: number,
    offset: number,
    filters?: any
  ): GetGoalsResponse {
    return {
      goals,
      total,
      limit,
      offset,
      ...(filters && { filters }),
    };
  }

  /**
   * Create UpdateGoalResponse from updated Goal object
   * 
   * @param goal - Updated goal object
   * @returns Update goal response
   */
  static toUpdateGoalResponse(goal: Goal): UpdateGoalResponse {
    return {
      goal,
    };
  }

  /**
   * Create DeleteGoalResponse for successful deletion
   * 
   * @returns Standard delete success response
   */
  static toDeleteGoalResponse(): DeleteGoalResponse {
    return {
      success: true,
      message: 'Goal deleted successfully',
    };
  }

  /**
   * Calculate goal progress percentage
   * 
   * @param goal - Goal object with current and target values
   * @returns Progress percentage (0-100)
   */
  static calculateGoalProgress(goal: Goal): number {
    if (goal.targetValue <= 0) {
      return 0;
    }
    const progress = (goal.currentValue / goal.targetValue) * 100;
    return Math.min(Math.round(progress * 100) / 100, 100); // Cap at 100%
  }

  /**
   * Calculate goal statistics from goals array
   * 
   * @param goals - Array of user goals
   * @returns GoalStats with calculated metrics
   */
  static calculateGoalStats(goals: Goal[]): GoalStats {
    const totalGoals = goals.length;
    const activeGoals = goals.filter(g => g.status === 'active').length;
    const completedGoals = goals.filter(g => g.status === 'completed').length;

    // Calculate completion rate
    const completionRate = totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0;

    // Calculate average completion time (simplified)
    const averageCompletionTime = 30; // Default 30 days - would need actual calculation

    // Group goals by type
    const goalsByType: { [key in GoalType]: number } = {
      exam_preparation: goals.filter(g => g.type === 'exam_preparation').length,
      topic_mastery: goals.filter(g => g.type === 'topic_mastery').length,
      daily_practice: goals.filter(g => g.type === 'daily_practice').length,
      score_target: goals.filter(g => g.type === 'score_target').length,
      streak: goals.filter(g => g.type === 'streak').length,
    };

    // Group goals by priority
    const goalsByPriority: { [key in GoalPriority]: number } = {
      low: goals.filter(g => g.priority === 'low').length,
      medium: goals.filter(g => g.priority === 'medium').length,
      high: goals.filter(g => g.priority === 'high').length,
    };

    // Get goals with upcoming deadlines (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingDeadlines = goals.filter(g => 
      g.status === 'active' && 
      g.deadline && 
      new Date(g.deadline) <= nextWeek
    );

    // Get recently completed goals (last 30 days)
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const recentCompletions = goals.filter(g => 
      g.status === 'completed' && 
      g.completedAt && 
      new Date(g.completedAt) >= lastMonth
    );

    return {
      totalGoals,
      activeGoals,
      completedGoals,
      completionRate: Math.round(completionRate * 100) / 100,
      averageCompletionTime,
      goalsByType,
      goalsByPriority,
      upcomingDeadlines,
      recentCompletions,
    };
  }

  /**
   * Determine if goal is overdue
   * 
   * @param goal - Goal object with optional deadline
   * @returns True if goal is overdue
   */
  static isGoalOverdue(goal: Goal): boolean {
    return Boolean(
      goal.status === 'active' && 
      goal.deadline && 
      new Date(goal.deadline) < new Date()
    );
  }

  /**
   * Calculate days until goal deadline
   * 
   * @param goal - Goal object with optional deadline
   * @returns Days until deadline (negative if overdue)
   */
  static getDaysUntilDeadline(goal: Goal): number | null {
    if (!goal.deadline) {
      return null;
    }
    
    const deadline = new Date(goal.deadline);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}