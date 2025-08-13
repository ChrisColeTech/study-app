// Question repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Question } from '../shared/types/question.types';
import { ServiceConfig } from '../shared/service-factory';
import { S3BaseRepository } from './base.repository';
import {
  IListRepository,
  StandardQueryParams,
  StandardQueryResult,
} from '../shared/types/repository.types';
import { QuestionCacheManager } from './question-cache-manager';
import { QuestionDataTransformer } from './question-data-transformer';
import { QuestionQueryBuilder } from './question-query-builder';

export interface IQuestionRepository extends IListRepository<Question, StandardQueryParams> {
  /**
   * Find questions by provider with standardized result format
   * @param provider - Provider identifier
   * @param filters - Optional pagination and filtering parameters
   * @returns Promise<StandardQueryResult<Question>> - Standardized paginated results
   * @throws RepositoryError
   */
  findByProvider(
    provider: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>>;

  /**
   * Find questions by provider and exam with standardized result format
   * @param provider - Provider identifier
   * @param exam - Exam identifier
   * @param filters - Optional pagination and filtering parameters
   * @returns Promise<StandardQueryResult<Question>> - Standardized paginated results
   * @throws RepositoryError
   */
  findByExam(
    provider: string,
    exam: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>>;

  /**
   * Find questions by provider, exam, and topic with standardized result format
   * @param provider - Provider identifier
   * @param exam - Exam identifier
   * @param topic - Topic identifier
   * @param filters - Optional pagination and filtering parameters
   * @returns Promise<StandardQueryResult<Question>> - Standardized paginated results
   * @throws RepositoryError
   */
  findByTopic(
    provider: string,
    exam: string,
    topic: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>>;

  /**
   * Find question by ID across all providers/exams
   * @param questionId - Question identifier
   * @returns Promise<Question | null> - Question if found
   * @throws RepositoryError
   */
  findById(questionId: string): Promise<Question | null>;

  /**
   * Find questions by difficulty level with standardized result format
   * @param provider - Provider identifier
   * @param exam - Exam identifier
   * @param difficulty - Difficulty level
   * @param filters - Optional pagination and filtering parameters
   * @returns Promise<StandardQueryResult<Question>> - Standardized paginated results
   * @throws RepositoryError
   */
  findByDifficulty(
    provider: string,
    exam: string,
    difficulty: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>>;

  /**
   * Search questions with text query and standardized result format
   * @param query - Search query string
   * @param filters - Optional pagination and filtering parameters
   * @param provider - Optional provider filter
   * @param exam - Optional exam filter
   * @returns Promise<StandardQueryResult<Question>> - Standardized paginated results
   * @throws RepositoryError
   */
  searchQuestions(
    query: string,
    filters?: StandardQueryParams,
    provider?: string,
    exam?: string
  ): Promise<StandardQueryResult<Question>>;
}

export class QuestionRepository extends S3BaseRepository implements IQuestionRepository {
  private s3Client: S3Client;
  private readonly QUESTIONS_PREFIX = 'questions/';

  // Focused helper classes following SRP
  private cacheManager: QuestionCacheManager;
  private dataTransformer: QuestionDataTransformer;
  private queryBuilder: QuestionQueryBuilder;

  constructor(s3Client: S3Client, config: ServiceConfig) {
    super('QuestionRepository', config, config.s3.bucketName);
    this.s3Client = s3Client;

    // Initialize focused helper classes
    this.cacheManager = new QuestionCacheManager();
    this.dataTransformer = new QuestionDataTransformer();
    this.queryBuilder = new QuestionQueryBuilder();
  }

  /**
   * Perform health check operation for S3 connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.QUESTIONS_PREFIX,
        MaxKeys: 1,
      })
    );
  }

  /**
   * Find all questions with optional filtering and pagination - standardized implementation
   */
  async findAll(filters?: StandardQueryParams): Promise<StandardQueryResult<Question>> {
    return this.executeWithErrorHandling(
      'findAll',
      async () => {
        const startTime = Date.now();

        const cacheKey = this.cacheManager.getAllQuestionsCacheKey();

        // Check cache first
        const cachedResult =
          this.cacheManager.getFromCache<StandardQueryResult<Question>>(cacheKey);
        if (cachedResult) {
          this.logger.debug('All questions retrieved from cache', {
            count: cachedResult.items.length,
          });
          return cachedResult;
        }

        // For now, return empty result - implement S3 loading later
        const allQuestions: Question[] = [];

        // Apply filters and pagination
        const filteredQuestions = this.applyFilters(allQuestions, filters);
        const paginatedQuestions = this.applyPagination(filteredQuestions, filters);

        const result: StandardQueryResult<Question> = {
          items: paginatedQuestions,
          total: filteredQuestions.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: (filters?.offset || 0) + paginatedQuestions.length < filteredQuestions.length,
          executionTimeMs: Date.now() - startTime,
        };

        // Cache results with shorter TTL for all queries
        this.cacheManager.setCache(cacheKey, result, 300); // 5 minutes

        this.logger.info('All questions query completed', {
          total: result.total,
          returned: result.items.length,
        });
        return result;
      },
      { filters }
    );
  }

  /**
   * Simple question transformation
   */
  private transformQuestion(q: any): Question {
    return q as Question; // Simple pass-through for now
  }

  /**
   * Load questions from S3 for a provider
   */
  private async loadQuestionsFromS3(provider: string): Promise<any[]> {
    // Simple implementation for compilation
    return [];
  }

  /**
   * Find questions by provider
   */
  async findByProvider(
    provider: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>> {
    return this.executeWithErrorHandling(
      'findByProvider',
      async () => {
        const startTime = Date.now();
        this.validateRequired({ provider }, 'findByProvider');

        const cacheKey = this.cacheManager.getProviderCacheKey(provider);

        // Check cache first
        const cachedResult =
          this.cacheManager.getFromCache<StandardQueryResult<Question>>(cacheKey);
        if (cachedResult) {
          this.logger.debug('Questions retrieved from cache', {
            provider,
            count: cachedResult.items.length,
          });
          return cachedResult;
        }

        // For now, implement basic S3 loading
        const questions = await this.loadQuestionsFromS3(provider);

        // Transform and apply filters
        const transformedQuestions = questions.map((q: any) => this.transformQuestion(q));
        const filteredQuestions = this.applyFilters(transformedQuestions, filters);
        const paginatedQuestions = this.applyPagination(filteredQuestions, filters);

        const result: StandardQueryResult<Question> = {
          items: paginatedQuestions,
          total: filteredQuestions.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: (filters?.offset || 0) + paginatedQuestions.length < filteredQuestions.length,
          executionTimeMs: Date.now() - startTime,
        };

        // Cache results
        this.cacheManager.setCache(cacheKey, result);

        this.logger.info('Questions loaded from S3', {
          provider,
          total: result.total,
          returned: result.items.length,
        });
        return result;
      },
      { provider, filters }
    );
  }

  /**
   * Find questions by exam
   */
  async findByExam(
    provider: string,
    exam: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>> {
    return this.executeWithErrorHandling(
      'findByExam',
      async () => {
        const startTime = Date.now();
        this.validateRequired({ provider, exam }, 'findByExam');

        const cacheKey = this.cacheManager.getExamCacheKey(provider, exam);

        // Check cache first
        const cachedResult =
          this.cacheManager.getFromCache<StandardQueryResult<Question>>(cacheKey);
        if (cachedResult) {
          this.logger.debug('Questions retrieved from cache', {
            provider,
            exam,
            count: cachedResult.items.length,
          });
          return cachedResult;
        }

        // For now, implement basic S3 loading
        const questions = await this.loadQuestionsFromS3(provider);

        // Transform and apply filters
        const transformedQuestions = questions.map((q: any) => this.transformQuestion(q));
        const filteredQuestions = this.applyFilters(transformedQuestions, filters);
        const paginatedQuestions = this.applyPagination(filteredQuestions, filters);

        const result: StandardQueryResult<Question> = {
          items: paginatedQuestions,
          total: filteredQuestions.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: (filters?.offset || 0) + paginatedQuestions.length < filteredQuestions.length,
          executionTimeMs: Date.now() - startTime,
        };

        // Cache results
        this.cacheManager.setCache(cacheKey, result);

        this.logger.info('Questions loaded from S3', {
          provider,
          exam,
          total: result.total,
          returned: result.items.length,
        });
        return result;
      },
      { provider, exam, filters }
    );
  }

  /**
   * Find questions by topic
   */
  async findByTopic(
    provider: string,
    exam: string,
    topic: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>> {
    return this.executeWithErrorHandling(
      'findByTopic',
      async () => {
        const startTime = Date.now();
        this.validateRequired({ provider, exam, topic }, 'findByTopic');

        const cacheKey = `${provider}-${exam}-${topic}`;

        // Check cache first
        const cachedResult =
          this.cacheManager.getFromCache<StandardQueryResult<Question>>(cacheKey);
        if (cachedResult) {
          this.logger.debug('Questions retrieved from cache', {
            provider,
            exam,
            topic,
            count: cachedResult.items.length,
          });
          return cachedResult;
        }

        // Get questions for exam and filter by topic
        const examResult = await this.findByExam(provider, exam, { limit: 1000 }); // Get all for filtering
        const topicFilteredQuestions = examResult.items.filter(
          (q: Question) => q.topicId === topic || (q.tags && q.tags.includes(topic))
        );

        // Apply additional filters and pagination
        const filteredQuestions = this.applyFilters(topicFilteredQuestions, filters);
        const paginatedQuestions = this.applyPagination(filteredQuestions, filters);

        const result: StandardQueryResult<Question> = {
          items: paginatedQuestions,
          total: filteredQuestions.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: (filters?.offset || 0) + paginatedQuestions.length < filteredQuestions.length,
          executionTimeMs: Date.now() - startTime,
        };

        // Cache filtered results
        this.cacheManager.setCache(cacheKey, result);

        this.logger.info('Questions filtered by topic', {
          provider,
          exam,
          topic,
          total: result.total,
          returned: result.items.length,
        });
        return result;
      },
      { provider, exam, topic, filters }
    );
  }

  /**
   * Find a specific question by ID
   */
  async findById(questionId: string): Promise<Question | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        this.validateRequired({ questionId }, 'findById');

        const cacheKey = this.cacheManager.getQuestionCacheKey(questionId);

        // Check cache first
        const cachedQuestion = this.cacheManager.getFromCache<Question>(cacheKey);
        if (cachedQuestion) {
          this.logger.debug('Question found in cache', { questionId });
          return cachedQuestion;
        }

        // For now, return null - implement S3 search later
        this.logger.debug('Question not found by ID', { questionId });
        return null;
      },
      { questionId }
    );
  }

  /**
   * Find questions by difficulty level
   */
  async findByDifficulty(
    provider: string,
    exam: string,
    difficulty: string,
    filters?: StandardQueryParams
  ): Promise<StandardQueryResult<Question>> {
    return this.executeWithErrorHandling(
      'findByDifficulty',
      async () => {
        const startTime = Date.now();
        this.validateRequired({ provider, exam, difficulty }, 'findByDifficulty');

        const cacheKey = `${provider}-${exam}-difficulty-${difficulty}`;

        // Check cache first
        const cachedResult =
          this.cacheManager.getFromCache<StandardQueryResult<Question>>(cacheKey);
        if (cachedResult) {
          this.logger.debug('Questions retrieved from cache', {
            provider,
            exam,
            difficulty,
            count: cachedResult.items.length,
          });
          return cachedResult;
        }

        // Get questions for exam and filter by difficulty
        const examResult = await this.findByExam(provider, exam, { limit: 1000 }); // Get all for filtering
        const difficultyFilteredQuestions = examResult.items.filter(
          (q: Question) => q.difficulty === difficulty
        );

        // Apply additional filters and pagination
        const filteredQuestions = this.applyFilters(difficultyFilteredQuestions, filters);
        const paginatedQuestions = this.applyPagination(filteredQuestions, filters);

        const result: StandardQueryResult<Question> = {
          items: paginatedQuestions,
          total: filteredQuestions.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: (filters?.offset || 0) + paginatedQuestions.length < filteredQuestions.length,
          executionTimeMs: Date.now() - startTime,
        };

        // Cache filtered results
        this.cacheManager.setCache(cacheKey, result);

        this.logger.info('Questions filtered by difficulty', {
          provider,
          exam,
          difficulty,
          total: result.total,
          returned: result.items.length,
        });
        return result;
      },
      { provider, exam, difficulty, filters }
    );
  }

  /**
   * Search questions with optional provider/exam filters
   */
  async searchQuestions(
    query: string,
    filters?: StandardQueryParams,
    provider?: string,
    exam?: string
  ): Promise<StandardQueryResult<Question>> {
    return this.executeWithErrorHandling(
      'searchQuestions',
      async () => {
        const startTime = Date.now();
        this.validateRequired({ query }, 'searchQuestions');

        const cacheKey = `search-${query}-${provider || 'all'}-${exam || 'all'}`;

        // Check cache first
        const cachedResult =
          this.cacheManager.getFromCache<StandardQueryResult<Question>>(cacheKey);
        if (cachedResult) {
          this.logger.debug('Search results retrieved from cache', {
            query,
            provider,
            exam,
            count: cachedResult.items.length,
          });
          return cachedResult;
        }

        // For now, return empty array - implement search later
        const searchResults: Question[] = [];

        // Apply filters and pagination
        const filteredQuestions = this.applyFilters(searchResults, filters);
        const paginatedQuestions = this.applyPagination(filteredQuestions, filters);

        const result: StandardQueryResult<Question> = {
          items: paginatedQuestions,
          total: filteredQuestions.length,
          limit: filters?.limit || this.config.query?.defaultLimit || 20,
          offset: filters?.offset || 0,
          hasMore: (filters?.offset || 0) + paginatedQuestions.length < filteredQuestions.length,
          executionTimeMs: Date.now() - startTime,
        };

        // Cache search results with shorter TTL
        this.cacheManager.setCache(cacheKey, result, 300); // 5 minutes for search results

        this.logger.info('Question search completed', {
          query,
          provider,
          exam,
          total: result.total,
          returned: result.items.length,
        });
        return result;
      },
      { query, filters, provider, exam }
    );
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cacheManager.clearCache();
    this.logger.info('Question repository cache cleared');
  }

  /**
   * Refresh cache from source
   */
  async refreshCache(): Promise<void> {
    return this.executeWithErrorHandling('refreshCache', async () => {
      this.clearCache();
      this.logger.info('Question repository cache refreshed');
    });
  }

  /**
   * Apply filters to questions array
   */
  private applyFilters(questions: Question[], filters?: StandardQueryParams & any): Question[] {
    if (!filters) return questions;

    let filtered = questions;

    // Apply any additional filters here based on the filters object
    // For now, just return the original array
    return filtered;
  }

  /**
   * Apply pagination to questions array
   */
  private applyPagination(questions: Question[], filters?: StandardQueryParams & any): Question[] {
    if (!filters) return questions;

    const offset = filters.offset || 0;
    const limit = filters.limit || this.config.query?.defaultLimit || 20;

    return questions.slice(offset, offset + limit);
  }
}
