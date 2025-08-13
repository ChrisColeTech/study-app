// =======================================================
// QUESTION DOMAIN TYPES - STUDY APP V3 BACKEND
// =======================================================
// This file contains question-specific types for API requests/responses
// and business operations. Core Question entity is defined in domain.types.ts

import { Question, QuestionOption, DifficultyLevel, EntityMetadata } from './domain.types';

// =======================================================
// QUESTION CLASSIFICATION ENUMS
// =======================================================

/**
 * Standardized question types for different assessment formats
 */
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  MULTIPLE_SELECT = 'multiple_select',
  TRUE_FALSE = 'true_false',
  FILL_IN_THE_BLANK = 'fill_in_the_blank',
  DRAG_AND_DROP = 'drag_and_drop',
  SCENARIO = 'scenario',
  SIMULATION = 'simulation',
}

/**
 * Review status for question content management
 */
export enum ReviewStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

/**
 * Bloom's taxonomy levels for educational assessment
 */
export enum BloomsLevel {
  REMEMBER = 'remember',
  UNDERSTAND = 'understand',
  APPLY = 'apply',
  ANALYZE = 'analyze',
  EVALUATE = 'evaluate',
  CREATE = 'create',
}

/**
 * Cognitive load classification for question complexity
 */
export enum CognitiveLoad {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

// =======================================================
// QUESTION METADATA AND CLASSIFICATION
// =======================================================

/**
 * Extended metadata for question management and analytics
 */
export interface QuestionMetadata extends EntityMetadata {
  source?: string;
  authorId?: string;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  language: string;
  estimatedTime: number; // seconds
  skillLevel: string;
  bloomsLevel: BloomsLevel;
  cognitiveLoad: CognitiveLoad;
  customFields?: Record<string, any>;
}

/**
 * Enhanced Question entity with extended metadata
 * Extends the core Question interface from domain.types.ts
 */
export interface EnhancedQuestion extends Question {
  type: QuestionType;
  metadata: QuestionMetadata;
}

// =======================================================
// QUESTION API REQUEST/RESPONSE TYPES
// =======================================================

/**
 * Request parameters for listing questions with filtering
 */
export interface GetQuestionsRequest {
  provider?: string;
  exam?: string;
  topic?: string;
  difficulty?: DifficultyLevel;
  type?: QuestionType;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  includeExplanations?: boolean;
  includeMetadata?: boolean;
}

/**
 * Response format for question listing with filtering metadata
 */
export interface GetQuestionsResponse {
  questions: EnhancedQuestion[];
  total: number;
  filters: {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: DifficultyLevel[];
    types: QuestionType[];
    tags: string[];
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Request parameters for getting a specific question
 */
export interface GetQuestionRequest {
  questionId: string;
  includeExplanation?: boolean;
  includeMetadata?: boolean;
}

/**
 * Response format for single question details
 */
export interface GetQuestionResponse {
  question: EnhancedQuestion;
}

// =======================================================
// QUESTION SEARCH TYPES
// =======================================================

/**
 * Advanced search request with full-text search capabilities
 */
export interface SearchQuestionsRequest {
  query: string;
  provider?: string;
  exam?: string;
  topic?: string;
  difficulty?: DifficultyLevel;
  type?: QuestionType;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: SearchSortOption;
  includeExplanations?: boolean;
  includeMetadata?: boolean;
  highlightMatches?: boolean;
}

/**
 * Search response with relevance scoring and highlighting
 */
export interface SearchQuestionsResponse {
  questions: SearchQuestionResult[];
  total: number;
  query: string;
  searchTime: number; // milliseconds
  filters: {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: DifficultyLevel[];
    types: QuestionType[];
    tags: string[];
  };
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Question result with search relevance and highlighting
 */
export interface SearchQuestionResult extends EnhancedQuestion {
  relevanceScore: number; // 0-1 relevance score
  highlights?: SearchHighlights; // Highlighted matching terms
}

/**
 * Text highlighting for search matches
 */
export interface SearchHighlights {
  questionText?: string[];
  options?: string[];
  explanation?: string[];
  tags?: string[];
}

/**
 * Search sorting options
 */
export enum SearchSortOption {
  RELEVANCE = 'relevance',
  DIFFICULTY_ASC = 'difficulty_asc',
  DIFFICULTY_DESC = 'difficulty_desc',
  CREATED_ASC = 'created_asc',
  CREATED_DESC = 'created_desc',
}

// =======================================================
// SERVICE INTERFACE
// =======================================================

/**
 * Question service interface for business operations
 */
export interface IQuestionService {
  getQuestions(request: GetQuestionsRequest): Promise<GetQuestionsResponse>;
  getQuestion(request: GetQuestionRequest): Promise<GetQuestionResponse>;
  searchQuestions(request: SearchQuestionsRequest): Promise<SearchQuestionsResponse>;
}

// =======================================================
// BACKWARD COMPATIBILITY
// =======================================================
// Re-export core Question types for convenience

export type { Question, QuestionOption, DifficultyLevel } from './domain.types';

/** @deprecated Use DifficultyLevel enum instead */
export type QuestionDifficulty = DifficultyLevel;