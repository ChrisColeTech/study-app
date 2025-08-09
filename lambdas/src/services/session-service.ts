import { v4 as uuidv4 } from 'uuid';
import { StudySession, SessionRequest, AnswerRequest } from '../types';
import SessionRepository from '../repositories/session-repository';
import { QuestionService } from './question-service';

export class SessionService {
  private sessionRepository: SessionRepository;
  private questionService: QuestionService;

  constructor() {
    this.sessionRepository = new SessionRepository();
    this.questionService = new QuestionService();
  }

  async createSession(userId: string, request: SessionRequest): Promise<StudySession> {
    const sessionId = uuidv4();
    
    const session: StudySession = {
      sessionId,
      userId,
      provider: request.provider,
      exam: request.exam,
      questions: [], // Will be populated on first access
      answers: {},
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.sessionRepository.create(session);
    return session;
  }

  async getSession(sessionId: string, userId: string): Promise<StudySession | null> {
    return await this.sessionRepository.findByIdAndUser(sessionId, userId);
  }

  async getUserSessions(userId: string, limit: number = 10): Promise<StudySession[]> {
    return await this.sessionRepository.findByUser(userId, limit);
  }

  async updateSession(
    sessionId: string, 
    userId: string, 
    updates: Partial<StudySession>
  ): Promise<StudySession | null> {
    const session = await this.sessionRepository.findByIdAndUser(sessionId, userId);
    if (!session) return null;

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.sessionRepository.update(sessionId, userId, updatedSession);
    return updatedSession;
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.sessionRepository.findByIdAndUser(sessionId, userId);
    if (!session) return false;

    await this.sessionRepository.delete(sessionId, userId);
    return true;
  }

  async submitAnswer(
    sessionId: string,
    userId: string,
    answerRequest: AnswerRequest
  ): Promise<{
    questionId: string;
    answerSubmitted: string;
    totalAnswered: number;
  }> {
    const session = await this.sessionRepository.findByIdAndUser(sessionId, userId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.completed) {
      throw new Error('Session is already completed');
    }

    // Update answers
    const updatedAnswers = {
      ...session.answers,
      [answerRequest.questionId]: answerRequest.answer,
    };

    await this.sessionRepository.update(sessionId, userId, {
      answers: updatedAnswers,
      updatedAt: new Date().toISOString(),
    });

    return {
      questionId: answerRequest.questionId,
      answerSubmitted: answerRequest.answer,
      totalAnswered: Object.keys(updatedAnswers).length,
    };
  }

  async createAdaptiveSession(userId: string, request: SessionRequest): Promise<{
    sessionId: string;
    sessionType: string;
    config: any;
    adaptiveFeatures: any;
    questionPreview: any[];
    nextQuestionUrl: string;
  }> {
    const session = await this.createSession(userId, request);

    // For now, return a basic adaptive session structure
    // In a full implementation, this would include ML-based question selection
    return {
      sessionId: session.sessionId,
      sessionType: 'adaptive',
      config: {
        questionCount: request.questionCount,
        isAdaptive: true,
        skillLevel: 'beginner',
        adaptiveAlgorithm: 'v1.0',
      },
      adaptiveFeatures: {
        skillLevel: 'beginner',
        averageAccuracy: 0,
        questionsAnalyzed: 0,
        weakAreasIdentified: [],
      },
      questionPreview: [],
      nextQuestionUrl: `/api/v1/sessions/${session.sessionId}/next-question`,
    };
  }

  async completeSession(sessionId: string, userId: string): Promise<StudySession | null> {
    const session = await this.sessionRepository.findByIdAndUser(sessionId, userId);
    if (!session) return null;

    const completedSession = {
      ...session,
      completed: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.sessionRepository.update(sessionId, userId, completedSession);
    return completedSession;
  }

  async getSessionStats(sessionId: string, userId: string): Promise<{
    totalQuestions: number;
    answeredQuestions: number;
    correctAnswers: number;
    accuracy: number;
    timeSpent: number;
    isCompleted: boolean;
  } | null> {
    const session = await this.sessionRepository.findByIdAndUser(sessionId, userId);
    if (!session) return null;

    const totalAnswered = Object.keys(session.answers).length;
    let correctAnswers = 0;

    // For accurate scoring, we'd need to load questions and check answers
    // This is a simplified version
    try {
      const questions = await this.questionService.getQuestions({
        provider: session.provider,
        exam: session.exam,
        limit: 1000,
      });

      correctAnswers = questions.questions.filter(q => {
        const userAnswer = session.answers[q.question_number.toString()];
        return userAnswer === q.answer.correct_answer;
      }).length;
    } catch (error) {
      console.error('Error calculating correct answers:', error);
    }

    const createdAt = new Date(session.createdAt).getTime();
    const updatedAt = new Date(session.updatedAt).getTime();
    const timeSpent = Math.floor((updatedAt - createdAt) / 1000); // in seconds

    return {
      totalQuestions: session.questions.length || 0,
      answeredQuestions: totalAnswered,
      correctAnswers,
      accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
      timeSpent,
      isCompleted: session.completed,
    };
  }
}