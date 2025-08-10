// Study session specific types

import { StudySession, SessionQuestion } from './domain.types';

export interface CreateSessionRequest {
  examId: string;
  providerId: string;
  sessionType: 'practice' | 'exam' | 'review';
  questionCount?: number;
  topics?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number; // minutes
}

export interface UpdateSessionRequest {
  currentQuestionIndex?: number;
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
}

export interface SubmitAnswerRequest {
  questionId: string;
  answer: string[];
  timeSpent: number; // seconds
  skipped: boolean;
  markedForReview: boolean;
}

export interface SessionSummary {
  sessionId: string;
  totalQuestions: number;
  questionsAnswered: number;
  questionsCorrect: number;
  questionsSkipped: number;
  questionsReviewed: number;
  accuracy: number; // percentage
  totalTimeSpent: number; // seconds
  averageTimePerQuestion: number; // seconds
  score: number;
  passingScore: number;
  passed: boolean;
  topicBreakdown: SessionTopicBreakdown[];
  completedAt: string;
}

export interface SessionTopicBreakdown {
  topicId: string;
  topicName: string;
  questionsTotal: number;
  questionsCorrect: number;
  accuracy: number;
  averageTime: number;
}

export interface SessionProgress {
  sessionId: string;
  currentQuestion: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  timeElapsed: number; // seconds
  timeRemaining?: number; // seconds (for timed sessions)
  accuracy: number; // percentage so far
}

export interface QuestionResponse {
  questionId: string;
  text: string;
  options: SessionQuestionOption[];
  topicId: string;
  topicName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeAllowed?: number; // seconds
  markedForReview: boolean;
}

export interface SessionQuestionOption {
  id: string;
  text: string;
}

export interface ReviewQuestion extends QuestionResponse {
  userAnswer?: string[];
  correctAnswer: string[];
  isCorrect?: boolean;
  explanation: string;
  timeSpent: number;
}

export interface SessionFilters {
  providerId?: string;
  examId?: string;
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}