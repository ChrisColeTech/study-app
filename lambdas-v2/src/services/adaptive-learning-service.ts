import { DynamoDBClient, QueryCommand, PutItemCommand, UpdateItemCommand, BatchGetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { 
  StudySession,
  Question,
  SessionAnswer,
  TopicMasteryStats,
  UserProgressAnalytics
} from '../types';
import { Logger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Spaced Repetition Item - tracks individual concept mastery
 */
export interface SpacedRepetitionItem {
  itemId: string;
  userId: string;
  conceptId: string; // Could be questionId, topicId, or skill
  conceptType: 'question' | 'topic' | 'skill';
  
  // SM-2 Algorithm fields (SuperMemo 2)
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

/**
 * Learning Session Plan - AI-generated study session
 */
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

/**
 * Performance Prediction Model
 */
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

/**
 * Adaptive Learning Service - Implements spaced repetition and difficulty adaptation
 */
export class AdaptiveLearningService {
  private dynamoClient: DynamoDBClient;
  private logger: Logger;
  private adaptiveTableName: string;
  private sessionsTableName: string;

  // SM-2 Algorithm constants
  private static readonly MIN_EASINESS_FACTOR = 1.3;
  private static readonly MAX_EASINESS_FACTOR = 2.5;
  private static readonly DEFAULT_EASINESS_FACTOR = 2.5;
  private static readonly MIN_INTERVAL = 1;
  private static readonly MAX_INTERVAL = 365;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.logger = new Logger('AdaptiveLearningService');
    this.adaptiveTableName = process.env.ADAPTIVE_TABLE || 'AdaptiveLearning';
    this.sessionsTableName = process.env.SESSIONS_TABLE || 'StudySessions';
  }

  // ============================================================================
  // SPACED REPETITION SYSTEM (SM-2 Algorithm)
  // ============================================================================

  /**
   * Process a user's answer and update spaced repetition schedule
   */
  async processAnswer(
    userId: string,
    questionId: string,
    isCorrect: boolean,
    responseTime: number,
    sessionContext?: {
      provider?: string;
      exam?: string;
      topic?: string;
    }
  ): Promise<SpacedRepetitionItem> {
    const startTime = Date.now();

    try {
      this.logger.info('Processing answer for spaced repetition', { userId, questionId, isCorrect, responseTime });

      // Get or create spaced repetition item
      let item = await this.getSpacedRepetitionItem(userId, questionId);
      if (!item) {
        item = await this.createSpacedRepetitionItem(userId, questionId, sessionContext);
      }

      // Update performance stats
      item.totalAttempts++;
      if (isCorrect) {
        item.correctAttempts++;
      }
      item.lastAttemptDate = new Date().toISOString();
      item.averageResponseTime = this.calculateMovingAverage(
        item.averageResponseTime,
        responseTime,
        item.totalAttempts
      );

      // Apply SM-2 algorithm
      const quality = this.calculateQuality(isCorrect, responseTime, item);
      item = this.applySM2Algorithm(item, quality);

      // Update difficulty adaptation
      await this.updateDifficultyAdaptation(item, isCorrect, responseTime);

      // Update mastery level
      item.masteryLevel = this.calculateMasteryLevel(item);
      item.updatedAt = new Date().toISOString();

      // Save to database
      await this.saveSpacedRepetitionItem(item);

      this.logger.perf('processAnswer', Date.now() - startTime, { userId, questionId, nextReview: item.nextReviewDate });
      return item;

    } catch (error) {
      this.logger.error('Failed to process answer for spaced repetition', { userId, questionId, error });
      throw error;
    }
  }

  /**
   * Get items due for review
   */
  async getDueItems(
    userId: string,
    limit: number = 20,
    priority: 'overdue' | 'due_today' | 'upcoming' | 'all' = 'all'
  ): Promise<SpacedRepetitionItem[]> {
    try {
      this.logger.info('Getting due items for review', { userId, limit, priority });

      const now = new Date();
      let filterExpression = 'userId = :userId';
      const expressionAttributeValues: any = { ':userId': userId };

      switch (priority) {
        case 'overdue':
          filterExpression += ' AND nextReviewDate < :now';
          expressionAttributeValues[':now'] = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
          break;
        case 'due_today':
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
          filterExpression += ' AND nextReviewDate BETWEEN :todayStart AND :todayEnd';
          expressionAttributeValues[':todayStart'] = todayStart;
          expressionAttributeValues[':todayEnd'] = todayEnd;
          break;
        case 'upcoming':
          filterExpression += ' AND nextReviewDate > :now AND nextReviewDate <= :upcoming';
          expressionAttributeValues[':now'] = now.toISOString();
          expressionAttributeValues[':upcoming'] = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
          break;
      }

      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.adaptiveTableName,
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: priority !== 'all' ? filterExpression.replace('userId = :userId AND ', '') : undefined,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        Limit: limit,
        ScanIndexForward: true // Sort by next review date ascending
      }));

      const items = result.Items?.map(item => unmarshall(item) as SpacedRepetitionItem) || [];
      
      // Sort by priority: overdue first, then by next review date
      return items.sort((a, b) => {
        const aOverdue = new Date(a.nextReviewDate) < now;
        const bOverdue = new Date(b.nextReviewDate) < now;
        
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        return new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime();
      });

    } catch (error) {
      this.logger.error('Failed to get due items', { userId, priority, error });
      throw error;
    }
  }

  /**
   * Generate optimized learning session plan
   */
  async generateSessionPlan(
    userId: string,
    sessionType: 'review' | 'learning' | 'mixed' | 'assessment',
    targetDuration: number = 30,
    options: {
      provider?: string;
      exam?: string;
      topics?: string[];
      difficultyLevel?: 'adaptive' | 'easy' | 'medium' | 'hard';
      newContentRatio?: number;
    } = {}
  ): Promise<LearningSessionPlan> {
    const startTime = Date.now();

    try {
      this.logger.info('Generating adaptive learning session plan', { userId, sessionType, targetDuration, options });

      // Get due items for review
      const dueItems = await this.getDueItems(userId, 50, 'all');
      const overdueItems = dueItems.filter(item => new Date(item.nextReviewDate) < new Date());
      
      // Get user's performance analytics for personalization
      const userAnalytics = await this.getUserPerformanceAnalytics(userId);
      
      // Calculate session parameters
      const targetQuestions = this.calculateTargetQuestions(targetDuration, userAnalytics);
      const difficultyDistribution = this.calculateDifficultyDistribution(sessionType, userAnalytics, options);
      const newContentRatio = options.newContentRatio || this.calculateOptimalNewContentRatio(sessionType, overdueItems.length);

      // Select items for session
      const selectedItems = await this.selectSessionItems(
        userId,
        dueItems,
        targetQuestions,
        sessionType,
        newContentRatio,
        options
      );

      // Get question pool
      const questionPool = await this.getQuestionPoolForItems(selectedItems, options);

      // Generate personalized order and difficulty progression
      const personalizedOrder = this.generatePersonalizedOrder(questionPool, userAnalytics, selectedItems);
      const difficultyProgression = this.generateDifficultyProgression(questionPool, personalizedOrder, userAnalytics);
      const breakSuggestions = this.generateBreakSuggestions(personalizedOrder.length, targetDuration);

      const sessionPlan: LearningSessionPlan = {
        planId: uuidv4(),
        userId,
        sessionType,
        selectedItems,
        questionPool,
        targetDifficulty: this.calculateTargetDifficulty(userAnalytics, options),
        adaptiveDifficultyEnabled: options.difficultyLevel === 'adaptive',
        estimatedDuration: targetDuration,
        targetQuestions,
        difficultyDistribution,
        reviewPriority: overdueItems.length > 10 ? 'overdue' : 'mixed',
        newContentRatio,
        personalizedOrder,
        difficultyProgression,
        breakSuggestions,
        createdAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours validity
      };

      this.logger.perf('generateSessionPlan', Date.now() - startTime, { 
        userId, 
        sessionType,
        questionsSelected: questionPool.length,
        overdueItems: overdueItems.length
      });

      return sessionPlan;

    } catch (error) {
      this.logger.error('Failed to generate session plan', { userId, sessionType, error });
      throw error;
    }
  }

  // ============================================================================
  // DIFFICULTY ADAPTATION SYSTEM
  // ============================================================================

  /**
   * Adapt question difficulty based on user performance
   */
  async adaptDifficulty(
    userId: string,
    currentPerformance: {
      accuracy: number;
      responseTime: number;
      streak: number;
    },
    sessionContext: {
      questionsAnswered: number;
      targetAccuracy: number;
      currentDifficulty: number;
    }
  ): Promise<{
    newDifficulty: number;
    adjustment: number;
    reasoning: string;
  }> {
    try {
      this.logger.info('Adapting difficulty', { userId, currentPerformance, sessionContext });

      const { accuracy, responseTime, streak } = currentPerformance;
      const { questionsAnswered, targetAccuracy, currentDifficulty } = sessionContext;

      // Calculate performance factors
      const accuracyFactor = this.calculateAccuracyFactor(accuracy, targetAccuracy);
      const speedFactor = this.calculateSpeedFactor(responseTime);
      const streakFactor = this.calculateStreakFactor(streak);
      const confidenceFactor = this.calculateConfidenceFactor(questionsAnswered);

      // Calculate difficulty adjustment
      const baseAdjustment = (accuracyFactor + speedFactor + streakFactor) / 3;
      const confidenceWeightedAdjustment = baseAdjustment * confidenceFactor;
      
      // Apply bounds and smoothing
      const maxAdjustment = questionsAnswered > 5 ? 15 : 10; // Larger adjustments after more questions
      const clampedAdjustment = Math.max(-maxAdjustment, Math.min(maxAdjustment, confidenceWeightedAdjustment));
      
      const newDifficulty = Math.max(0, Math.min(100, currentDifficulty + clampedAdjustment));
      
      // Generate reasoning
      const reasoning = this.generateDifficultyReasonins(
        accuracy,
        targetAccuracy,
        clampedAdjustment,
        streak,
        responseTime
      );

      return {
        newDifficulty,
        adjustment: clampedAdjustment,
        reasoning
      };

    } catch (error) {
      this.logger.error('Failed to adapt difficulty', { userId, error });
      throw error;
    }
  }

  /**
   * Get performance prediction for a user and concept
   */
  async getPerformancePrediction(
    userId: string,
    conceptId: string,
    conceptType: 'question' | 'topic' | 'skill' = 'question'
  ): Promise<PerformancePrediction> {
    try {
      this.logger.info('Calculating performance prediction', { userId, conceptId, conceptType });

      // Get spaced repetition item
      const item = await this.getSpacedRepetitionItem(userId, conceptId);
      
      // Get user analytics
      const userAnalytics = await this.getUserPerformanceAnalytics(userId);
      
      // Calculate prediction factors
      const factors = await this.calculatePredictionFactors(item, userAnalytics, conceptId);
      
      // Generate predictions
      const predictedAccuracy = this.predictAccuracy(factors);
      const predictedResponseTime = this.predictResponseTime(factors, item);
      const confidenceScore = this.calculatePredictionConfidence(factors, item);
      
      // Generate recommendations
      const recommendedAction = this.recommendAction(predictedAccuracy, item);
      const optimalTimingHours = this.calculateOptimalTiming(item, predictedAccuracy);

      const prediction: PerformancePrediction = {
        userId,
        conceptId,
        predictedAccuracy,
        predictedResponseTime,
        confidenceScore,
        factors,
        recommendedAction,
        optimalTimingHours,
        calculatedAt: new Date().toISOString()
      };

      return prediction;

    } catch (error) {
      this.logger.error('Failed to get performance prediction', { userId, conceptId, error });
      throw error;
    }
  }

  // ============================================================================
  // SM-2 ALGORITHM IMPLEMENTATION
  // ============================================================================

  /**
   * Apply SM-2 algorithm to update spaced repetition schedule
   */
  private applySM2Algorithm(item: SpacedRepetitionItem, quality: number): SpacedRepetitionItem {
    // SM-2 Algorithm implementation
    if (quality >= 3) {
      // Correct response
      if (item.repetition === 0) {
        item.interval = 1;
      } else if (item.repetition === 1) {
        item.interval = 6;
      } else {
        item.interval = Math.round(item.interval * item.easinessFactor);
      }
      item.repetition++;
    } else {
      // Incorrect response
      item.repetition = 0;
      item.interval = 1;
    }

    // Update easiness factor
    const newEasinessFactor = item.easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    item.easinessFactor = Math.max(
      AdaptiveLearningService.MIN_EASINESS_FACTOR,
      Math.min(AdaptiveLearningService.MAX_EASINESS_FACTOR, newEasinessFactor)
    );

    // Ensure minimum interval
    item.interval = Math.max(AdaptiveLearningService.MIN_INTERVAL, item.interval);
    item.interval = Math.min(AdaptiveLearningService.MAX_INTERVAL, item.interval);

    // Calculate next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + item.interval);
    item.nextReviewDate = nextReview.toISOString();

    return item;
  }

  /**
   * Calculate quality score for SM-2 algorithm (0-5 scale)
   */
  private calculateQuality(isCorrect: boolean, responseTime: number, item: SpacedRepetitionItem): number {
    if (!isCorrect) {
      // Incorrect answers get 0-2 based on response time
      const avgTime = item.averageResponseTime || 30000; // 30 seconds default
      if (responseTime > avgTime * 2) return 0; // Very slow incorrect
      if (responseTime > avgTime * 1.5) return 1; // Slow incorrect
      return 2; // Fast incorrect (might be a slip)
    }

    // Correct answers get 3-5 based on response time and difficulty
    const avgTime = item.averageResponseTime || 30000;
    if (responseTime < avgTime * 0.5) return 5; // Very fast correct
    if (responseTime < avgTime * 0.75) return 4; // Fast correct
    return 3; // Normal correct
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get spaced repetition item from database
   */
  private async getSpacedRepetitionItem(userId: string, conceptId: string): Promise<SpacedRepetitionItem | null> {
    try {
      const result = await this.dynamoClient.send(new QueryCommand({
        TableName: this.adaptiveTableName,
        KeyConditionExpression: 'userId = :userId AND conceptId = :conceptId',
        ExpressionAttributeValues: marshall({
          ':userId': userId,
          ':conceptId': conceptId
        })
      }));

      return result.Items && result.Items.length > 0 
        ? unmarshall(result.Items[0]!) as SpacedRepetitionItem 
        : null;

    } catch (error) {
      this.logger.error('Failed to get spaced repetition item', { userId, conceptId, error });
      return null;
    }
  }

  /**
   * Create new spaced repetition item
   */
  private async createSpacedRepetitionItem(
    userId: string,
    conceptId: string,
    context?: { provider?: string; exam?: string; topic?: string }
  ): Promise<SpacedRepetitionItem> {
    const now = new Date().toISOString();
    
    const item: SpacedRepetitionItem = {
      itemId: uuidv4(),
      userId,
      conceptId,
      conceptType: 'question',
      easinessFactor: AdaptiveLearningService.DEFAULT_EASINESS_FACTOR,
      interval: 1,
      repetition: 0,
      nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      totalAttempts: 0,
      correctAttempts: 0,
      lastAttemptDate: now,
      averageResponseTime: 0,
      masteryLevel: 'learning',
      currentDifficulty: 50,
      optimalDifficulty: 50,
      difficultyAdjustments: [],
      provider: context?.provider,
      exam: context?.exam,
      topic: context?.topic,
      createdAt: now,
      updatedAt: now
    };

    return item;
  }

  /**
   * Save spaced repetition item to database
   */
  private async saveSpacedRepetitionItem(item: SpacedRepetitionItem): Promise<void> {
    try {
      await this.dynamoClient.send(new PutItemCommand({
        TableName: this.adaptiveTableName,
        Item: marshall(item, { removeUndefinedValues: true })
      }));

    } catch (error) {
      this.logger.error('Failed to save spaced repetition item', { item, error });
      throw error;
    }
  }

  /**
   * Calculate moving average
   */
  private calculateMovingAverage(currentAverage: number, newValue: number, totalCount: number): number {
    if (totalCount === 1) return newValue;
    return ((currentAverage * (totalCount - 1)) + newValue) / totalCount;
  }

  /**
   * Calculate mastery level based on performance
   */
  private calculateMasteryLevel(item: SpacedRepetitionItem): 'learning' | 'reviewing' | 'mastered' {
    if (item.totalAttempts < 3) return 'learning';
    
    const accuracy = item.correctAttempts / item.totalAttempts;
    
    if (accuracy >= 0.9 && item.repetition >= 3 && item.interval >= 30) {
      return 'mastered';
    } else if (accuracy >= 0.7 && item.repetition >= 1) {
      return 'reviewing';
    }
    
    return 'learning';
  }

  /**
   * Update difficulty adaptation
   */
  private async updateDifficultyAdaptation(
    item: SpacedRepetitionItem,
    isCorrect: boolean,
    responseTime: number
  ): Promise<void> {
    const accuracy = item.correctAttempts / item.totalAttempts;
    const targetAccuracy = 0.75; // Target 75% accuracy
    
    let difficultyAdjustment = 0;
    let reason = '';

    if (accuracy > targetAccuracy + 0.1 && item.totalAttempts >= 5) {
      // User is performing well, increase difficulty
      difficultyAdjustment = 5;
      reason = 'High accuracy, increasing difficulty';
    } else if (accuracy < targetAccuracy - 0.1 && item.totalAttempts >= 3) {
      // User is struggling, decrease difficulty
      difficultyAdjustment = -5;
      reason = 'Low accuracy, decreasing difficulty';
    }

    if (Math.abs(difficultyAdjustment) > 0) {
      const adjustment: DifficultyAdjustment = {
        adjustmentDate: new Date().toISOString(),
        previousDifficulty: item.currentDifficulty,
        newDifficulty: Math.max(0, Math.min(100, item.currentDifficulty + difficultyAdjustment)),
        reason,
        performanceMetrics: {
          accuracy,
          responseTime,
          confidence: Math.min(100, (item.totalAttempts / 10) * 100) // Confidence based on attempts
        }
      };

      item.difficultyAdjustments.push(adjustment);
      item.currentDifficulty = adjustment.newDifficulty;
      
      // Keep only last 10 adjustments
      if (item.difficultyAdjustments.length > 10) {
        item.difficultyAdjustments = item.difficultyAdjustments.slice(-10);
      }
    }
  }

  // Placeholder implementations for additional methods
  private async getUserPerformanceAnalytics(userId: string): Promise<any> {
    // This would integrate with AnalyticsService
    return {
      overallAccuracy: 75,
      averageResponseTime: 25000,
      preferredDifficulty: 60,
      studyVelocity: 15
    };
  }

  private calculateTargetQuestions(duration: number, analytics: any): number {
    const baseRate = 2; // questions per minute
    return Math.floor(duration * baseRate);
  }

  private calculateDifficultyDistribution(sessionType: string, analytics: any, options: any): any {
    return { easy: 30, medium: 50, hard: 20 };
  }

  private calculateOptimalNewContentRatio(sessionType: string, overdueCount: number): number {
    if (sessionType === 'review') return 0.2;
    if (sessionType === 'learning') return 0.8;
    return overdueCount > 10 ? 0.3 : 0.5; // Mixed sessions
  }

  private async selectSessionItems(
    userId: string,
    dueItems: SpacedRepetitionItem[],
    targetQuestions: number,
    sessionType: string,
    newContentRatio: number,
    options: any
  ): Promise<SpacedRepetitionItem[]> {
    // Prioritize overdue items, then due today, then upcoming
    return dueItems.slice(0, Math.floor(targetQuestions * (1 - newContentRatio)));
  }

  private async getQuestionPoolForItems(items: SpacedRepetitionItem[], options: any): Promise<Question[]> {
    // This would fetch actual questions from QuestionService
    return []; // Placeholder
  }

  private generatePersonalizedOrder(questions: Question[], analytics: any, items: SpacedRepetitionItem[]): string[] {
    // Generate optimal question order based on difficulty progression and spaced repetition
    return questions.map(q => q.questionId);
  }

  private generateDifficultyProgression(questions: Question[], order: string[], analytics: any): number[] {
    // Generate smooth difficulty progression
    return order.map((_, index) => 50 + (index * 2)); // Gradual increase
  }

  private generateBreakSuggestions(questionCount: number, duration: number): number[] {
    const breaks = [];
    const breakInterval = Math.floor(questionCount / Math.max(1, duration / 15)); // Break every 15 minutes
    
    for (let i = breakInterval; i < questionCount; i += breakInterval) {
      breaks.push(i);
    }
    
    return breaks;
  }

  private calculateTargetDifficulty(analytics: any, options: any): number {
    return options.difficultyLevel === 'adaptive' ? analytics.preferredDifficulty || 60 : 50;
  }

  // Additional calculation methods
  private calculateAccuracyFactor(accuracy: number, target: number): number {
    const diff = accuracy - target;
    return Math.max(-10, Math.min(10, diff * 20)); // Scale to ±10 points
  }

  private calculateSpeedFactor(responseTime: number): number {
    const optimalTime = 30000; // 30 seconds
    if (responseTime < optimalTime * 0.5) return 2; // Very fast
    if (responseTime < optimalTime) return 1; // Fast
    if (responseTime < optimalTime * 2) return 0; // Normal
    return -1; // Slow
  }

  private calculateStreakFactor(streak: number): number {
    return Math.min(5, streak); // Up to 5 points for streak
  }

  private calculateConfidenceFactor(questionsAnswered: number): number {
    return Math.min(1, questionsAnswered / 10); // Full confidence after 10 questions
  }

  private generateDifficultyReasonins(
    accuracy: number,
    target: number,
    adjustment: number,
    streak: number,
    responseTime: number
  ): string {
    if (adjustment > 5) return `High accuracy (${Math.round(accuracy)}%) and good response time - increasing difficulty`;
    if (adjustment < -5) return `Low accuracy (${Math.round(accuracy)}%) - decreasing difficulty to build confidence`;
    if (streak > 5) return `Good streak of ${streak} correct answers - slight difficulty increase`;
    return 'Maintaining current difficulty level';
  }

  private async calculatePredictionFactors(item: SpacedRepetitionItem | null, analytics: any, conceptId: string): Promise<any> {
    return {
      historicalPerformance: item ? (item.correctAttempts / Math.max(1, item.totalAttempts)) * 100 : 50,
      timeSinceLastPractice: item ? Math.min(100, (Date.now() - new Date(item.lastAttemptDate).getTime()) / (24 * 60 * 60 * 1000)) : 100,
      conceptDifficulty: item?.currentDifficulty || 50,
      userSkillLevel: analytics.overallAccuracy || 50,
      contextualFactors: 75 // Time of day, recent performance, etc.
    };
  }

  private predictAccuracy(factors: any): number {
    return Math.max(0, Math.min(100,
      factors.historicalPerformance * 0.4 +
      (100 - factors.timeSinceLastPractice) * 0.2 +
      (100 - factors.conceptDifficulty) * 0.15 +
      factors.userSkillLevel * 0.15 +
      factors.contextualFactors * 0.1
    ));
  }

  private predictResponseTime(factors: any, item: SpacedRepetitionItem | null): number {
    const baseTime = 30000; // 30 seconds
    const difficultyMultiplier = factors.conceptDifficulty / 50;
    const skillMultiplier = Math.max(0.5, (100 - factors.userSkillLevel) / 100);
    
    return Math.round(baseTime * difficultyMultiplier * skillMultiplier);
  }

  private calculatePredictionConfidence(factors: any, item: SpacedRepetitionItem | null): number {
    if (!item || item.totalAttempts < 3) return 30; // Low confidence for new items
    if (item.totalAttempts < 10) return 60; // Medium confidence
    return 85; // High confidence with sufficient data
  }

  private recommendAction(predictedAccuracy: number, item: SpacedRepetitionItem | null): 'practice' | 'review' | 'skip' | 'intensive_study' {
    if (!item) return 'practice';
    
    if (predictedAccuracy < 40) return 'intensive_study';
    if (predictedAccuracy < 70) return 'practice';
    if (item.masteryLevel === 'mastered') return 'review';
    return 'practice';
  }

  private calculateOptimalTiming(item: SpacedRepetitionItem | null, predictedAccuracy: number): number {
    if (!item) return 24; // 1 day for new items
    
    const baseInterval = item.interval * 24; // Convert days to hours
    const accuracyMultiplier = predictedAccuracy / 100;
    
    return Math.round(baseInterval * accuracyMultiplier);
  }
}