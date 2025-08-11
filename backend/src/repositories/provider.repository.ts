// Provider repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Provider } from '../shared/types/provider.types';
import { ServiceConfig } from '../shared/service-factory';
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface IProviderRepository {
  findAll(): Promise<Provider[]>;
  findById(providerId: string): Promise<Provider | null>;
  findByCategory(category: string): Promise<Provider[]>;
  findByStatus(status: string): Promise<Provider[]>;
  clearCache(): void;
}

export class ProviderRepository implements IProviderRepository {
  private s3Client: S3Client;
  private bucketName: string;
  private logger = createLogger({ component: 'ProviderRepository' });
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly PROVIDERS_PREFIX = 'providers/';

  constructor(s3Client: S3Client, config: ServiceConfig) {
    this.s3Client = s3Client;
    this.bucketName = config.s3.bucketName;
  }

  /**
   * Get all providers from S3
   */
  async findAll(): Promise<Provider[]> {
    const cacheKey = 'all-providers';
    
    // Check cache first
    const cached = this.getFromCache<Provider[]>(cacheKey);
    if (cached) {
      this.logger.debug('Providers retrieved from cache');
      return cached;
    }

    try {
      this.logger.info('Loading all providers from S3', { bucket: this.bucketName });

      // List all provider files from S3
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.PROVIDERS_PREFIX,
        MaxKeys: 1000
      });

      const listResult = await this.s3Client.send(listCommand);
      const providers: Provider[] = [];

      if (listResult.Contents) {
        // Filter out directory markers and get actual provider files
        const providerFiles = listResult.Contents.filter(obj => 
          obj.Key && 
          !obj.Key.endsWith('/') &&
          obj.Key.includes('/provider.json')
        );

        this.logger.info('Found provider files', { count: providerFiles.length });

        // Load each provider file
        for (const file of providerFiles) {
          if (file.Key) {
            try {
              const provider = await this.loadProviderFile(file.Key);
              if (provider) {
                providers.push(provider);
              }
            } catch (error) {
              this.logger.warn('Failed to load provider file', { 
                file: file.Key,
                error: (error as Error).message
              });
            }
          }
        }
      }

      // Cache the results
      this.setCache(cacheKey, providers);
      
      this.logger.info('Providers loaded successfully', { 
        totalProviders: providers.length,
        activeProviders: providers.filter(p => p.status === 'active').length
      });

      return providers;
    } catch (error) {
      this.logger.error('Failed to load providers from S3', error as Error);
      throw new Error('Failed to load provider data');
    }
  }

  /**
   * Find a specific provider by ID
   */
  async findById(providerId: string): Promise<Provider | null> {
    const cacheKey = `provider-${providerId}`;
    
    // Check cache first
    const cached = this.getFromCache<Provider>(cacheKey);
    if (cached) {
      this.logger.debug('Provider retrieved from cache', { providerId });
      return cached;
    }

    try {
      this.logger.info('Loading provider from S3', { providerId, bucket: this.bucketName });

      // Try to load the specific provider file
      const providerKey = `${this.PROVIDERS_PREFIX}${providerId}/provider.json`;
      const provider = await this.loadProviderFile(providerKey);

      if (provider) {
        // Cache the result
        this.setCache(cacheKey, provider);
        this.logger.info('Provider loaded successfully', { providerId });
        return provider;
      } else {
        this.logger.warn('Provider not found', { providerId });
        return null;
      }
    } catch (error) {
      this.logger.error('Failed to load provider from S3', error as Error, { providerId });
      return null;
    }
  }

  /**
   * Find providers by category
   */
  async findByCategory(category: string): Promise<Provider[]> {
    const allProviders = await this.findAll();
    return allProviders.filter(provider => 
      provider.category?.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Find providers by status
   */
  async findByStatus(status: string): Promise<Provider[]> {
    const allProviders = await this.findAll();
    return allProviders.filter(provider => provider.status.toLowerCase() === status.toLowerCase());
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Provider cache cleared');
  }

  /**
   * Load a single provider file from S3
   */
  private async loadProviderFile(key: string): Promise<Provider | null> {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const result = await this.s3Client.send(getCommand);
      
      if (result.Body) {
        const content = await result.Body.transformToString();
        const providerData = JSON.parse(content);
        
        // Validate provider structure
        if (this.isValidProvider(providerData)) {
          return providerData as Provider;
        } else {
          this.logger.warn('Invalid provider data structure', { key });
          return null;
        }
      }
      return null;
    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Validate provider data structure
   */
  private isValidProvider(data: any): boolean {
    return data && 
           typeof data.id === 'string' &&
           typeof data.name === 'string' &&
           typeof data.description === 'string' &&
           typeof data.status === 'string';
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