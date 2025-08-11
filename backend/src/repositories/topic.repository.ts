// Topic repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Topic } from '../shared/types/topic.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface ITopicRepository {
  findAll(): Promise<Topic[]>;
  findById(topicId: string): Promise<Topic | null>;
  findByExam(examId: string): Promise<Topic[]>;
  findByProvider(providerId: string): Promise<Topic[]>;
  clearCache(): void;
}

export class TopicRepository implements ITopicRepository {
  private s3Client: S3Client;
  private bucketName: string;
  private logger = createLogger({ component: 'TopicRepository' });
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly PROVIDERS_PREFIX = 'providers/';

  constructor(s3Client: S3Client, config: ServiceConfig) {
    this.s3Client = s3Client;
    this.bucketName = config.s3.bucketName;
  }

  /**
   * Get all topics from S3
   */
  async findAll(): Promise<Topic[]> {
    const cacheKey = 'all-topics';
    
    // Check cache first
    const cached = this.getFromCache<Topic[]>(cacheKey);
    if (cached) {
      this.logger.debug('Topics retrieved from cache');
      return cached;
    }

    try {
      this.logger.info('Loading all topics from S3', { bucket: this.bucketName });

      // List all provider directories to find topic files
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.PROVIDERS_PREFIX,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const allTopics: Topic[] = [];

      if (listResult.Contents) {
        // Find all topics.json files
        const topicFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          obj.Key.includes('/topics.json')
        );

        this.logger.info('Found topic files', { count: topicFiles.length });

        // Load each topic file
        for (const file of topicFiles) {
          if (file.Key) {
            try {
              const topics = await this.loadTopicFile(file.Key);
              allTopics.push(...topics);
            } catch (error) {
              this.logger.warn('Failed to load topic file', { 
                file: file.Key,
                error: (error as Error).message
              });
            }
          }
        }
      }

      // Cache the results
      this.setCache(cacheKey, allTopics);
      
      this.logger.info('Topics loaded successfully', { 
        totalTopics: allTopics.length
      });

      return allTopics;
    } catch (error) {
      this.logger.error('Failed to load topics from S3', error as Error);
      throw new Error('Failed to load topic data');
    }
  }

  /**
   * Find a specific topic by ID
   */
  async findById(topicId: string): Promise<Topic | null> {
    const cacheKey = `topic-${topicId}`;
    
    // Check cache first
    const cached = this.getFromCache<Topic>(cacheKey);
    if (cached) {
      this.logger.debug('Topic retrieved from cache', { topicId });
      return cached;
    }

    try {
      // Load all topics and find the specific one
      const allTopics = await this.findAll();
      const topic = allTopics.find(t => t.id === topicId);

      if (topic) {
        // Cache the result
        this.setCache(cacheKey, topic);
        this.logger.debug('Topic found', { topicId });
        return topic;
      } else {
        this.logger.warn('Topic not found', { topicId });
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to find topic by ID', error as Error, { topicId });
      return null;
    }
  }

  /**
   * Find topics by exam
   */
  async findByExam(examId: string): Promise<Topic[]> {
    const cacheKey = `topics-exam-${examId}`;
    
    // Check cache first
    const cached = this.getFromCache<Topic[]>(cacheKey);
    if (cached) {
      this.logger.debug('Topics retrieved from cache', { examId });
      return cached;
    }

    try {
      const allTopics = await this.findAll();
      const examTopics = allTopics.filter(topic => topic.examId === examId);

      // Cache the results
      this.setCache(cacheKey, examTopics);
      
      this.logger.info('Topics by exam loaded successfully', { 
        examId,
        totalTopics: examTopics.length
      });

      return examTopics;
    } catch (error) {
      this.logger.error('Failed to load topics by exam', error as Error, { examId });
      return [];
    }
  }

  /**
   * Find topics by provider
   */
  async findByProvider(providerId: string): Promise<Topic[]> {
    const cacheKey = `topics-provider-${providerId}`;
    
    // Check cache first
    const cached = this.getFromCache<Topic[]>(cacheKey);
    if (cached) {
      this.logger.debug('Topics retrieved from cache', { providerId });
      return cached;
    }

    try {
      this.logger.info('Loading topics by provider from S3', { providerId, bucket: this.bucketName });

      const topicKey = `${this.PROVIDERS_PREFIX}${providerId}/topics.json`;
      const topics = await this.loadTopicFile(topicKey);

      // Cache the results
      this.setCache(cacheKey, topics);
      
      this.logger.info('Topics loaded successfully', { 
        providerId,
        totalTopics: topics.length
      });

      return topics;
    } catch (error) {
      this.logger.error('Failed to load topics by provider from S3', error as Error, { providerId });
      return [];
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Topic cache cleared');
  }

  /**
   * Load a single topic file from S3
   */
  private async loadTopicFile(key: string): Promise<Topic[]> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const result = await this.s3Client.send(getCommand);
      
      if (result.Body) {
        const content = await result.Body.transformToString();
        const topicData = JSON.parse(content);
        
        // Handle different topic file formats
        if (Array.isArray(topicData)) {
          return topicData as Topic[];
        } else if (topicData.topics && Array.isArray(topicData.topics)) {
          return topicData.topics as Topic[];
        } else if (this.isValidTopic(topicData)) {
          return [topicData as Topic];
        } else {
          this.logger.warn('Invalid topic file format', { key });
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
   * Validate topic data structure
   */
  private isValidTopic(data: any): boolean {
    return data && 
           typeof data.id === 'string' &&
           typeof data.name === 'string' &&
           typeof data.examId === 'string';
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