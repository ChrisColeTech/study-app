// Session service for Study App V3 Backend
// Phase 15: Session Creation Feature
// Phase 17: Session Update Feature

import { v4 as uuidv4 } from 'uuid';
import { 
  StudySession, 
  SessionQuestion
} from '../shared/types/domain.types';
import { Question } from '../shared/types/question.types';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  QuestionResponse,
  SessionQuestionOption,
  SessionProgress,
  ISessionService
} from '../shared/types/session.types';
import { ISessionRepository } from '../repositories/session.repository';
import { IProviderService } from './provider.service';
import { IExamService } from './exam.service';
import { ITopicService } from './topic.service';
import { IQuestionService } from './question.service';
import { createLogger } from '../shared/logger';

// Re-export the interface for ServiceFactory
export type { ISessionService };

export class SessionService implements ISessionService {
  private logger = createLogger({ component: 'SessionService' });

  constructor(
    private sessionRepository: ISessionRepository,
    private providerService: IProviderService,
    private examService: IExamService,
    private topicService: ITopicService,
    private questionService: IQuestionService
  ) {}

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

      // Store session using repository
      const createdSession = await this.sessionRepository.create(session);

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
        session: createdSession,
        questions: questionResponses
      };

      this.logger.info('Session created successfully', { 
        sessionId: createdSession.sessionId,
        userId,
        totalQuestions: createdSession.totalQuestions,
        providerId: createdSession.providerId,
        examId: createdSession.examId
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
   * Get an existing study session
   * Phase 16: Session Retrieval Feature
   */
  async getSession(sessionId: string, userId: string): Promise<GetSessionResponse> {
    this.logger.info('Retrieving session', { sessionId, userId });

    try {
      // Retrieve session using repository
      const session = await this.sessionRepository.findById(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      // Verify session belongs to the user
      if (session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      // Get full question details for current session
      const questions = await this.getSessionQuestionsWithDetails(session);

      // Calculate session progress
      const progress = this.calculateSessionProgress(session);

      const response: GetSessionResponse = {
        session,
        questions,
        progress
      };

      this.logger.info('Session retrieved successfully', { 
        sessionId: session.sessionId,
        userId,
        status: session.status,
        currentQuestion: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to retrieve session', error as Error, { 
        sessionId,
        userId
      });
      throw error;
    }
  }

  /**
   * Update session (Phase 17: Session Update Feature)
   */
  async updateSession(sessionId: string, userId: string, request: UpdateSessionRequest): Promise<UpdateSessionResponse> {
    this.logger.info('Updating session', { sessionId, userId, updates: Object.keys(request) });

    try {
      // First verify the session exists and belongs to the user
      const existingSession = await this.sessionRepository.findById(sessionId);

      if (!existingSession) {
        throw new Error('Session not found');
      }

      if (existingSession.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      // Validate the update request
      this.validateUpdateRequest(request, existingSession);

      // Prepare update data
      const updateData: Partial<StudySession> = {};

      if (request.status !== undefined) {
        updateData.status = request.status;
      }

      if (request.currentQuestionIndex !== undefined) {
        updateData.currentQuestionIndex = request.currentQuestionIndex;
      }


      // Update session using repository
      const updatedSession = await this.sessionRepository.update(sessionId, updateData);

      // Get updated question details and progress
      const questions = await this.getSessionQuestionsWithDetails(updatedSession);
      const progress = this.calculateSessionProgress(updatedSession);

      const response: UpdateSessionResponse = {
        session: updatedSession,
        questions,
        progress
      };

      this.logger.info('Session updated successfully', { 
        sessionId: updatedSession.sessionId,
        userId,
        status: updatedSession.status,
        currentQuestion: updatedSession.currentQuestionIndex
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to update session', error as Error, { 
        sessionId,
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
    try {
      await this.providerService.getProvider({ id: request.providerId });
    } catch (error) {
      throw new Error(`Invalid provider: ${request.providerId}`);
    }

    // Validate exam exists for the provider
    try {
      const examResponse = await this.examService.getExam(request.examId, { 
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
      for (const topicId of request.topics) {
        try {
          const topicResponse = await this.topicService.getTopic({ 
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
   * Validate session update request
   */
  private validateUpdateRequest(request: UpdateSessionRequest, existingSession: StudySession): void {
    // Can't update completed or abandoned sessions
    if (existingSession.status === 'completed' || existingSession.status === 'abandoned') {
      throw new Error('Cannot update completed or abandoned sessions');
    }

    // Validate status transitions
    if (request.status !== undefined) {
      const validTransitions: { [key: string]: string[] } = {
        'active': ['paused', 'completed', 'abandoned'],
        'paused': ['active', 'abandoned']
      };

      const allowedStatuses = validTransitions[existingSession.status] || [];
      if (!allowedStatuses.includes(request.status)) {
        throw new Error(`Invalid status transition from ${existingSession.status} to ${request.status}`);
      }
    }

    // Validate question index
    if (request.currentQuestionIndex !== undefined) {
      if (request.currentQuestionIndex < 0 || request.currentQuestionIndex >= existingSession.totalQuestions) {
        throw new Error('Invalid question index');
      }
    }
  }

  /**
   * Get questions for the session based on configuration
   */
  private async getQuestionsForSession(request: CreateSessionRequest): Promise<Question[]> {
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

    const questionResponse = await this.questionService.getQuestions(questionRequest);

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
   * Get full question details for the session
   */
  private async getSessionQuestionsWithDetails(session: StudySession): Promise<QuestionResponse[]> {
    const questions: QuestionResponse[] = [];

    this.logger.debug('Getting question details for session', {
      sessionId: session.sessionId,
      questionCount: session.questions.length
    });

    // Get details for each question in the session
    for (const sessionQuestion of session.questions) {
      try {
        const questionResponse = await this.questionService.getQuestion({
          questionId: sessionQuestion.questionId,
          includeExplanation: false, // Don't include explanations until session is completed
          includeMetadata: true
        });

        const question = questionResponse.question;
        
        // Convert to session question format
        const sessionQuestionResponse: QuestionResponse = {
          questionId: question.questionId,
          text: question.questionText,
          options: question.options.map((opt, index) => ({
            id: `option-${index}`,
            text: opt
          })),
          topicId: question.topicId || 'unknown',
          topicName: question.topicId || 'Unknown Topic',
          difficulty: this.mapDifficultyToSessionFormat(question.difficulty),
          timeAllowed: this.calculateTimeAllowed(question.difficulty),
          markedForReview: sessionQuestion.markedForReview
        };

        questions.push(sessionQuestionResponse);
      } catch (error) {
        this.logger.warn('Failed to get question details', {
          error: (error as Error).message,
          sessionId: session.sessionId,
          questionId: sessionQuestion.questionId
        });
        
        // Create a placeholder question response for missing questions
        questions.push({
          questionId: sessionQuestion.questionId,
          text: 'Question not available',
          options: [],
          topicId: 'unknown',
          topicName: 'Unknown Topic',
          difficulty: 'medium',
          timeAllowed: 120,
          markedForReview: sessionQuestion.markedForReview
        });
      }
    }

    return questions;
  }

  /**
   * Calculate session progress
   */
  private calculateSessionProgress(session: StudySession): SessionProgress {
    const answeredQuestions = session.questions.filter(q => q.userAnswer && q.userAnswer.length > 0).length;
    const correctAnswers = session.questions.filter(q => q.isCorrect === true).length;
    const totalTimeSpent = session.questions.reduce((sum, q) => sum + q.timeSpent, 0);
    
    // Calculate accuracy - only count answered questions
    const accuracy = answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0;

    // Calculate time remaining for timed sessions (if applicable)
    let timeRemaining: number | undefined;
    if (session.status === 'active' && session.questions.length > 0) {
      // Estimate remaining time based on average time per question
      const avgTimePerQuestion = totalTimeSpent / Math.max(answeredQuestions, 1);
      const remainingQuestions = session.totalQuestions - answeredQuestions;
      timeRemaining = remainingQuestions * avgTimePerQuestion;
    }

    const progress: SessionProgress = {
      sessionId: session.sessionId,
      currentQuestion: session.currentQuestionIndex + 1, // Convert to 1-based index for UI
      totalQuestions: session.totalQuestions,
      answeredQuestions,
      correctAnswers,
      timeElapsed: totalTimeSpent,
      accuracy: Math.round(accuracy * 100) / 100 // Round to 2 decimal places
    };

    if (timeRemaining !== undefined) {
      progress.timeRemaining = timeRemaining;
    }

    return progress;
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