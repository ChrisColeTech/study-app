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

        // Load all questions from S3 (currently only AWS provider)
        const allQuestions = await this.loadQuestionsFromS3('aws');

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
   * Transform S3 question data to Question interface
   */
  private transformS3QuestionToQuestion(s3Item: any, provider: string, examType: string): Question {
    try {
      const questionNumber = s3Item.question_number || 1;
      const questionData = s3Item.question || {};
      const answerData = s3Item.answer || {};
      const studyMetadata = s3Item.study_metadata || {};

      // Generate unique question ID
      const questionId = `${provider}-${examType}-${String(questionNumber).padStart(3, '0')}`;
      
      // Extract question text
      const questionText = questionData.text || 'Question text not available';
      
      // Transform options from S3 format [[letter, text], ...] to string array
      const options: string[] = [];
      if (questionData.options && Array.isArray(questionData.options)) {
        questionData.options.forEach((option: any) => {
          if (Array.isArray(option) && option.length >= 2) {
            // Format: "A: Option text"
            options.push(`${option[0]}: ${option[1]}`);
          }
        });
      }

      // Extract correct answer
      const correctAnswer = answerData.correct_answer || 'Answer not available';

      // Extract explanation
      const explanation = answerData.explanation || 'Explanation not available';

      // Map difficulty (S3 uses 'easy', 'medium', 'hard' which matches our enum)
      const difficulty = studyMetadata.difficulty || 'medium';

      // Extract topic
      const topicId = questionData.topic || questionData.service_category || 'general';

      // Extract tags
      const tags: string[] = [];
      if (questionData.aws_services && Array.isArray(questionData.aws_services)) {
        tags.push(...questionData.aws_services);
      }
      if (answerData.keywords && Array.isArray(answerData.keywords)) {
        tags.push(...answerData.keywords);
      }

      // Create Question object matching the interface
      const question: Question = {
        questionId,
        providerId: provider,
        examId: examType,
        topicId,
        questionText,
        options,
        correctAnswer: [correctAnswer], // Array for multi-select support
        explanation,
        difficulty: difficulty as any, // Cast to DifficultyLevel
        tags,
        // EntityMetadata fields
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return question;
    } catch (error) {
      this.logger.error('Failed to transform S3 question', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        questionNumber: s3Item.question_number 
      });
      
      // Return minimal question object on error
      return {
        questionId: `${provider}-${examType}-error`,
        providerId: provider,
        examId: examType,
        topicId: 'general',
        questionText: 'Error loading question',
        options: [],
        correctAnswer: [],
        explanation: 'Error loading explanation',
        difficulty: 'medium' as any,
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Load questions from S3 for a provider
   */
  private async loadQuestionsFromS3(provider: string): Promise<any[]> {
    try {
      const startTime = Date.now();
      this.logger.debug('Loading questions from S3', { provider });

      // For AWS provider, load all exam files
      if (provider.toLowerCase() === 'aws') {
        const examTypes = ['aif-c01', 'clf-c02', 'saa-c03', 'sap-c02'];
        const allQuestions: any[] = [];

        for (const examType of examTypes) {
          const key = `${this.QUESTIONS_PREFIX}${provider}/${examType}/questions.json`;
          this.logger.debug('Fetching S3 object', { bucket: this.bucketName, key });

          try {
            const response = await this.s3Client.send(
              new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
              })
            );

            if (response.Body) {
              const bodyContents = await response.Body.transformToString();
              const questionData = JSON.parse(bodyContents);
              
              // Extract questions from study_data array
              if (questionData.study_data && Array.isArray(questionData.study_data)) {
                const transformedQuestions = questionData.study_data.map((item: any) => 
                  this.transformS3QuestionToQuestion(item, provider, examType)
                );
                allQuestions.push(...transformedQuestions);
                
                this.logger.debug('Loaded questions from exam', { 
                  examType, 
                  count: transformedQuestions.length 
                });
              }
            }
          } catch (error) {
            this.logger.warn('Failed to load questions for exam', { 
              examType, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            // Continue with other exams even if one fails
          }
        }

        this.logger.info('Questions loaded from S3', { 
          provider, 
          totalQuestions: allQuestions.length,
          loadTimeMs: Date.now() - startTime 
        });
        return allQuestions;
      }

      // For other providers, return empty for now
      this.logger.warn('Provider not supported yet', { provider });
      return [];
    } catch (error) {
      this.logger.error('Failed to load questions from S3', { 
        provider, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
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
