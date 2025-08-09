import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../shared/logger';

/**
 * Cache Service - DynamoDB-based caching layer
 * Provides persistent caching for study data across Lambda invocations
 */
export class CacheService {
  private client: DynamoDBDocumentClient;
  private logger: Logger;
  private readonly tableName: string;
  private readonly region: string;

  constructor() {
    this.logger = new Logger('CacheService');
    this.tableName = process.env.CACHE_TABLE || 'study-app-cache';
    this.region = process.env.AWS_REGION || 'us-east-1';

    const ddbClient = new DynamoDBClient({ region: this.region });
    this.client = DynamoDBDocumentClient.from(ddbClient);

    this.logger.info('CacheService initialized', {
      tableName: this.tableName,
      region: this.region
    });
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      this.logger.debug('Getting item from cache', { key });

      const command = new GetCommand({
        TableName: this.tableName,
        Key: { cacheKey: key }
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        this.logger.debug('Cache miss', { key });
        return null;
      }

      // Check if item has expired
      const now = Date.now();
      if (response.Item.ttl && response.Item.ttl * 1000 < now) {
        this.logger.debug('Cache item expired', { key, ttl: response.Item.ttl });
        return null;
      }

      this.logger.perf('Cache get', Date.now() - startTime, { 
        key, 
        hit: true,
        sizeBytes: JSON.stringify(response.Item.data).length 
      });

      return response.Item.data as T;

    } catch (error) {
      this.logger.error('Failed to get item from cache', { key, error });
      
      // Return null on cache errors to allow fallback to primary source
      return null;
    }
  }

  /**
   * Put item in cache with TTL
   */
  async put<T>(key: string, data: T, ttlMinutes: number = 60): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = Math.floor(Date.now() / 1000) + (ttlMinutes * 60);
      const item = {
        cacheKey: key,
        data,
        ttl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.logger.debug('Putting item in cache', { 
        key, 
        ttlMinutes,
        sizeBytes: JSON.stringify(data).length 
      });

      const command = new PutCommand({
        TableName: this.tableName,
        Item: item
      });

      await this.client.send(command);

      this.logger.perf('Cache put', Date.now() - startTime, { 
        key, 
        ttlMinutes,
        sizeBytes: JSON.stringify(data).length 
      });

    } catch (error) {
      this.logger.error('Failed to put item in cache', { key, error });
      
      // Don't throw on cache errors - it's not critical
      // The application should continue to work without cache
    }
  }

  /**
   * Generate cache key for providers
   */
  getProvidersCacheKey(): string {
    return 'providers:all';
  }

  /**
   * Generate cache key for specific provider
   */
  getProviderCacheKey(providerId: string): string {
    return `provider:${providerId}`;
  }

  /**
   * Generate cache key for questions
   */
  getQuestionsCacheKey(provider: string, exam: string): string {
    return `questions:${provider}:${exam}`;
  }

  /**
   * Generate cache key for question stats
   */
  getQuestionStatsCacheKey(provider: string, exam: string): string {
    return `stats:questions:${provider}:${exam}`;
  }

  /**
   * Generate cache key for filtered questions
   * Note: This creates a lot of cache entries, use sparingly
   */
  getFilteredQuestionsCacheKey(
    provider: string, 
    exam: string, 
    filter: any,
    pagination: any
  ): string {
    const filterHash = this.hashObject({ filter, pagination });
    return `filtered:${provider}:${exam}:${filterHash}`;
  }

  /**
   * Simple hash function for objects
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear specific cache entries
   */
  async clearCache(pattern: string): Promise<void> {
    // For DynamoDB, we'd need to implement a scan and delete operation
    // This is expensive and not recommended for production
    this.logger.warn('Cache clear not implemented for DynamoDB', { pattern });
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    tableName: string;
    region: string;
    // Additional stats could be added by scanning the table
  }> {
    return {
      tableName: this.tableName,
      region: this.region
    };
  }
}

/**
 * Multi-layer Cache Manager
 * Combines Lambda memory cache with DynamoDB persistent cache
 */
export class MultiLayerCache {
  private memoryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private dynamoCache: CacheService;
  private logger: Logger;
  private readonly memoryTtl = 5 * 60 * 1000; // 5 minutes in memory

  constructor() {
    this.dynamoCache = new CacheService();
    this.logger = new Logger('MultiLayerCache');
  }

  /**
   * Get item from multi-layer cache
   * Checks memory first, then DynamoDB
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryItem = this.memoryCache.get(key);
    if (memoryItem && Date.now() - memoryItem.timestamp < memoryItem.ttl) {
      this.logger.debug('Memory cache hit', { key });
      return memoryItem.data as T;
    }

    // Remove expired memory cache item
    if (memoryItem) {
      this.memoryCache.delete(key);
    }

    // Check DynamoDB cache
    const dynamoItem = await this.dynamoCache.get<T>(key);
    if (dynamoItem) {
      // Store in memory cache for faster future access
      this.memoryCache.set(key, {
        data: dynamoItem,
        timestamp: Date.now(),
        ttl: this.memoryTtl
      });
      
      this.logger.debug('DynamoDB cache hit, stored in memory', { key });
      return dynamoItem;
    }

    this.logger.debug('Cache miss on all layers', { key });
    return null;
  }

  /**
   * Put item in multi-layer cache
   */
  async put<T>(key: string, data: T, dynamoTtlMinutes: number = 60): Promise<void> {
    // Store in memory cache immediately
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.memoryTtl
    });

    // Store in DynamoDB cache asynchronously
    await this.dynamoCache.put(key, data, dynamoTtlMinutes);
    
    this.logger.debug('Stored in multi-layer cache', { 
      key, 
      memoryTtlMinutes: this.memoryTtl / 60000,
      dynamoTtlMinutes 
    });
  }

  /**
   * Clear memory cache (DynamoDB cache remains)
   */
  clearMemoryCache(): void {
    const size = this.memoryCache.size;
    this.memoryCache.clear();
    this.logger.info('Cleared memory cache', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memory: {
      entries: number;
      totalSizeBytes: number;
    };
    dynamo: {
      tableName: string;
      region: string;
    };
  }> {
    let totalSizeBytes = 0;
    for (const [key, value] of this.memoryCache.entries()) {
      totalSizeBytes += JSON.stringify(value).length;
    }

    const dynamoStats = await this.dynamoCache.getCacheStats();

    return {
      memory: {
        entries: this.memoryCache.size,
        totalSizeBytes
      },
      dynamo: dynamoStats
    };
  }

  /**
   * Cleanup expired memory cache entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.memoryCache.entries()) {
      if (now - value.timestamp >= value.ttl) {
        this.memoryCache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug('Cleaned up expired memory cache entries', { removed });
    }
  }
}