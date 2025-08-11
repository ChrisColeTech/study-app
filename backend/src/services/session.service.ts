// Session service for Study App V3 Backend
// Phase 15: Session Creation Feature

import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { 
  StudySession, 
  SessionQuestion
} from '../shared/types/domain.types';
import { Question } from '../shared/types/question.types';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  QuestionResponse,
  SessionQuestionOption,
  ISessionService
} from '../shared/types/session.types';
import { ServiceFactory } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

// Re-export the interface for ServiceFactory
export type { ISessionService };

export class SessionService implements ISessionService {
  private logger = createLogger({ component: 'SessionService' });
  private dynamoClient: DynamoDBDocumentClient;
  private serviceFactory: ServiceFactory;
  private studySessionsTable: string;

  constructor(dynamoClient: DynamoDBDocumentClient, serviceFactory: ServiceFactory, studySessionsTable: string) {
    this.dynamoClient = dynamoClient;
    this.serviceFactory = serviceFactory;
    this.studySessionsTable = studySessionsTable;
  }

  /**
   * Create a new study session with configuration
   * Phase 15: Session Creation Feature
   */
  async createSession(userId: string, request: CreateSessionRequest): Promise<CreateSessionResponse> {
    this.logger.info('Creating new session', { 
      userId,
      examId: request.examId,
      providerId: request.providerId,
      sessionType: request.sessionType,
      questionCount: request.questionCount,
      topics: request.topics,
      difficulty: request.difficulty,
      timeLimit: request.timeLimit
    });

    try {
      // Validate the request
      await this.validateSessionRequest(request);

      // Get questions for the session based on configuration
      const questions = await this.getQuestionsForSession(request);

      if (questions.length === 0) {
        throw new Error('No questions found matching the specified criteria');
      }

      // Limit to requested question count or available questions
      const requestedCount = request.questionCount || questions.length;
      const sessionQuestions = this.selectSessionQuestions(questions, requestedCount);

      // Create session ID and timestamps
      const sessionId = uuidv4();
      const now = new Date().toISOString();

      // Create session object
      const session: StudySession = {
        sessionId,
        userId,
        examId: request.examId,
        providerId: request.providerId,
        startTime: now,
        status: 'active',
        questions: sessionQuestions.map(q => ({
          questionId: q.questionId,
          correctAnswer: [q.correctAnswer.toString()], // Convert to string array format
          timeSpent: 0,
          skipped: false,
          markedForReview: false
        })),
        currentQuestionIndex: 0,
        totalQuestions: sessionQuestions.length,
        correctAnswers: 0,
        createdAt: now,
        updatedAt: now
      };

      // Store session in DynamoDB
      await this.storeSession(session);

      // Prepare question responses (without correct answers or explanations)
      const questionResponses: QuestionResponse[] = sessionQuestions.map(q => ({
        questionId: q.questionId,
        text: q.questionText,
        options: q.options.map((opt, index) => ({
          id: `option-${index}`,
          text: opt
        })),
        topicId: q.topicId || 'unknown',
        topicName: q.topicId || 'Unknown Topic', // Fallback to topicId if name not available
        difficulty: this.mapDifficultyToSessionFormat(q.difficulty),
        timeAllowed: this.calculateTimeAllowed(q.difficulty),
        markedForReview: false
      }));

      const response: CreateSessionResponse = {
        session,
        questions: questionResponses
      };

      this.logger.info('Session created successfully', { 
        sessionId: session.sessionId,
        userId,
        totalQuestions: session.totalQuestions,
        providerId: session.providerId,
        examId: session.examId
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to create session', error as Error, { 
        userId,
        request
      });
      throw error;
    }
  }

  /**
   * Validate session creation request
   */
  private async validateSessionRequest(request: CreateSessionRequest): Promise<void> {
    // Validate provider exists
    const providerService = this.serviceFactory.getProviderService();
    try {
      await providerService.getProvider({ id: request.providerId });
    } catch (error) {
      throw new Error(`Invalid provider: ${request.providerId}`);
    }

    // Validate exam exists for the provider
    const examService = this.serviceFactory.getExamService();
    try {
      const examResponse = await examService.getExam(request.examId, { 
        includeProvider: true
      });
      if (examResponse.exam.providerId !== request.providerId) {
        throw new Error(`Exam ${request.examId} does not belong to provider ${request.providerId}`);
      }
    } catch (error) {
      throw new Error(`Invalid exam: ${request.examId} for provider ${request.providerId}`);
    }

    // Validate topics if provided
    if (request.topics && request.topics.length > 0) {
      const topicService = this.serviceFactory.getTopicService();
      for (const topicId of request.topics) {
        try {
          const topicResponse = await topicService.getTopic({ 
            id: topicId
          });
          if (topicResponse.topic.examId !== request.examId) {
            throw new Error(`Topic ${topicId} does not belong to exam ${request.examId}`);
          }
        } catch (error) {
          throw new Error(`Invalid topic: ${topicId} for exam ${request.examId}`);
        }
      }
    }

    // Validate question count
    if (request.questionCount && (request.questionCount < 1 || request.questionCount > 200)) {
      throw new Error('Question count must be between 1 and 200');
    }

    // Validate time limit
    if (request.timeLimit && (request.timeLimit < 5 || request.timeLimit > 300)) {
      throw new Error('Time limit must be between 5 and 300 minutes');
    }
  }

  /**
   * Get questions for the session based on configuration
   */
  private async getQuestionsForSession(request: CreateSessionRequest): Promise<Question[]> {
    const questionService = this.serviceFactory.getQuestionService();

    // Build question request parameters
    const questionRequest: any = {
      provider: request.providerId,
      exam: request.examId,
      difficulty: request.difficulty,
      includeExplanations: true,
      includeMetadata: true,
      limit: request.questionCount || 100, // Get more than needed for randomization
      offset: 0
    };

    // Only add topic if single topic specified
    if (request.topics && request.topics.length === 1) {
      questionRequest.topic = request.topics[0];
    }

    this.logger.debug('Fetching questions for session', questionRequest);

    const questionResponse = await questionService.getQuestions(questionRequest);

    let questions = questionResponse.questions;

    // Filter by multiple topics if specified
    if (request.topics && request.topics.length > 1) {
      questions = questions.filter(q => q.topicId && request.topics!.includes(q.topicId));
    }

    this.logger.debug('Questions retrieved for session', { 
      totalAvailable: questionResponse.total,
      filtered: questions.length,
      requested: request.questionCount
    });

    return questions;
  }

  /**
   * Select and randomize questions for the session
   */
  private selectSessionQuestions(questions: Question[], count: number): Question[] {
    // Randomize question order
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    
    // Take the requested number of questions
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Store session in DynamoDB
   */
  private async storeSession(session: StudySession): Promise<void> {
    this.logger.debug('Storing session in DynamoDB', { 
      sessionId: session.sessionId,
      tableName: this.studySessionsTable 
    });

    const command = new PutCommand({
      TableName: this.studySessionsTable,
      Item: session,
      ConditionExpression: 'attribute_not_exists(sessionId)' // Prevent overwriting existing sessions
    });

    try {
      await this.dynamoClient.send(command);
      this.logger.debug('Session stored successfully', { sessionId: session.sessionId });
    } catch (error) {
      this.logger.error('Failed to store session in DynamoDB', error as Error, { 
        sessionId: session.sessionId 
      });
      
      if ((error as any).name === 'ConditionalCheckFailedException') {
        throw new Error('Session with this ID already exists');
      }
      
      throw new Error('Failed to store session');
    }
  }

  /**
   * Map question difficulty to session format
   */
  private mapDifficultyToSessionFormat(difficulty: string): 'easy' | 'medium' | 'hard' {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
      case 'easy':
        return 'easy';
      case 'advanced':
      case 'expert':
      case 'hard':
        return 'hard';
      case 'intermediate':
      case 'medium':
      default:
        return 'medium';
    }
  }

  /**
   * Calculate time allowed per question based on difficulty
   */
  private calculateTimeAllowed(difficulty: string): number {
    switch (this.mapDifficultyToSessionFormat(difficulty)) {
      case 'easy':
        return 60; // 1 minute
      case 'hard':
        return 180; // 3 minutes  
      case 'medium':
      default:
        return 120; // 2 minutes
    }
  }
}