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
  IGoalsProgressTracker,
  GoalType,
  GoalStatus,
  GoalPriority
} from '../shared/types/goals.types';
import { IGoalsRepository } from '../repositories/goals.repository';
import { IProviderService } from './provider.service';
import { IExamService } from './exam.service';
import { ITopicService } from './topic.service';
import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';

// Re-export the interface for ServiceFactory
export type { IGoalsService };

export class GoalsService extends BaseService implements IGoalsService {

  constructor(
    private goalsRepository: IGoalsRepository,
    private providerService: IProviderService,
    private examService: IExamService,
    private topicService: ITopicService,
    private goalsProgressTracker: IGoalsProgressTracker
  ) {
    super();
  }

  /**
   * Create a new goal for a user
   */
  async createGoal(userId: string, request: CreateGoalRequest): Promise<CreateGoalResponse> {
    return this.executeWithErrorHandling(
      async () => {
        this.validateRequired(userId, 'userId');
        this.validateRequired(request, 'request');
        
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

        this.logSuccess('Goal created successfully', { 
          goalId: createdGoal.goalId,
          userId,
          type: createdGoal.type,
          targetValue: createdGoal.targetValue,
          title: createdGoal.title
        });

        return { goal: createdGoal };
      },
      {
        operation: 'create goal',
        entityType: 'Goal',
        userId,
        requestData: {
          type: request.type,
          targetType: request.targetType,
          title: request.title
        }
      }
    );
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
        returned: result.items.length,
        filters
      });

      return {
        goals: result.items,
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
   * Get goal statistics for a user (delegated to GoalsProgressTracker)
   */
  async getGoalStats(userId: string): Promise<GoalStats> {
    return this.goalsProgressTracker.getGoalStats(userId);
  }

  /**
   * Update goal progress (delegated to GoalsProgressTracker)
   */
  async updateGoalProgress(goalId: string, progress: number): Promise<void> {
    return this.goalsProgressTracker.updateGoalProgress(goalId, progress);
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