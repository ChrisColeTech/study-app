// Provider repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Provider } from '../shared/types/provider.types';
import { ServiceConfig } from '../shared/service-factory';
import { S3BaseRepository } from './base.repository';
import { IListRepository, StandardQueryResult } from '../shared/types/repository.types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface IProviderRepository extends IListRepository<Provider, any> {
  /**
   * Find all providers
   * @param filters - Optional filtering parameters
   * @returns Promise<Provider[]> - All providers
   * @throws RepositoryError
   */
  findAll(filters?: any): Promise<StandardQueryResult<Provider>>;

  /**
   * Find provider by ID
   * @param providerId - Provider identifier
   * @returns Promise<Provider | null> - Provider if found
   * @throws RepositoryError
   */
  findById(providerId: string): Promise<Provider | null>;

  /**
   * Find providers by category
   * @param category - Provider category
   * @returns Promise<Provider[]> - Providers in category
   * @throws RepositoryError
   */
  findByCategory(category: string): Promise<Provider[]>;

  /**
   * Find providers by status
   * @param status - Provider status
   * @returns Promise<Provider[]> - Providers with status
   * @throws RepositoryError
   */
  findByStatus(status: string): Promise<Provider[]>;

  /**
   * Clear repository cache
   */
  clearCache(): void;
}

export class ProviderRepository extends S3BaseRepository implements IProviderRepository {
  private s3Client: S3Client;
  private cache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly PROVIDERS_PREFIX = 'providers/';

  constructor(s3Client: S3Client, config: ServiceConfig) {
    super('ProviderRepository', config, config.s3.bucketName);
    this.s3Client = s3Client;
  }

  /**
   * Perform health check operation for S3 connectivity
   */
  protected async performHealthCheck(): Promise<void> {
    await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.PROVIDERS_PREFIX,
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

  /**
   * Find all providers
   */
  async findAll(filters?: any): Promise<StandardQueryResult<Provider>> {
    return this.executeWithErrorHandling('findAll', async () => {
      const cacheKey = 'all-providers';

      // Check cache first
      const cachedProviders = this.getFromCache<Provider[]>(cacheKey);
      let providers: Provider[];

      if (cachedProviders) {
        this.logger.debug('Providers retrieved from cache', { count: cachedProviders.length });
        providers = cachedProviders;
      } else {
        // Load from S3
        providers = await this.loadProvidersFromS3();

        // Cache results
        this.setCache(cacheKey, providers);
        this.logger.info('Providers loaded from S3', { count: providers.length });
      }

      // Return standardized result format
      return {
        items: providers,
        total: providers.length,
        limit: filters?.limit || this.config.query?.defaultLimit || 20,
        offset: filters?.offset || 0,
        hasMore: false, // All providers loaded in one call
        executionTimeMs: 0, // Will be set by executeWithErrorHandling
      };
    });
  }

  /**
   * Find provider by ID
   */
  async findById(providerId: string): Promise<Provider | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        this.validateRequired({ providerId }, 'findById');

        const cacheKey = `provider-${providerId}`;

        // Check cache first
        const cachedProvider = this.getFromCache<Provider>(cacheKey);
        if (cachedProvider) {
          this.logger.debug('Provider retrieved from cache', { providerId });
          return cachedProvider;
        }

        // Get all providers and find by ID
        const allProvidersResult = await this.findAll();
        const provider = allProvidersResult.items.find((p: any) => p.id === providerId) || null;

        // Cache individual provider
        if (provider) {
          this.setCache(cacheKey, provider);
          this.logger.debug('Provider found and cached', { providerId });
        } else {
          this.logger.debug('Provider not found', { providerId });
        }

        return provider;
      },
      { providerId }
    );
  }

  /**
   * Find providers by category
   */
  async findByCategory(category: string): Promise<Provider[]> {
    return this.executeWithErrorHandling(
      'findByCategory',
      async () => {
        this.validateRequired({ category }, 'findByCategory');

        const cacheKey = `providers-category-${category}`;

        // Check cache first
        const cachedProviders = this.getFromCache<Provider[]>(cacheKey);
        if (cachedProviders) {
          this.logger.debug('Providers retrieved from cache', {
            category,
            count: cachedProviders.length,
          });
          return cachedProviders;
        }

        // Get all providers and filter by category
        const allProvidersResult = await this.findAll();
        const filteredProviders = allProvidersResult.items.filter(
          (p: any) => p.category === category
        );

        // Cache filtered results
        this.setCache(cacheKey, filteredProviders);

        this.logger.info('Providers filtered by category', {
          category,
          count: filteredProviders.length,
        });
        return filteredProviders;
      },
      { category }
    );
  }

  /**
   * Find providers by status
   */
  async findByStatus(status: string): Promise<Provider[]> {
    return this.executeWithErrorHandling(
      'findByStatus',
      async () => {
        this.validateRequired({ status }, 'findByStatus');

        const cacheKey = `providers-status-${status}`;

        // Check cache first
        const cachedProviders = this.getFromCache<Provider[]>(cacheKey);
        if (cachedProviders) {
          this.logger.debug('Providers retrieved from cache', {
            status,
            count: cachedProviders.length,
          });
          return cachedProviders;
        }

        // Get all providers and filter by status
        const allProvidersResult = await this.findAll();
        const filteredProviders = allProvidersResult.items.filter((p: any) => p.status === status);

        // Cache filtered results
        this.setCache(cacheKey, filteredProviders);

        this.logger.info('Providers filtered by status', {
          status,
          count: filteredProviders.length,
        });
        return filteredProviders;
      },
      { status }
    );
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Provider repository cache cleared');
  }

  /**
   * Refresh cache from source
   */
  async refreshCache(): Promise<void> {
    return this.executeWithErrorHandling('refreshCache', async () => {
      this.clearCache();
      this.logger.info('Provider repository cache refreshed');
    });
  }

  /**
   * Load providers from S3 - simple implementation for compilation
   */
  private async loadProvidersFromS3(): Promise<Provider[]> {
    // Simple implementation for compilation - would load from S3 in real implementation
    return [];
  }
}
