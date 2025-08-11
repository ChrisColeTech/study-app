// Provider service for Study App V3 Backend

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { 
  Provider, 
  GetProvidersRequest, 
  GetProvidersResponse, 
  GetProviderRequest, 
  GetProviderResponse, 
  IProviderService,
  ProviderCategory,
  ProviderStatus
} from '../shared/types/provider.types';

// Re-export the interface for ServiceFactory
export type { IProviderService };
import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class ProviderService implements IProviderService {
  private logger = createLogger({ component: 'ProviderService' });
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
   * Get all providers with optional filtering
   */
  async getProviders(request: GetProvidersRequest): Promise<GetProvidersResponse> {
    this.logger.info('Getting providers', { 
      category: request.category, 
      status: request.status,
      search: request.search,
      includeInactive: request.includeInactive 
    });

    try {
      // Get all providers from cache or S3
      const allProviders = await this.getAllProviders();

      // Apply filters
      let filteredProviders = allProviders;

      // Filter by status
      if (request.status) {
        filteredProviders = filteredProviders.filter(p => p.status === request.status);
      }

      // Filter by category
      if (request.category) {
        filteredProviders = filteredProviders.filter(p => p.category === request.category);
      }

      // Filter out inactive providers unless explicitly requested
      if (!request.includeInactive) {
        filteredProviders = filteredProviders.filter(p => p.status === ProviderStatus.ACTIVE);
      }

      // Apply search filter
      if (request.search) {
        const searchLower = request.search.toLowerCase();
        filteredProviders = filteredProviders.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.fullName.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }

      // Sort by name for consistent ordering
      filteredProviders.sort((a, b) => a.name.localeCompare(b.name));

      // Get available filter options
      const availableCategories = [...new Set(allProviders.map(p => p.category))];
      const availableStatuses = [...new Set(allProviders.map(p => p.status))];

      const response: GetProvidersResponse = {
        providers: filteredProviders,
        total: filteredProviders.length,
        filters: {
          categories: availableCategories,
          statuses: availableStatuses
        }
      };

      this.logger.info('Providers retrieved successfully', { 
        total: response.total,
        filtered: filteredProviders.length 
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get providers', error as Error);
      throw new Error('Failed to retrieve providers');
    }
  }

  /**
   * Get a specific provider by ID
   */
  async getProvider(request: GetProviderRequest): Promise<GetProviderResponse> {
    this.logger.info('Getting provider', { id: request.id, includeCertifications: request.includeCertifications });

    try {
      const cacheKey = `provider:${request.id}`;
      
      // Check cache first
      const cached = this.getFromCache<Provider>(cacheKey);
      if (cached) {
        this.logger.debug('Provider retrieved from cache', { id: request.id });
        
        const provider = request.includeCertifications === false ? 
          { ...cached, certifications: [] } : 
          cached;

        return { provider };
      }

      // Load from S3
      const provider = await this.loadProviderFromS3(request.id);

      // Cache the result
      this.setCache(cacheKey, provider);

      // Filter certifications if requested
      const responseProvider = request.includeCertifications === false ? 
        { ...provider, certifications: [] } : 
        provider;

      this.logger.info('Provider retrieved successfully', { 
        id: request.id,
        name: provider.name,
        certificationsCount: provider.certifications.length
      });

      return { provider: responseProvider };

    } catch (error) {
      this.logger.error('Failed to get provider', error as Error, { id: request.id });
      
      if ((error as any).name === 'NoSuchKey' || (error as Error).message.includes('does not exist')) {
        throw new Error(`Provider '${request.id}' not found`);
      }
      
      throw new Error('Failed to retrieve provider');
    }
  }

  /**
   * Refresh the provider cache
   */
  async refreshCache(): Promise<void> {
    this.logger.info('Refreshing provider cache');

    try {
      // Clear existing cache
      this.cache.clear();

      // Pre-load all providers
      await this.getAllProviders();

      this.logger.info('Provider cache refreshed successfully');

    } catch (error) {
      this.logger.error('Failed to refresh cache', error as Error);
      throw new Error('Failed to refresh provider cache');
    }
  }

  /**
   * Get all providers from cache or S3
   */
  private async getAllProviders(): Promise<Provider[]> {
    const cacheKey = 'providers:all';

    // Check cache first
    const cached = this.getFromCache<Provider[]>(cacheKey);
    if (cached) {
      this.logger.debug('All providers retrieved from cache');
      return cached;
    }

    // Load all providers from S3
    const providers = await this.loadAllProvidersFromS3();

    // Cache the results
    this.setCache(cacheKey, providers);

    this.logger.info('All providers loaded from S3', { count: providers.length });

    return providers;
  }

  /**
   * Load all providers from S3
   */
  private async loadAllProvidersFromS3(): Promise<Provider[]> {
    this.logger.debug('Loading all providers from S3');

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

      // Load each provider file
      const providers: Provider[] = [];
      
      for (const item of listResponse.Contents) {
        if (!item.Key || !item.Key.endsWith('.json')) continue;

        try {
          const providerId = item.Key.replace(this.PROVIDERS_PREFIX, '').replace('.json', '');
          const provider = await this.loadProviderFromS3(providerId);
          providers.push(provider);
        } catch (error) {
          this.logger.warn('Failed to load provider file', { key: item.Key, error: (error as Error).message });
          // Continue loading other providers
        }
      }

      return providers;

    } catch (error) {
      this.logger.error('Failed to load providers from S3', error as Error);
      throw new Error('Failed to load providers from storage');
    }
  }

  /**
   * Load a specific provider from S3
   */
  private async loadProviderFromS3(providerId: string): Promise<Provider> {
    this.logger.debug('Loading provider from S3', { id: providerId });

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

      // Ensure the ID matches the filename
      if (provider.id !== providerId) {
        this.logger.warn('Provider ID mismatch', { 
          fileId: providerId, 
          dataId: provider.id,
          key 
        });
        // Use the filename ID as authoritative
        provider.id = providerId;
      }

      this.logger.debug('Provider loaded successfully', { 
        id: provider.id,
        name: provider.name,
        certificationsCount: provider.certifications?.length || 0
      });

      return provider;

    } catch (error) {
      this.logger.error('Failed to load provider from S3', error as Error, { id: providerId });
      throw error;
    }
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