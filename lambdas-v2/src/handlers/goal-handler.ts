import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { BaseHandler } from '../shared/base-handler';
import { GoalService, EnhancedStudyGoal } from '../services/goal-service';
import { AIRecommendationService } from '../services/ai-recommendation-service';
import { AdaptiveLearningService } from '../services/adaptive-learning-service';
import { AnalyticsService } from '../services/analytics-service';
import { ValidationService } from '../services/validation-service';
import { 
  CreateGoalRequest,
  ApiError,
  ErrorCode
} from '../types';
import Joi from 'joi';

/**
 * Enhanced Goal Handler - AI-powered study goal management
 * Phase 5: AI-Powered Study Features Implementation
 */
class GoalHandler extends BaseHandler {
  private goalService: GoalService;
  private recommendationService: AIRecommendationService;
  private adaptiveLearningService: AdaptiveLearningService;
  private analyticsService: AnalyticsService;
  private validationService: ValidationService;

  // Validation schemas
  private createGoalSchema = Joi.object({
    title: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500).optional(),
    targetDate: Joi.string().isoDate().required(),
    questionsTarget: Joi.number().min(10).max(10000).required(),
    accuracyTarget: Joi.number().min(50).max(100).required()
  });

  private updateGoalSchema = Joi.object({
    title: Joi.string().min(3).max(100).optional(),
    description: Joi.string().max(500).optional(),
    targetDate: Joi.string().isoDate().optional(),
    questionsTarget: Joi.number().min(10).max(10000).optional(),
    accuracyTarget: Joi.number().min(50).max(100).optional(),
    status: Joi.string().valid('active', 'completed', 'paused').optional()
  });

  private addMilestoneSchema = Joi.object({
    title: Joi.string().min(3).max(100).required(),
    description: Joi.string().max(500).optional(),
    targetDate: Joi.string().isoDate().required(),
    requirements: Joi.array().items(Joi.object({
      type: Joi.string().valid('accuracy', 'questions', 'time', 'topics', 'sessions').required(),
      target: Joi.number().min(1).required(),
      description: Joi.string().required()
    })).min(1).required(),
    rewards: Joi.array().items(Joi.string()).default([])
  });

  constructor() {
    super('GoalHandler');
    this.goalService = new GoalService();
    this.recommendationService = new AIRecommendationService();
    this.adaptiveLearningService = new AdaptiveLearningService();
    this.analyticsService = new AnalyticsService();
    this.validationService = new ValidationService();
  }

  // ============================================================================
  // GOAL CRUD OPERATIONS WITH AI ENHANCEMENT
  // ============================================================================

  /**
   * Create a new study goal with AI optimization
   * POST /goals
   */
  public async createGoal(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      this.logger.info('Creating enhanced study goal', { userId });

      // Validate request body
      const requestBody = this.parseAndValidateBody(event.body, this.createGoalSchema);
      const goalRequest: CreateGoalRequest = requestBody;

      // Validate target date is in the future
      const targetDate = new Date(goalRequest.targetDate);
      if (targetDate <= new Date()) {
        throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Target date must be in the future');
      }

      // Create AI-optimized goal
      const goal = await this.goalService.createGoal(userId, goalRequest);

      return this.success({
        goal,
        message: 'Study goal created successfully with AI optimization',
        aiFeatures: {
          optimizedMilestones: goal.milestones.length,
          adaptiveSettings: goal.adaptiveSettings,
          recommendationsGenerated: goal.aiRecommendations.length,
          learningPathNodes: goal.learningPath.length
        }
      });

    } catch (error) {
      this.logger.error('Failed to create study goal', { userId, error });
      if (error instanceof ApiError) {
        return this.badRequest(error.message);
      }
      return this.internalError('Failed to create study goal');
    }
  }

  /**
   * Get a specific goal with detailed AI insights
   * GET /goals/{goalId}
   */
  public async getGoal(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const goalId = event.pathParameters?.id;
      if (!goalId) {
        throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Goal ID is required');
      }

      this.logger.info('Getting enhanced goal details', { userId, goalId });

      const goal = await this.goalService.getGoal(userId, goalId);
      if (!goal) {
        throw new ApiError(ErrorCode.NOT_FOUND, 'Goal not found');
      }

      // Get additional AI insights
      const [recommendations, sessionPlan] = await Promise.all([
        this.recommendationService.generateRecommendations(userId, {
          includeStudyPlan: false,
          timeAvailable: 60,
          urgency: this.calculateGoalUrgency(goal)
        }),
        this.recommendationService.getSessionRecommendations(userId, {
          availableTime: 45,
          sessionType: 'mixed'
        })
      ]);

      return this.success({
        goal,
        aiInsights: {
          personalizedRecommendations: recommendations.recommendations.slice(0, 3),
          nextSessionPlan: sessionPlan.sessionPlan,
          progressPrediction: goal.analyticsSnapshot,
          milestoneStatus: this.analyzeMilestoneStatus(goal),
          learningPathProgress: this.calculateLearningPathProgress(goal)
        },
        metadata: {
          lastOptimized: goal.studyPlan.lastOptimized,
          adaptiveAdjustments: goal.studyPlan.adaptiveAdjustments,
          achievementsEarned: goal.achievements.length
        }
      });

    } catch (error) {
      const goalId = event.pathParameters?.id;
      this.logger.error('Failed to get goal details', { userId, goalId, error });
      if (error instanceof ApiError) {
        return this.badRequest(error.message);
      }
      return this.internalError('Failed to get goal details');
    }
  }

  /**
   * List user goals with AI-powered filtering and sorting - Enhanced version
   * GET /goals
   */
  public async getGoals(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      this.logger.info('Listing enhanced goals', { userId });

      const queryParams = event.queryStringParameters || {};
      const status = queryParams.status as 'active' | 'completed' | 'paused' | undefined;
      const includeInsights = queryParams.includeInsights === 'true';
      const sortBy = queryParams.sortBy as 'created' | 'priority' | 'progress' | 'deadline' || 'priority';

      // Get goals from service
      const goals = await this.goalService.listGoals(userId, status);

      // AI-powered sorting
      const sortedGoals = this.sortGoalsIntelligently(goals, sortBy);

      let aiInsights;
      if (includeInsights) {
        // Get AI insights for goal management
        aiInsights = await this.generateGoalManagementInsights(userId, sortedGoals);
      }

      return this.success({
        goals: sortedGoals,
        count: sortedGoals.length,
        aiInsights: aiInsights || null,
        summary: {
          active: goals.filter(g => g.status === 'active').length,
          completed: goals.filter(g => g.status === 'completed').length,
          paused: goals.filter(g => g.status === 'paused').length,
          averageProgress: goals.length > 0 ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length : 0,
          totalAchievements: goals.reduce((sum, g) => sum + g.achievements.length, 0)
        }
      });

    } catch (error) {
      this.logger.error('Failed to list goals', { userId, status, error });
      return this.internalError('Failed to list goals');
    }
  }

  /**
   * Update goal with AI re-optimization
   * PUT /goals/{goalId}
   */
  public async updateGoal(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const goalId = event.pathParameters?.id;
      if (!goalId) {
        throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Goal ID is required');
      }

      this.logger.info('Updating goal with AI re-optimization', { userId, goalId });

      // Validate request body
      const requestBody = this.parseAndValidateBody(event.body, this.updateGoalSchema);

      // Update goal with AI re-optimization
      const updatedGoal = await this.goalService.updateGoal(userId, goalId, requestBody);

      return this.success({
        goal: updatedGoal,
        message: 'Goal updated successfully with AI re-optimization',
        changes: {
          reoptimized: this.wasGoalReoptimized(updatedGoal),
          newRecommendations: updatedGoal.aiRecommendations.filter(r => !r.applied).length,
          updatedMilestones: updatedGoal.milestones.length,
          adjustedLearningPath: updatedGoal.learningPath.length
        }
      });

    } catch (error) {
      const goalId = event.pathParameters?.id;
      this.logger.error('Failed to update goal', { userId, goalId, error });
      if (error instanceof ApiError) {
        return this.badRequest(error.message);
      }
      return this.internalError('Failed to update goal');
    }
  }

  /**
   * Delete goal
   * DELETE /goals/{goalId}
   */
  public async deleteGoal(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const goalId = event.pathParameters?.id;
      if (!goalId) {
        throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Goal ID is required');
      }

      this.logger.info('Deleting goal', { userId, goalId });

      await this.goalService.deleteGoal(userId, goalId);

      return this.success({
        message: 'Goal deleted successfully',
        goalId
      });

    } catch (error) {
      const goalId = event.pathParameters?.id;
      this.logger.error('Failed to delete goal', { userId, goalId, error });
      return this.internalError('Failed to delete goal');
    }
  }

  // ============================================================================
  // MILESTONE MANAGEMENT
  // ============================================================================

  /**
   * Add milestone to goal
   * POST /goals/{goalId}/milestones
   */
  public async addMilestone(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      const goalId = event.pathParameters?.id;
      if (!goalId) {
        throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Goal ID is required');
      }

      this.logger.info('Adding milestone to goal', { userId, goalId });

      // Validate request body
      const requestBody = this.parseAndValidateBody(event.body, this.addMilestoneSchema);

      // Add milestone
      const milestone = await this.goalService.addMilestone(userId, goalId, {
        title: requestBody.title,
        description: requestBody.description,
        targetDate: requestBody.targetDate,
        requirements: requestBody.requirements.map((req: any) => ({
          ...req,
          current: 0 // Initialize current progress to 0
        })),
        rewards: requestBody.rewards || []
      });

      return this.success({
        milestone,
        message: 'Milestone added successfully',
        goalId
      });

    } catch (error) {
      const goalId = event.pathParameters?.id;
      this.logger.error('Failed to add milestone', { userId, goalId, error });
      if (error instanceof ApiError) {
        return this.badRequest(error.message);
      }
      return this.internalError('Failed to add milestone');
    }
  }

  /**
   * Get personalized AI-powered study recommendations
   * GET /recommendations (when called from goals context)
   */
  public async getRecommendations(event: APIGatewayProxyEvent, userId: string): Promise<APIGatewayProxyResult> {
    try {
      this.logger.info('Getting AI-powered study recommendations', { userId });

      const queryParams = event.queryStringParameters || {};
      const options = {
        includeStudyPlan: queryParams.includeStudyPlan === 'true',
        planDuration: queryParams.planDuration ? parseInt(queryParams.planDuration) : 30,
        focusAreas: queryParams.focusAreas ? queryParams.focusAreas.split(',') : undefined,
        urgency: queryParams.urgency as 'low' | 'medium' | 'high' || 'medium',
        timeAvailable: queryParams.timeAvailable ? parseInt(queryParams.timeAvailable) : 60
      };

      // Generate AI recommendations
      const result = await this.recommendationService.generateRecommendations(userId, options);

      return this.success({
        recommendations: result.recommendations,
        studyPlan: result.studyPlan,
        lastUpdated: result.lastUpdated,
        metadata: {
          totalRecommendations: result.recommendations.length,
          highPriorityCount: result.recommendations.filter(r => r.priority === 'high').length,
          averageConfidence: result.recommendations.reduce((sum, r) => sum + r.confidence, 0) / result.recommendations.length,
          planIncluded: !!result.studyPlan
        }
      });

    } catch (error) {
      this.logger.error('Failed to get AI recommendations', { userId, error });
      return this.internalError('Failed to get AI recommendations');
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Parse and validate request body
   */
  private parseAndValidateBody(body: string | null, schema: Joi.Schema): any {
    if (!body) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Request body is required');
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (error) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, 'Invalid JSON in request body');
    }

    const { error, value } = schema.validate(parsedBody);
    if (error) {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, `Validation error: ${error.details[0]?.message}`);
    }

    return value;
  }

  /**
   * Calculate goal urgency for AI optimization
   */
  private calculateGoalUrgency(goal: EnhancedStudyGoal): 'low' | 'medium' | 'high' {
    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const daysRemaining = Math.max(0, Math.floor((targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const progressGap = 100 - goal.progress;

    if (daysRemaining < 7 && progressGap > 30) return 'high';
    if (daysRemaining < 14 && progressGap > 50) return 'high';
    if (daysRemaining < 30 && progressGap > 20) return 'medium';
    
    return 'low';
  }

  /**
   * Analyze milestone status for insights
   */
  private analyzeMilestoneStatus(goal: EnhancedStudyGoal): any {
    const completed = goal.milestones.filter(m => m.completed).length;
    const total = goal.milestones.length;
    const overdue = goal.milestones.filter(m => !m.completed && new Date(m.targetDate) < new Date()).length;
    const upcoming = goal.milestones.filter(m => {
      const targetDate = new Date(m.targetDate);
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return !m.completed && targetDate <= in7Days && targetDate > new Date();
    }).length;

    return {
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      completed,
      total,
      overdue,
      upcoming,
      nextMilestone: goal.milestones.find(m => !m.completed)
    };
  }

  /**
   * Calculate learning path progress
   */
  private calculateLearningPathProgress(goal: EnhancedStudyGoal): any {
    const completed = goal.learningPath.filter(node => node.completed).length;
    const total = goal.learningPath.length;

    return {
      nodesCompleted: completed,
      totalNodes: total,
      progressPercentage: total > 0 ? (completed / total) * 100 : 0,
      currentNode: goal.learningPath.find(node => !node.completed),
      estimatedTimeRemaining: goal.learningPath
        .filter(node => !node.completed)
        .reduce((sum, node) => sum + node.estimatedTime, 0)
    };
  }

  /**
   * Sort goals intelligently using AI
   */
  private sortGoalsIntelligently(goals: EnhancedStudyGoal[], sortBy: string): EnhancedStudyGoal[] {
    switch (sortBy) {
      case 'priority':
        return goals.sort((a, b) => {
          const urgencyA = this.calculateGoalUrgency(a);
          const urgencyB = this.calculateGoalUrgency(b);
          const urgencyOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          if (urgencyA !== urgencyB) {
            return urgencyOrder[urgencyB] - urgencyOrder[urgencyA];
          }
          return (100 - a.progress) - (100 - b.progress); // Less progress = higher priority
        });
      
      case 'progress':
        return goals.sort((a, b) => b.progress - a.progress);
      
      case 'deadline':
        return goals.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
      
      case 'created':
      default:
        return goals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  /**
   * Generate goal management insights
   */
  private async generateGoalManagementInsights(userId: string, goals: EnhancedStudyGoal[]): Promise<any> {
    const activeGoals = goals.filter(g => g.status === 'active');
    const overloadRisk = activeGoals.length > 3;
    const strugglingGoals = activeGoals.filter(g => g.progress < 30 && this.calculateGoalUrgency(g) !== 'low');

    return {
      overloadRisk,
      strugglingGoalsCount: strugglingGoals.length,
      suggestedFocus: strugglingGoals.length > 0 ? strugglingGoals[0]?.goalId : activeGoals[0]?.goalId,
      recommendations: [
        ...(overloadRisk ? ['Consider pausing some goals to focus on priority items'] : []),
        ...(strugglingGoals.length > 0 ? [`Focus on improving progress in ${strugglingGoals.length} struggling goals`] : [])
      ]
    };
  }

  /**
   * Check if goal was re-optimized in update
   */
  private wasGoalReoptimized(goal: EnhancedStudyGoal): boolean {
    const lastOptimized = new Date(goal.studyPlan.lastOptimized);
    const updated = new Date(goal.updatedAt);
    const timeDiff = Math.abs(updated.getTime() - lastOptimized.getTime());
    return timeDiff < 60000; // Within 1 minute
  }
}

const goalHandler = new GoalHandler();
export const handler = goalHandler.withAuth(
  (event: APIGatewayProxyEvent, userId: string) => goalHandler.getGoals(event, userId)
);