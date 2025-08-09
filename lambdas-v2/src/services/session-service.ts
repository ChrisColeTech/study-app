import { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { 
  StudySession, 
  Question, 
  SessionConfiguration, 
  SessionProgress, 
  SessionAnalytics, 
  SessionAnswer, 
  SessionState, 
  SessionResults, 
  CreateSessionRequest,
  UpdateSessionRequest,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  Achievement,
  QuestionFilter
} from '../types';
import { QuestionService } from './question-service';
import { Logger } from '../shared/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Session Service - Comprehensive study session management
 * Handles session lifecycle, question selection, answer processing, and progress tracking
 */
export class SessionService {
  private dynamoClient: DynamoDBClient;
  private questionService: QuestionService;
  private logger: Logger;
  private sessionsTableName: string;
  private answersTableName: string;

  constructor() {
    this.dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.questionService = new QuestionService();
    this.logger = new Logger('SessionService');
    this.sessionsTableName = process.env.SESSIONS_TABLE_NAME || 'StudySessions';
    this.answersTableName = process.env.ANSWERS_TABLE_NAME || 'SessionAnswers';
  }

  /**
   * Create a new study session with intelligent question selection
   */
  async createSession(userId: string, request: CreateSessionRequest): Promise<StudySession> {
    const startTime = Date.now();
    const sessionId = uuidv4();

    try {
      this.logger.info('Creating new session', { userId, sessionId, request });

      // Default session configuration
      const defaultConfig: SessionConfiguration = {
        questionCount: 20,
        timeLimit: undefined,
        difficulty: undefined,
        topics: undefined,
        serviceCategories: undefined,
        awsServices: undefined,
        questionTypes: undefined,
        shuffleQuestions: true,
        immediateResultsFeedback: true,
        allowReview: true,
        ...request.config
      };

      // Select questions using intelligent algorithms
      const selectedQuestions = await this.selectQuestionsForSession(
        request.provider,
        request.exam,
        defaultConfig
      );

      if (selectedQuestions.length === 0) {
        throw new Error(`No questions found for ${request.provider}/${request.exam} with specified criteria`);
      }

      // Adjust question count to actual available questions
      const actualQuestionCount = Math.min(defaultConfig.questionCount, selectedQuestions.length);
      const finalQuestions = selectedQuestions.slice(0, actualQuestionCount);

      // Initialize session analytics
      const initialAnalytics: SessionAnalytics = {
        difficultyBreakdown: {
          easy: { correct: 0, total: 0 },
          medium: { correct: 0, total: 0 },
          hard: { correct: 0, total: 0 }
        },
        topicPerformance: {},
        servicePerformance: {},
        questionTypePerformance: {
          single_choice: { correct: 0, total: 0 },
          multiple_choice: { correct: 0, total: 0 }
        },
        timeAnalytics: {
          fastestAnswer: 0,
          slowestAnswer: 0,
          averageAnswerTime: 0
        }
      };

      // Initialize session progress
      const initialProgress: SessionProgress = {
        percentage: 0,
        questionsCorrect: 0,
        questionsIncorrect: 0,
        questionsSkipped: 0,
        averageTimePerQuestion: 0,
        timeSpent: 0,
        streakCurrent: 0,
        streakBest: 0
      };

      // Create session object
      const now = new Date().toISOString();
      const session: StudySession = {
        sessionId,
        userId,
        provider: request.provider,
        exam: request.exam,
        status: 'active',
        startTime: now,
        totalQuestions: actualQuestionCount,
        questionsAnswered: 0,
        correctAnswers: 0,
        currentQuestionIndex: 0,
        selectedQuestionIds: finalQuestions.map(q => q.questionId),
        sessionConfig: { ...defaultConfig, questionCount: actualQuestionCount },
        progress: initialProgress,
        analytics: initialAnalytics,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        expiresAt: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
      };

      // Save session to DynamoDB
      await this.saveSession(session);

      this.logger.perf('createSession', Date.now() - startTime, {
        sessionId,
        userId,
        questionCount: actualQuestionCount,
        provider: request.provider,
        exam: request.exam
      });

      return session;

    } catch (error) {
      this.logger.error('Failed to create session', {
        userId,
        sessionId,
        request,
        error
      });
      throw error;
    }
  }

  /**
   * Get session by ID with current state
   */
  async getSession(sessionId: string, userId: string): Promise<StudySession | null> {
    try {
      const session = await this.loadSession(sessionId, userId);
      if (!session) {
        return null;
      }

      // Update last activity
      session.lastActivityAt = new Date().toISOString();
      await this.saveSession(session);

      return session;
    } catch (error) {
      this.logger.error('Failed to get session', { sessionId, userId, error });
      throw error;
    }
  }

  /**
   * Get current session state with question
   */
  async getSessionState(sessionId: string, userId: string): Promise<SessionState | null> {
    try {
      const session = await this.getSession(sessionId, userId);
      if (!session || session.status !== 'active') {
        return null;
      }

      // Get current question
      const currentQuestionId = session.selectedQuestionIds[session.currentQuestionIndex];
      if (!currentQuestionId) {
        return null;
      }

      const currentQuestion = await this.questionService.getQuestion(
        session.provider,
        session.exam,
        currentQuestionId
      );

      if (!currentQuestion) {
        this.logger.error('Current question not found', {
          sessionId,
          userId,
          questionId: currentQuestionId,
          questionIndex: session.currentQuestionIndex
        });
        return null;
      }

      // Calculate time remaining if timed session
      let timeRemaining: number | undefined;
      if (session.sessionConfig.timeLimit) {
        const sessionStartTime = new Date(session.startTime).getTime();
        const timeLimit = session.sessionConfig.timeLimit * 60 * 1000; // convert to milliseconds
        const timeElapsed = Date.now() - sessionStartTime;
        timeRemaining = Math.max(0, Math.floor((timeLimit - timeElapsed) / 1000)); // in seconds
      }

      return {
        sessionId,
        currentQuestion,
        questionIndex: session.currentQuestionIndex,
        progress: session.progress,
        timeRemaining,
        canGoBack: session.sessionConfig.allowReview && session.currentQuestionIndex > 0,
        canSkip: true
      };

    } catch (error) {
      this.logger.error('Failed to get session state', { sessionId, userId, error });
      throw error;
    }
  }

  /**
   * Submit an answer for the current question
   */
  async submitAnswer(
    sessionId: string, 
    userId: string, 
    request: SubmitAnswerRequest
  ): Promise<SubmitAnswerResponse> {
    const startTime = Date.now();

    try {
      this.logger.info('Submitting answer', { sessionId, userId, request });

      const session = await this.loadSession(sessionId, userId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.status !== 'active') {
        throw new Error(`Session is ${session.status}, cannot submit answers`);
      }

      // Get the question
      const question = await this.questionService.getQuestion(
        session.provider,
        session.exam,
        request.questionId
      );

      if (!question) {
        throw new Error('Question not found');
      }

      // Validate that this is the current question
      const currentQuestionId = session.selectedQuestionIds[session.currentQuestionIndex];
      if (currentQuestionId !== request.questionId) {
        throw new Error('Question ID does not match current question');
      }

      // Process the answer
      const isCorrect = this.validateAnswer(question, request.answer);
      const timeSpent = request.timeSpent || 30; // default 30 seconds if not provided

      // Create answer record
      const answer: SessionAnswer = {
        questionId: request.questionId,
        questionIndex: session.currentQuestionIndex,
        userAnswer: request.answer,
        isCorrect,
        timeSpent,
        submittedAt: new Date().toISOString(),
        explanation: question.explanation
      };

      // Save answer
      await this.saveAnswer(sessionId, userId, answer);

      // Update session progress and analytics
      await this.updateSessionProgress(session, question, answer);

      // Move to next question
      session.currentQuestionIndex++;
      session.questionsAnswered++;
      if (isCorrect) {
        session.correctAnswers++;
      }

      // Check if session is complete
      const sessionCompleted = session.currentQuestionIndex >= session.totalQuestions;
      if (sessionCompleted) {
        session.status = 'completed';
        session.endTime = new Date().toISOString();
      }

      session.updatedAt = new Date().toISOString();
      session.lastActivityAt = new Date().toISOString();

      // Save updated session
      await this.saveSession(session);

      // Prepare response
      let nextQuestion: Question | undefined;
      if (!sessionCompleted && session.currentQuestionIndex < session.selectedQuestionIds.length) {
        const nextQuestionId = session.selectedQuestionIds[session.currentQuestionIndex];
        if (nextQuestionId) {
          nextQuestion = await this.questionService.getQuestion(
            session.provider,
            session.exam,
            nextQuestionId
          ) || undefined;
        }
      }

      const response: SubmitAnswerResponse = {
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: session.sessionConfig.immediateResultsFeedback ? question.explanation : undefined,
        nextQuestion: nextQuestion,
        sessionProgress: session.progress,
        sessionCompleted
      };

      this.logger.perf('submitAnswer', Date.now() - startTime, {
        sessionId,
        userId,
        questionId: request.questionId,
        isCorrect,
        sessionCompleted
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to submit answer', {
        sessionId,
        userId,
        request,
        error
      });
      throw error;
    }
  }

  /**
   * Update session configuration
   */
  async updateSession(
    sessionId: string, 
    userId: string, 
    request: UpdateSessionRequest
  ): Promise<StudySession> {
    try {
      const session = await this.loadSession(sessionId, userId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Update configuration
      if (request.config) {
        session.sessionConfig = { ...session.sessionConfig, ...request.config };
      }

      // Update status
      if (request.status) {
        session.status = request.status;
      }

      session.updatedAt = new Date().toISOString();
      session.lastActivityAt = new Date().toISOString();

      await this.saveSession(session);

      this.logger.info('Session updated', { sessionId, userId, request });

      return session;

    } catch (error) {
      this.logger.error('Failed to update session', { sessionId, userId, request, error });
      throw error;
    }
  }

  /**
   * Complete session and generate results
   */
  async completeSession(sessionId: string, userId: string): Promise<SessionResults> {
    try {
      const session = await this.loadSession(sessionId, userId);
      if (!session) {
        throw new Error('Session not found');
      }

      if (session.status === 'completed') {
        // Session already completed, return existing results
        return this.generateSessionResults(session);
      }

      // Mark session as completed
      session.status = 'completed';
      session.endTime = new Date().toISOString();
      session.updatedAt = new Date().toISOString();

      await this.saveSession(session);

      // Generate comprehensive results
      const results = this.generateSessionResults(session);

      this.logger.info('Session completed', {
        sessionId,
        userId,
        finalScore: results.finalScore,
        questionsCorrect: results.questionsCorrect,
        questionsTotal: results.questionsTotal
      });

      return results;

    } catch (error) {
      this.logger.error('Failed to complete session', { sessionId, userId, error });
      throw error;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string, userId: string): Promise<void> {
    try {
      await this.dynamoClient.send(new DeleteItemCommand({
        TableName: this.sessionsTableName,
        Key: marshall({
          sessionId,
          userId
        })
      }));

      this.logger.info('Session deleted', { sessionId, userId });

    } catch (error) {
      this.logger.error('Failed to delete session', { sessionId, userId, error });
      throw error;
    }
  }

  /**
   * List user sessions with pagination
   */
  async listUserSessions(
    userId: string, 
    status?: string, 
    limit: number = 20,
    lastEvaluatedKey?: any
  ): Promise<{
    sessions: StudySession[];
    lastEvaluatedKey?: any;
  }> {
    try {
      let filterExpression: string | undefined;
      let expressionAttributeValues: any = {
        ':userId': { S: userId }
      };

      if (status) {
        filterExpression = '#status = :status';
        expressionAttributeValues[':status'] = { S: status };
      }

      const command = new QueryCommand({
        TableName: this.sessionsTableName,
        IndexName: 'UserIdIndex', // Assuming GSI on userId
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: status ? { '#status': 'status' } : undefined,
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: false // Most recent first
      });

      const result = await this.dynamoClient.send(command);

      const sessions = result.Items?.map(item => unmarshall(item) as StudySession) || [];

      return {
        sessions,
        lastEvaluatedKey: result.LastEvaluatedKey
      };

    } catch (error) {
      this.logger.error('Failed to list user sessions', { userId, status, limit, error });
      throw error;
    }
  }

  /**
   * Intelligent question selection algorithms
   */
  private async selectQuestionsForSession(
    provider: string,
    exam: string,
    config: SessionConfiguration
  ): Promise<Question[]> {
    try {
      // Build filter from config
      const filter: QuestionFilter = {
        difficulty: config.difficulty,
        topics: config.topics,
        serviceCategory: config.serviceCategories?.[0], // For now, take first category
        awsServices: config.awsServices,
        questionType: config.questionTypes?.[0], // For now, take first type
        hasExplanation: config.immediateResultsFeedback ? true : undefined
      };

      // Get filtered questions
      const questions = await this.questionService.getRandomQuestions(
        provider,
        exam,
        config.questionCount * 2, // Get more than needed for better selection
        filter
      );

      if (questions.length === 0) {
        // Fallback: get any questions if no filter match
        return await this.questionService.getRandomQuestions(provider, exam, config.questionCount);
      }

      // Apply intelligent selection algorithms
      let selectedQuestions = questions;

      // Algorithm 1: Ensure difficulty distribution if not specified
      if (!config.difficulty && questions.length >= config.questionCount) {
        selectedQuestions = this.balanceDifficultyDistribution(questions, config.questionCount);
      }

      // Algorithm 2: Ensure topic diversity
      if (selectedQuestions.length >= config.questionCount) {
        selectedQuestions = this.ensureTopicDiversity(selectedQuestions, config.questionCount);
      }

      // Algorithm 3: Shuffle if requested
      if (config.shuffleQuestions) {
        selectedQuestions = this.shuffleArray(selectedQuestions);
      }

      // Take final count
      return selectedQuestions.slice(0, config.questionCount);

    } catch (error) {
      this.logger.error('Failed to select questions for session', {
        provider,
        exam,
        config,
        error
      });
      throw error;
    }
  }

  /**
   * Balance difficulty distribution in question selection
   */
  private balanceDifficultyDistribution(questions: Question[], targetCount: number): Question[] {
    const easyQuestions = questions.filter(q => q.difficulty === 'easy');
    const mediumQuestions = questions.filter(q => q.difficulty === 'medium');
    const hardQuestions = questions.filter(q => q.difficulty === 'hard');

    // Aim for 40% easy, 40% medium, 20% hard
    const easyCount = Math.floor(targetCount * 0.4);
    const mediumCount = Math.floor(targetCount * 0.4);
    const hardCount = targetCount - easyCount - mediumCount;

    const selected: Question[] = [];

    // Select questions from each difficulty
    selected.push(...easyQuestions.slice(0, easyCount));
    selected.push(...mediumQuestions.slice(0, mediumCount));
    selected.push(...hardQuestions.slice(0, hardCount));

    // Fill remaining slots if needed
    const remaining = targetCount - selected.length;
    if (remaining > 0) {
      const unusedQuestions = questions.filter(q => !selected.includes(q));
      selected.push(...unusedQuestions.slice(0, remaining));
    }

    return selected;
  }

  /**
   * Ensure topic diversity in question selection
   */
  private ensureTopicDiversity(questions: Question[], targetCount: number): Question[] {
    // Group questions by topic
    const topicGroups: { [topic: string]: Question[] } = {};
    questions.forEach(question => {
      question.topics.forEach(topic => {
        if (!topicGroups[topic]) {
          topicGroups[topic] = [];
        }
        topicGroups[topic].push(question);
      });
    });

    const topics = Object.keys(topicGroups);
    const questionsPerTopic = Math.max(1, Math.floor(targetCount / topics.length));
    
    const selected: Question[] = [];
    const usedQuestions = new Set<string>();

    // Select questions from each topic
    topics.forEach(topic => {
      const topicQuestions = topicGroups[topic]?.filter(q => !usedQuestions.has(q.questionId)) || [];
      const selectedFromTopic = topicQuestions.slice(0, questionsPerTopic);
      
      selectedFromTopic.forEach(q => {
        if (selected.length < targetCount) {
          selected.push(q);
          usedQuestions.add(q.questionId);
        }
      });
    });

    // Fill remaining slots
    const remaining = targetCount - selected.length;
    if (remaining > 0) {
      const unusedQuestions = questions.filter(q => !usedQuestions.has(q.questionId));
      selected.push(...unusedQuestions.slice(0, remaining));
    }

    return selected;
  }

  /**
   * Validate user answer against correct answer
   */
  private validateAnswer(question: Question, userAnswer: string | string[]): boolean {
    const correctAnswer = question.correctAnswer;

    if (question.questionType === 'single_choice') {
      return typeof userAnswer === 'string' && userAnswer === correctAnswer;
    } else if (question.questionType === 'multiple_choice') {
      if (typeof userAnswer === 'string' || !Array.isArray(correctAnswer)) {
        return false;
      }
      
      const userSet = new Set(Array.isArray(userAnswer) ? userAnswer : [userAnswer]);
      const correctSet = new Set(Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer]);
      
      return userSet.size === correctSet.size && 
             [...userSet].every(answer => correctSet.has(answer));
    }

    return false;
  }

  /**
   * Update session progress and analytics after an answer
   */
  private async updateSessionProgress(
    session: StudySession, 
    question: Question, 
    answer: SessionAnswer
  ): Promise<void> {
    const progress = session.progress;
    const analytics = session.analytics;

    // Update basic progress
    if (answer.isCorrect) {
      progress.questionsCorrect++;
      progress.streakCurrent++;
      progress.streakBest = Math.max(progress.streakBest, progress.streakCurrent);
    } else {
      progress.questionsIncorrect++;
      progress.streakCurrent = 0;
    }

    // Update time tracking
    progress.timeSpent += answer.timeSpent;
    progress.averageTimePerQuestion = progress.timeSpent / (session.questionsAnswered + 1);
    progress.percentage = ((session.questionsAnswered + 1) / session.totalQuestions) * 100;

    // Update analytics - difficulty breakdown
    const difficulty = question.difficulty || 'medium';
    analytics.difficultyBreakdown[difficulty].total++;
    if (answer.isCorrect) {
      analytics.difficultyBreakdown[difficulty].correct++;
    }

    // Update analytics - topic performance
    question.topics.forEach(topic => {
      if (!analytics.topicPerformance[topic]) {
        analytics.topicPerformance[topic] = { correct: 0, total: 0 };
      }
      analytics.topicPerformance[topic].total++;
      if (answer.isCorrect) {
        analytics.topicPerformance[topic].correct++;
      }
    });

    // Update analytics - service performance
    if (question.awsServices) {
      question.awsServices.forEach(service => {
        if (!analytics.servicePerformance[service]) {
          analytics.servicePerformance[service] = { correct: 0, total: 0 };
        }
        analytics.servicePerformance[service].total++;
        if (answer.isCorrect) {
          analytics.servicePerformance[service].correct++;
        }
      });
    }

    // Update analytics - question type performance
    analytics.questionTypePerformance[question.questionType].total++;
    if (answer.isCorrect) {
      analytics.questionTypePerformance[question.questionType].correct++;
    }

    // Update analytics - time analytics
    if (analytics.timeAnalytics.fastestAnswer === 0 || answer.timeSpent < analytics.timeAnalytics.fastestAnswer) {
      analytics.timeAnalytics.fastestAnswer = answer.timeSpent;
    }
    if (answer.timeSpent > analytics.timeAnalytics.slowestAnswer) {
      analytics.timeAnalytics.slowestAnswer = answer.timeSpent;
    }
    analytics.timeAnalytics.averageAnswerTime = progress.averageTimePerQuestion;
  }

  /**
   * Generate comprehensive session results
   */
  private generateSessionResults(session: StudySession): SessionResults {
    const finalScore = session.totalQuestions > 0 
      ? Math.round((session.correctAnswers / session.totalQuestions) * 100)
      : 0;

    // Determine grade based on score
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (finalScore >= 90) grade = 'A';
    else if (finalScore >= 80) grade = 'B';
    else if (finalScore >= 70) grade = 'C';
    else if (finalScore >= 60) grade = 'D';
    else grade = 'F';

    const passed = finalScore >= 70; // 70% passing score

    // Generate recommendations
    const recommendations = this.generateRecommendations(session);

    return {
      sessionId: session.sessionId,
      finalScore,
      questionsCorrect: session.correctAnswers,
      questionsTotal: session.totalQuestions,
      timeSpent: session.progress.timeSpent,
      performance: session.analytics,
      grade,
      passed,
      recommendations,
      completedAt: session.endTime || new Date().toISOString()
    };
  }

  /**
   * Generate personalized recommendations based on session performance
   */
  private generateRecommendations(session: StudySession): string[] {
    const recommendations: string[] = [];
    const analytics = session.analytics;

    // Check difficulty performance
    const difficulties = ['easy', 'medium', 'hard'] as const;
    difficulties.forEach(difficulty => {
      const perf = analytics.difficultyBreakdown[difficulty];
      if (perf.total > 0 && (perf.correct / perf.total) < 0.7) {
        recommendations.push(`Focus on ${difficulty} level questions to improve your foundation`);
      }
    });

    // Check topic performance
    const weakTopics = Object.entries(analytics.topicPerformance)
      .filter(([_, perf]) => perf.total > 0 && (perf.correct / perf.total) < 0.6)
      .map(([topic, _]) => topic)
      .slice(0, 3); // Top 3 weak topics

    if (weakTopics.length > 0) {
      recommendations.push(`Review these topics: ${weakTopics.join(', ')}`);
    }

    // Check answer speed
    if (session.progress.averageTimePerQuestion > 120) { // 2 minutes
      recommendations.push('Try to improve your answer speed with more practice');
    } else if (session.progress.averageTimePerQuestion < 30) { // 30 seconds
      recommendations.push('Take more time to carefully read questions and options');
    }

    // Check overall performance
    const overallAccuracy = session.correctAnswers / session.totalQuestions;
    if (overallAccuracy < 0.7) {
      recommendations.push('Consider reviewing fundamental concepts before attempting more practice sessions');
    } else if (overallAccuracy > 0.9) {
      recommendations.push('Excellent performance! Consider tackling more challenging topics or exam simulations');
    }

    return recommendations;
  }

  /**
   * Save session to DynamoDB
   */
  private async saveSession(session: StudySession): Promise<void> {
    try {
      await this.dynamoClient.send(new PutItemCommand({
        TableName: this.sessionsTableName,
        Item: marshall(session, { removeUndefinedValues: true })
      }));
    } catch (error) {
      this.logger.error('Failed to save session', { sessionId: session.sessionId, error });
      throw error;
    }
  }

  /**
   * Load session from DynamoDB
   */
  private async loadSession(sessionId: string, userId: string): Promise<StudySession | null> {
    try {
      const result = await this.dynamoClient.send(new GetItemCommand({
        TableName: this.sessionsTableName,
        Key: marshall({
          sessionId,
          userId
        })
      }));

      return result.Item ? unmarshall(result.Item) as StudySession : null;

    } catch (error) {
      this.logger.error('Failed to load session', { sessionId, userId, error });
      throw error;
    }
  }

  /**
   * Save answer to DynamoDB
   */
  private async saveAnswer(sessionId: string, userId: string, answer: SessionAnswer): Promise<void> {
    try {
      await this.dynamoClient.send(new PutItemCommand({
        TableName: this.answersTableName,
        Item: marshall({
          sessionId,
          userId,
          ...answer,
          expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
        }, { removeUndefinedValues: true })
      }));
    } catch (error) {
      this.logger.error('Failed to save answer', { sessionId, userId, answer, error });
      throw error;
    }
  }

  /**
   * Utility: Shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }
}