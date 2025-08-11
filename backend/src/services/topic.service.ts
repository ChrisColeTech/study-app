// Topic service for Study App V3 Backend

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { 
  Topic, 
  GetTopicsRequest, 
  GetTopicsResponse, 
  ITopicService,
  TopicMetadata
} from '../shared/types/topic.types';
import { Provider } from '../shared/types/provider.types';

// Re-export the interface for ServiceFactory
export type { ITopicService };
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class TopicService implements ITopicService {
  private logger = createLogger({ component: 'TopicService' });
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
   * Get all topics with optional filtering
   */
  async getTopics(request: GetTopicsRequest): Promise<GetTopicsResponse> {
    this.logger.info('Getting topics', { 
      provider: request.provider, 
      exam: request.exam,
      category: request.category,
      search: request.search,
      level: request.level
    });

    try {
      // Get all topics from cache or S3
      const allTopics = await this.getAllTopics();

      // Apply filters
      let filteredTopics = allTopics;

      // Filter by provider
      if (request.provider) {
        filteredTopics = filteredTopics.filter(t => 
          t.providerId.toLowerCase() === request.provider!.toLowerCase() ||
          t.providerName.toLowerCase().includes(request.provider!.toLowerCase())
        );
      }

      // Filter by exam
      if (request.exam) {
        const searchLower = request.exam.toLowerCase();
        filteredTopics = filteredTopics.filter(t => 
          t.examId.toLowerCase() === searchLower ||
          t.examName.toLowerCase().includes(searchLower) ||
          t.examCode.toLowerCase().includes(searchLower)
        );
      }

      // Filter by category
      if (request.category) {
        filteredTopics = filteredTopics.filter(t => 
          t.category?.toLowerCase().includes(request.category!.toLowerCase())
        );
      }

      // Filter by level
      if (request.level) {
        filteredTopics = filteredTopics.filter(t => 
          t.level.toLowerCase() === request.level!.toLowerCase()
        );
      }

      // Apply search filter
      if (request.search) {
        const searchLower = request.search.toLowerCase();
        filteredTopics = filteredTopics.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          (t.description && t.description.toLowerCase().includes(searchLower)) ||
          t.providerName.toLowerCase().includes(searchLower) ||
          t.examName.toLowerCase().includes(searchLower) ||
          t.skillsValidated.some(skill => skill.toLowerCase().includes(searchLower))
        );
      }

      // Sort by provider, then exam, then topic name for consistent ordering
      filteredTopics.sort((a, b) => {
        if (a.providerName !== b.providerName) {
          return a.providerName.localeCompare(b.providerName);
        }
        if (a.examName !== b.examName) {
          return a.examName.localeCompare(b.examName);
        }
        return a.name.localeCompare(b.name);
      });

      // Get available filter options from all topics
      const availableProviders = [...new Set(allTopics.map(t => t.providerId))].sort();
      const availableExams = [...new Set(allTopics.map(t => t.examId))].sort();
      const availableCategories = [...new Set(allTopics.map(t => t.category).filter(Boolean))].sort();
      const availableLevels = [...new Set(allTopics.map(t => t.level))].sort();

      const response: GetTopicsResponse = {
        topics: filteredTopics,
        total: filteredTopics.length,
        filters: {
          providers: availableProviders,
          exams: availableExams,
          categories: availableCategories,
          levels: availableLevels
        }
      };

      this.logger.info('Topics retrieved successfully', { 
        total: response.total,
        filtered: filteredTopics.length 
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get topics', error as Error);
      throw new Error('Failed to retrieve topics');
    }
  }

  /**
   * Get all topics from cache or S3
   */
  private async getAllTopics(): Promise<Topic[]> {
    const cacheKey = 'topics:all';

    // Check cache first
    const cached = this.getFromCache<Topic[]>(cacheKey);
    if (cached) {
      this.logger.debug('All topics retrieved from cache');
      return cached;
    }

    // Load all topics from S3
    const topics = await this.loadAllTopicsFromS3();

    // Cache the results
    this.setCache(cacheKey, topics);

    this.logger.info('All topics loaded from S3', { count: topics.length });

    return topics;
  }

  /**
   * Load all topics from S3 by extracting from provider certification data
   */
  private async loadAllTopicsFromS3(): Promise<Topic[]> {
    this.logger.debug('Loading all topics from S3 provider data');

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

      // Load each provider file and extract topics
      const allTopics: Topic[] = [];
      
      for (const item of listResponse.Contents) {
        if (!item.Key || !item.Key.endsWith('.json')) continue;

        try {
          const providerId = item.Key.replace(this.PROVIDERS_PREFIX, '').replace('.json', '');
          const provider = await this.loadProviderFromS3(providerId);
          const providerTopics = this.extractTopicsFromProvider(provider);
          allTopics.push(...providerTopics);
        } catch (error) {
          this.logger.warn('Failed to load topics from provider file', { key: item.Key, error: (error as Error).message });
          // Continue loading other providers
        }
      }

      // Remove duplicates based on topic name and provider/exam combination
      const uniqueTopics = this.deduplicateTopics(allTopics);

      return uniqueTopics;

    } catch (error) {
      this.logger.error('Failed to load topics from S3', error as Error);
      throw new Error('Failed to load topics from storage');
    }
  }

  /**
   * Load a specific provider from S3
   */
  private async loadProviderFromS3(providerId: string): Promise<Provider> {
    this.logger.debug('Loading provider from S3 for topic extraction', { id: providerId });

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
      if (!provider.id || !provider.name || !provider.status) {
        throw new Error(`Invalid provider data in ${key}: missing required fields`);
      }

      return provider;

    } catch (error) {
      this.logger.error('Failed to load provider from S3 for topics', error as Error, { id: providerId });
      throw error;
    }
  }

  /**
   * Extract topics from a provider's certification data
   */
  private extractTopicsFromProvider(provider: Provider): Topic[] {
    const topics: Topic[] = [];
    const now = new Date().toISOString();

    if (!provider.certifications || provider.certifications.length === 0) {
      return topics;
    }

    for (const certification of provider.certifications) {
      if (!certification.topics || certification.topics.length === 0) {
        continue;
      }

      for (const topicName of certification.topics) {
        const topicId = this.generateTopicId(provider.id, certification.id, topicName);
        
        const metadata: TopicMetadata = {
          difficultyLevel: certification.metadata?.difficultyLevel,
          popularityRank: certification.metadata?.popularityRank,
          marketDemand: certification.metadata?.marketDemand,
          jobRoles: certification.metadata?.jobRoles,
          industries: certification.metadata?.industries,
          studyTimeRecommended: certification.metadata?.studyTimeRecommended
        };

        const topic: Topic = {
          id: topicId,
          name: topicName,
          category: provider.category,
          providerId: provider.id,
          providerName: provider.name,
          examId: certification.id,
          examName: certification.name,
          examCode: certification.code,
          level: certification.level,
          description: `${topicName} - covered in ${certification.fullName}`,
          skillsValidated: certification.skillsValidated || [],
          metadata,
          createdAt: now,
          updatedAt: now
        };

        topics.push(topic);
      }
    }

    return topics;
  }

  /**
   * Generate a consistent topic ID
   */
  private generateTopicId(providerId: string, certificationId: string, topicName: string): string {
    const normalizedTopic = topicName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return `${providerId}-${certificationId}-${normalizedTopic}`;
  }

  /**
   * Remove duplicate topics based on name and provider/exam combination
   */
  private deduplicateTopics(topics: Topic[]): Topic[] {
    const seen = new Set<string>();
    const uniqueTopics: Topic[] = [];

    for (const topic of topics) {
      const key = `${topic.providerId}-${topic.examId}-${topic.name.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTopics.push(topic);
      }
    }

    return uniqueTopics;
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