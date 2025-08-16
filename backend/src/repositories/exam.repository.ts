// Exam repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Exam } from '../shared/types/exam.types';
import { StatusType } from '../shared/types/domain.types';
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
    try {
      this.logger.info('Loading exams from S3', { 
        bucket: this.bucketName, 
        key: 'providers/metadata.json'
      });

      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: 'providers/metadata.json',
      });

      const result = await this.s3Client.send(getCommand);
      if (!result.Body) {
        throw new Error('No data returned from S3');
      }

      const content = await result.Body.transformToString();
      const providersData = JSON.parse(content);
      
      if (!providersData.providers || !Array.isArray(providersData.providers)) {
        throw new Error('Invalid providers data structure');
      }

      // Extract exams from all providers
      const exams: Exam[] = [];
      for (const provider of providersData.providers) {
        if (provider.exams && Array.isArray(provider.exams)) {
          for (const examData of provider.exams) {
            const exam: Exam = {
              examId: examData.code,
              examName: examData.name,
              examCode: examData.code,
              providerId: provider.id,
              providerName: provider.name,
              description: examData.description,
              level: this.mapExamLevel(examData.difficulty),
              category: this.mapExamCategory(examData.categories),
              duration: examData.duration,
              questionCount: examData.questionCount,
              passingScore: this.getPassingScore(examData.code),
              topics: [],
              isActive: true,
              metadata: {
                lastUpdated: provider.lastUpdated || new Date().toISOString(),
                examUrl: undefined,
                cost: undefined,
                validityPeriod: undefined,
                retakePolicy: undefined,
                languages: undefined,
              },
            };
            exams.push(exam);
          }
        }
      }

      this.logger.info('Exams loaded from S3 metadata', { 
        count: exams.length 
      });
      
      return exams;

    } catch (error) {
      this.logger.error('Failed to load exams from S3', error as Error, {
        bucket: this.bucketName,
        key: 'providers/metadata.json'
      });
      throw error;
    }
  }

  private mapExamCategory(categories: string[]): string {
    if (!categories || !Array.isArray(categories)) return 'general';
    if (categories.some(cat => cat.toLowerCase().includes('cloud'))) return 'cloud';
    if (categories.some(cat => cat.toLowerCase().includes('ai') || cat.toLowerCase().includes('ml'))) return 'ai';
    if (categories.some(cat => cat.toLowerCase().includes('architect'))) return 'architecture';
    return 'general';
  }

  private mapExamLevel(difficulty: string): 'foundational' | 'associate' | 'professional' | 'specialty' | 'expert' {
    if (!difficulty) return 'associate';
    const diff = difficulty.toLowerCase();
    if (diff.includes('foundational') || diff.includes('practitioner')) return 'foundational';
    if (diff.includes('associate')) return 'associate';
    if (diff.includes('professional')) return 'professional';
    if (diff.includes('expert') || diff.includes('specialty')) return 'expert';
    return 'associate';
  }

  private getPassingScore(examCode: string): number {
    const passingScores: Record<string, number> = {
      'clf-c02': 700,
      'saa-c03': 720,
      'sap-c02': 750,
      'aif-c01': 700,
    };
    return passingScores[examCode] || 700;
  }
}
