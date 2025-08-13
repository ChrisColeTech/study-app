// =======================================================
// CORE DOMAIN ENTITY TYPES - STUDY APP V3 BACKEND
// =======================================================
// This file contains the primary business entities and common types
// used across multiple domains in the application

// =======================================================
// COMMON BASE TYPES AND ENUMS
// =======================================================

/**
 * Standardized difficulty levels used across the application
 * Replaces inconsistent difficulty types throughout the system
 */
export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium', 
  HARD = 'hard',
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

/**
 * Standardized status types for entities with lifecycle states
 */
export enum StatusType {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  ABANDONED = 'abandoned',
  ARCHIVED = 'archived',
  DRAFT = 'draft'
}

/**
 * Common metadata pattern for entities requiring tracking information
 */
export interface EntityMetadata {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
}

// =======================================================
// USER DOMAIN TYPES
// =======================================================

/**
 * Primary User entity - canonical definition used throughout the application
 * This replaces duplicate User interfaces in other files
 */
export interface User extends EntityMetadata {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash?: string; // Optional for API responses, required for storage
  isActive: boolean;
  preferences: UserPreferences;
}

/**
 * User study preferences and configuration settings
 */
export interface UserPreferences {
  studyMode: 'practice' | 'exam' | 'review';
  difficulty: DifficultyLevel;
  timePerQuestion: number; // seconds
  showExplanations: boolean;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}

/**
 * User progress tracking across providers, exams, and topics
 */
export interface UserProgress extends EntityMetadata {
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
}

// =======================================================
// CERTIFICATION PROVIDER TYPES
// =======================================================

/**
 * Certification provider entity (AWS, Azure, GCP, etc.)
 * Renamed from ExamProvider for consistency
 */
export interface Provider extends EntityMetadata {
  providerId: string;
  id: string; // Alternative identifier used in some parts of codebase
  name: string;
  description: string;
  logoUrl?: string;
  isActive: boolean;
  status: StatusType; // Status for filtering and management
  category?: string; // Provider category classification
  exams: Exam[];
}

/**
 * Certification exam within a provider
 */
export interface Exam extends EntityMetadata {
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
}

/**
 * Topic/subject area within an exam
 */
export interface Topic extends EntityMetadata {
  topicId: string;
  examId: string;
  name: string;
  description: string;
  questionCount: number;
  weight: number; // percentage of exam
  subtopics?: string[];
}

// =======================================================
// QUESTION DOMAIN TYPES
// =======================================================

/**
 * Primary Question entity - canonical definition
 * Consolidates different Question interfaces from other files
 */
export interface Question extends EntityMetadata {
  questionId: string;
  providerId: string;
  examId: string;
  topicId: string;
  questionText: string; // Standardized property name used throughout codebase
  options: string[]; // Simplified to string array for consistency with existing usage
  correctAnswer: string[]; // Multi-select support
  explanation: string;
  difficulty: DifficultyLevel;
  tags: string[];
}

/**
 * Question option/choice for multiple choice questions
 */
export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

// =======================================================
// SESSION DOMAIN TYPES
// =======================================================

/**
 * Study session entity
 */
export interface StudySession extends EntityMetadata {
  sessionId: string;
  userId?: string;
  examId: string;
  providerId: string;
  startTime: string;
  endTime?: string;
  status: StatusType;
  questions: SessionQuestion[];
  currentQuestionIndex: number;
  score?: number;
  totalQuestions: number;
  correctAnswers: number;
  isAdaptive?: boolean;
  adaptiveConfig?: AdaptiveSessionConfig;
}

/**
 * Configuration for adaptive study sessions
 */
export interface AdaptiveSessionConfig {
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  adjustmentAlgorithm: string;
}

/**
 * Question with user's answer within a session context
 */
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

// =======================================================
// GOALS DOMAIN TYPES
// =======================================================

/**
 * User study goal entity
 */
export interface Goal extends EntityMetadata {
  goalId: string;
  userId: string;
  type: 'accuracy' | 'questions_per_day' | 'study_streak' | 'exam_completion';
  target: number;
  current: number;
  deadline?: string;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string;
}

// =======================================================
// BACKWARD COMPATIBILITY ALIASES
// =======================================================
// These maintain compatibility during migration period

/** @deprecated Use Provider instead */
export type ExamProvider = Provider;

/** @deprecated Use DifficultyLevel enum instead */
export type QuestionDifficulty = DifficultyLevel;