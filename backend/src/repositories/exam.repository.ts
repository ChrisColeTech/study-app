// Exam repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Exam } from '../shared/types/exam.types';
import { ServiceConfig } from '../shared/service-factory';
import { S3BaseRepository } from './base.repository';
import { IListRepository, StandardQueryResult } from '../shared/types/repository.types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface IExamRepository extends IListRepository<Exam, any> {
  /**
   * Find exam by ID
   * @param examId - Exam identifier
   * @returns Promise<Exam | null> - Exam if found
   * @throws RepositoryError
   */
  findById(examId: string): Promise<Exam | null>;

  /**
   * Find exams by provider
   * @param provider - Provider identifier
   * @returns Promise<Exam[]> - Exams from provider
   * @throws RepositoryError
   */
  findByProvider(provider: string): Promise<Exam[]>;

  /**
   * Find exams by category
   * @param category - Exam category
   * @returns Promise<Exam[]> - Exams in category
   * @throws RepositoryError
   */
  findByCategory(category: string): Promise<Exam[]>;

  /**
   * Find exams by level
   * @param level - Exam level/difficulty
   * @returns Promise<Exam[]> - Exams at specified level
   * @throws RepositoryError
   */
  findByLevel(level: string): Promise<Exam[]>;

  /**
   * Clear repository cache
   */
  clearCache(): void;
}

export class ExamRepository extends S3BaseRepository implements IExamRepository {
  private s3Client: S3Client;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly EXAMS_PREFIX = 'exams/';

  constructor(s3Client: S3Client, config: ServiceConfig) {
    super('ExamRepository', config, config.s3.bucketName);
    this.s3Client = s3Client;
  }

  /**
   * Perform health check operation for S3 connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.EXAMS_PREFIX,
        MaxKeys: 1,
      })
    );
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
        this.cache.delete(key);
      }
    }
    return null;
  }

  /**
   * Store data in cache with TTL
   */
  private setCache<T>(key: string, data: T, customTtl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl || this.CACHE_TTL,
    });
  }

  async findAll(filters?: any): Promise<StandardQueryResult<Exam>> {
    return this.executeWithErrorHandling('findAll', async () => {
      const cacheKey = 'all-exams';
      const cachedExams = this.getFromCache<Exam[]>(cacheKey);

      let exams: Exam[];
      if (cachedExams) {
        exams = cachedExams;
      } else {
        exams = await this.loadExamsFromS3();
        this.setCache(cacheKey, exams);
      }

      // Return standardized result format
      return {
        items: exams,
        total: exams.length,
        limit: filters?.limit || this.config.query?.defaultLimit || 20,
        offset: filters?.offset || 0,
        hasMore: false, // All exams loaded in one call
        executionTimeMs: 0, // Will be set by executeWithErrorHandling
      };
    });
  }

  async findById(examId: string): Promise<Exam | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        this.validateRequired({ examId }, 'findById');
        const allExamsResult = await this.findAll();
        return allExamsResult.items.find(e => e.examId === examId) || null;
      },
      { examId }
    );
  }

  async findByProvider(provider: string): Promise<Exam[]> {
    return this.executeWithErrorHandling(
      'findByProvider',
      async () => {
        this.validateRequired({ provider }, 'findByProvider');
        const allExamsResult = await this.findAll();
        return allExamsResult.items.filter(e => e.providerId === provider);
      },
      { provider }
    );
  }

  async findByCategory(category: string): Promise<Exam[]> {
    return this.executeWithErrorHandling(
      'findByCategory',
      async () => {
        this.validateRequired({ category }, 'findByCategory');
        const allExamsResult = await this.findAll();
        return allExamsResult.items.filter(e => e.category === category);
      },
      { category }
    );
  }

  async findByLevel(level: string): Promise<Exam[]> {
    return this.executeWithErrorHandling(
      'findByLevel',
      async () => {
        this.validateRequired({ level }, 'findByLevel');
        const allExamsResult = await this.findAll();
        return allExamsResult.items.filter(e => e.level === level);
      },
      { level }
    );
  }

  clearCache(): void {
    this.cache.clear();
    this.logger.info('Exam repository cache cleared');
  }

  async refreshCache(): Promise<void> {
    return this.executeWithErrorHandling('refreshCache', async () => {
      this.clearCache();
    });
  }

  private async loadExamsFromS3(): Promise<Exam[]> {
    // Simple implementation for compilation
    return [];
  }
}
