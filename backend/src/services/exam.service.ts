// Exam service for Study App V3 Backend
// Phase 8: Exam Listing Feature

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { 
  Exam, 
  GetExamsRequest, 
  GetExamsResponse, 
  IExamService
} from '../shared/types/exam.types';
import { Provider } from '../shared/types/provider.types';
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class ExamService implements IExamService {
  private logger = createLogger({ component: 'ExamService' });
  private s3Client: S3Client;
  private bucketName: string;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly PROVIDERS_PREFIX = 'providers/';

  constructor(s3Client: S3Client, bucketName: string) {
    this.s3Client = s3Client;
    this.bucketName = bucketName;
  }

  /**
   * Get all exams with optional filtering
   */
  async getExams(request: GetExamsRequest): Promise<GetExamsResponse> {
    this.logger.info('Getting exams', { 
      provider: request.provider,
      category: request.category,
      level: request.level,
      search: request.search,
      includeInactive: request.includeInactive 
    });

    try {
      // Get all exams from cache or S3
      const allExams = await this.getAllExams();

      // Apply filters
      let filteredExams = allExams;

      // Filter by provider
      if (request.provider) {
        filteredExams = filteredExams.filter(e => 
          e.providerId.toLowerCase() === request.provider!.toLowerCase()
        );
      }

      // Filter by level
      if (request.level) {
        filteredExams = filteredExams.filter(e => 
          e.level.toLowerCase() === request.level!.toLowerCase()
        );
      }

      // Filter out inactive exams unless explicitly requested
      if (!request.includeInactive) {
        filteredExams = filteredExams.filter(e => e.isActive);
      }

      // Apply search filter
      if (request.search) {
        const searchLower = request.search.toLowerCase();
        filteredExams = filteredExams.filter(e => 
          e.examName.toLowerCase().includes(searchLower) ||
          e.examCode.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower) ||
          e.providerName.toLowerCase().includes(searchLower) ||
          e.topics.some(topic => topic.toLowerCase().includes(searchLower))
        );
      }

      // Sort by provider name, then by level, then by exam name
      filteredExams.sort((a, b) => {
        const providerCompare = a.providerName.localeCompare(b.providerName);
        if (providerCompare !== 0) return providerCompare;
        
        const levelOrder = ['foundational', 'associate', 'professional', 'specialty', 'expert'];
        const levelCompare = levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level);
        if (levelCompare !== 0) return levelCompare;
        
        return a.examName.localeCompare(b.examName);
      });

      // Apply pagination
      const limit = Math.min(request.limit || 50, 100); // Max 100 results
      const offset = request.offset || 0;
      const paginatedExams = filteredExams.slice(offset, offset + limit);
      const hasMore = offset + limit < filteredExams.length;

      // Get available filter options from all exams
      const availableProviders = [...new Set(allExams.map(e => e.providerId))];
      const availableCategories = [...new Set(allExams.map(e => this.getCategoryFromProvider(e.providerId)))].filter(Boolean);
      const availableLevels = [...new Set(allExams.map(e => e.level))];

      const response: GetExamsResponse = {
        exams: paginatedExams,
        total: filteredExams.length,
        filters: {
          providers: availableProviders.sort(),
          categories: availableCategories.sort(),
          levels: availableLevels.sort()
        },
        pagination: {
          limit,
          offset,
          hasMore
        }
      };

      this.logger.info('Exams retrieved successfully', { 
        total: response.total,
        returned: paginatedExams.length,
        hasMore
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get exams', error as Error);
      throw new Error('Failed to retrieve exams');
    }
  }

  /**
   * Get all exams from cache or S3
   */
  private async getAllExams(): Promise<Exam[]> {
    const cacheKey = 'exams:all';

    // Check cache first
    const cached = this.getFromCache<Exam[]>(cacheKey);
    if (cached) {
      this.logger.debug('All exams retrieved from cache');
      return cached;
    }

    // Load all exams from S3 providers
    const exams = await this.loadAllExamsFromS3();

    // Cache the results
    this.setCache(cacheKey, exams);

    this.logger.info('All exams loaded from S3', { count: exams.length });

    return exams;
  }

  /**
   * Load all exams from S3 provider files
   */
  private async loadAllExamsFromS3(): Promise<Exam[]> {
    this.logger.debug('Loading all exams from S3 providers');

    try {
      // List all provider files in S3
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.PROVIDERS_PREFIX,
        MaxKeys: 100 // Should be enough for providers
      });

      const listResponse = await this.s3Client.send(listCommand);
      
      if (!listResponse.Contents || listResponse.Contents.length === 0) {
        this.logger.warn('No provider files found in S3');
        return [];
      }

      // Load exams from each provider file
      const allExams: Exam[] = [];
      
      for (const item of listResponse.Contents) {
        if (!item.Key || !item.Key.endsWith('.json')) continue;

        try {
          const providerId = item.Key.replace(this.PROVIDERS_PREFIX, '').replace('.json', '');
          const providerExams = await this.loadExamsFromProvider(providerId);
          allExams.push(...providerExams);
        } catch (error) {
          this.logger.warn('Failed to load provider exams', { key: item.Key, error: (error as Error).message });
          // Continue loading other providers
        }
      }

      return allExams;

    } catch (error) {
      this.logger.error('Failed to load exams from S3', error as Error);
      throw new Error('Failed to load exams from storage');
    }
  }

  /**
   * Load exams from a specific provider
   */
  private async loadExamsFromProvider(providerId: string): Promise<Exam[]> {
    this.logger.debug('Loading exams from provider', { id: providerId });

    try {
      const key = `${this.PROVIDERS_PREFIX}${providerId}.json`;
      
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error(`Provider file ${key} has no content`);
      }

      const content = await response.Body.transformToString();
      const provider: Provider = JSON.parse(content);

      // Validate that the provider has required fields
      if (!provider.id || !provider.name || !provider.certifications) {
        throw new Error(`Invalid provider data in ${key}: missing required fields`);
      }

      // Convert certifications to exams
      const exams: Exam[] = provider.certifications.map(cert => ({
        examId: cert.id,
        examName: cert.name,
        examCode: cert.code || cert.examCode || cert.id,
        providerId: provider.id,
        providerName: provider.name,
        description: cert.description || '',
        level: cert.level as 'foundational' | 'associate' | 'professional' | 'specialty' | 'expert',
        duration: cert.duration,
        questionCount: cert.questionCount || 0,
        passingScore: cert.passingScore,
        topics: cert.topics || [],
        isActive: cert.status === 'active',
        metadata: {
          lastUpdated: new Date().toISOString(),
          examUrl: provider.website,
          cost: cert.cost ? `$${cert.cost}` : undefined,
          validityPeriod: cert.validityPeriod,
          retakePolicy: cert.retakePolicy,
          languages: cert.languages
        }
      }));

      this.logger.debug('Exams loaded successfully from provider', { 
        id: providerId,
        name: provider.name,
        examCount: exams.length
      });

      return exams;

    } catch (error) {
      this.logger.error('Failed to load exams from provider', error as Error, { id: providerId });
      throw error;
    }
  }

  /**
   * Get category from provider ID (helper method)
   */
  private getCategoryFromProvider(providerId: string): string {
    // Map common provider IDs to categories
    const categoryMap: Record<string, string> = {
      'aws': 'cloud',
      'azure': 'cloud',
      'gcp': 'cloud',
      'cisco': 'networking',
      'comptia': 'general'
    };
    
    return categoryMap[providerId.toLowerCase()] || 'other';
  }

  /**
   * Get data from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    this.cache.set(key, entry);
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  public getCacheStats(): {
    size: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Re-export the interface for ServiceFactory
export type { IExamService };