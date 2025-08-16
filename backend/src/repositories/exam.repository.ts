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
    try {
      this.logger.info('Loading exams from S3', { 
        bucket: this.bucketName, 
        prefix: 'questions/' 
      });

      // First, try to load from an exams metadata file
      try {
        const getCommand = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: 'exams/metadata.json',
        });

        const result = await this.s3Client.send(getCommand);
        if (result.Body) {
          const content = await result.Body.transformToString();
          const examsData = JSON.parse(content);
          
          if (examsData.exams && Array.isArray(examsData.exams)) {
            this.logger.info('Exams loaded from metadata.json', { 
              count: examsData.exams.length 
            });
            return examsData.exams;
          }
        }
      } catch (error: any) {
        this.logger.debug('No exams/metadata.json file found, attempting to discover from structure', {
          error: error.message,
          code: error.Code
        });
      }

      // If no metadata file, discover exams from S3 structure
      this.logger.info('Attempting to discover exams from S3 structure', {
        bucket: this.bucketName,
        prefix: 'questions/'
      });

      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: 'questions/',
        Delimiter: '/',
      });

      const result = await this.s3Client.send(listCommand);
      const exams: Exam[] = [];

      this.logger.info('S3 list result for exams', {
        keyCount: result.KeyCount,
        isTruncated: result.IsTruncated,
        commonPrefixesCount: result.CommonPrefixes?.length || 0,
        contentsCount: result.Contents?.length || 0
      });

      if (result.CommonPrefixes) {
        this.logger.info('Discovering exams from S3 structure', { 
          prefixes: result.CommonPrefixes.length 
        });

        // Process each provider (aws/, azure/, etc.)
        for (const providerPrefix of result.CommonPrefixes) {
          if (providerPrefix.Prefix) {
            const providerMatch = providerPrefix.Prefix.match(/questions\/([^\/]+)\//);
            if (providerMatch) {
              const providerId = providerMatch[1];
              
              // List exams for this provider
              const examListCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: providerPrefix.Prefix,
                Delimiter: '/',
              });

              const examResult = await this.s3Client.send(examListCommand);
              
              if (examResult.CommonPrefixes) {
                // Extract exam IDs from the S3 structure (questions/aws/clf-c02/, questions/aws/saa-c03/, etc.)
                for (const examPrefix of examResult.CommonPrefixes) {
                  if (examPrefix.Prefix) {
                    const examMatch = examPrefix.Prefix.match(/questions\/[^\/]+\/([^\/]+)\//);
                    if (examMatch) {
                      const examId = examMatch[1];
                      
                      this.logger.debug('Matched exam from S3 prefix', { 
                        prefix: examPrefix.Prefix, 
                        providerId,
                        examId 
                      });
                      
                      // Create exam from discovered structure
                      const exam: Exam = {
                        examId: examId,
                        providerId: providerId,
                        name: this.getExamDisplayName(examId, providerId),
                        description: `${this.getExamDisplayName(examId, providerId)} certification exam`,
                        category: this.getExamCategory(providerId),
                        level: this.getExamLevel(examId),
                        duration: this.getExamDuration(examId),
                        questionCount: 0, // Will be determined when questions are loaded
                        passingScore: this.getExamPassingScore(examId),
                        status: StatusType.ACTIVE,
                        isActive: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      };

                      exams.push(exam);
                      this.logger.debug('Created exam from S3 structure', { examId, providerId });
                    } else {
                      this.logger.debug('S3 exam prefix did not match pattern', { 
                        prefix: examPrefix.Prefix 
                      });
                    }
                  }
                }
              }
            } else {
              this.logger.debug('S3 provider prefix did not match pattern', { 
                prefix: providerPrefix.Prefix 
              });
            }
          }
        }
      } else {
        this.logger.warn('No CommonPrefixes found in S3 list result', {
          bucket: this.bucketName,
          prefix: 'questions/'
        });
      }

      if (exams.length === 0) {
        this.logger.warn('No exams discovered from S3 structure, returning fallback exams');
        return this.getFallbackExams();
      }

      this.logger.info('Exams discovered from S3 structure', { count: exams.length });
      return exams;

    } catch (error) {
      this.logger.error('Failed to load exams from S3', error as Error, {
        bucket: this.bucketName,
        prefix: 'questions/',
      });
      
      // Return fallback hardcoded exams if S3 fails
      this.logger.info('Returning fallback exams due to S3 error');
      return this.getFallbackExams();
    }
  }

  private getExamDisplayName(examId: string, providerId: string): string {
    const names: Record<string, string> = {
      'clf-c02': 'AWS Certified Cloud Practitioner',
      'saa-c03': 'AWS Certified Solutions Architect - Associate',
      'sap-c02': 'AWS Certified Solutions Architect - Professional',
      'aif-c01': 'AWS Certified AI Practitioner',
      'az-900': 'Microsoft Azure Fundamentals',
      'az-104': 'Microsoft Azure Administrator Associate',
      'az-204': 'Microsoft Azure Developer Associate',
      'gcp-ace': 'Google Cloud Associate Cloud Engineer',
      'gcp-pca': 'Google Cloud Professional Cloud Architect',
      'ccna': 'Cisco Certified Network Associate',
      'ccnp': 'Cisco Certified Network Professional',
      'security-plus': 'CompTIA Security+',
      'network-plus': 'CompTIA Network+',
    };
    return names[examId] || `${providerId.toUpperCase()} ${examId.toUpperCase()}`;
  }

  private getExamCategory(providerId: string): string {
    const categories: Record<string, string> = {
      aws: 'cloud',
      azure: 'cloud',
      gcp: 'cloud',
      cisco: 'networking',
      comptia: 'general',
    };
    return categories[providerId] || 'technology';
  }

  private getExamLevel(examId: string): string {
    if (examId.includes('fundamentals') || examId.includes('practitioner') || examId.includes('c02') || examId.includes('900')) {
      return 'beginner';
    }
    if (examId.includes('associate') || examId.includes('c03') || examId.includes('104') || examId.includes('204') || examId.includes('ace')) {
      return 'intermediate';
    }
    if (examId.includes('professional') || examId.includes('expert') || examId.includes('pca') || examId.includes('ccnp')) {
      return 'advanced';
    }
    return 'intermediate';
  }

  private getExamDuration(examId: string): number {
    const durations: Record<string, number> = {
      'clf-c02': 90,
      'saa-c03': 130,
      'sap-c02': 180,
      'aif-c01': 85,
      'az-900': 60,
      'az-104': 120,
      'az-204': 120,
      'gcp-ace': 120,
      'gcp-pca': 120,
      'ccna': 120,
      'ccnp': 120,
      'security-plus': 90,
      'network-plus': 90,
    };
    return durations[examId] || 120;
  }

  private getExamPassingScore(examId: string): number {
    const passingScores: Record<string, number> = {
      'clf-c02': 700,
      'saa-c03': 720,
      'sap-c02': 750,
      'aif-c01': 700,
      'az-900': 700,
      'az-104': 700,
      'az-204': 700,
      'gcp-ace': 70,
      'gcp-pca': 70,
      'ccna': 825,
      'ccnp': 800,
      'security-plus': 750,
      'network-plus': 720,
    };
    return passingScores[examId] || 700;
  }

  private getFallbackExams(): Exam[] {
    const fallbackExams: Exam[] = [
      {
        examId: 'clf-c02',
        providerId: 'aws',
        name: 'AWS Certified Cloud Practitioner',
        description: 'AWS Certified Cloud Practitioner certification exam',
        category: 'cloud',
        level: 'beginner',
        duration: 90,
        questionCount: 65,
        passingScore: 700,
        status: StatusType.ACTIVE,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        examId: 'saa-c03',
        providerId: 'aws',
        name: 'AWS Certified Solutions Architect - Associate',
        description: 'AWS Certified Solutions Architect - Associate certification exam',
        category: 'cloud',
        level: 'intermediate',
        duration: 130,
        questionCount: 65,
        passingScore: 720,
        status: StatusType.ACTIVE,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        examId: 'sap-c02',
        providerId: 'aws',
        name: 'AWS Certified Solutions Architect - Professional',
        description: 'AWS Certified Solutions Architect - Professional certification exam',
        category: 'cloud',
        level: 'advanced',
        duration: 180,
        questionCount: 75,
        passingScore: 750,
        status: StatusType.ACTIVE,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        examId: 'aif-c01',
        providerId: 'aws',
        name: 'AWS Certified AI Practitioner',
        description: 'AWS Certified AI Practitioner certification exam',
        category: 'cloud',
        level: 'beginner',
        duration: 85,
        questionCount: 65,
        passingScore: 700,
        status: StatusType.ACTIVE,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    this.logger.info('Using fallback exams', { count: fallbackExams.length });
    return fallbackExams;
  }
}
