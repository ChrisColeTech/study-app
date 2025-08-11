// Exam repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Exam } from '../shared/types/exam.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface IExamRepository {
  findAll(): Promise<Exam[]>;
  findById(examId: string): Promise<Exam | null>;
  findByProvider(provider: string): Promise<Exam[]>;
  findByCategory(category: string): Promise<Exam[]>;
  findByLevel(level: string): Promise<Exam[]>;
  clearCache(): void;
}

export class ExamRepository implements IExamRepository {
  private s3Client: S3Client;
  private bucketName: string;
  private logger = createLogger({ component: 'ExamRepository' });
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly PROVIDERS_PREFIX = 'providers/';

  constructor(s3Client: S3Client, config: ServiceConfig) {
    this.s3Client = s3Client;
    this.bucketName = config.s3.bucketName;
  }

  /**
   * Get all exams from S3
   */
  async findAll(): Promise<Exam[]> {
    const cacheKey = 'all-exams';
    
    // Check cache first
    const cached = this.getFromCache<Exam[]>(cacheKey);
    if (cached) {
      this.logger.debug('Exams retrieved from cache');
      return cached;
    }

    try {
      this.logger.info('Loading all exams from S3', { bucket: this.bucketName });

      // List all provider directories to find exam files
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.PROVIDERS_PREFIX,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allExams: Exam[] = [];

      if (listResult.Contents) {
        // Find all exam.json files
        const examFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.includes('/exams.json')
        );

        this.logger.info('Found exam files', { count: examFiles.length });

        // Load each exam file
        for (const file of examFiles) {
          if (file.Key) {
            try {
              const exams = await this.loadExamFile(file.Key);
              allExams.push(...exams);
            } catch (error) {
              this.logger.warn('Failed to load exam file', { 
                file: file.Key,
                error: (error as Error).message
              });
            }
          }
        }
      }

      // Cache the results
      this.setCache(cacheKey, allExams);
      
      this.logger.info('Exams loaded successfully', { 
        totalExams: allExams.length,
        activeExams: allExams.filter(e => e.isActive).length
      });

      return allExams;
    } catch (error) {
      this.logger.error('Failed to load exams from S3', error as Error);
      throw new Error('Failed to load exam data');
    }
  }

  /**
   * Find a specific exam by ID
   */
  async findById(examId: string): Promise<Exam | null> {
    const cacheKey = `exam-${examId}`;
    
    // Check cache first
    const cached = this.getFromCache<Exam>(cacheKey);
    if (cached) {
      this.logger.debug('Exam retrieved from cache', { examId });
      return cached;
    }

    try {
      // Load all exams and find the specific one
      const allExams = await this.findAll();
      const exam = allExams.find(e => e.examId === examId);

      if (exam) {
        // Cache the result
        this.setCache(cacheKey, exam);
        this.logger.debug('Exam found', { examId });
        return exam;
      } else {
        this.logger.warn('Exam not found', { examId });
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to find exam by ID', error as Error, { examId });
      return null;
    }
  }

  /**
   * Find exams by provider
   */
  async findByProvider(provider: string): Promise<Exam[]> {
    const cacheKey = `exams-provider-${provider}`;
    
    // Check cache first
    const cached = this.getFromCache<Exam[]>(cacheKey);
    if (cached) {
      this.logger.debug('Exams retrieved from cache', { provider });
      return cached;
    }

    try {
      this.logger.info('Loading exams by provider from S3', { provider, bucket: this.bucketName });

      const examKey = `${this.PROVIDERS_PREFIX}${provider}/exams.json`;
      const exams = await this.loadExamFile(examKey);

      // Cache the results
      this.setCache(cacheKey, exams);
      
      this.logger.info('Exams loaded successfully', { 
        provider,
        totalExams: exams.length
      });

      return exams;
    } catch (error) {
      this.logger.error('Failed to load exams by provider from S3', error as Error, { provider });
      return [];
    }
  }

  /**
   * Find exams by category
   */
  async findByCategory(category: string): Promise<Exam[]> {
    const allExams = await this.findAll();
    return allExams.filter(exam => 
      exam.category?.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Find exams by level
   */
  async findByLevel(level: string): Promise<Exam[]> {
    const allExams = await this.findAll();
    return allExams.filter(exam => 
      exam.level?.toLowerCase() === level.toLowerCase()
    );
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Exam cache cleared');
  }

  /**
   * Load a single exam file from S3
   */
  private async loadExamFile(key: string): Promise<Exam[]> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const result = await this.s3Client.send(getCommand);
      
      if (result.Body) {
        const content = await result.Body.transformToString();
        const examData = JSON.parse(content);
        
        // Handle different exam file formats
        if (Array.isArray(examData)) {
          return examData as Exam[];
        } else if (examData.exams && Array.isArray(examData.exams)) {
          return examData.exams as Exam[];
        } else if (this.isValidExam(examData)) {
          return [examData as Exam];
        } else {
          this.logger.warn('Invalid exam file format', { key });
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
   * Validate exam data structure
   */
  private isValidExam(data: any): boolean {
    return data && 
           typeof data.examId === 'string' &&
           typeof data.name === 'string' &&
           typeof data.providerId === 'string' &&
           typeof data.isActive === 'boolean';
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