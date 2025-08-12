// Session service for Study App V3 Backend
// Phase 15: Session Creation Feature
// Phase 17: Session Update Feature

import { v4 as uuidv4 } from 'uuid';
import { 
  StudySession, 
  SessionQuestion,
  Question
} from '../shared/types/domain.types';
// Removed import of Question from question.types - using Question from domain.types instead
import {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  QuestionResponse,
  SessionQuestionOption,
  SessionProgress,
  ISessionService,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  AnswerFeedback,
  CompleteSessionResponse,
  DetailedSessionResults,
  QuestionResultBreakdown,
  DifficultyPerformance,
  TopicPerformanceBreakdown,
  TimeDistribution,
  StudyRecommendations,
  FocusArea,
  SessionSummary
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
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    this.logger.info('Creating new session', { 
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
      const sessionQuestions = request.isAdaptive 
        ? this.selectAdaptiveQuestions(questions, requestedCount)
        : this.selectSessionQuestions(questions, requestedCount);

      // Create session ID and timestamps
      const sessionId = uuidv4();
      const now = new Date().toISOString();

      // Create session object (no userId - auth association added in Phase 30)
      const session: StudySession = {
        sessionId,
        // userId: undefined, // Will be associated when auth is added
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
        // Phase 22: Adaptive session configuration
        ...(request.isAdaptive && {
          isAdaptive: true,
          adaptiveConfig: {
            difficultyDistribution: {
              easy: Math.round(requestedCount * 0.3),
              medium: Math.round(requestedCount * 0.5),
              hard: Math.round(requestedCount * 0.2)
            },
            adjustmentAlgorithm: 'difficulty-based'
          }
        }),
        createdAt: now,
        updatedAt: now
      };

      // Store session using repository
      const createdSession = await this.sessionRepository.create(session);

      // Prepare question responses (without correct answers or explanations)
      const questionResponses: QuestionResponse[] = sessionQuestions.map(q => ({
        questionId: q.questionId,
        text: q.text,
        options: Array.isArray(q.options) ? q.options.map((opt, index) => ({
          id: `option-${index}`,
          text: typeof opt === 'string' ? opt : opt.text || `Option ${index + 1}`
        })) : [],
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
        totalQuestions: createdSession.totalQuestions,
        providerId: createdSession.providerId,
        examId: createdSession.examId
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to create session', error as Error, { 
        request
      });
      throw error;
    }
  }

  /**
   * Get an existing study session
   * Phase 16: Session Retrieval Feature
   */
  async getSession(sessionId: string): Promise<GetSessionResponse> {
    this.logger.info('Retrieving session', { sessionId });

    try {
      // Retrieve session using repository
      const session = await this.sessionRepository.findById(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      // Session access is sessionId-based (userId association added in Phase 30)

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
        status: session.status,
        currentQuestion: session.currentQuestionIndex,
        totalQuestions: session.totalQuestions
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to retrieve session', error as Error, { 
        sessionId
      });
      throw error;
    }
  }

  /**
   * Update session (Phase 17: Session Update Feature)
   */
  async updateSession(sessionId: string, request: UpdateSessionRequest): Promise<UpdateSessionResponse> {
    this.logger.info('Updating session', { sessionId, updates: Object.keys(request) });

    try {
      // First verify the session exists and belongs to the user
      const existingSession = await this.sessionRepository.findById(sessionId);

      if (!existingSession) {
        throw new Error('Session not found');
      }

      // Session access is sessionId-based (userId association added in Phase 30)

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
        status: updatedSession.status,
        currentQuestion: updatedSession.currentQuestionIndex
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to update session', error as Error, { 
        sessionId,
        request
      });
      throw error;
    }
  }

  /**
   * Delete a study session
   * Phase 19: Session Deletion Feature
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    this.logger.info('Deleting session', { sessionId });

    try {
      // First check if session exists
      const existingSession = await this.sessionRepository.findById(sessionId);

      if (!existingSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Check if session can be deleted (business logic)
      if (existingSession.status === 'completed') {
        throw new Error('Cannot delete completed sessions - they are archived for analytics');
      }

      // Update session status to 'abandoned' instead of hard delete for audit trail
      await this.sessionRepository.update(sessionId, { 
        status: 'abandoned',
        updatedAt: new Date().toISOString()
      });

      this.logger.info('Session deleted successfully', { 
        sessionId,
        previousStatus: existingSession.status
      });

      return { 
        success: true, 
        message: 'Session deleted successfully' 
      };

    } catch (error) {
      this.logger.error('Failed to delete session', error as Error, { sessionId });
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

    // Map from question service type to domain type
    return questions.map(q => this.mapQuestionToDomainType(q));
  }

  /**
   * Map question from question service type to domain type
   */
  private mapQuestionToDomainType(q: any): Question {
    return {
      questionId: q.questionId,
      providerId: q.providerId,
      examId: q.examId,
      topicId: q.topicId || 'unknown',
      text: q.questionText || 'Question text not available',
      options: Array.isArray(q.options) ? 
        q.options.map((opt: any, index: number) => ({
          id: `option-${index}`,
          text: typeof opt === 'string' ? opt : opt.text || `Option ${index + 1}`,
          isCorrect: false // We don't expose correct answers to client
        })) : [],
      correctAnswer: Array.isArray(q.correctAnswer) ? 
        q.correctAnswer.map((ans: any) => ans.toString()) : 
        [q.correctAnswer?.toString() || '0'],
      explanation: q.explanation || 'No explanation available',
      difficulty: this.mapDifficultyToSessionFormat(q.difficulty),
      tags: Array.isArray(q.tags) ? q.tags : [],
      createdAt: q.createdAt || new Date().toISOString(),
      updatedAt: q.updatedAt || new Date().toISOString()
    };
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
   * Select questions for adaptive sessions - Phase 22 implementation
   * Adaptive logic: start with easier questions, progress based on performance
   */
  private selectAdaptiveQuestions(questions: Question[], count: number): Question[] {
    // Group questions by difficulty
    const easyQuestions = questions.filter(q => q.difficulty === 'easy');
    const mediumQuestions = questions.filter(q => q.difficulty === 'medium');
    const hardQuestions = questions.filter(q => q.difficulty === 'hard');

    // Adaptive selection: 40% easy, 40% medium, 20% hard for initial session
    const easyCount = Math.round(count * 0.4);
    const mediumCount = Math.round(count * 0.4);
    const hardCount = count - easyCount - mediumCount;

    // Select questions from each difficulty level
    const selectedEasy = this.selectRandomQuestions(easyQuestions, easyCount);
    const selectedMedium = this.selectRandomQuestions(mediumQuestions, mediumCount);
    const selectedHard = this.selectRandomQuestions(hardQuestions, hardCount);

    // Combine and shuffle the selected questions
    const adaptiveQuestions = [...selectedEasy, ...selectedMedium, ...selectedHard];
    return adaptiveQuestions.sort(() => Math.random() - 0.5);
  }

  private selectRandomQuestions(questions: Question[], count: number): Question[] {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, questions.length));
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
        
        // Convert to session question format - map from question service type
        const sessionQuestionResponse: QuestionResponse = {
          questionId: question.questionId,
          text: question.questionText || 'Question text not available',
          options: Array.isArray(question.options) ? question.options.map((opt: any, index: number) => ({
            id: `option-${index}`,
            text: typeof opt === 'string' ? opt : opt.text || `Option ${index + 1}`
          })) : [],
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

  /**
   * Submit answer for a question in a session
   * Phase 20: Answer Submission Feature
   */
  async submitAnswer(sessionId: string, request: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
    this.logger.info('Submitting answer', { 
      sessionId,
      questionId: request.questionId,
      answerCount: request.answer.length,
      timeSpent: request.timeSpent,
      skipped: request.skipped,
      markedForReview: request.markedForReview
    });

    try {
      // Retrieve session
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Validate session state
      if (session.status !== 'active') {
        throw new Error('Cannot submit answers to inactive session');
      }

      // Find the question in the session
      const questionIndex = session.questions.findIndex(q => q.questionId === request.questionId);
      if (questionIndex === -1) {
        throw new Error('Question not found in session');
      }

      const sessionQuestion = session.questions[questionIndex];
      
      // Get full question details for scoring and feedback
      const questionResponse = await this.questionService.getQuestion({
        questionId: request.questionId,
        includeExplanation: true,
        includeMetadata: true
      });

      const questionDetails = questionResponse.question;

      // Calculate if answer is correct
      const isCorrect = this.calculateAnswerCorrectness(request.answer, sessionQuestion.correctAnswer);

      // Calculate score based on difficulty and correctness
      const score = this.calculateQuestionScore(isCorrect, questionDetails.difficulty, request.timeSpent);

      // Update session question with answer data
      const updatedSessionQuestion = {
        ...sessionQuestion,
        userAnswer: request.answer,
        isCorrect,
        timeSpent: request.timeSpent,
        skipped: request.skipped || false,
        markedForReview: request.markedForReview || false,
        answeredAt: new Date().toISOString()
      };

      // Update session with new question data
      const updatedQuestions = [...session.questions];
      updatedQuestions[questionIndex] = updatedSessionQuestion;

      // Update session stats
      const updatedSession = {
        ...session,
        questions: updatedQuestions,
        correctAnswers: updatedQuestions.filter(q => q.isCorrect === true).length,
        updatedAt: new Date().toISOString()
      };

      // Move to next question if current question matches this one
      if (session.currentQuestionIndex === questionIndex && !request.skipped) {
        updatedSession.currentQuestionIndex = Math.min(questionIndex + 1, session.totalQuestions - 1);
      }

      // Check if session should be completed (all questions answered)
      const allQuestionsAnswered = updatedQuestions.every(q => 
        q.userAnswer && q.userAnswer.length > 0
      );
      
      if (allQuestionsAnswered) {
        updatedSession.status = 'completed';
        updatedSession.endTime = new Date().toISOString();
        updatedSession.score = this.calculateTotalSessionScore(updatedQuestions, questionDetails.difficulty);
      }

      // Save updated session
      const savedSession = await this.sessionRepository.update(sessionId, updatedSession);

      // Calculate updated progress
      const progress = this.calculateSessionProgress(savedSession);

      // Get next question if session is still active
      let nextQuestion: QuestionResponse | undefined;
      if (savedSession.status === 'active' && savedSession.currentQuestionIndex < savedSession.totalQuestions - 1) {
        const nextQuestionIndex = savedSession.currentQuestionIndex + 1;
        const nextSessionQuestion = savedSession.questions[nextQuestionIndex];
        
        try {
          const nextQuestionResponse = await this.questionService.getQuestion({
            questionId: nextSessionQuestion.questionId,
            includeExplanation: false,
            includeMetadata: true
          });
          
          nextQuestion = {
            questionId: nextQuestionResponse.question.questionId,
            text: nextQuestionResponse.question.questionText,
            options: nextQuestionResponse.question.options.map((opt, index) => ({
              id: `option-${index}`,
              text: opt
            })),
            topicId: nextQuestionResponse.question.topicId || 'unknown',
            topicName: nextQuestionResponse.question.topicId || 'Unknown Topic',
            difficulty: this.mapDifficultyToSessionFormat(nextQuestionResponse.question.difficulty),
            timeAllowed: this.calculateTimeAllowed(nextQuestionResponse.question.difficulty),
            markedForReview: nextSessionQuestion.markedForReview
          };
        } catch (error) {
          this.logger.warn('Failed to get next question details', {
            error: (error as Error).message,
            sessionId,
            questionId: nextSessionQuestion.questionId
          });
        }
      }

      // Create feedback response
      const feedback: AnswerFeedback = {
        questionId: request.questionId,
        isCorrect,
        correctAnswer: sessionQuestion.correctAnswer,
        userAnswer: request.answer,
        explanation: questionDetails.explanation || 'No explanation available',
        score,
        timeSpent: request.timeSpent,
        questionDifficulty: this.mapDifficultyToSessionFormat(questionDetails.difficulty),
        topicId: questionDetails.topicId || 'unknown',
        topicName: questionDetails.topicId || 'Unknown Topic'
      };

      const response: SubmitAnswerResponse = {
        success: true,
        feedback,
        session: savedSession,
        progress
      };

      if (nextQuestion) {
        response.nextQuestion = nextQuestion;
      }

      this.logger.info('Answer submitted successfully', { 
        sessionId,
        questionId: request.questionId,
        isCorrect,
        score,
        sessionStatus: savedSession.status,
        progressAccuracy: progress.accuracy
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to submit answer', error as Error, { 
        sessionId,
        request
      });
      throw error;
    }
  }

  /**
   * Calculate if user answer matches correct answer
   */
  private calculateAnswerCorrectness(userAnswer: string[], correctAnswer: string[]): boolean {
    // Sort both arrays to handle multiple choice questions where order doesn't matter
    const sortedUserAnswer = [...userAnswer].sort();
    const sortedCorrectAnswer = [...correctAnswer].sort();
    
    // Check if arrays have same length and same elements
    return sortedUserAnswer.length === sortedCorrectAnswer.length &&
           sortedUserAnswer.every((answer, index) => answer === sortedCorrectAnswer[index]);
  }

  /**
   * Calculate score for a single question based on difficulty and correctness
   */
  private calculateQuestionScore(isCorrect: boolean, difficulty: string, timeSpent: number): number {
    if (!isCorrect) {
      return 0;
    }

    // Base score based on difficulty
    let baseScore = 1;
    switch (this.mapDifficultyToSessionFormat(difficulty)) {
      case 'easy':
        baseScore = 1;
        break;
      case 'medium':
        baseScore = 2;
        break;
      case 'hard':
        baseScore = 3;
        break;
    }

    // Time bonus (faster answers get slight bonus, but don't penalize slower answers too much)
    const expectedTime = this.calculateTimeAllowed(difficulty);
    const timeRatio = timeSpent / expectedTime;
    let timeMultiplier = 1.0;
    
    if (timeRatio < 0.5) {
      // Very fast answer - small bonus
      timeMultiplier = 1.2;
    } else if (timeRatio < 0.75) {
      // Fast answer - small bonus
      timeMultiplier = 1.1;
    } else if (timeRatio <= 1.0) {
      // Normal time - no bonus or penalty
      timeMultiplier = 1.0;
    } else {
      // Overtime - small penalty but not too harsh
      timeMultiplier = Math.max(0.8, 1.0 - (timeRatio - 1.0) * 0.2);
    }

    return Math.round(baseScore * timeMultiplier * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate total session score
   */
  private calculateTotalSessionScore(questions: SessionQuestion[], baseDifficulty: string): number {
    return questions.reduce((total, question) => {
      if (question.isCorrect && question.timeSpent > 0) {
        return total + this.calculateQuestionScore(true, baseDifficulty, question.timeSpent);
      }
      return total;
    }, 0);
  }

  /**
   * Complete a study session and generate comprehensive results
   * Phase 21: Session Completion Feature
   */
  async completeSession(sessionId: string): Promise<CompleteSessionResponse> {
    this.logger.info('Completing session', { sessionId });

    try {
      // Retrieve session
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Validate session can be completed
      if (session.status === 'completed') {
        throw new Error('Session is already completed');
      }

      if (session.status === 'abandoned') {
        throw new Error('Cannot complete abandoned session');
      }

      // Check if all questions have been answered (at least attempted)
      const unansweredQuestions = session.questions.filter(q => 
        !q.userAnswer || q.userAnswer.length === 0
      );

      if (unansweredQuestions.length > 0) {
        throw new Error(`Cannot complete session: ${unansweredQuestions.length} questions remain unanswered`);
      }

      // Get full question details for comprehensive analysis
      const questionDetails = await this.getQuestionDetailsForCompletion(session);

      // Calculate completion time
      const completedAt = new Date().toISOString();
      const sessionDuration = session.startTime ? 
        Math.floor((new Date(completedAt).getTime() - new Date(session.startTime).getTime()) / 1000) : 
        session.questions.reduce((sum, q) => sum + q.timeSpent, 0);

      // Generate comprehensive results
      const detailedResults = await this.generateDetailedResults(session, questionDetails, completedAt, sessionDuration);
      const sessionSummary = this.generateSessionSummary(session, detailedResults, completedAt);
      const recommendations = this.generateStudyRecommendations(detailedResults, sessionSummary);

      // Update session to completed status
      const updatedSession = await this.sessionRepository.update(sessionId, {
        status: 'completed',
        endTime: completedAt,
        score: detailedResults.finalScore,
        updatedAt: completedAt
      });

      this.logger.info('Session completed successfully', {
        sessionId,
        finalScore: detailedResults.finalScore,
        accuracy: detailedResults.accuracyPercentage,
        totalTime: detailedResults.totalTimeSpent,
        recommendations: recommendations.overallRecommendation
      });

      const response: CompleteSessionResponse = {
        success: true,
        sessionSummary,
        detailedResults,
        recommendations
      };

      // userProgress will be implemented when user management is added in Phase 30
      // For now, we don't set it since it's optional

      return response;

    } catch (error) {
      this.logger.error('Failed to complete session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Get question details needed for session completion analysis
   */
  private async getQuestionDetailsForCompletion(session: StudySession): Promise<Question[]> {
    const questionDetails: Question[] = [];

    for (const sessionQuestion of session.questions) {
      try {
        const questionResponse = await this.questionService.getQuestion({
          questionId: sessionQuestion.questionId,
          includeExplanation: true,
          includeMetadata: true
        });
        // Map from question service type to domain type
        questionDetails.push(this.mapQuestionToDomainType(questionResponse.question));
      } catch (error) {
        this.logger.warn('Failed to get question details for completion', {
          sessionId: session.sessionId,
          questionId: sessionQuestion.questionId,
          error: (error as Error).message
        });
        
        // Create a placeholder question for missing questions
        questionDetails.push({
          questionId: sessionQuestion.questionId,
          providerId: session.providerId,
          examId: session.examId,
          topicId: 'unknown',
          text: 'Question not available',
          options: [],
          correctAnswer: sessionQuestion.correctAnswer,
          explanation: 'No explanation available',
          difficulty: 'medium',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    return questionDetails;
  }

  /**
   * Generate detailed session results with comprehensive analytics
   */
  private async generateDetailedResults(
    session: StudySession,
    questionDetails: Question[],
    completedAt: string,
    sessionDuration: number
  ): Promise<DetailedSessionResults> {
    // Calculate basic metrics
    const totalTimeSpent = session.questions.reduce((sum, q) => sum + q.timeSpent, 0);
    const averageTimePerQuestion = totalTimeSpent / session.totalQuestions;
    const correctAnswers = session.questions.filter(q => q.isCorrect === true).length;
    const accuracyPercentage = (correctAnswers / session.totalQuestions) * 100;

    // Generate question breakdown with detailed results
    const questionsBreakdown = this.generateQuestionBreakdown(session, questionDetails);

    // Calculate scores
    const finalScore = questionsBreakdown.reduce((sum, q) => sum + q.score, 0);
    const maxPossibleScore = this.calculateMaxPossibleScore(questionDetails);

    // Generate performance by difficulty
    const performanceByDifficulty = this.calculateDifficultyPerformance(session, questionDetails);

    // Generate performance by topic
    const performanceByTopic = await this.calculateTopicPerformance(session, questionDetails);

    // Calculate time distribution
    const timeDistribution = this.calculateTimeDistribution(session, questionDetails);

    return {
      sessionId: session.sessionId,
      finalScore,
      maxPossibleScore,
      accuracyPercentage: Math.round(accuracyPercentage * 100) / 100,
      totalTimeSpent,
      averageTimePerQuestion: Math.round(averageTimePerQuestion * 100) / 100,
      questionsBreakdown,
      performanceByDifficulty,
      performanceByTopic,
      timeDistribution,
      completedAt,
      sessionDuration
    };
  }

  /**
   * Generate detailed question breakdown for completion results
   */
  private generateQuestionBreakdown(session: StudySession, questionDetails: Question[]): QuestionResultBreakdown[] {
    return session.questions.map((sessionQuestion, index) => {
      const questionDetail = questionDetails[index];
      const difficulty = this.mapDifficultyToSessionFormat(questionDetail.difficulty);
      const score = sessionQuestion.isCorrect ? 
        this.calculateQuestionScore(true, questionDetail.difficulty, sessionQuestion.timeSpent) : 0;

      return {
        questionId: sessionQuestion.questionId,
        questionText: questionDetail.text || 'Question text not available',
        userAnswer: sessionQuestion.userAnswer || [],
        correctAnswer: sessionQuestion.correctAnswer,
        isCorrect: sessionQuestion.isCorrect || false,
        timeSpent: sessionQuestion.timeSpent,
        score,
        difficulty,
        topicId: questionDetail.topicId || 'unknown',
        topicName: questionDetail.topicId || 'Unknown Topic',
        explanation: questionDetail.explanation || 'No explanation available',
        markedForReview: sessionQuestion.markedForReview,
        skipped: sessionQuestion.skipped
      };
    });
  }

  /**
   * Calculate maximum possible score for the session
   */
  private calculateMaxPossibleScore(questionDetails: Question[]): number {
    return questionDetails.reduce((sum, question) => {
      const difficulty = this.mapDifficultyToSessionFormat(question.difficulty);
      // Assume perfect time performance for max score calculation
      const expectedTime = this.calculateTimeAllowed(question.difficulty);
      const maxScore = this.calculateQuestionScore(true, question.difficulty, expectedTime * 0.5);
      return sum + maxScore;
    }, 0);
  }

  /**
   * Calculate performance metrics by difficulty level
   */
  private calculateDifficultyPerformance(session: StudySession, questionDetails: Question[]): DifficultyPerformance[] {
    const difficultyMap = new Map<string, {
      questions: SessionQuestion[];
      details: Question[];
    }>();

    // Group questions by difficulty
    session.questions.forEach((sessionQuestion, index) => {
      const questionDetail = questionDetails[index];
      const difficulty = this.mapDifficultyToSessionFormat(questionDetail.difficulty);
      
      if (!difficultyMap.has(difficulty)) {
        difficultyMap.set(difficulty, { questions: [], details: [] });
      }
      
      difficultyMap.get(difficulty)!.questions.push(sessionQuestion);
      difficultyMap.get(difficulty)!.details.push(questionDetail);
    });

    // Calculate metrics for each difficulty
    const performanceArray: DifficultyPerformance[] = [];
    
    for (const [difficulty, data] of difficultyMap.entries()) {
      const totalQuestions = data.questions.length;
      const correctQuestions = data.questions.filter(q => q.isCorrect === true).length;
      const accuracy = totalQuestions > 0 ? (correctQuestions / totalQuestions) * 100 : 0;
      const averageTime = data.questions.reduce((sum, q) => sum + q.timeSpent, 0) / totalQuestions;
      const totalScore = data.questions.reduce((sum, q, index) => {
        if (q.isCorrect) {
          return sum + this.calculateQuestionScore(true, data.details[index].difficulty, q.timeSpent);
        }
        return sum;
      }, 0);
      const maxPossibleScore = data.details.reduce((sum, detail) => {
        const expectedTime = this.calculateTimeAllowed(detail.difficulty);
        return sum + this.calculateQuestionScore(true, detail.difficulty, expectedTime * 0.5);
      }, 0);

      performanceArray.push({
        difficulty: difficulty as 'easy' | 'medium' | 'hard',
        totalQuestions,
        correctQuestions,
        accuracy: Math.round(accuracy * 100) / 100,
        averageTime: Math.round(averageTime * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
        maxPossibleScore: Math.round(maxPossibleScore * 100) / 100
      });
    }

    return performanceArray;
  }

  /**
   * Calculate performance metrics by topic
   */
  private async calculateTopicPerformance(session: StudySession, questionDetails: Question[]): Promise<TopicPerformanceBreakdown[]> {
    const topicMap = new Map<string, {
      questions: SessionQuestion[];
      details: Question[];
      topicName: string;
    }>();

    // Group questions by topic
    for (let i = 0; i < session.questions.length; i++) {
      const sessionQuestion = session.questions[i];
      const questionDetail = questionDetails[i];
      const topicId = questionDetail.topicId || 'unknown';
      
      if (!topicMap.has(topicId)) {
        // Try to get topic name
        let topicName = 'Unknown Topic';
        try {
          if (topicId !== 'unknown') {
            const topicResponse = await this.topicService.getTopic({ id: topicId });
            topicName = topicResponse.topic.name;
          }
        } catch (error) {
          this.logger.warn('Failed to get topic name for completion', {
            topicId,
            error: (error as Error).message
          });
        }

        topicMap.set(topicId, { questions: [], details: [], topicName });
      }
      
      topicMap.get(topicId)!.questions.push(sessionQuestion);
      topicMap.get(topicId)!.details.push(questionDetail);
    }

    // Calculate metrics for each topic
    const performanceArray: TopicPerformanceBreakdown[] = [];
    
    for (const [topicId, data] of topicMap.entries()) {
      const questionsTotal = data.questions.length;
      const questionsCorrect = data.questions.filter(q => q.isCorrect === true).length;
      const accuracy = questionsTotal > 0 ? (questionsCorrect / questionsTotal) * 100 : 0;
      const averageTime = data.questions.reduce((sum, q) => sum + q.timeSpent, 0) / questionsTotal;
      const totalScore = data.questions.reduce((sum, q, index) => {
        if (q.isCorrect) {
          return sum + this.calculateQuestionScore(true, data.details[index].difficulty, q.timeSpent);
        }
        return sum;
      }, 0);
      const maxPossibleScore = data.details.reduce((sum, detail) => {
        const expectedTime = this.calculateTimeAllowed(detail.difficulty);
        return sum + this.calculateQuestionScore(true, detail.difficulty, expectedTime * 0.5);
      }, 0);

      performanceArray.push({
        topicId,
        topicName: data.topicName,
        questionsTotal,
        questionsCorrect,
        accuracy: Math.round(accuracy * 100) / 100,
        averageTime: Math.round(averageTime * 100) / 100,
        strongestArea: false, // Will be set later
        weakestArea: false, // Will be set later
        needsImprovement: accuracy < 70,
        totalScore: Math.round(totalScore * 100) / 100,
        maxPossibleScore: Math.round(maxPossibleScore * 100) / 100
      });
    }

    // Mark strongest and weakest areas
    if (performanceArray.length > 1) {
      const sortedByAccuracy = [...performanceArray].sort((a, b) => b.accuracy - a.accuracy);
      sortedByAccuracy[0].strongestArea = true;
      sortedByAccuracy[sortedByAccuracy.length - 1].weakestArea = true;
    }

    return performanceArray;
  }

  /**
   * Calculate time distribution metrics
   */
  private calculateTimeDistribution(session: StudySession, questionDetails: Question[]): TimeDistribution {
    let fastQuestions = 0;
    let normalQuestions = 0;
    let slowQuestions = 0;
    
    const timesByDifficulty = {
      easy: [] as number[],
      medium: [] as number[],
      hard: [] as number[]
    };

    session.questions.forEach((sessionQuestion, index) => {
      const questionDetail = questionDetails[index];
      const difficulty = this.mapDifficultyToSessionFormat(questionDetail.difficulty);
      const expectedTime = this.calculateTimeAllowed(questionDetail.difficulty);
      const timeRatio = sessionQuestion.timeSpent / expectedTime;

      // Categorize by speed
      if (timeRatio < 0.5) {
        fastQuestions++;
      } else if (timeRatio <= 1.0) {
        normalQuestions++;
      } else {
        slowQuestions++;
      }

      // Collect times by difficulty
      timesByDifficulty[difficulty].push(sessionQuestion.timeSpent);
    });

    // Calculate averages by difficulty
    const averageTimeEasy = timesByDifficulty.easy.length > 0 ?
      timesByDifficulty.easy.reduce((sum, time) => sum + time, 0) / timesByDifficulty.easy.length : 0;
    
    const averageTimeMedium = timesByDifficulty.medium.length > 0 ?
      timesByDifficulty.medium.reduce((sum, time) => sum + time, 0) / timesByDifficulty.medium.length : 0;
    
    const averageTimeHard = timesByDifficulty.hard.length > 0 ?
      timesByDifficulty.hard.reduce((sum, time) => sum + time, 0) / timesByDifficulty.hard.length : 0;

    return {
      fastQuestions,
      normalQuestions,
      slowQuestions,
      averageTimeEasy: Math.round(averageTimeEasy * 100) / 100,
      averageTimeMedium: Math.round(averageTimeMedium * 100) / 100,
      averageTimeHard: Math.round(averageTimeHard * 100) / 100
    };
  }

  /**
   * Generate session summary for completion
   */
  private generateSessionSummary(
    session: StudySession, 
    detailedResults: DetailedSessionResults,
    completedAt: string
  ): SessionSummary {
    const questionsAnswered = session.questions.filter(q => q.userAnswer && q.userAnswer.length > 0).length;
    const questionsSkipped = session.questions.filter(q => q.skipped).length;
    const questionsReviewed = session.questions.filter(q => q.markedForReview).length;

    // For now, use a simple passing score of 70%
    const passingScore = Math.floor(detailedResults.maxPossibleScore * 0.7);
    const passed = detailedResults.finalScore >= passingScore;

    return {
      sessionId: session.sessionId,
      totalQuestions: session.totalQuestions,
      questionsAnswered,
      questionsCorrect: session.correctAnswers,
      questionsSkipped,
      questionsReviewed,
      accuracy: detailedResults.accuracyPercentage,
      totalTimeSpent: detailedResults.totalTimeSpent,
      averageTimePerQuestion: detailedResults.averageTimePerQuestion,
      score: detailedResults.finalScore,
      passingScore,
      passed,
      topicBreakdown: detailedResults.performanceByTopic.map(topic => ({
        topicId: topic.topicId,
        topicName: topic.topicName,
        questionsTotal: topic.questionsTotal,
        questionsCorrect: topic.questionsCorrect,
        accuracy: topic.accuracy,
        averageTime: topic.averageTime
      })),
      completedAt
    };
  }

  /**
   * Generate study recommendations based on performance
   */
  private generateStudyRecommendations(
    detailedResults: DetailedSessionResults,
    sessionSummary: SessionSummary
  ): StudyRecommendations {
    const accuracy = detailedResults.accuracyPercentage;
    
    // Determine overall recommendation
    let overallRecommendation: 'excellent' | 'good' | 'needs_improvement' | 'requires_focused_study';
    let readinessForExam = false;
    let suggestedStudyTime = 30; // default 30 minutes per day

    if (accuracy >= 85) {
      overallRecommendation = 'excellent';
      readinessForExam = true;
      suggestedStudyTime = 15;
    } else if (accuracy >= 75) {
      overallRecommendation = 'good';
      readinessForExam = true;
      suggestedStudyTime = 20;
    } else if (accuracy >= 60) {
      overallRecommendation = 'needs_improvement';
      readinessForExam = false;
      suggestedStudyTime = 45;
    } else {
      overallRecommendation = 'requires_focused_study';
      readinessForExam = false;
      suggestedStudyTime = 60;
    }

    // Generate focus areas from weak topics
    const focusAreas: FocusArea[] = detailedResults.performanceByTopic
      .filter(topic => topic.needsImprovement)
      .sort((a, b) => a.accuracy - b.accuracy) // Weakest first
      .slice(0, 3) // Top 3 focus areas
      .map(topic => ({
        topicId: topic.topicId,
        topicName: topic.topicName,
        priority: topic.accuracy < 50 ? 'high' : topic.accuracy < 65 ? 'medium' : 'low',
        currentAccuracy: topic.accuracy,
        targetAccuracy: 80,
        estimatedStudyTime: Math.ceil((80 - topic.accuracy) * 2), // 2 minutes per percentage point needed
        specificWeaknesses: this.identifySpecificWeaknesses(topic, detailedResults.questionsBreakdown),
        recommendedResources: ['Practice questions', 'Review materials', 'Video tutorials']
      }));

    // Next session recommendation
    const nextSessionRecommendation = this.generateNextSessionRecommendation(detailedResults, focusAreas);

    // Motivational message
    const motivationalMessage = this.generateMotivationalMessage(overallRecommendation, accuracy);

    return {
      overallRecommendation,
      readinessForExam,
      suggestedStudyTime,
      focusAreas,
      nextSessionRecommendation,
      motivationalMessage
    };
  }

  /**
   * Identify specific weaknesses in a topic
   */
  private identifySpecificWeaknesses(topic: TopicPerformanceBreakdown, questionsBreakdown: QuestionResultBreakdown[]): string[] {
    const topicQuestions = questionsBreakdown.filter(q => q.topicId === topic.topicId);
    const weaknesses: string[] = [];

    // Analyze patterns in wrong answers
    const wrongAnswers = topicQuestions.filter(q => !q.isCorrect);
    
    if (wrongAnswers.length > 0) {
      const avgTimeWrong = wrongAnswers.reduce((sum, q) => sum + q.timeSpent, 0) / wrongAnswers.length;
      const avgTimeAll = topicQuestions.reduce((sum, q) => sum + q.timeSpent, 0) / topicQuestions.length;
      
      if (avgTimeWrong < avgTimeAll * 0.7) {
        weaknesses.push('Rushing through questions');
      } else if (avgTimeWrong > avgTimeAll * 1.3) {
        weaknesses.push('Taking too long to answer');
      }

      const skippedCount = wrongAnswers.filter(q => q.skipped).length;
      if (skippedCount > wrongAnswers.length * 0.3) {
        weaknesses.push('Frequent question skipping');
      }

      // Check difficulty patterns
      const wrongByDifficulty = wrongAnswers.reduce((acc, q) => {
        acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      if (wrongByDifficulty.easy > 0) {
        weaknesses.push('Struggling with basic concepts');
      }
      if (wrongByDifficulty.hard > wrongByDifficulty.medium) {
        weaknesses.push('Advanced topics need more practice');
      }
    }

    return weaknesses.length > 0 ? weaknesses : ['General understanding needs improvement'];
  }

  /**
   * Generate next session recommendation
   */
  private generateNextSessionRecommendation(
    detailedResults: DetailedSessionResults,
    focusAreas: FocusArea[]
  ): StudyRecommendations['nextSessionRecommendation'] {
    const accuracy = detailedResults.accuracyPercentage;
    
    // Determine session type
    let sessionType: 'practice' | 'exam' | 'review' = 'practice';
    if (accuracy >= 80) {
      sessionType = 'exam';
    } else if (accuracy < 60) {
      sessionType = 'review';
    }

    // Determine topics to focus on
    const topics = focusAreas.length > 0 ? 
      focusAreas.slice(0, 2).map(area => area.topicId) : 
      detailedResults.performanceByTopic
        .filter(topic => topic.needsImprovement)
        .slice(0, 2)
        .map(topic => topic.topicId);

    // Determine difficulty
    const avgDifficultyPerformance = detailedResults.performanceByDifficulty
      .reduce((acc, perf) => acc + perf.accuracy, 0) / detailedResults.performanceByDifficulty.length;
    
    let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    if (avgDifficultyPerformance < 60) {
      difficulty = 'easy';
    } else if (avgDifficultyPerformance > 80) {
      difficulty = 'hard';
    }

    // Determine question count
    let questionCount = 20;
    if (sessionType === 'review') {
      questionCount = 15;
    } else if (sessionType === 'exam') {
      questionCount = 30;
    }

    return {
      sessionType,
      topics,
      difficulty,
      questionCount
    };
  }

  /**
   * Generate motivational message based on performance
   */
  private generateMotivationalMessage(
    overallRecommendation: string,
    accuracy: number
  ): string {
    const messages = {
      excellent: [
        `Outstanding performance with ${accuracy.toFixed(1)}% accuracy! You're ready to excel in your exam.`,
        `Exceptional work! Your ${accuracy.toFixed(1)}% accuracy demonstrates mastery of the material.`,
        `Fantastic job! With ${accuracy.toFixed(1)}% accuracy, you're well-prepared for success.`
      ],
      good: [
        `Great work with ${accuracy.toFixed(1)}% accuracy! A little more practice and you'll be exam-ready.`,
        `Well done! Your ${accuracy.toFixed(1)}% accuracy shows solid understanding. Keep up the momentum!`,
        `Good progress at ${accuracy.toFixed(1)}% accuracy! You're on the right track to success.`
      ],
      needs_improvement: [
        `You're making progress with ${accuracy.toFixed(1)}% accuracy. Focus on the recommended areas for improvement.`,
        `Keep pushing forward! Your ${accuracy.toFixed(1)}% accuracy shows you're learning. More practice will help.`,
        `Good effort at ${accuracy.toFixed(1)}% accuracy! Review the focus areas and you'll see improvement.`
      ],
      requires_focused_study: [
        `Every expert was once a beginner. Your ${accuracy.toFixed(1)}% shows you're learning. Focus on the fundamentals.`,
        `Don't give up! ${accuracy.toFixed(1)}% is a starting point. Consistent study will lead to success.`,
        `You're building your foundation with ${accuracy.toFixed(1)}% accuracy. Focus on understanding key concepts.`
      ]
    };

    const messageArray = messages[overallRecommendation as keyof typeof messages];
    return messageArray[Math.floor(Math.random() * messageArray.length)];
  }
}