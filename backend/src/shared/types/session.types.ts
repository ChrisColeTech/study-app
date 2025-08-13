// Study session specific types

import { StudySession, SessionQuestion, Question } from './domain.types';
import { 
  DifficultyPerformance, 
  TopicPerformanceBreakdown, 
  TimeDistribution, 
  UserProgressUpdate 
} from './analytics.types';

export interface CreateSessionRequest {
  examId: string;
  providerId: string;
  sessionType: 'practice' | 'exam' | 'review';
  questionCount?: number;
  topics?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimit?: number; // minutes
  isAdaptive?: boolean; // Phase 22: Adaptive sessions
}

export interface UpdateSessionRequest {
  action: 'pause' | 'resume' | 'next' | 'previous' | 'answer' | 'mark_for_review' | 'complete';
  currentQuestionIndex?: number;
  status?: 'active' | 'paused' | 'completed' | 'abandoned';
  questionId?: string; // Required for answer and mark_for_review actions
  userAnswer?: string[]; // Required for answer action
  timeSpent?: number; // Required for answer action (in seconds)
  skipped?: boolean; // Optional for answer action
  markedForReview?: boolean; // Required for mark_for_review action
}

export interface SubmitAnswerRequest {
  questionId: string;
  answer: string[];
  timeSpent: number; // seconds
  skipped?: boolean;
  markedForReview?: boolean;
}

export interface SubmitAnswerResponse {
  success: boolean;
  feedback: AnswerFeedback;
  session: StudySession;
  progress: SessionProgress;
  nextQuestion?: QuestionResponse;
}

export interface AnswerFeedback {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string[];
  userAnswer: string[];
  explanation: string;
  score: number; // Points earned for this question
  timeSpent: number;
  questionDifficulty: 'easy' | 'medium' | 'hard';
  topicId: string;
  topicName: string;
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

export interface CreateSessionResponse {
  session: StudySession;
  questions: QuestionResponse[];
}

export interface GetSessionResponse {
  session: StudySession;
  questions: QuestionResponse[];
  progress: SessionProgress;
}

export interface UpdateSessionResponse {
  session: StudySession;
  questions: QuestionResponse[];
  progress: SessionProgress;
}

export interface CompleteSessionResponse {
  success: boolean;
  sessionSummary: SessionSummary;
  detailedResults: DetailedSessionResults;
  userProgress?: UserProgressUpdate[];
  recommendations: StudyRecommendations;
}

export interface DetailedSessionResults {
  sessionId: string;
  finalScore: number;
  maxPossibleScore: number;
  accuracyPercentage: number;
  totalTimeSpent: number; // seconds
  averageTimePerQuestion: number; // seconds
  questionsBreakdown: QuestionResultBreakdown[];
  performanceByDifficulty: DifficultyPerformance[];
  performanceByTopic: TopicPerformanceBreakdown[];
  timeDistribution: TimeDistribution;
  completedAt: string;
  sessionDuration: number; // seconds from start to completion
}

export interface QuestionResultBreakdown {
  questionId: string;
  questionText: string;
  userAnswer: string[];
  correctAnswer: string[];
  isCorrect: boolean;
  timeSpent: number;
  score: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topicId: string;
  topicName: string;
  explanation: string;
  markedForReview: boolean;
  skipped: boolean;
}

// Performance analytics types moved to analytics.types.ts - import from there instead

export interface StudyRecommendations {
  overallRecommendation: 'excellent' | 'good' | 'needs_improvement' | 'requires_focused_study';
  readinessForExam: boolean;
  suggestedStudyTime: number; // minutes per day
  focusAreas: FocusArea[];
  nextSessionRecommendation: {
    sessionType: 'practice' | 'exam' | 'review';
    topics: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    questionCount: number;
  };
  motivationalMessage: string;
}

export interface FocusArea {
  topicId: string;
  topicName: string;
  priority: 'high' | 'medium' | 'low';
  currentAccuracy: number;
  targetAccuracy: number;
  estimatedStudyTime: number; // minutes needed
  specificWeaknesses: string[];
  recommendedResources: string[];
}

export interface ISessionService {
  createSession(request: CreateSessionRequest): Promise<CreateSessionResponse>;
  getSession(sessionId: string): Promise<GetSessionResponse>;
  updateSession(sessionId: string, request: UpdateSessionRequest): Promise<UpdateSessionResponse>;
  deleteSession(sessionId: string): Promise<{ success: boolean; message: string }>;
  submitAnswer(sessionId: string, request: SubmitAnswerRequest): Promise<SubmitAnswerResponse>;
  completeSession(sessionId: string): Promise<CompleteSessionResponse>;
}

// New decomposed service interfaces for Phase 5: SessionService Decomposition

/**
 * Session Orchestrator Service - Handles question coordination and session configuration
 * Responsible for: Question selection, adaptive algorithms, session progress calculation
 */
export interface ISessionOrchestrator {
  getQuestionsForSession(request: CreateSessionRequest): Promise<Question[]>;
  getSessionQuestionsWithDetails(session: StudySession): Promise<QuestionResponse[]>;
  selectSessionQuestions(questions: Question[], count: number): Question[];
  selectAdaptiveQuestions(questions: Question[], count: number): Question[];
  calculateSessionProgress(session: StudySession): SessionProgress;
}

/**
 * Answer Processor Service - Handles answer submission and session completion
 * Responsible for: Answer evaluation, scoring, session completion logic
 */
export interface IAnswerProcessor {
  submitAnswer(sessionId: string, request: SubmitAnswerRequest): Promise<SubmitAnswerResponse>;
  completeSession(sessionId: string): Promise<CompleteSessionResponse>;
}

/**
 * Session Analyzer Service - Handles results analysis and performance calculations
 * Responsible for: Analytics computation, performance metrics, study recommendations
 */
export interface ISessionAnalyzer {
  generateDetailedResults(
    session: StudySession,
    questionDetails: Question[],
    completedAt: string,
    sessionDuration: number
  ): Promise<DetailedSessionResults>;
  calculateTopicPerformance(
    session: StudySession,
    questionDetails: Question[]
  ): Promise<TopicPerformanceBreakdown[]>;
  analyzeSessionResults(session: StudySession): Promise<DetailedSessionResults>;
  generateStudyRecommendations(
    session: StudySession,
    detailedResults: DetailedSessionResults
  ): Promise<StudyRecommendations>;
}
