// Session service for Study App V3 Backend
// Phase 15: Session Creation Feature
// Phase 17: Session Update Feature

import {
  ISessionService,
  ISessionOrchestrator,
  IAnswerProcessor,
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  UpdateSessionRequest,
  UpdateSessionResponse,
  CompleteSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SessionSummary,
  DetailedSessionResults,
  QuestionResultBreakdown,
  StudyRecommendations,
  FocusArea,
  SessionFilters,
} from '../shared/types/session.types';
import {
  StudySession,
  Question,
  StatusType,
} from '../shared/types/domain.types';
import {
  ISessionRepository,
} from '../repositories/session.repository';
import {
  DifficultyPerformance,
  TopicPerformanceBreakdown,
  TimeDistribution,
  UserProgressUpdate,
} from '../shared/types/analytics.types';
import { IProviderService } from './provider.service';
import { IExamService } from './exam.service';
import { ITopicService } from './topic.service';
import { IQuestionService } from './question.service';
import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';
import { v4 as uuidv4 } from 'uuid';

// Re-export the interface for ServiceFactory
export type { ISessionService };

export class SessionService extends BaseService implements ISessionService {
  constructor(
    private sessionRepository: ISessionRepository,
    private sessionOrchestrator: ISessionOrchestrator,
    private answerProcessor: IAnswerProcessor,
    private providerService: IProviderService,
    private examService: IExamService,
    private topicService: ITopicService,
    private questionService: IQuestionService
  ) {
    super();
  }

  /**
   * Create a new study session with configuration
   * Phase 15: Session Creation Feature
   * Orchestrates SessionOrchestrator for question selection
   */
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    this.logger.info('Creating new session', {
      examId: request.examId,
      providerId: request.providerId,
      sessionType: request.sessionType,
      questionCount: request.questionCount,
      topics: request.topics,
      difficulty: request.difficulty,
      timeLimit: request.timeLimit,
    });

    try {
      // Validate the request
      await this.validateSessionRequest(request);

      // Use SessionOrchestrator to get questions for the session
      const questions = await this.sessionOrchestrator.getQuestionsForSession(request);

      if (questions.length === 0) {
        throw new Error('No questions found matching the specified criteria');
      }

      // Use SessionOrchestrator for question selection
      const requestedCount = request.questionCount || questions.length;
      const sessionQuestions = request.isAdaptive
        ? this.sessionOrchestrator.selectAdaptiveQuestions(questions, requestedCount)
        : this.sessionOrchestrator.selectSessionQuestions(questions, requestedCount);

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
        status: StatusType.ACTIVE,
        questions: sessionQuestions.map(q => ({
          questionId: q.questionId,
          correctAnswer: q.correctAnswer || [],
          timeSpent: 0,
          skipped: false,
          markedForReview: false,
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
              hard: Math.round(requestedCount * 0.2),
            },
            adjustmentAlgorithm: 'difficulty-based',
          },
        }),
        createdAt: now,
        updatedAt: now,
      };

      // Store session using repository
      const createdSession = await this.sessionRepository.create(session);

      // Use SessionOrchestrator to get question details
      const questionResponses =
        await this.sessionOrchestrator.getSessionQuestionsWithDetails(createdSession);

      const response: CreateSessionResponse = {
        session: createdSession,
        questions: questionResponses,
      };

      this.logger.info('Session created successfully', {
        sessionId: createdSession.sessionId,
        totalQuestions: createdSession.totalQuestions,
        providerId: createdSession.providerId,
        examId: createdSession.examId,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create session', error as Error, {
        examId: request.examId,
        providerId: request.providerId,
      });
      throw error;
    }
  }

  /**
   * Get session details with current progress
   * Phase 16: Session Retrieval Feature
   */
  async getSession(sessionId: string): Promise<GetSessionResponse> {
    this.logger.info('Getting session', { sessionId });

    try {
      const session = await this.sessionRepository.findById(sessionId);

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Use SessionOrchestrator to get detailed question information
      const questions = await this.sessionOrchestrator.getSessionQuestionsWithDetails(session);

      // Use SessionOrchestrator to calculate progress
      const progress = this.sessionOrchestrator.calculateSessionProgress(session);

      this.logger.info('Session retrieved successfully', {
        sessionId,
        status: session.status,
        currentQuestion: progress.currentQuestion,
        totalQuestions: progress.totalQuestions,
      });

      return {
        session,
        questions,
        progress,
      };
    } catch (error) {
      this.logger.error('Failed to get session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Update session state
   * Phase 17: Session Update Feature
   */
  async updateSession(
    sessionId: string,
    request: UpdateSessionRequest
  ): Promise<UpdateSessionResponse> {
    this.logger.info('Updating session', { sessionId, action: request.action });

    try {
      const existingSession = await this.sessionRepository.findById(sessionId);

      if (!existingSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Validate update request
      this.validateUpdateRequest(request, existingSession);

      const updatedSession = { ...existingSession };

      // Handle different update actions
      switch (request.action) {
        case 'pause':
          updatedSession.status = StatusType.PAUSED;
          break;

        case 'resume':
          updatedSession.status = StatusType.ACTIVE;
          break;

        case 'next':
          updatedSession.currentQuestionIndex = Math.min(
            updatedSession.currentQuestionIndex + 1,
            updatedSession.questions.length - 1
          );
          break;

        case 'previous':
          updatedSession.currentQuestionIndex = Math.max(
            updatedSession.currentQuestionIndex - 1,
            0
          );
          break;

        case 'answer':
          // For answer actions, delegate to AnswerProcessor
          if (request.questionId && request.userAnswer && request.timeSpent !== undefined) {
            const answerResult = await this.answerProcessor.submitAnswer(sessionId, {
              questionId: request.questionId,
              answer: request.userAnswer,
              timeSpent: request.timeSpent,
              skipped: request.skipped || false,
              markedForReview: request.markedForReview || false,
            });

            // Return the answer processing result
            return {
              session: answerResult.session,
              questions: await this.sessionOrchestrator.getSessionQuestionsWithDetails(
                answerResult.session
              ),
              progress: answerResult.progress,
            };
          } else {
            throw new Error('Missing required fields for answer action');
          }

        case 'mark_for_review':
          if (request.questionId) {
            const questionIndex = updatedSession.questions.findIndex(
              q => q.questionId === request.questionId
            );
            if (questionIndex !== -1) {
              updatedSession.questions[questionIndex].markedForReview =
                request.markedForReview || false;
            }
          }
          break;

        case 'complete':
          // Delegate to AnswerProcessor for completion
          const completeResult = await this.answerProcessor.completeSession(sessionId);
          const completedSession = await this.sessionRepository.findById(sessionId);

          if (completedSession) {
            return {
              session: completedSession,
              questions:
                await this.sessionOrchestrator.getSessionQuestionsWithDetails(completedSession),
              progress: this.sessionOrchestrator.calculateSessionProgress(completedSession),
            };
          } else {
            throw new Error('Failed to retrieve completed session');
          }
      }

      // Update timestamps and save
      updatedSession.updatedAt = new Date().toISOString();
      const savedSession = await this.sessionRepository.update(sessionId, updatedSession);

      // Get updated question details and progress
      const questions = await this.sessionOrchestrator.getSessionQuestionsWithDetails(savedSession);
      const progress = this.sessionOrchestrator.calculateSessionProgress(savedSession);

      this.logger.info('Session updated successfully', {
        sessionId,
        action: request.action,
        newStatus: savedSession.status,
      });

      return {
        session: savedSession,
        questions,
        progress,
      };
    } catch (error) {
      this.logger.error('Failed to update session', error as Error, {
        sessionId,
        action: request.action,
      });
      throw error;
    }
  }

  /**
   * Delete session
   * Phase 19: Session Deletion Feature
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    this.logger.info('Deleting session', { sessionId });

    try {
      const session = await this.sessionRepository.findById(sessionId);

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Don't allow deletion of completed sessions - they are archived for analytics
      if (session.status === StatusType.COMPLETED) {
        throw new Error('Cannot delete completed sessions - they are archived for analytics');
      }

      // For active/paused sessions, mark as abandoned instead of hard delete
      if (session.status === StatusType.ACTIVE || session.status === StatusType.PAUSED) {
        await this.sessionRepository.update(sessionId, {
          status: StatusType.ABANDONED,
          updatedAt: new Date().toISOString(),
        });

        this.logger.info('Session marked as abandoned', { sessionId });
      } else {
        // For already abandoned sessions or other statuses, perform hard delete
        await this.sessionRepository.delete(sessionId);
        this.logger.info('Session hard deleted', { sessionId });
      }

      return {
        success: true,
        message: 'Session deleted successfully',
      };
    } catch (error) {
      this.logger.error('Failed to delete session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Submit answer for a question - Delegates to AnswerProcessor
   * Phase 18: Answer Submission Feature
   */
  async submitAnswer(
    sessionId: string,
    request: SubmitAnswerRequest
  ): Promise<SubmitAnswerResponse> {
    this.logger.info('Delegating answer submission to AnswerProcessor', {
      sessionId,
      questionId: request.questionId,
    });

    try {
      return await this.answerProcessor.submitAnswer(sessionId, request);
    } catch (error) {
      this.logger.error('Failed to submit answer', error as Error, {
        sessionId,
        questionId: request.questionId,
      });
      throw error;
    }
  }

  /**
   * Complete session - Delegates to AnswerProcessor
   * Phase 21: Session Completion Feature
   */
  async completeSession(sessionId: string): Promise<CompleteSessionResponse> {
    this.logger.info('Delegating session completion to AnswerProcessor', { sessionId });

    try {
      return await this.answerProcessor.completeSession(sessionId);
    } catch (error) {
      this.logger.error('Failed to complete session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Validate session creation request
   * Phase 15: Session Creation Feature
   */
  private async validateSessionRequest(request: CreateSessionRequest): Promise<void> {
    // Validate provider exists
    const providerResponse = await this.providerService.getProvider({ id: request.providerId });
    const provider = providerResponse.provider;
    if (!provider) {
      throw new Error(`Provider not found: ${request.providerId}`);
    }

    // Validate exam exists
    const examResponse = await this.examService.getExam(request.examId, {});
    const exam = examResponse.exam;
    if (!exam) {
      throw new Error(`Exam not found: ${request.examId}`);
    }

    // Validate exam belongs to provider
    if (exam.providerId !== request.providerId) {
      throw new Error(`Exam ${request.examId} does not belong to provider ${request.providerId}`);
    }

    // Validate topics if specified
    if (request.topics && request.topics.length > 0) {
      for (const topicId of request.topics) {
        const topicResponse = await this.topicService.getTopic({ id: topicId });
        const topic = topicResponse.topic;
        if (!topic) {
          throw new Error(`Topic not found: ${topicId}`);
        }
        if (topic.examId !== request.examId) {
          throw new Error(`Topic ${topicId} does not belong to exam ${request.examId}`);
        }
      }
    }

    // Validate question count limits
    if (request.questionCount !== undefined) {
      if (request.questionCount < 1) {
        throw new Error('Question count must be at least 1');
      }
      if (request.questionCount > 100) {
        throw new Error('Question count cannot exceed 100');
      }
    }

    // Validate time limit if specified
    if (request.timeLimit !== undefined) {
      if (request.timeLimit < 5) {
        throw new Error('Time limit must be at least 5 minutes');
      }
      if (request.timeLimit > 240) {
        throw new Error('Time limit cannot exceed 240 minutes (4 hours)');
      }
    }
  }

  /**
   * Validate session update request
   * Phase 17: Session Update Feature
   */
  private validateUpdateRequest(
    request: UpdateSessionRequest,
    existingSession: StudySession
  ): void {
    if (existingSession.status === StatusType.COMPLETED) {
      throw new Error('Cannot update completed session');
    }

    if (request.action === 'answer') {
      if (!request.questionId || !request.userAnswer || request.timeSpent === undefined) {
        throw new Error(
          'Missing required fields for answer action: questionId, userAnswer, timeSpent'
        );
      }
    }

    if (request.action === 'mark_for_review') {
      if (!request.questionId || request.markedForReview === undefined) {
        throw new Error(
          'Missing required fields for mark_for_review action: questionId, markedForReview'
        );
      }
    }
  }
}
