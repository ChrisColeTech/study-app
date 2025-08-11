// Question repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Question } from '../shared/types/question.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface QuestionFile {
  provider: string;
  exam: string;
  questions: Question[];
}

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
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly QUESTIONS_PREFIX = 'questions/';

  constructor(s3Client: S3Client, config: ServiceConfig) {
    this.s3Client = s3Client;
    this.bucketName = config.s3.bucketName;
  }

  /**
   * Find questions by provider
   */
  async findByProvider(provider: string): Promise<Question[]> {
    const cacheKey = `questions-provider-${provider}`;
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Questions retrieved from cache', { provider });
      return cached;
    }

    try {
      this.logger.info('Loading questions by provider from S3', { provider, bucket: this.bucketName });

      // List all question files for this provider
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: `${this.QUESTIONS_PREFIX}${provider}/`,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allQuestions: Question[] = [];

      if (listResult.Contents) {
        const questionFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.endsWith('/questions.json')
        );

        this.logger.info('Found question files', { provider, count: questionFiles.length });

        // Load each question file
        for (const file of questionFiles) {
          if (file.Key) {
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
      }

      // Cache the results
      this.setCache(cacheKey, allQuestions);
      
      this.logger.info('Questions loaded successfully', { 
        provider,
        totalQuestions: allQuestions.length
      });

      return allQuestions;
    } catch (error) {
      // Handle specific S3 errors gracefully
      const errorName = (error as any).name;
      if (errorName === 'NoSuchBucket' || errorName === 'AccessDenied') {
        this.logger.warn('S3 bucket not accessible - returning empty results', { 
          provider, 
          bucket: this.bucketName,
          error: (error as Error).message 
        });
        return [];
      }
      
      this.logger.error('Failed to load questions by provider from S3', error as Error, { provider });
      throw new Error('Failed to load question data');
    }
  }

  /**
   * Find questions by specific exam
   */
  async findByExam(provider: string, exam: string): Promise<Question[]> {
    const cacheKey = `questions-exam-${provider}-${exam}`;
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
    if (cached) {
      this.logger.debug('Questions retrieved from cache', { provider, exam });
      return cached;
    }

    try {
      this.logger.info('Loading questions by exam from S3', { provider, exam, bucket: this.bucketName });

      const questionKey = `${this.QUESTIONS_PREFIX}${provider}/${exam}/questions.json`;
      const questions = await this.loadQuestionFile(questionKey);

      // Cache the results
      this.setCache(cacheKey, questions);
      
      this.logger.info('Questions loaded successfully', { 
        provider,
        exam,
        totalQuestions: questions.length
      });

      return questions;
    } catch (error) {
      // Handle specific S3 errors gracefully
      const errorName = (error as any).name;
      if (errorName === 'NoSuchBucket' || errorName === 'AccessDenied' || errorName === 'NoSuchKey') {
        this.logger.warn('S3 data not accessible - returning empty results', { 
          provider, 
          exam,
          bucket: this.bucketName,
          error: (error as Error).message 
        });
        return [];
      }
      
      this.logger.error('Failed to load questions by exam from S3', error as Error, { provider, exam });
      throw new Error('Failed to load question data');
    }
  }

  /**
   * Find questions by topic within an exam
   */
  async findByTopic(provider: string, exam: string, topic: string): Promise<Question[]> {
    const examQuestions = await this.findByExam(provider, exam);
    return examQuestions.filter(question => question.topicId === topic);
  }

  /**
   * Find a specific question by ID
   */
  async findById(questionId: string): Promise<Question | null> {
    const cacheKey = `question-${questionId}`;
    
    // Check cache first
    const cached = this.getFromCache<Question>(cacheKey);
    if (cached) {
      this.logger.debug('Question retrieved from cache', { questionId });
      return cached;
    }

    try {
      // We need to search through all question files to find this ID
      // This is inefficient but necessary with the current S3 structure
      const allQuestions = await this.getAllQuestions();
      const question = allQuestions.find(q => q.questionId === questionId);

      if (question) {
        // Cache the result
        this.setCache(cacheKey, question);
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
    return examQuestions.filter(question => 
      question.difficulty.toLowerCase() === difficulty.toLowerCase()
    );
  }

  /**
   * Search questions by text content
   */
  async searchQuestions(query: string, provider?: string, exam?: string): Promise<Question[]> {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    let questionsToSearch: Question[];
    
    if (provider && exam) {
      questionsToSearch = await this.findByExam(provider, exam);
    } else if (provider) {
      questionsToSearch = await this.findByProvider(provider);
    } else {
      questionsToSearch = await this.getAllQuestions();
    }

    return questionsToSearch.filter(question => {
      const searchableText = [
        question.questionText,
        ...(question.options || []),
        question.explanation || '',
        ...(question.tags || [])
      ].join(' ').toLowerCase();

      return searchTerms.every(term => searchableText.includes(term));
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Question cache cleared');
  }

  /**
   * Get all questions from all providers (expensive operation)
   */
  private async getAllQuestions(): Promise<Question[]> {
    const cacheKey = 'all-questions';
    
    // Check cache first
    const cached = this.getFromCache<Question[]>(cacheKey);
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
        const questionFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.endsWith('/questions.json')
        );

        this.logger.info('Found question files', { count: questionFiles.length });

        // Load each question file
        for (const file of questionFiles) {
          if (file.Key) {
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
      }

      // Cache the results
      this.setCache(cacheKey, allQuestions);
      
      this.logger.info('All questions loaded successfully', { 
        totalQuestions: allQuestions.length
      });

      return allQuestions;
    } catch (error) {
      // Handle specific S3 errors gracefully
      const errorName = (error as any).name;
      if (errorName === 'NoSuchBucket' || errorName === 'AccessDenied') {
        this.logger.warn('S3 bucket not accessible - returning empty results', { 
          bucket: this.bucketName,
          error: (error as Error).message 
        });
        return [];
      }
      
      this.logger.error('Failed to load all questions from S3', error as Error);
      throw new Error('Failed to load question data');
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
        
        // Handle different question file formats
        if (Array.isArray(questionData)) {
          return questionData as Question[];
        } else if (questionData.questions && Array.isArray(questionData.questions)) {
          return questionData.questions as Question[];
        } else {
          this.logger.warn('Invalid question file format', { key });
          return [];
        }
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
   * Get data from cache if it exists and is not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry) {
      const now = Date.now();
      if (now - entry.timestamp < entry.ttl) {
        return entry.data;
      } else {
        // Cache expired, remove it
        this.cache.delete(key);
      }
    }
    return null;
  }

  /**
   * Store data in cache with TTL
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }
}