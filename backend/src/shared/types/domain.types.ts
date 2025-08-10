// Core domain entity types

export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  preferences: UserPreferences;
}

export interface UserPreferences {
  studyMode: 'practice' | 'exam' | 'review';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timePerQuestion: number; // seconds
  showExplanations: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}

export interface StudySession {
  sessionId: string;
  userId: string;
  examId: string;
  providerId: string;
  startTime: string;
  endTime?: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  questions: SessionQuestion[];
  currentQuestionIndex: number;
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionQuestion {
  questionId: string;
  userAnswer?: string[];
  correctAnswer: string[];
  isCorrect?: boolean;
  timeSpent: number; // seconds
  skipped: boolean;
  markedForReview: boolean;
  answeredAt?: string;
}

export interface Question {
  questionId: string;
  providerId: string;
  examId: string;
  topicId: string;
  text: string;
  options: QuestionOption[];
  correctAnswer: string[];
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface ExamProvider {
  providerId: string;
  name: string;
  description: string;
  logoUrl?: string;
  isActive: boolean;
  exams: Exam[];
}

export interface Exam {
  examId: string;
  providerId: string;
  name: string;
  code: string;
  description: string;
  totalQuestions: number;
  passingScore: number;
  duration: number; // minutes
  topics: Topic[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  topicId: string;
  examId: string;
  name: string;
  description: string;
  questionCount: number;
  weight: number; // percentage of exam
  subtopics?: string[];
}

export interface UserProgress {
  userId: string;
  topicId: string;
  examId: string;
  providerId: string;
  questionsAttempted: number;
  questionsCorrect: number;
  accuracy: number; // percentage
  averageTimePerQuestion: number; // seconds
  lastStudiedAt: string;
  masteryLevel: 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  goalId: string;
  userId: string;
  type: 'accuracy' | 'questions_per_day' | 'study_streak' | 'exam_completion';
  target: number;
  current: number;
  deadline?: string;
  isActive: boolean;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Analytics {
  userId: string;
  examId: string;
  providerId: string;
  totalSessions: number;
  totalQuestionsAnswered: number;
  totalCorrectAnswers: number;
  overallAccuracy: number;
  averageSessionDuration: number; // minutes
  studyStreak: number; // days
  topicBreakdown: TopicAnalytics[];
  weeklyProgress: WeeklyProgress[];
  lastCalculatedAt: string;
}

export interface TopicAnalytics {
  topicId: string;
  topicName: string;
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  averageTime: number;
  masteryLevel: string;
}

export interface WeeklyProgress {
  week: string; // ISO week (YYYY-WW)
  questionsAnswered: number;
  accuracy: number;
  studyTime: number; // minutes
}