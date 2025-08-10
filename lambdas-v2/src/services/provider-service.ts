import { Provider, Exam } from '../types';
import { S3Service } from './s3-service';
import { MultiLayerCache } from './cache-service';
import { Logger } from '../shared/logger';

/**
 * Provider Service - Manages study providers and their exams
 * Handles S3-based provider metadata with multi-layer caching
 */
export class ProviderService {
  private s3Service: S3Service;
  private cache: MultiLayerCache;
  private logger: Logger;

  constructor() {
    this.s3Service = new S3Service();
    this.cache = new MultiLayerCache();
    this.logger = new Logger('ProviderService');
  }

  /**
   * Get all providers and their exams
   */
  async getAllProviders(): Promise<Provider[]> {
    const startTime = Date.now();
    const cacheKey = 'providers:all';

    try {
      // Check multi-layer cache first
      const cachedProviders = await this.cache.get<Provider[]>(cacheKey);
      if (cachedProviders) {
        this.logger.debug('Returning cached providers');
        return cachedProviders;
      }

      this.logger.info('Loading providers from S3');

      // Load providers from S3
      const providers = await this.loadProvidersFromS3();
      
      // Update cache with 6 hour TTL
      await this.cache.put(cacheKey, providers, 360);

      this.logger.perf('getAllProviders', Date.now() - startTime, {
        providerCount: providers.length,
        totalExams: providers.reduce((sum, p) => sum + p.exams.length, 0)
      });

      return providers;
    } catch (error) {
      this.logger.error('Failed to get all providers', error);
      throw error;
    }
  }

  /**
   * Get specific provider by ID
   */
  async getProvider(providerId: string): Promise<Provider | null> {
    const startTime = Date.now();
    const cacheKey = `provider:${providerId}`;

    try {
      // Check multi-layer cache first
      const cachedProvider = await this.cache.get<Provider>(cacheKey);
      if (cachedProvider) {
        this.logger.debug('Returning cached provider', { providerId });
        return cachedProvider;
      }

      this.logger.info('Loading specific provider from S3', { providerId });

      // Try to load specific provider from S3
      const provider = await this.loadProviderFromS3(providerId);
      
      if (provider) {
        // Update cache with 6 hour TTL
        await this.cache.put(cacheKey, provider, 360);
        this.logger.perf('getProvider', Date.now() - startTime, { providerId });
        return provider;
      }

      // If specific provider file doesn't exist, load all and find it
      const allProviders = await this.getAllProviders();
      const foundProvider = allProviders.find(p => p.id === providerId);
      
      if (foundProvider) {
        // Cache the found provider
        await this.cache.put(cacheKey, foundProvider, 360);
      }
      
      this.logger.perf('getProvider', Date.now() - startTime, { 
        providerId,
        found: !!foundProvider 
      });

      return foundProvider || null;
    } catch (error) {
      this.logger.error('Failed to get provider', { providerId, error });
      throw error;
    }
  }

  /**
   * Get exam from provider
   */
  async getExam(providerId: string, examId: string): Promise<Exam | null> {
    try {
      const provider = await this.getProvider(providerId);
      if (!provider) {
        return null;
      }

      return provider.exams.find(exam => exam.id === examId) || null;
    } catch (error) {
      this.logger.error('Failed to get exam', { providerId, examId, error });
      throw error;
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(): Promise<{
    totalProviders: number;
    totalExams: number;
    providerBreakdown: { [key: string]: number };
  }> {
    try {
      const providers = await this.getAllProviders();
      
      return {
        totalProviders: providers.length,
        totalExams: providers.reduce((sum, p) => sum + (p.exams?.length || 0), 0),
        providerBreakdown: providers.reduce((breakdown, provider) => {
          breakdown[provider.id] = provider.exams?.length || 0;
          return breakdown;
        }, {} as { [key: string]: number })
      };
    } catch (error) {
      this.logger.error('Failed to get provider stats', error);
      throw error;
    }
  }

  /**
   * Clear cache - useful for testing or forced refresh
   */
  clearCache(): void {
    this.cache.clearMemoryCache();
    this.logger.info('Provider cache cleared');
  }

  /**
   * Load all providers from S3
   */
  private async loadProvidersFromS3(): Promise<Provider[]> {
    try {
      // First try to load consolidated providers file
      let providers = await this.s3Service.getJsonObject<Provider[]>('providers/providers.json');
      
      if (providers) {
        return providers;
      }

      // If consolidated file doesn't exist, try to load individual provider files
      this.logger.debug('Consolidated providers file not found, trying individual files');
      
      const providerKeys = await this.s3Service.listObjects('providers/');
      const individualProviders: Provider[] = [];

      for (const key of providerKeys) {
        if (key.endsWith('.json') && key !== 'providers/providers.json') {
          const provider = await this.s3Service.getJsonObject<Provider>(key);
          if (provider) {
            individualProviders.push(provider);
          }
        }
      }

      if (individualProviders.length > 0) {
        return individualProviders;
      }

      // If no providers found in S3, return default providers
      this.logger.warn('No providers found in S3, returning default providers');
      return this.getDefaultProviders();

    } catch (error) {
      this.logger.error('Failed to load providers from S3, falling back to defaults', error);
      return this.getDefaultProviders();
    }
  }

  /**
   * Load specific provider from S3
   */
  private async loadProviderFromS3(providerId: string): Promise<Provider | null> {
    try {
      const provider = await this.s3Service.getJsonObject<Provider>(`providers/${providerId}.json`);
      return provider;
    } catch (error) {
      this.logger.debug('Failed to load specific provider from S3', { providerId });
      return null;
    }
  }


  /**
   * Get default providers when S3 data is not available
   */
  private getDefaultProviders(): Provider[] {
    return [
      {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Cloud computing platform and services',
        exams: [
          {
            id: 'saa-c03',
            name: 'Solutions Architect Associate',
            description: 'Validates ability to design distributed systems on AWS',
            questionCount: 681,
            duration: 130,
            passingScore: 720
          },
          {
            id: 'dva-c01',
            name: 'Developer Associate',
            description: 'Validates ability to develop applications on AWS',
            questionCount: 0,
            duration: 130,
            passingScore: 720
          },
          {
            id: 'soa-c02',
            name: 'SysOps Administrator Associate',
            description: 'Validates ability to deploy and manage systems on AWS',
            questionCount: 0,
            duration: 130,
            passingScore: 720
          }
        ]
      },
      {
        id: 'azure',
        name: 'Microsoft Azure',
        description: 'Cloud computing platform and services',
        exams: [
          {
            id: 'az-900',
            name: 'Azure Fundamentals',
            description: 'Validates foundational knowledge of cloud services',
            questionCount: 0,
            duration: 60,
            passingScore: 700
          },
          {
            id: 'az-104',
            name: 'Azure Administrator',
            description: 'Validates skills to manage Azure subscriptions and resources',
            questionCount: 0,
            duration: 150,
            passingScore: 700
          }
        ]
      },
      {
        id: 'gcp',
        name: 'Google Cloud Platform',
        description: 'Cloud computing platform and services',
        exams: [
          {
            id: 'ace',
            name: 'Associate Cloud Engineer',
            description: 'Validates ability to deploy and manage GCP resources',
            questionCount: 0,
            duration: 120,
            passingScore: 70
          }
        ]
      }
    ];
  }
}