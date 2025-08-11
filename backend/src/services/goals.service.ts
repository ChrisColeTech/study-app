// Goals Service for Study App V3 Backend
// Phase 18: Goals Management System

import { v4 as uuidv4 } from 'uuid';
import {
  Goal,
  GoalMilestone,
  GoalReminder,
  CreateGoalRequest,
  CreateGoalResponse,
  GetGoalsRequest,
  GetGoalsResponse,
  GoalResponse,
  UpdateGoalRequest,
  UpdateGoalResponse,
  DeleteGoalResponse,
  GoalStats,
  IGoalsService,
  GoalType,
  GoalStatus,
  GoalPriority
} from '../shared/types/goals.types';
import { IGoalsRepository } from '../repositories/goals.repository';
import { IProviderService } from './provider.service';
import { IExamService } from './exam.service';
import { ITopicService } from './topic.service';
import { createLogger } from '../shared/logger';

// Re-export the interface for ServiceFactory
export type { IGoalsService };

export class GoalsService implements IGoalsService {
  private logger = createLogger({ component: 'GoalsService' });

  constructor(
    private goalsRepository: IGoalsRepository,
    private providerService: IProviderService,
    private examService: IExamService,
    private topicService: ITopicService
  ) {}

  /**
   * Create a new goal for a user
   */
  async createGoal(userId: string, request: CreateGoalRequest): Promise<CreateGoalResponse> {
    this.logger.info('Creating new goal', { 
      userId, 
      type: request.type,
      targetType: request.targetType,
      title: request.title 
    });

    try {
      // Validate the request
      await this.validateGoalRequest(request);

      // Generate goal ID and timestamps
      const goalId = uuidv4();
      const now = new Date().toISOString();

      // Process milestones
      const milestones: GoalMilestone[] = (request.milestones || []).map((milestone, index) => ({
        milestoneId: uuidv4(),
        ...milestone,
        isCompleted: false,
        order: index
      }));

      // Process reminders
      const reminders: GoalReminder[] = (request.reminders || []).map(reminder => ({
        reminderId: uuidv4(),
        ...reminder
      }));

      // Create goal object
      const goal: Goal = {
        goalId,
        userId,
        title: request.title,
        ...(request.description && { description: request.description }),
        type: request.type,
        priority: request.priority,
        status: 'active',
        targetType: request.targetType,
        targetValue: request.targetValue,
        currentValue: 0,
        ...(request.examId && { examId: request.examId }),
        ...(request.topicId && { topicId: request.topicId }),
        ...(request.providerId && { providerId: request.providerId }),
        ...(request.deadline && { deadline: request.deadline }),
        startDate: now,
        createdAt: now,
        updatedAt: now,
        progressPercentage: 0,
        milestones,
        reminders,
        isArchived: false
      };

      // Store goal using repository
      const createdGoal = await this.goalsRepository.create(goal);

      this.logger.info('Goal created successfully', { 
        goalId: createdGoal.goalId,
        userId,
        type: createdGoal.type,
        targetValue: createdGoal.targetValue
      });

      return { goal: createdGoal };

    } catch (error) {
      this.logger.error('Failed to create goal', error as Error, { userId, request });
      throw error;
    }
  }

  /**
   * Get goals for a user with optional filtering
   */
  async getGoals(userId: string, request: GetGoalsRequest = {}): Promise<GetGoalsResponse> {
    this.logger.info('Retrieving goals', { userId, filters: request });

    try {
      // Apply defaults
      const limit = Math.min(request.limit || 50, 100);
      const offset = request.offset || 0;
      
      const filters = {
        ...request,
        limit,
        offset
      };

      // Get goals from repository
      const result = await this.goalsRepository.findByUserId(userId, filters);

      this.logger.info('Goals retrieved successfully', { 
        userId,
        total: result.total,
        returned: result.goals.length,
        filters
      });

      return {
        goals: result.goals,
        total: result.total,
        limit,
        offset,
        filters
      };

    } catch (error) {
      this.logger.error('Failed to retrieve goals', error as Error, { userId, request });
      throw error;
    }
  }

  /**
   * Get a specific goal by ID
   */
  async getGoal(goalId: string, userId: string): Promise<GoalResponse> {
    this.logger.info('Retrieving goal', { goalId, userId });

    try {
      const goal = await this.goalsRepository.findById(goalId);

      if (!goal) {
        throw new Error('Goal not found');
      }

      // Verify goal belongs to the user
      if (goal.userId !== userId) {
        throw new Error('Goal not found or access denied');
      }

      this.logger.info('Goal retrieved successfully', { 
        goalId: goal.goalId,
        userId,
        type: goal.type,
        status: goal.status,
        progress: goal.progressPercentage
      });

      return { goal };

    } catch (error) {
      this.logger.error('Failed to retrieve goal', error as Error, { goalId, userId });
      throw error;
    }
  }

  /**
   * Update an existing goal
   */
  async updateGoal(goalId: string, userId: string, request: UpdateGoalRequest): Promise<UpdateGoalResponse> {
    this.logger.info('Updating goal', { goalId, userId, updates: Object.keys(request) });

    try {
      // First verify the goal exists and belongs to the user
      const existingGoal = await this.goalsRepository.findById(goalId);

      if (!existingGoal) {
        throw new Error('Goal not found');
      }

      if (existingGoal.userId !== userId) {
        throw new Error('Goal not found or access denied');
      }

      // Validate the update request
      this.validateUpdateRequest(request, existingGoal);

      // Prepare update data
      const updateData: Partial<Goal> = {
        ...request,
        updatedAt: new Date().toISOString()
      };

      // Handle goal completion
      if (request.status === 'completed' && existingGoal.status !== 'completed') {
        updateData.completedAt = new Date().toISOString();
        updateData.progressPercentage = 100;
      }

      // Update progress percentage if currentValue is being updated
      if (request.currentValue !== undefined) {
        const targetValue = request.targetValue || existingGoal.targetValue;
        updateData.progressPercentage = Math.min(Math.round((request.currentValue / targetValue) * 100), 100);
      }

      // Update goal using repository
      const updatedGoal = await this.goalsRepository.update(goalId, updateData);

      this.logger.info('Goal updated successfully', { 
        goalId: updatedGoal.goalId,
        userId,
        status: updatedGoal.status,
        progress: updatedGoal.progressPercentage
      });

      return { goal: updatedGoal };

    } catch (error) {
      this.logger.error('Failed to update goal', error as Error, { goalId, userId, request });
      throw error;
    }
  }

  /**
   * Delete a goal
   */
  async deleteGoal(goalId: string, userId: string): Promise<DeleteGoalResponse> {
    this.logger.info('Deleting goal', { goalId, userId });

    try {
      // First verify the goal exists and belongs to the user
      const existingGoal = await this.goalsRepository.findById(goalId);

      if (!existingGoal) {
        throw new Error('Goal not found');
      }

      if (existingGoal.userId !== userId) {
        throw new Error('Goal not found or access denied');
      }

      // Delete goal using repository
      await this.goalsRepository.delete(goalId);

      this.logger.info('Goal deleted successfully', { goalId, userId });

      return {
        success: true,
        message: 'Goal deleted successfully'
      };

    } catch (error) {
      this.logger.error('Failed to delete goal', error as Error, { goalId, userId });
      throw error;
    }
  }

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
      const activeGoals = allGoals.goals.filter(g => g.status === 'active').length;
      const completedGoals = allGoals.goals.filter(g => g.status === 'completed').length;
      const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

      // Calculate average completion time
      const completedGoalsWithTime = allGoals.goals
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
      const goalsByType = allGoals.goals.reduce((acc, goal) => {
        acc[goal.type] = (acc[goal.type] || 0) + 1;
        return acc;
      }, {} as { [key in GoalType]: number });

      const goalsByPriority = allGoals.goals.reduce((acc, goal) => {
        acc[goal.priority] = (acc[goal.priority] || 0) + 1;
        return acc;
      }, {} as { [key in GoalPriority]: number });

      // Get upcoming deadlines (next 7 days)
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingDeadlines = allGoals.goals
        .filter(g => g.status === 'active' && g.deadline)
        .filter(g => {
          const deadline = new Date(g.deadline!);
          return deadline >= now && deadline <= nextWeek;
        })
        .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
        .slice(0, 5);

      // Get recent completions (last 30 days)
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recentCompletions = allGoals.goals
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

  /**
   * Validate goal creation request
   */
  private async validateGoalRequest(request: CreateGoalRequest): Promise<void> {
    if (!request.title || request.title.trim().length === 0) {
      throw new Error('Goal title is required');
    }

    if (request.title.length > 200) {
      throw new Error('Goal title must be 200 characters or less');
    }

    if (request.description && request.description.length > 1000) {
      throw new Error('Goal description must be 1000 characters or less');
    }

    if (request.targetValue <= 0) {
      throw new Error('Target value must be greater than 0');
    }

    if (request.deadline) {
      const deadline = new Date(request.deadline);
      const now = new Date();
      if (deadline <= now) {
        throw new Error('Deadline must be in the future');
      }
    }

    // Validate references exist
    if (request.providerId) {
      try {
        await this.providerService.getProvider({ id: request.providerId });
      } catch (error) {
        throw new Error(`Invalid provider: ${request.providerId}`);
      }
    }

    if (request.examId) {
      try {
        await this.examService.getExam(request.examId, { includeProvider: true });
      } catch (error) {
        throw new Error(`Invalid exam: ${request.examId}`);
      }
    }

    if (request.topicId) {
      try {
        await this.topicService.getTopic({ id: request.topicId });
      } catch (error) {
        throw new Error(`Invalid topic: ${request.topicId}`);
      }
    }
  }

  /**
   * Validate goal update request
   */
  private validateUpdateRequest(request: UpdateGoalRequest, existingGoal: Goal): void {
    if (request.title !== undefined) {
      if (!request.title || request.title.trim().length === 0) {
        throw new Error('Goal title cannot be empty');
      }
      if (request.title.length > 200) {
        throw new Error('Goal title must be 200 characters or less');
      }
    }

    if (request.description !== undefined && request.description.length > 1000) {
      throw new Error('Goal description must be 1000 characters or less');
    }

    if (request.targetValue !== undefined && request.targetValue <= 0) {
      throw new Error('Target value must be greater than 0');
    }

    if (request.currentValue !== undefined && request.currentValue < 0) {
      throw new Error('Current value cannot be negative');
    }

    if (request.deadline !== undefined && request.deadline) {
      const deadline = new Date(request.deadline);
      const now = new Date();
      if (deadline <= now) {
        throw new Error('Deadline must be in the future');
      }
    }

    // Can't reactivate completed goals
    if (existingGoal.status === 'completed' && request.status && request.status !== 'completed') {
      throw new Error('Cannot change status of completed goals');
    }
  }
}