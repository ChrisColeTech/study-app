import { createLogger } from '../shared/logger';
import type { IGoalsRepository } from '../repositories/goals.repository';
import type { 
  IGoalsProgressTracker,
  Goal,
  GoalStats,
  GoalType,
  GoalPriority
} from '../shared/types/goals.types';

/**
 * GoalsProgressTracker - Handles progress tracking and analytics for goals
 * 
 * Responsibilities:
 * - Goal statistics calculation
 * - Progress updates and milestone tracking
 * - Analytics and reporting
 * - Auto-completion logic
 */
export class GoalsProgressTracker implements IGoalsProgressTracker {
  private logger = createLogger({ component: 'GoalsProgressTracker' });

  constructor(
    private goalsRepository: IGoalsRepository
  ) {}

  /**
   * Get goal statistics for a user
   */
  async getGoalStats(userId: string): Promise<GoalStats> {
    this.logger.info('Retrieving goal statistics', { userId });

    try {
      // Get all user goals
      const allGoals = await this.goalsRepository.findByUserId(userId, { limit: 1000 });

      // Calculate statistics
      const totalGoals = allGoals.total;
      const activeGoals = allGoals.items.filter(g => g.status === 'active').length;
      const completedGoals = allGoals.items.filter(g => g.status === 'completed').length;
      const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

      // Calculate average completion time
      const completedGoalsWithTime = allGoals.items
        .filter(g => g.status === 'completed' && g.completedAt)
        .map(g => {
          const start = new Date(g.startDate).getTime();
          const end = new Date(g.completedAt!).getTime();
          return (end - start) / (1000 * 60 * 60 * 24); // days
        });

      const averageCompletionTime = completedGoalsWithTime.length > 0
        ? Math.round(completedGoalsWithTime.reduce((sum, days) => sum + days, 0) / completedGoalsWithTime.length)
        : 0;

      // Group by type and priority
      const goalsByType = allGoals.items.reduce((acc, goal) => {
        acc[goal.type] = (acc[goal.type] || 0) + 1;
        return acc;
      }, {} as { [key in GoalType]: number });

      const goalsByPriority = allGoals.items.reduce((acc, goal) => {
        acc[goal.priority] = (acc[goal.priority] || 0) + 1;
        return acc;
      }, {} as { [key in GoalPriority]: number });

      // Get upcoming deadlines (next 7 days)
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingDeadlines = allGoals.items
        .filter(g => g.status === 'active' && g.deadline)
        .filter(g => {
          const deadline = new Date(g.deadline!);
          return deadline >= now && deadline <= nextWeek;
        })
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
        .slice(0, 5);

      // Get recent completions (last 30 days)
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentCompletions = allGoals.items
        .filter(g => g.status === 'completed' && g.completedAt)
        .filter(g => new Date(g.completedAt!) >= lastMonth)
        .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
        .slice(0, 5);

      const stats: GoalStats = {
        totalGoals,
        activeGoals,
        completedGoals,
        completionRate,
        averageCompletionTime,
        goalsByType,
        goalsByPriority,
        upcomingDeadlines,
        recentCompletions
      };

      this.logger.info('Goal statistics retrieved successfully', { 
        userId,
        totalGoals,
        activeGoals,
        completedGoals,
        completionRate
      });

      return stats;

    } catch (error) {
      this.logger.error('Failed to retrieve goal statistics', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update goal progress (called by other services when progress is made)
   */
  async updateGoalProgress(goalId: string, progress: number): Promise<void> {
    this.logger.info('Updating goal progress', { goalId, progress });

    try {
      const goal = await this.goalsRepository.findById(goalId);
      if (!goal || goal.status !== 'active') {
        return; // Goal doesn't exist or isn't active
      }

      const newCurrentValue = Math.min(progress, goal.targetValue);
      const progressPercentage = Math.min(Math.round((newCurrentValue / goal.targetValue) * 100), 100);

      const updateData: Partial<Goal> = {
        currentValue: newCurrentValue,
        progressPercentage,
        updatedAt: new Date().toISOString()
      };

      // Auto-complete goal if target reached
      if (newCurrentValue >= goal.targetValue) {
        updateData.status = 'completed';
        updateData.completedAt = new Date().toISOString();
      }

      await this.goalsRepository.update(goalId, updateData);

      this.logger.info('Goal progress updated successfully', { 
        goalId,
        currentValue: newCurrentValue,
        progressPercentage,
        status: updateData.status
      });

    } catch (error) {
      this.logger.error('Failed to update goal progress', error as Error, { goalId, progress });
      // Don't throw error here - progress updates shouldn't break other flows
    }
  }
}

export type { IGoalsProgressTracker };