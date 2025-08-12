// Question repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Question } from '../shared/types/question.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';
import { QuestionCacheManager } from './question-cache-manager';
import { QuestionDataTransformer } from './question-data-transformer';
import { QuestionQueryBuilder } from './question-query-builder';



export interface IQuestionRepository {
  findByProvider(provider: string): Promise<Question[]>;
  findByExam(provider: string, exam: string): Promise<Question[]>;
  findByTopic(provider: string, exam: string, topic: string): Promise<Question[]>;
  findById(questionId: string): Promise<Question | null>;
  findByDifficulty(provider: string, exam: string, difficulty: string): Promise<Question[]>;
  searchQuestions(query: string, provider?: string, exam?: string): Promise<Question[]>;
  clearCache(): void;
}

export class QuestionRepository implements IQuestionRepository {
  private s3Client: S3Client;
  private bucketName: string;
  private logger = createLogger({ component: 'QuestionRepository' });
  private readonly QUESTIONS_PREFIX = 'questions/';

  // Focused helper classes following SRP
  private cacheManager: QuestionCacheManager;
  private dataTransformer: QuestionDataTransformer;
  private queryBuilder: QuestionQueryBuilder;

  constructor(s3Client: S3Client, config: ServiceConfig) {
    this.s3Client = s3Client;
    this.bucketName = config.s3.bucketName;
    
    // Initialize focused helper classes
    this.cacheManager = new QuestionCacheManager();
    this.dataTransformer = new QuestionDataTransformer();
    this.queryBuilder = new QuestionQueryBuilder();
  }

  /**
   * Find questions by provider
   */
  async findByProvider(provider: string): Promise<Question[]> {
    const cacheKey = this.cacheManager.getProviderCacheKey(provider);
    
    // Check cache first
    const cached = this.cacheManager.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Questions retrieved from cache', { provider });
      return cached;
    }

    try {
      this.logger.info('Loading questions by provider from S3', { provider, bucket: this.bucketName });

      // List all question files for this provider
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.queryBuilder.buildProviderPrefix(provider, this.QUESTIONS_PREFIX),
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allQuestions: Question[] = [];

      if (listResult.Contents) {
        const questionFiles = this.queryBuilder.filterToQuestionFiles(listResult.Contents);

        this.logger.info('Found question files', { provider, count: questionFiles.length });

        // Load each question file
        for (const file of questionFiles) {
          try {
            const questions = await this.loadQuestionFile(file.Key);
            allQuestions.push(...questions);
          } catch (error) {
            this.logger.warn('Failed to load question file', { 
              file: file.Key,
              error: (error as Error).message
            });
          }
        }
      }

      // Cache the results
      this.cacheManager.setCache(cacheKey, allQuestions);
      
      this.logger.info('Questions loaded successfully', { 
        provider,
        totalQuestions: allQuestions.length
      });

      return allQuestions;
    } catch (error) {
      return this.handleS3Error(error, { provider });
    }
  }

  /**
   * Find questions by specific exam
   */
  async findByExam(provider: string, exam: string): Promise<Question[]> {
    const cacheKey = this.cacheManager.getExamCacheKey(provider, exam);
    
    // Check cache first
    const cached = this.cacheManager.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Questions retrieved from cache', { provider, exam });
      return cached;
    }

    try {
      this.logger.info('Loading questions by exam from S3', { provider, exam, bucket: this.bucketName });

      const questionKey = this.queryBuilder.buildQuestionFileKey(provider, exam, this.QUESTIONS_PREFIX);
      const questions = await this.loadQuestionFile(questionKey);

      // Cache the results
      this.cacheManager.setCache(cacheKey, questions);
      
      this.logger.info('Questions loaded successfully', { 
        provider,
        exam,
        totalQuestions: questions.length
      });

      return questions;
    } catch (error) {
      return this.handleS3Error(error, { provider, exam });
    }
  }

  /**
   * Find questions by topic within an exam
   */
  async findByTopic(provider: string, exam: string, topic: string): Promise<Question[]> {
    const examQuestions = await this.findByExam(provider, exam);
    return this.queryBuilder.filterByTopic(examQuestions, topic);
  }

  /**
   * Find a specific question by ID
   */
  async findById(questionId: string): Promise<Question | null> {
    const cacheKey = this.cacheManager.getQuestionCacheKey(questionId);
    
    // Check cache first
    const cached = this.cacheManager.getFromCache<Question>(cacheKey);
    if (cached) {
      this.logger.debug('Question retrieved from cache', { questionId });
      return cached;
    }

    try {
      // We need to search through all question files to find this ID
      // This is inefficient but necessary with the current S3 structure
      const allQuestions = await this.getAllQuestions();
      const question = this.queryBuilder.findQuestionById(allQuestions, questionId);

      if (question) {
        // Cache the result
        this.cacheManager.setCache(cacheKey, question);
        this.logger.debug('Question found', { questionId });
        return question;
      } else {
        this.logger.warn('Question not found', { questionId });
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to find question by ID', error as Error, { questionId });
      return null;
    }
  }

  /**
   * Find questions by difficulty
   */
  async findByDifficulty(provider: string, exam: string, difficulty: string): Promise<Question[]> {
    const examQuestions = await this.findByExam(provider, exam);
    return this.queryBuilder.filterByDifficulty(examQuestions, difficulty);
  }

  /**
   * Search questions by text content with enhanced matching
   */
  async searchQuestions(query: string, provider?: string, exam?: string): Promise<Question[]> {
    let questionsToSearch: Question[];
    
    if (provider && exam) {
      questionsToSearch = await this.findByExam(provider, exam);
    } else if (provider) {
      questionsToSearch = await this.findByProvider(provider);
    } else {
      // When no provider specified, search across available data
      questionsToSearch = await this.getSearchableQuestions();
    }

    return this.queryBuilder.searchQuestions(questionsToSearch, query);
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cacheManager.clearCache();
  }

  /**
   * Get all questions from all providers (expensive operation)
   */
  private async getAllQuestions(): Promise<Question[]> {
    const cacheKey = this.cacheManager.getAllQuestionsCacheKey();
    
    // Check cache first
    const cached = this.cacheManager.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('All questions retrieved from cache');
      return cached;
    }

    try {
      this.logger.info('Loading all questions from S3', { bucket: this.bucketName });

      // List all question files
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.QUESTIONS_PREFIX,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allQuestions: Question[] = [];

      if (listResult.Contents) {
        const questionFiles = this.queryBuilder.filterToQuestionFiles(listResult.Contents);

        this.logger.info('Found question files', { count: questionFiles.length });

        // Load each question file
        for (const file of questionFiles) {
          try {
            const questions = await this.loadQuestionFile(file.Key);
            allQuestions.push(...questions);
          } catch (error) {
            this.logger.warn('Failed to load question file', { 
              file: file.Key,
              error: (error as Error).message
            });
          }
        }
      }

      // Cache the results
      this.cacheManager.setCache(cacheKey, allQuestions);
      
      this.logger.info('All questions loaded successfully', { 
        totalQuestions: allQuestions.length
      });

      return allQuestions;
    } catch (error) {
      return this.handleS3Error(error, {});
    }
  }

  /**
   * Get searchable questions efficiently (prioritize popular providers)
   */
  private async getSearchableQuestions(): Promise<Question[]> {
    const cacheKey = this.cacheManager.getSearchableCacheKey();
    
    // Check cache first
    const cached = this.cacheManager.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Searchable questions retrieved from cache');
      return cached;
    }

    try {
      // Start with AWS questions (most popular), then expand if needed
      const popularProviders = ['aws', 'azure', 'gcp', 'cisco', 'comptia'];
      const allQuestions: Question[] = [];
      
      for (const provider of popularProviders) {
        try {
          const providerQuestions = await this.findByProvider(provider);
          allQuestions.push(...providerQuestions);
          
          // If we have enough questions for search, stop here for performance
          if (allQuestions.length >= 1000) {
            break;
          }
        } catch (error) {
          this.logger.warn(`Failed to load questions for provider: ${provider}`, {
            error: (error as Error).message
          });
          // Continue with other providers
        }
      }

      // Optimize questions for search performance
      const optimizedQuestions = this.queryBuilder.optimizeQuestionsForSearch(allQuestions);

      // Cache the results with shorter TTL for search data
      this.cacheManager.setCache(cacheKey, optimizedQuestions, this.cacheManager.getSearchTtl());

      return optimizedQuestions;
    } catch (error) {
      this.logger.error('Failed to load searchable questions', error as Error);
      return [];
    }
  }

  /**
   * Load a single question file from S3
   */
  private async loadQuestionFile(key: string): Promise<Question[]> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const result = await this.s3Client.send(getCommand);
      
      if (result.Body) {
        const content = await result.Body.transformToString();
        const questionData = JSON.parse(content);
        
        // Use data transformer to handle different formats
        return this.dataTransformer.processQuestionData(questionData, key);
      }
      return [];
    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return []; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Handle S3 errors gracefully with consistent error handling
   */
  private handleS3Error(error: any, context: { provider?: string; exam?: string }): Question[] {
    const errorName = error.name;
    if (errorName === 'NoSuchBucket' || errorName === 'AccessDenied' || errorName === 'NoSuchKey') {
      this.logger.warn('S3 data not accessible - returning empty results', { 
        ...context,
        bucket: this.bucketName,
        error: error.message 
      });
      return [];
    }
    
    this.logger.error('Failed to load questions from S3', error as Error, context);
    throw new Error('Failed to load question data');
  }
}