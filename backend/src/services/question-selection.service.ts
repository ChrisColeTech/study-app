// Question Selection service for Study App V3 Backend  
// Objective 36: QuestionService Optimization - Selection algorithms focused service

import {
  Question,
  EnhancedQuestion,
  GetQuestionsRequest,
  GetQuestionsResponse,
  GetQuestionRequest,
  SearchQuestionsRequest,
  QuestionDifficulty,
  QuestionType,
} from '../shared/types/question.types';
import { createLogger } from '../shared/logger';

export interface IQuestionSelectionService {
  selectQuestions(allQuestions: Question[], request: GetQuestionsRequest): Promise<GetQuestionsResponse>;
  processQuestionOutput(question: Question, request: GetQuestionRequest): Promise<EnhancedQuestion>;
  applySearchFilters(questions: Question[], request: SearchQuestionsRequest): Question[];
  generateFilterOptions(questions: Question[]): {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: QuestionDifficulty[];
    types: QuestionType[];
    tags: string[];
  };
}

/**
 * QuestionSelectionService - Handles question filtering, selection, and output processing
 * Split from QuestionService for SRP compliance (Objective 36)
 * Focused on algorithm-based question selection
 */
export class QuestionSelectionService implements IQuestionSelectionService {
  private logger = createLogger({ component: 'QuestionSelectionService' });

  constructor() {}

  /**
   * Select and process questions with filtering and pagination
   */
  async selectQuestions(
    allQuestions: Question[],
    request: GetQuestionsRequest
  ): Promise<GetQuestionsResponse> {
    // Apply filters
    let filteredQuestions = this.applyFilters(allQuestions, request);

    // Apply pagination
    const limit = request.limit || 50;
    const offset = request.offset || 0;
    const total = filteredQuestions.length;
    const paginatedQuestions = filteredQuestions.slice(offset, offset + limit);

    // Generate available filter options from all questions
    const filters = this.generateFilterOptions(allQuestions);

    // Strip explanations if not requested
    if (!request.includeExplanations) {
      paginatedQuestions.forEach(q => {
        q.explanation = '';
      });
    }

    // Convert to EnhancedQuestions and strip metadata if not requested
    const enhancedQuestions = paginatedQuestions.map(q => this.createEnhancedQuestion(q));
    
    if (!request.includeMetadata) {
      enhancedQuestions.forEach(q => {
        q.metadata = {} as any;
      });
    }

    return {
      questions: enhancedQuestions,
      total,
      filters,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Process question output based on request flags
   */
  async processQuestionOutput(question: Question, request: GetQuestionRequest): Promise<EnhancedQuestion> {
    const enhancedQuestion = this.createEnhancedQuestion(question);

    // Strip explanation if not requested (default true for details endpoint)
    if (request.includeExplanation === false) {
      enhancedQuestion.explanation = '';
    }

    // Strip metadata if not requested (default true for details endpoint)
    if (request.includeMetadata === false) {
      enhancedQuestion.metadata = {} as any;
    }

    return enhancedQuestion;
  }

  /**
   * Apply filters specific to search (excluding full-text search)
   */
  applySearchFilters(questions: Question[], request: SearchQuestionsRequest): Question[] {
    let filtered = questions;

    // Filter by topic
    if (request.topic) {
      filtered = filtered.filter(q => q.topicId === request.topic);
    }

    // Filter by difficulty
    if (request.difficulty) {
      filtered = filtered.filter(q => q.difficulty === request.difficulty);
    }

    // Filter by type (base Questions don't have type, so assume default)
    if (request.type) {
      filtered = filtered.filter(q => (q as any).type === request.type || request.type === QuestionType.MULTIPLE_CHOICE);
    }

    // Filter by tags
    if (request.tags && request.tags.length > 0) {
      filtered = filtered.filter(q => q.tags && request.tags!.some(tag => q.tags!.includes(tag)));
    }

    return filtered;
  }

  /**
   * Generate available filter options from all questions
   */
  generateFilterOptions(questions: Question[]): {
    providers: string[];
    exams: string[];
    topics: string[];
    difficulties: QuestionDifficulty[];
    types: QuestionType[];
    tags: string[];
  } {
    const providers = [...new Set(questions.map(q => q.providerId))];
    const exams = [...new Set(questions.map(q => q.examId))];
    const topics = [...new Set(questions.map(q => q.topicId).filter(Boolean) as string[])];
    const difficulties = [...new Set(questions.map(q => q.difficulty))];
    const types = [...new Set(questions.map(q => (q as any).type || QuestionType.MULTIPLE_CHOICE))];
    const tags = [...new Set(questions.flatMap(q => q.tags || []))];

    return {
      providers: providers.sort(),
      exams: exams.sort(),
      topics: topics.sort(),
      difficulties,
      types,
      tags: tags.sort(),
    };
  }

  /**
   * Apply filters to question list
   */
  private applyFilters(questions: Question[], request: GetQuestionsRequest): Question[] {
    let filtered = questions;

    // Filter by topic
    if (request.topic) {
      filtered = filtered.filter(q => q.topicId === request.topic);
    }

    // Filter by difficulty
    if (request.difficulty) {
      filtered = filtered.filter(q => q.difficulty === request.difficulty);
    }

    // Filter by type (base Questions don't have type, so assume default)
    if (request.type) {
      filtered = filtered.filter(q => (q as any).type === request.type || request.type === QuestionType.MULTIPLE_CHOICE);
    }

    // Filter by tags
    if (request.tags && request.tags.length > 0) {
      filtered = filtered.filter(q => q.tags && request.tags!.some(tag => q.tags!.includes(tag)));
    }

    // Apply search filter
    if (request.search) {
      const searchLower = request.search.toLowerCase();
      filtered = filtered.filter(
        q =>
          q.questionText.toLowerCase().includes(searchLower) ||
          q.options.some(option => option.toLowerCase().includes(searchLower)) ||
          (q.explanation && q.explanation.toLowerCase().includes(searchLower)) ||
          (q.tags && q.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    return filtered;
  }

  /**
   * Convert Question to EnhancedQuestion with default metadata and type
   */
  private createEnhancedQuestion(question: Question): EnhancedQuestion {
    return {
      ...question,
      type: QuestionType.MULTIPLE_CHOICE, // Default type
      metadata: {
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
        version: question.version || 1,
        reviewStatus: 'APPROVED' as any, // Default to approved
        language: 'en',
        estimatedTime: 60,
        skillLevel: 'intermediate',
        bloomsLevel: 'UNDERSTAND' as any, // Default blooms level
        cognitiveLoad: 'MEDIUM' as any // Default cognitive load
      }
    };
  }
}