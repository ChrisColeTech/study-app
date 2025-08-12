// Session Analyzer Service - Phase 5: SessionService Decomposition
// Handles results analysis, performance calculations, and study recommendations

import { 
  StudySession, 
  SessionQuestion,
  Question
} from '../shared/types/domain.types';
import {
  DetailedSessionResults,
  QuestionResultBreakdown,
  DifficultyPerformance,
  TopicPerformanceBreakdown,
  TimeDistribution,
  StudyRecommendations,
  FocusArea,
  ISessionAnalyzer
} from '../shared/types/session.types';
import { createLogger } from '../shared/logger';

export class SessionAnalyzer implements ISessionAnalyzer {
  private logger = createLogger({ component: 'SessionAnalyzer' });

  /**
   * Generate detailed results for completed session
   * Phase 21: Session Completion Feature
   */
  async generateDetailedResults(
    session: StudySession,
    questionDetails: Question[],
    completedAt: string,
    sessionDuration: number
  ): Promise<DetailedSessionResults> {
    this.logger.info('Generating detailed session results', { 
      sessionId: session.sessionId,
      questionCount: questionDetails.length,
      sessionDuration 
    });

    try {
      // Calculate basic metrics
      const totalTimeSpent = session.questions.reduce((total, q) => total + q.timeSpent, 0);
      const answeredQuestions = session.questions.filter(q => q.userAnswer !== undefined);
      const averageTimePerQuestion = answeredQuestions.length > 0 ? totalTimeSpent / answeredQuestions.length : 0;

      // Generate question-by-question breakdown
      const questionsBreakdown = this.generateQuestionBreakdown(session, questionDetails);

      // Calculate maximum possible score
      const maxPossibleScore = this.calculateMaxPossibleScore(questionDetails);

      // Calculate accuracy percentage
      const correctAnswers = session.questions.filter(q => q.isCorrect === true).length;
      const totalAnswered = answeredQuestions.length;
      const accuracyPercentage = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : 0;

      // Calculate performance by difficulty
      const performanceByDifficulty = this.calculateDifficultyPerformance(session, questionDetails);

      // Calculate performance by topic
      const performanceByTopic = await this.calculateTopicPerformance(session, questionDetails);

      // Calculate time distribution
      const timeDistribution = this.calculateTimeDistribution(session, questionDetails);

      const detailedResults: DetailedSessionResults = {
        sessionId: session.sessionId,
        finalScore: session.score || 0,
        maxPossibleScore,
        accuracyPercentage,
        totalTimeSpent,
        averageTimePerQuestion,
        questionsBreakdown,
        performanceByDifficulty,
        performanceByTopic,
        timeDistribution,
        completedAt,
        sessionDuration
      };

      this.logger.info('Detailed session results generated', { 
        sessionId: session.sessionId,
        finalScore: detailedResults.finalScore,
        maxPossibleScore: detailedResults.maxPossibleScore,
        accuracyPercentage: detailedResults.accuracyPercentage
      });

      return detailedResults;

    } catch (error) {
      this.logger.error('Error generating detailed results', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId: session.sessionId 
      });
      throw error;
    }
  }

  /**
   * Calculate topic performance breakdown
   * Phase 21: Session Completion Feature
   */
  async calculateTopicPerformance(
    session: StudySession,
    questionDetails: Question[]
  ): Promise<TopicPerformanceBreakdown[]> {
    this.logger.info('Calculating topic performance', { 
      sessionId: session.sessionId,
      questionCount: questionDetails.length 
    });

    const topicStats = new Map<string, {
      topicId: string;
      topicName: string;
      questionsTotal: number;
      questionsCorrect: number;
      totalTime: number;
      totalScore: number;
      maxPossibleScore: number;
    }>();

    // Aggregate stats by topic
    session.questions.forEach((sessionQuestion, index) => {
      const question = questionDetails[index];
      if (!question) return;

      const topicId = question.topicId;
      if (!topicStats.has(topicId)) {
        topicStats.set(topicId, {
          topicId,
          topicName: `Topic ${topicId}`, // Simplified topic name
          questionsTotal: 0,
          questionsCorrect: 0,
          totalTime: 0,
          totalScore: 0,
          maxPossibleScore: 0
        });
      }

      const stats = topicStats.get(topicId)!;
      stats.questionsTotal++;
      stats.totalTime += sessionQuestion.timeSpent;
      
      // Calculate max possible score for this question
      const maxScore = this.calculateQuestionMaxScore(question.difficulty);
      stats.maxPossibleScore += maxScore;

      if (sessionQuestion.isCorrect) {
        stats.questionsCorrect++;
        stats.totalScore += this.calculateQuestionScore(question.difficulty, sessionQuestion.timeSpent);
      }
    });

    // Convert to performance breakdown array
    const topicPerformances = Array.from(topicStats.values()).map(stats => {
      const accuracy = stats.questionsTotal > 0 ? (stats.questionsCorrect / stats.questionsTotal) * 100 : 0;
      const averageTime = stats.questionsTotal > 0 ? stats.totalTime / stats.questionsTotal : 0;

      return {
        topicId: stats.topicId,
        topicName: stats.topicName,
        questionsTotal: stats.questionsTotal,
        questionsCorrect: stats.questionsCorrect,
        accuracy,
        averageTime,
        totalScore: stats.totalScore,
        maxPossibleScore: stats.maxPossibleScore,
        strongestArea: false, // Will be set below
        weakestArea: false,   // Will be set below
        needsImprovement: accuracy < 70
      };
    });

    // Identify strongest and weakest areas
    if (topicPerformances.length > 0) {
      const sortedByAccuracy = [...topicPerformances].sort((a, b) => b.accuracy - a.accuracy);
      sortedByAccuracy[0].strongestArea = true;
      if (sortedByAccuracy.length > 1) {
        sortedByAccuracy[sortedByAccuracy.length - 1].weakestArea = true;
      }
    }

    this.logger.info('Topic performance calculated', { 
      sessionId: session.sessionId,
      topicCount: topicPerformances.length,
      averageAccuracy: topicPerformances.reduce((sum, t) => sum + t.accuracy, 0) / topicPerformances.length
    });

    return topicPerformances;
  }

  /**
   * Generate question-by-question breakdown
   * Phase 21: Session Completion Feature
   */
  private generateQuestionBreakdown(
    session: StudySession,
    questionDetails: Question[]
  ): QuestionResultBreakdown[] {
    return session.questions.map((sessionQuestion, index) => {
      const question = questionDetails[index];
      const score = sessionQuestion.isCorrect ? 
        this.calculateQuestionScore(question?.difficulty || 'medium', sessionQuestion.timeSpent) : 0;

      return {
        questionId: sessionQuestion.questionId,
        questionText: question?.text || 'Question text not available',
        userAnswer: sessionQuestion.userAnswer || [],
        correctAnswer: sessionQuestion.correctAnswer || [],
        isCorrect: sessionQuestion.isCorrect || false,
        timeSpent: sessionQuestion.timeSpent,
        score,
        difficulty: question?.difficulty || 'medium',
        topicId: question?.topicId || 'unknown',
        topicName: `Topic ${question?.topicId || 'Unknown'}`,
        explanation: question?.explanation || 'No explanation available',
        markedForReview: sessionQuestion.markedForReview,
        skipped: sessionQuestion.skipped
      };
    });
  }

  /**
   * Calculate maximum possible score for all questions
   * Phase 21: Session Completion Feature
   */
  private calculateMaxPossibleScore(questionDetails: Question[]): number {
    return questionDetails.reduce((total, question) => {
      return total + this.calculateQuestionMaxScore(question.difficulty);
    }, 0);
  }

  /**
   * Calculate maximum possible score for a question based on difficulty
   * Phase 21: Session Completion Feature
   */
  private calculateQuestionMaxScore(difficulty: string): number {
    const basePoints = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    };
    
    const points = basePoints[difficulty as keyof typeof basePoints] || 2;
    return Math.round(points * 1.5); // Maximum with time bonus
  }

  /**
   * Calculate performance by difficulty level
   * Phase 21: Session Completion Feature
   */
  private calculateDifficultyPerformance(
    session: StudySession,
    questionDetails: Question[]
  ): DifficultyPerformance[] {
    const difficulties = ['easy', 'medium', 'hard'] as const;
    
    return difficulties.map(difficulty => {
      const questionsOfDifficulty = session.questions.filter((_, index) => 
        questionDetails[index]?.difficulty === difficulty
      );

      const totalQuestions = questionsOfDifficulty.length;
      const correctQuestions = questionsOfDifficulty.filter(q => q.isCorrect).length;
      const accuracy = totalQuestions > 0 ? (correctQuestions / totalQuestions) * 100 : 0;
      
      const totalTime = questionsOfDifficulty.reduce((sum, q) => sum + q.timeSpent, 0);
      const averageTime = totalQuestions > 0 ? totalTime / totalQuestions : 0;

      const totalScore = questionsOfDifficulty.reduce((sum, q) => {
        return sum + (q.isCorrect ? this.calculateQuestionScore(difficulty, q.timeSpent) : 0);
      }, 0);

      const maxPossibleScore = totalQuestions * this.calculateQuestionMaxScore(difficulty);

      return {
        difficulty,
        totalQuestions,
        correctQuestions,
        accuracy,
        averageTime,
        totalScore,
        maxPossibleScore
      };
    });
  }

  /**
   * Calculate time distribution across questions
   * Phase 21: Session Completion Feature
   */
  private calculateTimeDistribution(
    session: StudySession,
    questionDetails: Question[]
  ): TimeDistribution {
    let fastQuestions = 0;
    let normalQuestions = 0;
    let slowQuestions = 0;
    
    const timesByDifficulty = {
      easy: [] as number[],
      medium: [] as number[],
      hard: [] as number[]
    };

    session.questions.forEach((sessionQuestion, index) => {
      const question = questionDetails[index];
      if (!question) return;

      const expectedTime = this.calculateExpectedTime(question.difficulty);
      const actualTime = sessionQuestion.timeSpent;
      
      // Categorize question timing
      if (actualTime < expectedTime * 0.5) {
        fastQuestions++;
      } else if (actualTime <= expectedTime) {
        normalQuestions++;
      } else {
        slowQuestions++;
      }

      // Collect times by difficulty
      if (question.difficulty in timesByDifficulty) {
        timesByDifficulty[question.difficulty as keyof typeof timesByDifficulty].push(actualTime);
      }
    });

    // Calculate averages by difficulty
    const averageTimeEasy = timesByDifficulty.easy.length > 0 ? 
      timesByDifficulty.easy.reduce((a, b) => a + b, 0) / timesByDifficulty.easy.length : 0;
    const averageTimeMedium = timesByDifficulty.medium.length > 0 ? 
      timesByDifficulty.medium.reduce((a, b) => a + b, 0) / timesByDifficulty.medium.length : 0;
    const averageTimeHard = timesByDifficulty.hard.length > 0 ? 
      timesByDifficulty.hard.reduce((a, b) => a + b, 0) / timesByDifficulty.hard.length : 0;

    return {
      fastQuestions,
      normalQuestions,
      slowQuestions,
      averageTimeEasy,
      averageTimeMedium,
      averageTimeHard
    };
  }

  /**
   * Calculate expected time for a question based on difficulty
   * Phase 21: Session Completion Feature
   */
  private calculateExpectedTime(difficulty: string): number {
    switch (difficulty) {
      case 'easy': return 60;    // 1 minute
      case 'medium': return 90;  // 1.5 minutes
      case 'hard': return 120;   // 2 minutes
      default: return 90;        // Default to medium
    }
  }

  /**
   * Calculate score for a question based on difficulty and time spent
   * Phase 21: Session Completion Feature
   */
  private calculateQuestionScore(difficulty: string, timeSpent: number): number {
    const basePoints = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    };

    const points = basePoints[difficulty as keyof typeof basePoints] || 2;
    const expectedTime = this.calculateExpectedTime(difficulty);
    
    // Time bonus: up to 50% bonus for fast answers
    const timeFactor = Math.max(0.5, Math.min(1.5, expectedTime / timeSpent));
    
    return Math.round(points * timeFactor);
  }

  /**
   * Analyze session results for completion
   * Phase 21: Session Completion Feature
   */
  async analyzeSessionResults(session: StudySession): Promise<DetailedSessionResults> {
    // For this implementation, we'll create a simplified analysis
    // In a full implementation, this would perform more comprehensive analysis
    const totalQuestions = session.questions.length;
    const correctAnswers = session.questions.filter(q => q.isCorrect === true).length;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    return {
      sessionId: session.sessionId,
      finalScore: session.score || 0,
      maxPossibleScore: totalQuestions * 3, // Assuming max 3 points per question
      accuracyPercentage: accuracy,
      totalTimeSpent: session.questions.reduce((total, q) => total + (q.timeSpent || 0), 0),
      averageTimePerQuestion: totalQuestions > 0 ? session.questions.reduce((total, q) => total + (q.timeSpent || 0), 0) / totalQuestions : 0,
      questionsBreakdown: session.questions.map((q, index) => {
        // Calculate score based on correctness and default values
        const questionScore = q.isCorrect ? 
          this.calculateQuestionScore('medium', q.timeSpent || 0) : 0;
        
        return {
          questionId: q.questionId,
          questionText: 'Question text not available',
          userAnswer: q.userAnswer || [],
          correctAnswer: q.correctAnswer || [],
          isCorrect: q.isCorrect || false,
          timeSpent: q.timeSpent || 0,
          score: questionScore,
          difficulty: 'medium' as const,
          topicId: 'unknown',
          topicName: 'Unknown Topic',
          explanation: 'No explanation available',
          markedForReview: q.markedForReview || false,
          skipped: q.skipped || false
        };
      }),
      performanceByDifficulty: [],
      performanceByTopic: [],
      timeDistribution: {
        fastQuestions: 0,
        normalQuestions: 0,
        slowQuestions: 0,
        averageTimeEasy: 0,
        averageTimeMedium: 0,
        averageTimeHard: 0
      },
      completedAt: new Date().toISOString(),
      sessionDuration: session.questions.reduce((total, q) => total + (q.timeSpent || 0), 0)
    };
  }

  /**
   * Generate study recommendations for completion
   * Phase 21: Session Completion Feature
   */
  async generateStudyRecommendations(
    session: StudySession,
    detailedResults: DetailedSessionResults
  ): Promise<StudyRecommendations> {
    const accuracy = detailedResults.accuracyPercentage;
    
    let overallRecommendation: 'excellent' | 'good' | 'needs_improvement' | 'requires_focused_study';
    let readinessForExam = false;
    let suggestedStudyTime = 30; // minutes per day
    
    if (accuracy >= 90) {
      overallRecommendation = 'excellent';
      readinessForExam = true;
      suggestedStudyTime = 15;
    } else if (accuracy >= 80) {
      overallRecommendation = 'good';
      readinessForExam = true;
      suggestedStudyTime = 20;
    } else if (accuracy >= 70) {
      overallRecommendation = 'needs_improvement';
      readinessForExam = false;
      suggestedStudyTime = 30;
    } else {
      overallRecommendation = 'requires_focused_study';
      readinessForExam = false;
      suggestedStudyTime = 45;
    }
    
    return {
      overallRecommendation,
      readinessForExam,
      suggestedStudyTime,
      focusAreas: [],
      nextSessionRecommendation: {
        sessionType: 'practice' as const,
        topics: [],
        difficulty: accuracy >= 85 ? 'hard' : accuracy >= 70 ? 'medium' : 'easy',
        questionCount: accuracy >= 70 ? 15 : 20
      },
      motivationalMessage: this.generateMotivationalMessage(accuracy)
    };
  }

  /**
   * Generate motivational message based on performance
   * Phase 21: Session Completion Feature
   */
  private generateMotivationalMessage(accuracy: number): string {
    if (accuracy >= 90) {
      return "Outstanding performance! You're ready for the exam. Keep up the excellent work!";
    } else if (accuracy >= 80) {
      return "Great job! You're making solid progress. A bit more practice and you'll be fully prepared.";
    } else if (accuracy >= 70) {
      return "Good effort! You're on the right track. Focus on your weak areas to improve further.";
    } else {
      return "Keep studying! Every practice session is a step forward. Focus on understanding the concepts better.";
    }
  }
}

// Re-export the interface for ServiceFactory
export type { ISessionAnalyzer };