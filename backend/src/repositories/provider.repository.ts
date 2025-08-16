// Provider repository for S3 operations

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Provider } from '../shared/types/provider.types';
import { StatusType } from '../shared/types/domain.types';
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
  try {
    this.logger.info('Loading providers from S3', { 
      bucket: this.bucketName, 
      prefix: this.PROVIDERS_PREFIX 
    });

    // First, try to load from a providers metadata file
    try {
      const getCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: 'providers/metadata.json',
      });

      const result = await this.s3Client.send(getCommand);
      if (result.Body) {
        const content = await result.Body.transformToString();
        const providersData = JSON.parse(content);
        
        if (providersData.providers && Array.isArray(providersData.providers)) {
          this.logger.info('Providers loaded from metadata.json', { 
            count: providersData.providers.length 
          });
          return providersData.providers;
        }
      }
    } catch (error: any) {
      this.logger.debug('No providers/metadata.json file found, attempting to discover from structure', {
        error: error.message,
        code: error.Code
      });
    }

    // If no metadata file, discover providers from S3 structure
    this.logger.info('Attempting to discover providers from S3 structure', {
      bucket: this.bucketName,
      prefix: 'questions/'
    });

    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: 'questions/',
      Delimiter: '/',
    });

    const result = await this.s3Client.send(listCommand);
    const providers: Provider[] = [];

    this.logger.info('S3 list result', {
      keyCount: result.KeyCount,
      isTruncated: result.IsTruncated,
      commonPrefixesCount: result.CommonPrefixes?.length || 0,
      contentsCount: result.Contents?.length || 0
    });

    if (result.CommonPrefixes) {
      this.logger.info('Discovering providers from S3 structure', { 
        prefixes: result.CommonPrefixes.length 
      });

      // Log all discovered prefixes for debugging
      result.CommonPrefixes.forEach((prefix, index) => {
        this.logger.debug(`S3 CommonPrefix[${index}]`, { prefix: prefix.Prefix });
      });

      // Extract provider IDs from the S3 structure (questions/aws/, questions/azure/, etc.)
      for (const prefix of result.CommonPrefixes) {
        if (prefix.Prefix) {
          const providerIdMatch = prefix.Prefix.match(/questions\/([^\/]+)\//);
          if (providerIdMatch) {
            const providerId = providerIdMatch[1];
            
            this.logger.debug('Matched provider from S3 prefix', { 
              prefix: prefix.Prefix, 
              providerId 
            });
            
            // Create provider from discovered structure
            const provider: Provider = {
              id: providerId,
              providerId: providerId,
              name: this.getProviderDisplayName(providerId),
              description: `${this.getProviderDisplayName(providerId)} certification study material`,
              logoUrl: `https://cdn.example.com/logos/${providerId}.png`,
              category: 'cloud',
              status: StatusType.ACTIVE,
              isActive: true,
              exams: [], // Will be populated separately when exams are loaded
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            providers.push(provider);
            this.logger.debug('Created provider from S3 structure', { providerId });
          } else {
            this.logger.debug('S3 prefix did not match provider pattern', { 
              prefix: prefix.Prefix 
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

    if (providers.length === 0) {
      this.logger.warn('No providers discovered from S3 structure, returning fallback providers');
      return this.getFallbackProviders();
    }

    this.logger.info('Providers discovered from S3 structure', { count: providers.length });
    return providers;

  } catch (error) {
    this.logger.error('Failed to load providers from S3', error as Error, {
      bucket: this.bucketName,
      prefix: this.PROVIDERS_PREFIX,
    });
    
    // Return fallback hardcoded providers if S3 fails
    this.logger.info('Returning fallback providers due to S3 error');
    return this.getFallbackProviders();
  }
}

private getProviderDisplayName(providerId: string): string {
  const names: Record<string, string> = {
    aws: 'Amazon Web Services',
    azure: 'Microsoft Azure',
    gcp: 'Google Cloud Platform',
    cisco: 'Cisco',
    comptia: 'CompTIA',
  };
  return names[providerId] || providerId.toUpperCase();
}

private getProviderWebsite(providerId: string): string {
  const websites: Record<string, string> = {
    aws: 'https://aws.amazon.com',
    azure: 'https://azure.microsoft.com',
    gcp: 'https://cloud.google.com',
    cisco: 'https://cisco.com',
    comptia: 'https://comptia.org',
  };
  return websites[providerId] || `https://${providerId}.com`;
}

private getProviderFoundationYear(providerId: string): number {
  const years: Record<string, number> = {
    aws: 2006,
    azure: 2010,
    gcp: 2008,
    cisco: 1984,
    comptia: 1982,
  };
  return years[providerId] || 2000;
}

private getProviderHeadquarters(providerId: string): string {
  const headquarters: Record<string, string> = {
    aws: 'Seattle, WA',
    azure: 'Redmond, WA',
    gcp: 'Mountain View, CA',
    cisco: 'San Jose, CA',
    comptia: 'Downers Grove, IL',
  };
  return headquarters[providerId] || 'Unknown';
}

private getProviderMarketShare(providerId: string): number {
  const marketShares: Record<string, number> = {
    aws: 32,
    azure: 23,
    gcp: 10,
    cisco: 8,
    comptia: 15,
  };
  return marketShares[providerId] || 5;
}

private getProviderSpecializations(providerId: string): string[] {
  const specializations: Record<string, string[]> = {
    aws: ['Cloud Computing', 'Machine Learning', 'Data Analytics', 'IoT'],
    azure: ['Cloud Computing', 'AI/ML', 'DevOps', 'Enterprise Solutions'],
    gcp: ['Cloud Computing', 'Data Analytics', 'Machine Learning', 'Kubernetes'],
    cisco: ['Networking', 'Security', 'Collaboration', 'Data Center'],
    comptia: ['IT Fundamentals', 'Security', 'Cloud', 'Project Management'],
  };
  return specializations[providerId] || ['Technology'];
}

private getFallbackProviders(): Provider[] {
  const fallbackProviders: Provider[] = [
    {
      id: 'aws',
      providerId: 'aws',
      name: 'Amazon Web Services',
      description: 'Amazon Web Services (AWS) certification study material',
      logoUrl: 'https://cdn.example.com/logos/aws.png',
      category: 'cloud',
      status: StatusType.ACTIVE,
      isActive: true,
      exams: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'azure',
      providerId: 'azure', 
      name: 'Microsoft Azure',
      description: 'Microsoft Azure certification study material',
      logoUrl: 'https://cdn.example.com/logos/azure.png',
      category: 'cloud',
      status: StatusType.ACTIVE,
      isActive: true,
      exams: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'gcp',
      providerId: 'gcp',
      name: 'Google Cloud Platform',
      description: 'Google Cloud Platform certification study material',
      logoUrl: 'https://cdn.example.com/logos/gcp.png',
      category: 'cloud',
      status: StatusType.ACTIVE,
      isActive: true,
      exams: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'cisco',
      providerId: 'cisco',
      name: 'Cisco',
      description: 'Cisco certification study material',
      logoUrl: 'https://cdn.example.com/logos/cisco.png',
      category: 'networking',
      status: StatusType.ACTIVE,
      isActive: true,
      exams: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'comptia',
      providerId: 'comptia',
      name: 'CompTIA',
      description: 'CompTIA certification study material',
      logoUrl: 'https://cdn.example.com/logos/comptia.png',
      category: 'general',
      status: StatusType.ACTIVE,
      isActive: true,
      exams: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  this.logger.info('Using fallback providers', { count: fallbackProviders.length });
  return fallbackProviders;
}
}
