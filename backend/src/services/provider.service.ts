// Refactored provider service using dedicated filters and mappers
// Eliminates complex filtering logic mixed with business operations

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
import { IProviderRepository } from '../repositories/provider.repository';
import { ProviderFilter } from '../filters/provider.filter';
import { ProviderMapper } from '../mappers/provider.mapper';
import { createLogger } from '../shared/logger';
import { BaseService } from '../shared/base-service';

// Re-export the interface for ServiceFactory
export type { IProviderService };

export class ProviderService extends BaseService implements IProviderService {
  constructor(private providerRepository: IProviderRepository) {
    super();
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
      // Get all providers from repository
      const allProviders = await this.providerRepository.findAll();

      // Apply filters using dedicated filter class
      const { filtered, total } = ProviderFilter.applyFilters(allProviders, request);

      // Sort providers using dedicated filter class
      const sortedProviders = ProviderFilter.sortProviders(filtered);

      // Create response using dedicated mapper
      const response = ProviderMapper.toGetProvidersResponse(
        sortedProviders, 
        total, 
        allProviders, 
        request
      );

      this.logger.info('Providers retrieved successfully', { 
        total: response.total,
        filtered: response.providers.length,
        activeProviders: response.providers.filter(p => p.status === ProviderStatus.ACTIVE).length
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to get providers', error as Error, { request });
      throw error;
    }
  }

  /**
   * Get a specific provider by ID
   */
  async getProvider(request: GetProviderRequest): Promise<GetProviderResponse> {
    this.logger.info('Getting provider', { providerId: request.id });

    try {
      const provider = await this.providerRepository.findById(request.id);

      if (!provider) {
        throw new Error(`Provider not found: ${request.id}`);
      }

      // Check if provider is active (unless explicitly including inactive)
      if (provider.status !== ProviderStatus.ACTIVE && !request.includeInactive) {
        throw new Error(`Provider not found: ${request.id}`);
      }

      // Create response using dedicated mapper
      const response = ProviderMapper.toGetProviderResponse(provider);

      this.logger.info('Provider retrieved successfully', { 
        providerId: provider.id,
        name: provider.name,
        status: provider.status
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to get provider', error as Error, { 
        providerId: request.id 
      });
      throw error;
    }
  }

  /**
   * Get providers by category
   */
  async getProvidersByCategory(category: ProviderCategory): Promise<Provider[]> {
    this.logger.info('Getting providers by category', { category });

    try {
      const providers = await this.providerRepository.findByCategory(category);
      
      this.logger.info('Providers by category retrieved successfully', { 
        category,
        count: providers.length
      });

      return providers;
    } catch (error) {
      this.logger.error('Failed to get providers by category', error as Error, { category });
      throw error;
    }
  }

  /**
   * Get providers by status
   */
  async getProvidersByStatus(status: ProviderStatus): Promise<Provider[]> {
    this.logger.info('Getting providers by status', { status });

    try {
      const providers = await this.providerRepository.findByStatus(status);
      
      this.logger.info('Providers by status retrieved successfully', { 
        status,
        count: providers.length
      });

      return providers;
    } catch (error) {
      this.logger.error('Failed to get providers by status', error as Error, { status });
      throw error;
    }
  }

  /**
   * Refresh provider cache (admin operation)
   */
  async refreshCache(): Promise<void> {
    this.logger.info('Refreshing provider cache');

    try {
      this.providerRepository.clearCache();
      
      // Warm up the cache by loading all providers
      await this.providerRepository.findAll();
      
      this.logger.info('Provider cache refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh provider cache', error as Error);
      throw error;
    }
  }
}