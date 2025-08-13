// Dedicated mapper for session data transformations
// Extracted from SessionOrchestrator and SessionService to separate mapping concerns

import { StudySession } from '../shared/types/domain.types';
import { DifficultyLevel } from '../shared/types/domain.types';
import {
  SessionProgress,
  QuestionResponse,
  SessionQuestionOption,
  CreateSessionResponse,
  GetSessionResponse,
  UpdateSessionResponse,
  SessionSummary,
  SessionTopicBreakdown,
  AnswerFeedback
} from '../shared/types/session.types';
import { EnhancedQuestion } from '../shared/types/question.types';

/**
 * SessionMapper - Dedicated mapper for session data transformations
 * 
 * Extracted from SessionOrchestrator and SessionService to separate concerns and
 * provide standardized transformation patterns for session-related data objects.
 * 
 * @responsibilities
 * - Calculate session progress from StudySession objects
 * - Transform questions to session question responses
 * - Create session response objects with progress and question data
 * - Generate session summaries and topic breakdowns
 */
export class SessionMapper {
  /**
   * Calculate session progress from StudySession data
   * 
   * @param session - StudySession object with questions and state
   * @returns SessionProgress with calculated metrics
   */
  static calculateSessionProgress(session: StudySession): SessionProgress {
    const answeredQuestions = session.questions.filter(q => q.userAnswer !== undefined).length;
    const correctAnswers = session.questions.filter(q => q.isCorrect === true).length;
    const totalQuestions = session.questions.length;

    // Calculate time elapsed
    const startTime = new Date(session.startTime).getTime();
    const currentTime = new Date().getTime();
    const timeElapsed = Math.floor((currentTime - startTime) / 1000);

    // Calculate accuracy (avoid division by zero)
    const accuracy = answeredQuestions > 0 ? (correctAnswers / answeredQuestions) * 100 : 0;

    return {
      sessionId: session.sessionId,
      currentQuestion: session.currentQuestionIndex + 1,
      totalQuestions,
      answeredQuestions,
      correctAnswers,
      timeElapsed,
      accuracy,
    };
  }

  /**
   * Transform enhanced question to session question response
   * 
   * @param question - Enhanced question with metadata
   * @param topicName - Topic name for display
   * @param markedForReview - Whether question is marked for review
   * @returns QuestionResponse formatted for session display
   */
  static toQuestionResponse(
    question: EnhancedQuestion,
    topicName: string,
    markedForReview: boolean = false
  ): QuestionResponse {
    return {
      questionId: question.questionId,
      text: question.questionText,
      options: question.options.map((optText, index) => ({
        id: index.toString(),
        text: optText,
      }) as SessionQuestionOption),
      topicId: question.topicId || '',
      topicName,
      difficulty: this.mapDifficultyLevel(question.difficulty),
      timeAllowed: this.calculateTimeAllowed(question.difficulty),
      markedForReview,
    };
  }

  /**
   * Transform array of enhanced questions to session question responses
   * 
   * @param questions - Array of enhanced questions
   * @param topicNames - Map of topicId to topic name
   * @param markedQuestions - Set of questionIds marked for review
   * @returns Array of QuestionResponse objects
   */
  static toQuestionResponses(
    questions: EnhancedQuestion[],
    topicNames: Map<string, string>,
    markedQuestions: Set<string> = new Set()
  ): QuestionResponse[] {
    return questions.map(question => 
      this.toQuestionResponse(
        question,
        topicNames.get(question.topicId || '') || 'Unknown Topic',
        markedQuestions.has(question.questionId)
      )
    );
  }

  /**
   * Create CreateSessionResponse from session and questions
   * 
   * @param session - Created StudySession
   * @param questions - Array of question responses for the session
   * @returns Complete CreateSessionResponse
   */
  static toCreateSessionResponse(
    session: StudySession,
    questions: QuestionResponse[]
  ): CreateSessionResponse {
    return {
      session,
      questions,
    };
  }

  /**
   * Create GetSessionResponse with progress calculation
   * 
   * @param session - StudySession object
   * @param questions - Array of question responses
   * @returns Complete GetSessionResponse with progress
   */
  static toGetSessionResponse(
    session: StudySession,
    questions: QuestionResponse[]
  ): GetSessionResponse {
    return {
      session,
      questions,
      progress: this.calculateSessionProgress(session),
    };
  }

  /**
   * Create UpdateSessionResponse with progress calculation
   * 
   * @param session - Updated StudySession object
   * @param questions - Array of question responses
   * @returns Complete UpdateSessionResponse with progress
   */
  static toUpdateSessionResponse(
    session: StudySession,
    questions: QuestionResponse[]
  ): UpdateSessionResponse {
    return {
      session,
      questions,
      progress: this.calculateSessionProgress(session),
    };
  }

  /**
   * Generate session summary from completed session
   * 
   * @param session - Completed StudySession
   * @returns SessionSummary with calculated metrics
   */
  static generateSessionSummary(session: StudySession): SessionSummary {
    const totalQuestions = session.questions.length;
    const questionsAnswered = session.questions.filter(q => q.userAnswer !== undefined).length;
    const questionsCorrect = session.questions.filter(q => q.isCorrect === true).length;
    const questionsSkipped = session.questions.filter(q => q.skipped === true).length;
    const questionsReviewed = session.questions.filter(q => q.markedForReview === true).length;
    
    const accuracy = questionsAnswered > 0 ? (questionsCorrect / questionsAnswered) * 100 : 0;
    const totalTimeSpent = session.questions.reduce((sum, q) => sum + (q.timeSpent || 0), 0);
    const averageTimePerQuestion = questionsAnswered > 0 ? totalTimeSpent / questionsAnswered : 0;
    
    // Simple scoring: 100 points per correct answer
    const score = questionsCorrect * 100;
    const passingScore = Math.ceil(totalQuestions * 0.7) * 100; // 70% passing
    const passed = score >= passingScore;

    return {
      sessionId: session.sessionId,
      totalQuestions,
      questionsAnswered,
      questionsCorrect,
      questionsSkipped,
      questionsReviewed,
      accuracy: Math.round(accuracy * 100) / 100,
      totalTimeSpent,
      averageTimePerQuestion: Math.round(averageTimePerQuestion),
      score,
      passingScore,
      passed,
      topicBreakdown: this.calculateTopicBreakdown(session),
      completedAt: session.endTime || new Date().toISOString(),
    };
  }

  /**
   * Map DifficultyLevel enum to session difficulty string
   * 
   * @param difficulty - DifficultyLevel enum value
   * @returns Session difficulty string
   * @private
   */
  private static mapDifficultyLevel(difficulty: DifficultyLevel): 'easy' | 'medium' | 'hard' {
    switch (difficulty) {
      case DifficultyLevel.EASY:
        return 'easy';
      case DifficultyLevel.MEDIUM:
        return 'medium';
      case DifficultyLevel.HARD:
        return 'hard';
      default:
        return 'medium';
    }
  }

  /**
   * Calculate time allowed for question based on difficulty
   * 
   * @param difficulty - Question difficulty level
   * @returns Time allowed in seconds
   * @private
   */
  private static calculateTimeAllowed(difficulty: DifficultyLevel): number {
    switch (difficulty) {
      case DifficultyLevel.EASY:
        return 45; // 45 seconds
      case DifficultyLevel.MEDIUM:
        return 60; // 1 minute
      case DifficultyLevel.HARD:
        return 90; // 1.5 minutes
      default:
        return 60;
    }
  }

  /**
   * Calculate topic breakdown for session summary
   * 
   * @param session - Completed StudySession
   * @returns Array of SessionTopicBreakdown objects
   * @private
   */
  private static calculateTopicBreakdown(session: StudySession): SessionTopicBreakdown[] {
    const topicMap = new Map<string, {
      topicId: string;
      topicName: string;
      total: number;
      correct: number;
      totalTime: number;
    }>();

    // This would need to be enhanced with actual topic data from questions
    // For now, return empty array as topic breakdown requires external question data
    return [];
  }
}