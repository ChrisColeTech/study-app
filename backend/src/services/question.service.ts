// Question service for Study App V3 Backend
// Objective 36: QuestionService Optimization - Main orchestration service

import {
  GetQuestionsRequest,
  GetQuestionsResponse,
  GetQuestionRequest,
  GetQuestionResponse,
  SearchQuestionsRequest,
  SearchQuestionsResponse,
  IQuestionService,
} from '../shared/types/question.types';
import { BaseService } from '../shared/base-service';
import { QuestionCrudService } from './question-crud.service';
import { IQuestionAnalyticsService } from './question-analytics.service';

// Re-export the interface for ServiceFactory
export type { IQuestionService };

/**
 * QuestionService - Main orchestration service for question operations
 * Objective 36: QuestionService Optimization - Delegates to focused services for SRP compliance
 */
export class QuestionService extends BaseService implements IQuestionService {
  constructor(
    private questionCrudService: QuestionCrudService,
    private questionAnalyticsService: IQuestionAnalyticsService
  ) {
    super();
  }

  /**
   * Get questions with comprehensive filtering - delegates to CRUD service
   */
  async getQuestions(request: GetQuestionsRequest): Promise<GetQuestionsResponse> {
    return await this.questionCrudService.getQuestions(request);
  }

  /**
   * Get individual question by ID - delegates to CRUD service
   */
  async getQuestion(request: GetQuestionRequest): Promise<GetQuestionResponse> {
    return await this.questionCrudService.getQuestion(request);
  }

  /**
   * Search questions with full-text search and relevance scoring - delegates to analytics service
   */
  async searchQuestions(request: SearchQuestionsRequest): Promise<SearchQuestionsResponse> {
    return await this.questionAnalyticsService.searchQuestions(request);
  }

  /**
   * Refresh question cache (admin operation) - delegates to CRUD service
   */
  async refreshCache(): Promise<void> {
    return await this.questionCrudService.refreshCache();
  }
}