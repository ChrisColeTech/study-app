// Session Orchestrator Service - Phase 5: SessionService Decomposition
// Handles question coordination, session configuration, and selection algorithms

import { StudySession, Question, DifficultyLevel } from '../shared/types/domain.types';
import {
  CreateSessionRequest,
  QuestionResponse,
  SessionQuestionOption,
  SessionProgress,
  ISessionOrchestrator,
} from '../shared/types/session.types';
import { IProviderService } from './provider.service';
import { IExamService } from './exam.service';
import { ITopicService } from './topic.service';
import { IQuestionService } from './question.service';
import { createLogger } from '../shared/logger';
import { Question as ServiceQuestion } from '../shared/types/question.types';

export class SessionOrchestrator implements ISessionOrchestrator {
  private logger = createLogger({ component: 'SessionOrchestrator' });

  constructor(
    private providerService: IProviderService,
    private examService: IExamService,
    private topicService: ITopicService,
    private questionService: IQuestionService
  ) {}

  /**
   * Get questions for session based on configuration
   * Phase 15: Session Creation Feature
   */
  async getQuestionsForSession(request: CreateSessionRequest): Promise<Question[]> {
    this.logger.info('Getting questions for session', {
      examId: request.examId,
      providerId: request.providerId,
      sessionType: request.sessionType,
      questionCount: request.questionCount,
      topics: request.topics,
      difficulty: request.difficulty,
    });

    try {
      // Step 1: Get all questions for the specified exam
      const questionsResponse = await this.questionService.getQuestions({ exam: request.examId });
      const allQuestions = questionsResponse.questions;

      if (allQuestions.length === 0) {
        throw new Error(`No questions found for examId: ${request.examId}`);
      }

      let filteredQuestions = allQuestions;

      // Step 2: Filter by provider if not already filtered by exam
      if (request.providerId) {
        filteredQuestions = filteredQuestions.filter(q => q.providerId === request.providerId);
      }

      // Step 3: Filter by topics if specified
      if (request.topics && request.topics.length > 0) {
        filteredQuestions = filteredQuestions.filter(
          q => q.topicId && request.topics!.includes(q.topicId)
        );
      }

      // Step 4: Filter by difficulty if specified
      if (request.difficulty) {
        filteredQuestions = filteredQuestions.filter(
          q => this.mapDifficulty(q.difficulty) === request.difficulty
        );
      }

      // Step 5: Convert to domain Question type and validate
      const questions = filteredQuestions.map(q => this.mapQuestionToDomainType(q));

      this.logger.info('Questions retrieved successfully', {
        totalQuestions: allQuestions.length,
        filteredQuestions: questions.length,
        filters: {
          topics: request.topics,
          difficulty: request.difficulty,
        },
      });

      return questions;
    } catch (error) {
      this.logger.error('Error getting questions for session', {
        error: error instanceof Error ? error.message : String(error),
        request,
      });
      throw error;
    }
  }

  /**
   * Get session questions with details for display
   * Phase 15: Session Creation Feature
   */
  async getSessionQuestionsWithDetails(session: StudySession): Promise<QuestionResponse[]> {
    this.logger.info('Getting session questions with details', {
      sessionId: session.sessionId,
      questionCount: session.questions.length,
    });

    try {
      const questionDetails = await Promise.all(
        session.questions.map(async sessionQuestion => {
          const questionResponse = await this.questionService.getQuestion({
            questionId: sessionQuestion.questionId,
          });
          const questionData = questionResponse.question;

          if (!questionData) {
            throw new Error(`Question not found: ${sessionQuestion.questionId}`);
          }

          // Get topic name
          const topicResponse = await this.topicService.getTopic({
            id: questionData.topicId || '',
          });
          const topic = topicResponse.topic;
          const topicName = topic?.name || 'Unknown Topic';

          return {
            questionId: questionData.questionId,
            text: questionData.questionText,
            options: questionData.options.map(
              (optText, index) =>
                ({
                  id: index.toString(),
                  text: optText,
                }) as SessionQuestionOption
            ),
            topicId: questionData.topicId || '',
            topicName,
            difficulty: this.mapDifficulty(questionData.difficulty),
            timeAllowed: this.calculateTimeAllowed(questionData.difficulty),
            markedForReview: sessionQuestion.markedForReview,
          } as QuestionResponse;
        })
      );

      this.logger.info('Session questions with details retrieved successfully', {
        sessionId: session.sessionId,
        detailsCount: questionDetails.length,
      });

      return questionDetails;
    } catch (error) {
      this.logger.error('Error getting session questions with details', {
        error: error instanceof Error ? error.message : String(error),
        sessionId: session.sessionId,
      });
      throw error;
    }
  }

  /**
   * Select session questions using standard algorithm
   * Phase 15: Session Creation Feature
   */
  selectSessionQuestions(questions: Question[], count: number): Question[] {
    this.logger.info('Selecting session questions', {
      availableQuestions: questions.length,
      requestedCount: count,
    });

    if (questions.length === 0) {
      return [];
    }

    const selectedQuestions =
      count >= questions.length ? [...questions] : this.selectRandomQuestions(questions, count);

    this.logger.info('Session questions selected', {
      selectedCount: selectedQuestions.length,
    });

    return selectedQuestions;
  }

  /**
   * Select session questions using adaptive algorithm
   * Phase 22: Adaptive Sessions Feature
   */
  selectAdaptiveQuestions(questions: Question[], count: number): Question[] {
    this.logger.info('Selecting adaptive session questions', {
      availableQuestions: questions.length,
      requestedCount: count,
    });

    if (questions.length === 0) {
      return [];
    }

    // For adaptive sessions, create difficulty distribution
    // 30% easy, 50% medium, 20% hard
    const easyCount = Math.ceil(count * 0.3);
    const mediumCount = Math.ceil(count * 0.5);
    const hardCount = count - easyCount - mediumCount;

    const easyQuestions = questions.filter(q => q.difficulty === 'easy');
    const mediumQuestions = questions.filter(q => q.difficulty === 'medium');
    const hardQuestions = questions.filter(q => q.difficulty === 'hard');

    const selectedQuestions: Question[] = [];

    // Select questions from each difficulty level
    selectedQuestions.push(...this.selectRandomQuestions(easyQuestions, easyCount));
    selectedQuestions.push(...this.selectRandomQuestions(mediumQuestions, mediumCount));
    selectedQuestions.push(...this.selectRandomQuestions(hardQuestions, hardCount));

    // If we don't have enough questions in specific difficulties, fill from all questions
    if (selectedQuestions.length < count) {
      const remainingCount = count - selectedQuestions.length;
      const remainingQuestions = questions.filter(
        q => !selectedQuestions.some(selected => selected.questionId === q.questionId)
      );
      selectedQuestions.push(...this.selectRandomQuestions(remainingQuestions, remainingCount));
    }

    this.logger.info('Adaptive session questions selected', {
      selectedCount: selectedQuestions.length,
      distribution: {
        easy: selectedQuestions.filter(q => q.difficulty === 'easy').length,
        medium: selectedQuestions.filter(q => q.difficulty === 'medium').length,
        hard: selectedQuestions.filter(q => q.difficulty === 'hard').length,
      },
    });

    return selectedQuestions.slice(0, count);
  }

  /**
   * Calculate session progress
   * Phase 15: Session Creation Feature
   */
  calculateSessionProgress(session: StudySession): SessionProgress {
    const answeredQuestions = session.questions.filter(q => q.userAnswer !== undefined).length;
    const correctAnswers = session.questions.filter(q => q.isCorrect === true).length;
    const totalQuestions = session.questions.length;

    // Calculate time elapsed
    const startTime = new Date(session.startTime).getTime();
    const currentTime = new Date().getTime();
    const timeElapsed = Math.floor((currentTime - startTime) / 1000);

    // Calculate accuracy (avoid division by zero)
    const accuracy = answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0;

    const progress: SessionProgress = {
      sessionId: session.sessionId,
      currentQuestion: session.currentQuestionIndex + 1,
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      timeElapsed,
      accuracy,
    };

    this.logger.debug('Session progress calculated', { progress });

    return progress;
  }

  /**
   * Map question data to domain Question type
   * Phase 15: Session Creation Feature
   */
  private mapQuestionToDomainType(q: ServiceQuestion): Question {
    return {
      questionId: q.questionId,
      providerId: q.providerId,
      examId: q.examId,
      topicId: q.topicId || '',
      questionText: q.questionText,
      options: q.options || [],
      correctAnswer: q.correctAnswer || [],
      explanation: q.explanation || '',
      difficulty: q.difficulty || DifficultyLevel.MEDIUM,
      tags: q.tags || [],
      createdAt: q.createdAt || new Date().toISOString(),
      updatedAt: q.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Map QuestionDifficulty to domain difficulty format
   */
  private mapDifficulty(difficulty: any): 'easy' | 'medium' | 'hard' {
    if (typeof difficulty === 'string') {
      const lower = difficulty.toLowerCase();
      if (lower === 'easy' || lower === 'beginner') return 'easy';
      if (lower === 'medium' || lower === 'intermediate') return 'medium';
      if (lower === 'hard' || lower === 'advanced' || lower === 'difficult') return 'hard';
    }
    return 'medium'; // default
  }

  /**
   * Select random questions from array
   * Phase 15: Session Creation Feature
   */
  private selectRandomQuestions(questions: Question[], count: number): Question[] {
    if (questions.length <= count) {
      return [...questions];
    }

    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Calculate time allowed for question based on difficulty
   * Phase 15: Session Creation Feature
   */
  private calculateTimeAllowed(difficulty: string): number {
    switch (difficulty) {
      case 'easy':
        return 60; // 1 minute
      case 'medium':
        return 90; // 1.5 minutes
      case 'hard':
        return 120; // 2 minutes
      default:
        return 90; // Default to medium
    }
  }
}

// Re-export the interface for ServiceFactory
export type { ISessionOrchestrator };
