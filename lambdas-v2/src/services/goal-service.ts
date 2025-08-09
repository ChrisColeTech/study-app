import { DynamoDBClient, QueryCommand, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { 
  StudyGoal, 
  CreateGoalRequest,
  StudySession,
  Achievement,
  UserProgressAnalytics,
  TopicMasteryStats
} from '../types';
import { Logger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced Study Goal with AI features
 */
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

/**
 * Goal Service - Enhanced goal management with AI features
 */
export class GoalService {
  private dynamoClient: DynamoDBClient;
  private logger: Logger;
  private goalsTableName: string;
  private analyticsTableName: string;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.logger = new Logger('GoalService');
    this.goalsTableName = process.env.GOALS_TABLE_NAME || 'StudyGoals';
    this.analyticsTableName = process.env.ANALYTICS_TABLE_NAME || 'StudyAnalytics';
  }

  // ============================================================================
  // BASIC GOAL CRUD OPERATIONS
  // ============================================================================

  /**
   * Create a new study goal with AI optimization
   */
  async createGoal(userId: string, goalRequest: CreateGoalRequest): Promise<EnhancedStudyGoal> {
    const startTime = Date.now();

    try {
      this.logger.info('Creating new study goal', { userId, title: goalRequest.title });

      const goalId = uuidv4();
      const now = new Date().toISOString();

      // Generate AI-optimized study plan and milestones
      const aiOptimizations = await this.generateAIOptimizations(userId, goalRequest);

      const goal: EnhancedStudyGoal = {
        // Base StudyGoal properties
        goalId,
        userId,
        title: goalRequest.title,
        description: goalRequest.description,
        targetDate: goalRequest.targetDate,
        status: 'active',
        progress: 0,
        metrics: {
          questionsTarget: goalRequest.questionsTarget,
          questionsCompleted: 0,
          accuracyTarget: goalRequest.accuracyTarget,
          currentAccuracy: 0
        },
        createdAt: now,
        updatedAt: now,

        // AI-enhanced properties
        aiOptimized: true,
        adaptiveSettings: {
          difficultyLevel: 'adaptive',
          spacedRepetition: true,
          personalizedSchedule: true
        },
        milestones: aiOptimizations.milestones,
        studyPlan: aiOptimizations.studyPlan,
        aiRecommendations: aiOptimizations.recommendations,
        learningPath: aiOptimizations.learningPath,
        achievements: [],
        analyticsSnapshot: aiOptimizations.analyticsSnapshot
      };

      // Store in DynamoDB
      await this.dynamoClient.send(new PutItemCommand({
        TableName: this.goalsTableName,
        Item: marshall(goal, { removeUndefinedValues: true }),
        ConditionExpression: 'attribute_not_exists(goalId)'
      }));

      this.logger.perf('createGoal', Date.now() - startTime, { goalId, userId });
      return goal;

    } catch (error) {
      this.logger.error('Failed to create goal', { userId, goalRequest, error });
      throw error;
    }
  }

  /**
   * Get a specific goal with full AI data
   */
  async getGoal(userId: string, goalId: string): Promise<EnhancedStudyGoal | null> {
    try {
      this.logger.info('Getting goal', { userId, goalId });

      const result = await this.dynamoClient.send(new GetItemCommand({
        TableName: this.goalsTableName,
        Key: marshall({ goalId, userId })
      }));

      if (!result.Item) {
        return null;
      }

      const goal = unmarshall(result.Item) as EnhancedStudyGoal;
      
      // Update analytics snapshot if stale
      if (this.isAnalyticsSnapshotStale(goal.analyticsSnapshot)) {
        goal.analyticsSnapshot = await this.updateAnalyticsSnapshot(userId, goalId);
        await this.updateGoalAnalytics(goal);
      }

      return goal;

    } catch (error) {
      this.logger.error('Failed to get goal', { userId, goalId, error });
      throw error;
    }
  }

  /**
   * List user goals with progress tracking
   */
  async listGoals(userId: string, status?: 'active' | 'completed' | 'paused'): Promise<EnhancedStudyGoal[]> {
    const startTime = Date.now();

    try {
      this.logger.info('Listing goals', { userId, status });

      const params: any = {
        TableName: this.goalsTableName,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: marshall({ ':userId': userId })
      };

      if (status) {
        params.FilterExpression = '#status = :status';
        params.ExpressionAttributeNames = { '#status': 'status' };
        params.ExpressionAttributeValues = marshall({ ':userId': userId, ':status': status });
      }

      const result = await this.dynamoClient.send(new QueryCommand(params));
      const goals = result.Items?.map(item => unmarshall(item) as EnhancedStudyGoal) || [];

      // Update progress for all goals
      const updatedGoals = await Promise.all(
        goals.map(goal => this.updateGoalProgress(goal))
      );

      this.logger.perf('listGoals', Date.now() - startTime, { userId, count: updatedGoals.length });
      return updatedGoals;

    } catch (error) {
      this.logger.error('Failed to list goals', { userId, status, error });
      throw error;
    }
  }

  /**
   * Update goal with AI re-optimization
   */
  async updateGoal(
    userId: string, 
    goalId: string, 
    updates: Partial<CreateGoalRequest & { status: 'active' | 'completed' | 'paused' }>
  ): Promise<EnhancedStudyGoal> {
    const startTime = Date.now();

    try {
      this.logger.info('Updating goal', { userId, goalId, updates });

      const existingGoal = await this.getGoal(userId, goalId);
      if (!existingGoal) {
        throw new Error('Goal not found');
      }

      const now = new Date().toISOString();
      const updatedGoal = { ...existingGoal, ...updates, updatedAt: now };

      // If significant changes, re-optimize with AI
      const shouldReoptimize = this.shouldReoptimizeGoal(existingGoal, updates);
      if (shouldReoptimize) {
        const reoptimizations = await this.reoptimizeGoal(userId, updatedGoal);
        updatedGoal.studyPlan = reoptimizations.studyPlan;
        updatedGoal.aiRecommendations = [...updatedGoal.aiRecommendations, ...reoptimizations.newRecommendations];
        updatedGoal.learningPath = reoptimizations.learningPath;
      }

      await this.dynamoClient.send(new UpdateItemCommand({
        TableName: this.goalsTableName,
        Key: marshall({ goalId, userId }),
        UpdateExpression: 'SET #data = :data, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#data': 'data',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: marshall({
          ':data': updatedGoal,
          ':updatedAt': now
        })
      }));

      this.logger.perf('updateGoal', Date.now() - startTime, { goalId, userId, reoptimized: shouldReoptimize });
      return updatedGoal;

    } catch (error) {
      this.logger.error('Failed to update goal', { userId, goalId, updates, error });
      throw error;
    }
  }

  /**
   * Delete goal
   */
  async deleteGoal(userId: string, goalId: string): Promise<void> {
    try {
      this.logger.info('Deleting goal', { userId, goalId });

      await this.dynamoClient.send(new DeleteItemCommand({
        TableName: this.goalsTableName,
        Key: marshall({ goalId, userId }),
        ConditionExpression: 'attribute_exists(goalId)'
      }));

    } catch (error) {
      this.logger.error('Failed to delete goal', { userId, goalId, error });
      throw error;
    }
  }

  // ============================================================================
  // MILESTONE MANAGEMENT
  // ============================================================================

  /**
   * Add milestone to goal
   */
  async addMilestone(
    userId: string, 
    goalId: string, 
    milestoneData: Omit<GoalMilestone, 'milestoneId' | 'completed' | 'aiGenerated'>
  ): Promise<GoalMilestone> {
    try {
      this.logger.info('Adding milestone to goal', { userId, goalId, milestone: milestoneData.title });

      const goal = await this.getGoal(userId, goalId);
      if (!goal) {
        throw new Error('Goal not found');
      }

      const milestone: GoalMilestone = {
        ...milestoneData,
        milestoneId: uuidv4(),
        completed: false,
        aiGenerated: false
      };

      goal.milestones.push(milestone);
      goal.updatedAt = new Date().toISOString();

      await this.dynamoClient.send(new UpdateItemCommand({
        TableName: this.goalsTableName,
        Key: marshall({ goalId, userId }),
        UpdateExpression: 'SET milestones = :milestones, updatedAt = :updatedAt',
        ExpressionAttributeValues: marshall({
          ':milestones': goal.milestones,
          ':updatedAt': goal.updatedAt
        })
      }));

      return milestone;

    } catch (error) {
      this.logger.error('Failed to add milestone', { userId, goalId, error });
      throw error;
    }
  }

  /**
   * Complete milestone and award achievements
   */
  async completeMilestone(userId: string, goalId: string, milestoneId: string): Promise<GoalAchievement[]> {
    try {
      this.logger.info('Completing milestone', { userId, goalId, milestoneId });

      const goal = await this.getGoal(userId, goalId);
      if (!goal) {
        throw new Error('Goal not found');
      }

      const milestone = goal.milestones.find(m => m.milestoneId === milestoneId);
      if (!milestone) {
        throw new Error('Milestone not found');
      }

      if (milestone.completed) {
        return []; // Already completed
      }

      milestone.completed = true;
      milestone.completedAt = new Date().toISOString();

      // Check for achievements
      const newAchievements = await this.checkMilestoneAchievements(goal, milestone);
      goal.achievements.push(...newAchievements);

      // Update progress
      await this.updateGoalProgress(goal);

      await this.dynamoClient.send(new UpdateItemCommand({
        TableName: this.goalsTableName,
        Key: marshall({ goalId, userId }),
        UpdateExpression: 'SET milestones = :milestones, achievements = :achievements, progress = :progress, updatedAt = :updatedAt',
        ExpressionAttributeValues: marshall({
          ':milestones': goal.milestones,
          ':achievements': goal.achievements,
          ':progress': goal.progress,
          ':updatedAt': new Date().toISOString()
        })
      }));

      return newAchievements;

    } catch (error) {
      this.logger.error('Failed to complete milestone', { userId, goalId, milestoneId, error });
      throw error;
    }
  }

  // ============================================================================
  // AI OPTIMIZATION AND RECOMMENDATIONS
  // ============================================================================

  /**
   * Generate AI optimizations for a new goal
   */
  private async generateAIOptimizations(userId: string, goalRequest: CreateGoalRequest): Promise<{
    milestones: GoalMilestone[];
    studyPlan: StudyPlanReference;
    recommendations: AIRecommendation[];
    learningPath: LearningPathNode[];
    analyticsSnapshot: GoalAnalyticsSnapshot;
  }> {
    try {
      // Get user's historical performance for AI optimization
      const userAnalytics = await this.getUserAnalyticsForOptimization(userId);
      
      // Generate intelligent milestones
      const milestones = this.generateIntelligentMilestones(goalRequest, userAnalytics);
      
      // Create study plan reference
      const studyPlan: StudyPlanReference = {
        planId: uuidv4(),
        generatedAt: new Date().toISOString(),
        duration: this.calculateOptimalDuration(goalRequest, userAnalytics),
        adaptiveAdjustments: 0,
        lastOptimized: new Date().toISOString()
      };

      // Generate initial recommendations
      const recommendations = this.generateInitialRecommendations(goalRequest, userAnalytics);

      // Create learning path
      const learningPath = this.generateLearningPath(goalRequest, userAnalytics);

      // Create analytics snapshot
      const analyticsSnapshot: GoalAnalyticsSnapshot = {
        lastUpdated: new Date().toISOString(),
        currentAccuracy: userAnalytics?.overallAccuracy || 0,
        weeklyProgress: 0,
        studyVelocity: userAnalytics?.averageQuestionsPerDay || 10,
        difficultyTrend: 'stable',
        topicMastery: {},
        predictedCompletionDate: this.calculatePredictedCompletion(goalRequest, userAnalytics),
        confidenceScore: this.calculateInitialConfidenceScore(goalRequest, userAnalytics)
      };

      return {
        milestones,
        studyPlan,
        recommendations,
        learningPath,
        analyticsSnapshot
      };

    } catch (error) {
      this.logger.error('Failed to generate AI optimizations', { userId, goalRequest, error });
      // Return basic non-AI optimizations as fallback
      return this.getBasicOptimizations(goalRequest);
    }
  }

  /**
   * Generate intelligent milestones based on user performance
   */
  private generateIntelligentMilestones(goalRequest: CreateGoalRequest, userAnalytics?: any): GoalMilestone[] {
    const milestones: GoalMilestone[] = [];
    const totalQuestions = goalRequest.questionsTarget;
    const targetAccuracy = goalRequest.accuracyTarget;
    const targetDate = new Date(goalRequest.targetDate);
    const now = new Date();
    const totalDays = Math.max(1, Math.floor((targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    // Generate progressive milestones
    const milestonePercentages = [25, 50, 75, 90, 100];
    
    milestonePercentages.forEach((percentage, index) => {
      const questionsTarget = Math.floor((totalQuestions * percentage) / 100);
      const accuracyTarget = Math.min(targetAccuracy, 60 + (percentage / 100) * (targetAccuracy - 60));
      const daysFromNow = Math.floor((totalDays * percentage) / 100);
      const milestoneDate = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);

      milestones.push({
        milestoneId: uuidv4(),
        title: `${percentage}% Progress Checkpoint`,
        description: `Complete ${questionsTarget} questions with ${Math.round(accuracyTarget)}% accuracy`,
        targetDate: milestoneDate.toISOString(),
        completed: false,
        requirements: [
          {
            type: 'questions',
            target: questionsTarget,
            current: 0,
            description: `Answer ${questionsTarget} questions correctly`
          },
          {
            type: 'accuracy',
            target: accuracyTarget,
            current: 0,
            description: `Maintain ${Math.round(accuracyTarget)}% accuracy`
          }
        ],
        rewards: this.generateMilestoneRewards(percentage),
        aiGenerated: true
      });
    });

    return milestones;
  }

  /**
   * Generate milestone rewards
   */
  private generateMilestoneRewards(percentage: number): string[] {
    const baseRewards = ['Progress Badge', 'Study Points'];
    
    if (percentage === 25) return [...baseRewards, 'Getting Started Badge'];
    if (percentage === 50) return [...baseRewards, 'Halfway Hero Badge'];
    if (percentage === 75) return [...baseRewards, 'Almost There Badge'];
    if (percentage === 90) return [...baseRewards, 'Final Sprint Badge'];
    if (percentage === 100) return [...baseRewards, 'Goal Master Badge', 'Completion Certificate'];
    
    return baseRewards;
  }

  /**
   * Generate initial AI recommendations
   */
  private generateInitialRecommendations(goalRequest: CreateGoalRequest, userAnalytics?: any): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];
    const now = new Date();
    const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    // Study schedule recommendation
    recommendations.push({
      id: uuidv4(),
      type: 'study_schedule',
      priority: 'high',
      title: 'Optimal Study Schedule',
      description: 'Based on your goal timeline, we recommend studying 5 days per week',
      reasoning: 'Consistent daily practice improves retention and reduces cramming',
      actionItems: [
        'Schedule 45-60 minutes of study time daily',
        'Take weekends off for mental rest',
        'Focus on weak topics during peak focus hours'
      ],
      validUntil,
      applied: false
    });

    // Difficulty adjustment recommendation
    if (userAnalytics?.overallAccuracy) {
      if (userAnalytics.overallAccuracy < 60) {
        recommendations.push({
          id: uuidv4(),
          type: 'difficulty_adjustment',
          priority: 'high',
          title: 'Start with Easier Questions',
          description: 'Begin with fundamental topics to build confidence',
          reasoning: 'Your current accuracy suggests starting with easier questions to build a strong foundation',
          actionItems: [
            'Focus on easy and medium difficulty questions initially',
            'Master basic concepts before advancing',
            'Review explanations thoroughly'
          ],
          validUntil,
          applied: false
        });
      } else if (userAnalytics.overallAccuracy > 85) {
        recommendations.push({
          id: uuidv4(),
          type: 'difficulty_adjustment',
          priority: 'medium',
          title: 'Challenge Yourself with Harder Questions',
          description: 'Your high accuracy suggests you can handle more challenging content',
          reasoning: 'High accuracy indicates readiness for advanced topics',
          actionItems: [
            'Increase proportion of hard difficulty questions',
            'Focus on complex scenarios and edge cases',
            'Practice time management with challenging questions'
          ],
          validUntil,
          applied: false
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate learning path based on goal and analytics
   */
  private generateLearningPath(goalRequest: CreateGoalRequest, userAnalytics?: any): LearningPathNode[] {
    // This would typically integrate with a more sophisticated topic taxonomy
    // For now, generating a basic learning path
    const basicTopics = [
      'Fundamentals', 'Core Concepts', 'Advanced Topics', 
      'Practical Applications', 'Best Practices', 'Exam Preparation'
    ];

    return basicTopics.map((topic, index) => ({
      nodeId: uuidv4(),
      topic,
      estimatedTime: 60 + (index * 30), // Increasing time for each topic
      prerequisites: index > 0 ? [basicTopics[index - 1]!] : [],
      completed: false,
      difficultyLevel: Math.min(5, index + 1),
      adaptiveWeight: 1.0,
      nextReviewDate: new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  // ============================================================================
  // PROGRESS TRACKING AND ANALYTICS
  // ============================================================================

  /**
   * Update goal progress based on recent sessions
   */
  private async updateGoalProgress(goal: EnhancedStudyGoal): Promise<EnhancedStudyGoal> {
    try {
      // This would integrate with SessionService to get recent progress
      // For now, implementing basic progress calculation
      
      const completedMilestones = goal.milestones.filter(m => m.completed).length;
      const totalMilestones = goal.milestones.length;
      
      goal.progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;
      
      // Update analytics snapshot if needed
      if (this.isAnalyticsSnapshotStale(goal.analyticsSnapshot)) {
        goal.analyticsSnapshot = await this.updateAnalyticsSnapshot(goal.userId, goal.goalId);
      }

      return goal;

    } catch (error) {
      this.logger.error('Failed to update goal progress', { goalId: goal.goalId, error });
      return goal;
    }
  }

  /**
   * Update analytics snapshot for goal
   */
  private async updateAnalyticsSnapshot(userId: string, goalId: string): Promise<GoalAnalyticsSnapshot> {
    try {
      // This would integrate with AnalyticsService to get fresh analytics
      // For now, returning basic snapshot
      return {
        lastUpdated: new Date().toISOString(),
        currentAccuracy: 75, // Placeholder
        weeklyProgress: 15,   // Placeholder
        studyVelocity: 20,    // Placeholder
        difficultyTrend: 'stable',
        topicMastery: {},
        predictedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        confidenceScore: 80
      };

    } catch (error) {
      this.logger.error('Failed to update analytics snapshot', { userId, goalId, error });
      throw error;
    }
  }

  /**
   * Check if analytics snapshot is stale (older than 1 hour)
   */
  private isAnalyticsSnapshotStale(snapshot: GoalAnalyticsSnapshot): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(snapshot.lastUpdated) < oneHourAgo;
  }

  /**
   * Update goal analytics in DynamoDB
   */
  private async updateGoalAnalytics(goal: EnhancedStudyGoal): Promise<void> {
    try {
      await this.dynamoClient.send(new UpdateItemCommand({
        TableName: this.goalsTableName,
        Key: marshall({ goalId: goal.goalId, userId: goal.userId }),
        UpdateExpression: 'SET analyticsSnapshot = :analyticsSnapshot, updatedAt = :updatedAt',
        ExpressionAttributeValues: marshall({
          ':analyticsSnapshot': goal.analyticsSnapshot,
          ':updatedAt': new Date().toISOString()
        })
      }));

    } catch (error) {
      this.logger.error('Failed to update goal analytics', { goalId: goal.goalId, error });
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get user analytics for AI optimization
   */
  private async getUserAnalyticsForOptimization(userId: string): Promise<any> {
    try {
      // This would integrate with AnalyticsService
      // For now, returning placeholder data
      return {
        overallAccuracy: 70,
        averageQuestionsPerDay: 15,
        preferredStudyTime: 'evening',
        strongTopics: ['basics', 'fundamentals'],
        weakTopics: ['advanced', 'edge-cases']
      };

    } catch (error) {
      this.logger.error('Failed to get user analytics for optimization', { userId, error });
      return null;
    }
  }

  /**
   * Calculate optimal duration for goal completion
   */
  private calculateOptimalDuration(goalRequest: CreateGoalRequest, userAnalytics?: any): number {
    const targetDate = new Date(goalRequest.targetDate);
    const now = new Date();
    return Math.max(1, Math.floor((targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  }

  /**
   * Calculate predicted completion date
   */
  private calculatePredictedCompletion(goalRequest: CreateGoalRequest, userAnalytics?: any): string {
    const averageQuestionsPerDay = userAnalytics?.averageQuestionsPerDay || 10;
    const daysNeeded = Math.ceil(goalRequest.questionsTarget / averageQuestionsPerDay);
    return new Date(Date.now() + daysNeeded * 24 * 60 * 60 * 1000).toISOString();
  }

  /**
   * Calculate initial confidence score
   */
  private calculateInitialConfidenceScore(goalRequest: CreateGoalRequest, userAnalytics?: any): number {
    if (!userAnalytics) return 50; // Neutral confidence
    
    const accuracyFactor = Math.min(100, userAnalytics.overallAccuracy * 1.2);
    const consistencyFactor = userAnalytics.averageQuestionsPerDay > 0 ? 80 : 50;
    
    return Math.round((accuracyFactor + consistencyFactor) / 2);
  }

  /**
   * Check if goal should be re-optimized
   */
  private shouldReoptimizeGoal(existingGoal: EnhancedStudyGoal, updates: any): boolean {
    const significantChanges = ['targetDate', 'questionsTarget', 'accuracyTarget'];
    return significantChanges.some(field => updates[field] !== undefined);
  }

  /**
   * Re-optimize goal with AI
   */
  private async reoptimizeGoal(userId: string, goal: EnhancedStudyGoal): Promise<{
    studyPlan: StudyPlanReference;
    newRecommendations: AIRecommendation[];
    learningPath: LearningPathNode[];
  }> {
    try {
      const userAnalytics = await this.getUserAnalyticsForOptimization(userId);
      
      return {
        studyPlan: {
          ...goal.studyPlan,
          lastOptimized: new Date().toISOString(),
          adaptiveAdjustments: goal.studyPlan.adaptiveAdjustments + 1
        },
        newRecommendations: [{
          id: uuidv4(),
          type: 'study_schedule',
          priority: 'medium',
          title: 'Goal Updated - Schedule Adjusted',
          description: 'Your study schedule has been optimized based on your goal changes',
          reasoning: 'Goal parameters changed, requiring schedule adjustment',
          actionItems: ['Review updated milestones', 'Adjust daily study time'],
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          applied: false
        }],
        learningPath: goal.learningPath
      };

    } catch (error) {
      this.logger.error('Failed to re-optimize goal', { userId, goalId: goal.goalId, error });
      throw error;
    }
  }

  /**
   * Get basic optimizations as fallback
   */
  private getBasicOptimizations(goalRequest: CreateGoalRequest): {
    milestones: GoalMilestone[];
    studyPlan: StudyPlanReference;
    recommendations: AIRecommendation[];
    learningPath: LearningPathNode[];
    analyticsSnapshot: GoalAnalyticsSnapshot;
  } {
    return {
      milestones: [],
      studyPlan: {
        planId: uuidv4(),
        generatedAt: new Date().toISOString(),
        duration: 30,
        adaptiveAdjustments: 0,
        lastOptimized: new Date().toISOString()
      },
      recommendations: [],
      learningPath: [],
      analyticsSnapshot: {
        lastUpdated: new Date().toISOString(),
        currentAccuracy: 0,
        weeklyProgress: 0,
        studyVelocity: 10,
        difficultyTrend: 'stable',
        topicMastery: {},
        predictedCompletionDate: goalRequest.targetDate,
        confidenceScore: 50
      }
    };
  }

  /**
   * Check milestone achievements
   */
  private async checkMilestoneAchievements(goal: EnhancedStudyGoal, milestone: GoalMilestone): Promise<GoalAchievement[]> {
    const achievements: GoalAchievement[] = [];
    
    // Basic milestone completion achievement
    achievements.push({
      achievementId: uuidv4(),
      name: 'Milestone Master',
      description: `Completed milestone: ${milestone.title}`,
      earnedAt: new Date().toISOString(),
      category: 'progress',
      points: 100
    });

    // Check for consistency achievements
    const completedMilestones = goal.milestones.filter(m => m.completed).length;
    if (completedMilestones === 3) {
      achievements.push({
        achievementId: uuidv4(),
        name: 'Steady Progress',
        description: 'Completed 3 milestones',
        earnedAt: new Date().toISOString(),
        category: 'consistency',
        points: 200
      });
    }

    return achievements;
  }
}