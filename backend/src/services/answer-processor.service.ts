// Answer Processor Service - Phase 5: SessionService Decomposition
// Handles answer submission, scoring, and session completion logic

import { v4 as uuidv4 } from 'uuid';
import { StudySession, SessionQuestion, Question, DifficultyLevel, StatusType } from '../shared/types/domain.types';
import {
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  AnswerFeedback,
  CompleteSessionResponse,
  SessionProgress,
  QuestionResponse,
  IAnswerProcessor,
} from '../shared/types/session.types';
import { ISessionRepository } from '../repositories/session.repository';
import { ISessionOrchestrator } from './session-orchestrator.service';
import { ISessionAnalyzer } from './session-analyzer.service';
import { ITopicService } from './topic.service';
import { IQuestionService } from './question.service';
import { createLogger } from '../shared/logger';
import { Question as ServiceQuestion } from '../shared/types/question.types';

export class AnswerProcessor implements IAnswerProcessor {
  private logger = createLogger({ component: 'AnswerProcessor' });


  /**
   * Map QuestionDifficulty to domain difficulty format
   */
  private mapDifficulty(difficulty: any): DifficultyLevel {
    if (typeof difficulty === 'string') {
      const lower = difficulty.toLowerCase();
      if (lower === 'easy' || lower === 'beginner') return DifficultyLevel.EASY;
      if (lower === 'medium' || lower === 'intermediate') return DifficultyLevel.MEDIUM;
      if (lower === 'hard' || lower === 'advanced' || lower === 'difficult') return DifficultyLevel.HARD;
    }
    return DifficultyLevel.MEDIUM; // default
  }

  /**
   * Map DifficultyLevel enum to string literal for API responses
   */
  private mapDifficultyToString(difficulty: DifficultyLevel | string): 'easy' | 'medium' | 'hard' {
    if (typeof difficulty === 'string') {
      const lower = difficulty.toLowerCase();
      if (lower === 'easy' || lower === 'beginner' || lower === DifficultyLevel.EASY) return 'easy';
      if (lower === 'medium' || lower === 'intermediate' || lower === DifficultyLevel.MEDIUM) return 'medium';
      if (lower === 'hard' || lower === 'advanced' || lower === 'difficult' || lower === DifficultyLevel.HARD) return 'hard';
    }
    if (difficulty === DifficultyLevel.EASY) return 'easy';
    if (difficulty === DifficultyLevel.MEDIUM) return 'medium';
    if (difficulty === DifficultyLevel.HARD) return 'hard';
    return 'medium'; // default
  }

  constructor(
    private sessionRepository: ISessionRepository,
    private sessionOrchestrator: ISessionOrchestrator,
    private sessionAnalyzer: ISessionAnalyzer,
    private topicService: ITopicService,
    private questionService: IQuestionService
  ) {}

  /**
   * Submit answer for a question in the session
   * Phase 18: Answer Submission Feature
   */
  async submitAnswer(
    sessionId: string,
    request: SubmitAnswerRequest
  ): Promise<SubmitAnswerResponse> {
    this.logger.info('Processing answer submission', {
      sessionId,
      questionId: request.questionId,
      answerLength: request.answer.length,
      timeSpent: request.timeSpent,
      skipped: request.skipped,
      markedForReview: request.markedForReview,
    });

    try {
      // Step 1: Retrieve the session
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (session.status !== StatusType.ACTIVE) {
        throw new Error(`Cannot submit answer for session with status: ${session.status}`);
      }

      // Step 2: Find the question in the session
      const questionIndex = session.questions.findIndex(q => q.questionId === request.questionId);
      if (questionIndex === -1) {
        throw new Error(`Question not found in session: ${request.questionId}`);
      }

      // Step 3: Get question details for scoring and feedback
      const questionResponse = await this.questionService.getQuestion({
        questionId: request.questionId,
      });
      const serviceQuestionDetails = questionResponse.question;
      if (!serviceQuestionDetails) {
        throw new Error(`Question details not found: ${request.questionId}`);
      }
      const questionDetails = serviceQuestionDetails;

      // Step 4: Calculate answer correctness and score
      const isCorrect = this.calculateAnswerCorrectness(
        request.answer,
        questionDetails.correctAnswer
      );
      const score = this.calculateQuestionScore(
        isCorrect,
        questionDetails.difficulty,
        request.timeSpent
      );

      // Step 5: Update session question with answer
      const updatedSession = { ...session };
      updatedSession.questions[questionIndex] = {
        ...updatedSession.questions[questionIndex],
        userAnswer: request.answer,
        correctAnswer: questionDetails.correctAnswer,
        isCorrect,
        timeSpent: request.timeSpent,
        skipped: request.skipped || false,
        markedForReview: request.markedForReview || false,
        answeredAt: new Date().toISOString(),
      };

      // Update session-level counters
      updatedSession.correctAnswers = updatedSession.questions.filter(
        q => q.isCorrect === true
      ).length;
      updatedSession.updatedAt = new Date().toISOString();

      // Step 6: Move to next question if not skipped
      if (!request.skipped) {
        updatedSession.currentQuestionIndex = Math.min(
          updatedSession.currentQuestionIndex + 1,
          updatedSession.questions.length - 1
        );
      }

      // Step 7: Save updated session
      await this.sessionRepository.update(sessionId, updatedSession);

      // Step 8: Get topic information for feedback
      const topicResponse = await this.topicService.getTopic({ id: questionDetails.topicId || '' });
      const topic = topicResponse.topic;

      // Step 9: Create answer feedback
      const feedback: AnswerFeedback = {
        questionId: request.questionId,
        isCorrect,
        correctAnswer: questionDetails.correctAnswer,
        userAnswer: request.answer,
        explanation: questionDetails.explanation,
        score,
        timeSpent: request.timeSpent,
        questionDifficulty: this.mapDifficultyToString(questionDetails.difficulty),
        topicId: questionDetails.topicId,
        topicName: topic?.name || 'Unknown Topic',
      };

      // Step 10: Calculate session progress
      const progress = this.sessionOrchestrator.calculateSessionProgress(updatedSession);

      // Step 11: Get next question details if not at end
      let nextQuestion: QuestionResponse | undefined;
      if (updatedSession.currentQuestionIndex < updatedSession.questions.length - 1) {
        const nextQuestionIndex = updatedSession.currentQuestionIndex + 1;
        const nextSessionQuestion = updatedSession.questions[nextQuestionIndex];
        const nextQuestionResponse = await this.questionService.getQuestion({
          questionId: nextSessionQuestion.questionId,
        });
        const nextQuestionDetails = nextQuestionResponse.question;

        if (nextQuestionDetails) {
          const nextTopicResponse = await this.topicService.getTopic({
            id: nextQuestionDetails.topicId || '',
          });
          const nextTopic = nextTopicResponse.topic;
          nextQuestion = {
            questionId: nextQuestionDetails.questionId,
            text: nextQuestionDetails.questionText,
            options: nextQuestionDetails.options.map((optText, index) => ({
              id: index.toString(),
              text: optText,
            })),
            topicId: nextQuestionDetails.topicId || '',
            topicName: nextTopic?.name || 'Unknown Topic',
            difficulty: this.mapDifficultyToString(nextQuestionDetails.difficulty),
            timeAllowed: this.calculateTimeAllowed(nextQuestionDetails.difficulty),
            markedForReview: nextSessionQuestion.markedForReview,
          };
        }
      }

      this.logger.info('Answer submitted successfully', {
        sessionId,
        questionId: request.questionId,
        isCorrect,
        score,
        sessionProgress: {
          currentQuestion: progress.currentQuestion,
          totalQuestions: progress.totalQuestions,
          accuracy: progress.accuracy,
        },
      });

      const response: SubmitAnswerResponse = {
        success: true,
        feedback,
        session: updatedSession,
        progress,
        ...(nextQuestion && { nextQuestion }),
      };

      return response;
    } catch (error) {
      this.logger.error('Error submitting answer', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        request,
      });
      throw error;
    }
  }

  /**
   * Calculate if user answer matches correct answer
   * Phase 18: Answer Submission Feature
   */
  private calculateAnswerCorrectness(userAnswer: string[], correctAnswer: string[]): boolean {
    if (userAnswer.length !== correctAnswer.length) {
      return false;
    }

    const sortedUserAnswer = [...userAnswer].sort();
    const sortedCorrectAnswer = [...correctAnswer].sort();

    return sortedUserAnswer.every((answer, index) => answer === sortedCorrectAnswer[index]);
  }

  /**
   * Calculate score for a question based on correctness, difficulty, and time
   * Phase 18: Answer Submission Feature
   */
  private calculateQuestionScore(
    isCorrect: boolean,
    difficulty: DifficultyLevel | string,
    timeSpent: number
  ): number {
    if (!isCorrect) return 0;

    // Convert enum to string for lookup
    const difficultyStr = String(difficulty).toLowerCase();

    // Base points by difficulty
    const basePoints = {
      easy: 1,
      medium: 2,
      hard: 3,
      beginner: 1,
      intermediate: 2,
      advanced: 3,
      expert: 3,
    };

    const points = basePoints[difficultyStr as keyof typeof basePoints] || 2;

    // Time bonus: up to 50% bonus for fast answers
    const expectedTime = this.calculateTimeAllowed(difficultyStr);
    const timeFactor = Math.max(0.5, Math.min(1.5, expectedTime / timeSpent));

    return Math.round(points * timeFactor);
  }

  /**
   * Calculate total session score
   * Phase 21: Session Completion Feature
   */
  private calculateTotalSessionScore(questions: SessionQuestion[], baseDifficulty: string): number {
    return questions.reduce((total, question) => {
      if (question.isCorrect) {
        const score = this.calculateQuestionScore(true, baseDifficulty, question.timeSpent);
        return total + score;
      }
      return total;
    }, 0);
  }

  /**
   * Complete a study session
   * Phase 21: Session Completion Feature
   */
  async completeSession(sessionId: string): Promise<CompleteSessionResponse> {
    this.logger.info('Starting session completion', { sessionId });

    try {
      // Step 1: Get and validate session
      const session = await this.sessionRepository.findById(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      if (session.status === StatusType.COMPLETED) {
        throw new Error('Session is already completed');
      }

      if (session.status === StatusType.ABANDONED) {
        throw new Error('Cannot complete abandoned session');
      }

      // Step 2: Check if all questions are answered
      const unansweredQuestions = session.questions.filter(q => q.isCorrect === undefined);
      if (unansweredQuestions.length > 0) {
        throw new Error(
          `Cannot complete session: ${unansweredQuestions.length} questions remain unanswered`
        );
      }

      // Step 3: Update session status to completed
      const completedAt = new Date().toISOString();
      const completedSession = await this.sessionRepository.update(sessionId, {
        status: StatusType.COMPLETED,
        endTime: completedAt,
      });

      // Step 4: Get question details for analysis
      const questionDetails = await this.getQuestionDetailsForCompletion(completedSession);

      // Step 5: Generate session summary
      const sessionSummary = this.generateSessionSummary(
        completedSession,
        questionDetails,
        completedAt
      );

      // Step 6: Get detailed analysis from SessionAnalyzer
      const detailedResults = await this.sessionAnalyzer.analyzeSessionResults(completedSession);

      // Step 7: Generate recommendations
      const recommendations = await this.sessionAnalyzer.generateStudyRecommendations(
        completedSession,
        detailedResults
      );

      this.logger.info('Session completed successfully', {
        sessionId,
        accuracy: sessionSummary.accuracy,
        totalQuestions: sessionSummary.totalQuestions,
      });

      return {
        success: true,
        sessionSummary,
        detailedResults,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Failed to complete session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Get question details for session completion analysis
   * Phase 21: Session Completion Feature
   */
  private async getQuestionDetailsForCompletion(session: StudySession): Promise<Question[]> {
    const questionDetails = await Promise.all(
      session.questions.map(async sessionQuestion => {
        const questionResponse = await this.questionService.getQuestion({
          questionId: sessionQuestion.questionId,
        });
        const questionData = questionResponse.question;
        if (!questionData) {
          throw new Error(`Question not found for completion: ${sessionQuestion.questionId}`);
        }
        return questionData;
      })
    );

    return questionDetails;
  }

  /**
   * Generate session summary for completion
   * Phase 21: Session Completion Feature
   */
  private generateSessionSummary(
    session: StudySession,
    questionDetails: Question[],
    completedAt: string
  ) {
    const questionsAnswered = session.questions.filter(q => q.userAnswer !== undefined).length;
    const questionsCorrect = session.questions.filter(q => q.isCorrect === true).length;
    const questionsSkipped = session.questions.filter(q => q.skipped).length;
    const questionsReviewed = session.questions.filter(q => q.markedForReview).length;

    const accuracy = questionsAnswered > 0 ? (questionsCorrect / questionsAnswered) * 100 : 0;
    const totalTimeSpent = session.questions.reduce((total, q) => total + q.timeSpent, 0);
    const averageTimePerQuestion = questionsAnswered > 0 ? totalTimeSpent / questionsAnswered : 0;

    // Calculate topic breakdown
    const topicBreakdown = this.calculateTopicBreakdown(session, questionDetails);

    return {
      sessionId: session.sessionId,
      totalQuestions: session.totalQuestions,
      questionsAnswered,
      questionsCorrect,
      questionsSkipped,
      questionsReviewed,
      accuracy,
      totalTimeSpent,
      averageTimePerQuestion,
      score: session.score || 0,
      passingScore: Math.floor(session.totalQuestions * 0.7), // 70% passing
      passed: accuracy >= 70,
      topicBreakdown,
      completedAt,
    };
  }

  /**
   * Calculate topic breakdown for session summary
   */
  private calculateTopicBreakdown(session: StudySession, questionDetails: Question[]) {
    const topicStats = new Map();

    session.questions.forEach((sessionQuestion, index) => {
      const question = questionDetails[index];
      if (!question) return;

      const topicId = question.topicId;
      if (!topicStats.has(topicId)) {
        topicStats.set(topicId, {
          topicId,
          topicName: question.topicId, // Will be enhanced with real topic names
          questionsTotal: 0,
          questionsCorrect: 0,
          totalTime: 0,
        });
      }

      const stats = topicStats.get(topicId);
      stats.questionsTotal++;
      if (sessionQuestion.isCorrect) stats.questionsCorrect++;
      stats.totalTime += sessionQuestion.timeSpent;
    });

    return Array.from(topicStats.values()).map(stats => ({
      ...stats,
      accuracy:
        stats.questionsTotal > 0 ? (stats.questionsCorrect / stats.questionsTotal) * 100 : 0,
      averageTime: stats.questionsTotal > 0 ? stats.totalTime / stats.questionsTotal : 0,
    }));
  }

  /**
   * Generate study recommendations based on session performance
   */
  private generateStudyRecommendations(
    session: StudySession,
    detailedResults: any,
    questionDetails: Question[]
  ) {
    const accuracy = detailedResults.accuracyPercentage;

    let overallRecommendation:
      | 'excellent'
      | 'good'
      | 'needs_improvement'
      | 'requires_focused_study';
    let readinessForExam: boolean;
    let suggestedStudyTime: number;

    if (accuracy >= 85) {
      overallRecommendation = 'excellent';
      readinessForExam = true;
      suggestedStudyTime = 30;
    } else if (accuracy >= 75) {
      overallRecommendation = 'good';
      readinessForExam = true;
      suggestedStudyTime = 45;
    } else if (accuracy >= 60) {
      overallRecommendation = 'needs_improvement';
      readinessForExam = false;
      suggestedStudyTime = 60;
    } else {
      overallRecommendation = 'requires_focused_study';
      readinessForExam = false;
      suggestedStudyTime = 90;
    }

    return {
      overallRecommendation,
      readinessForExam,
      suggestedStudyTime,
      focusAreas: [],
      nextSessionRecommendation: {
        sessionType: 'practice' as const,
        topics: [],
        difficulty: accuracy < 70 ? ('easy' as const) : ('medium' as const),
        questionCount: 20,
      },
      motivationalMessage: this.generateMotivationalMessage(accuracy, session.totalQuestions),
    };
  }

  /**
   * Generate motivational message based on performance
   */
  private generateMotivationalMessage(accuracy: number, totalQuestions: number): string {
    if (accuracy >= 90) {
      return `Outstanding performance! You answered ${totalQuestions} questions with ${accuracy.toFixed(1)}% accuracy. You're well-prepared for the exam!`;
    } else if (accuracy >= 75) {
      return `Great job! ${accuracy.toFixed(1)}% accuracy shows solid understanding. Keep practicing to maintain this level.`;
    } else if (accuracy >= 60) {
      return `Good progress! ${accuracy.toFixed(1)}% accuracy is a solid foundation. Focus on your weak areas to improve further.`;
    } else {
      return `Keep studying! ${accuracy.toFixed(1)}% accuracy shows you're learning. Focus on understanding concepts and practice regularly.`;
    }
  }

  /**
   * Calculate time allowed for question based on difficulty
   */
  private calculateTimeAllowed(difficulty: DifficultyLevel | string): number {
    // Convert enum to string for lookup
    const difficultyStr = String(difficulty).toLowerCase();
    
    switch (difficultyStr) {
      case 'easy':
      case 'beginner':
        return 60; // 1 minute
      case 'medium':
      case 'intermediate':
        return 90; // 1.5 minutes
      case 'hard':
      case 'advanced':
      case 'expert':
        return 120; // 2 minutes
      default:
        return 90; // Default to medium
    }
  }
}

// Re-export the interface for ServiceFactory
export type { IAnswerProcessor };
