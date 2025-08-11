// Provider service for Study App V3 Backend

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
import { createLogger } from '../shared/logger';

// Re-export the interface for ServiceFactory
export type { IProviderService };

export class ProviderService implements IProviderService {
  private logger = createLogger({ component: 'ProviderService' });

  constructor(private providerRepository: IProviderRepository) {}

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

      // Apply filtering
      let filteredProviders = allProviders;

      // Filter by status
      if (request.status !== undefined) {
        filteredProviders = filteredProviders.filter(p => p.status === request.status);
      } else if (!request.includeInactive) {
        // Default: only show active providers unless explicitly requested
        filteredProviders = filteredProviders.filter(p => p.status === ProviderStatus.ACTIVE);
      }

      // Filter by category
      if (request.category !== undefined) {
        filteredProviders = filteredProviders.filter(p => 
          p.category?.toLowerCase() === request.category!.toLowerCase()
        );
      }

      // Filter by search term
      if (request.search) {
        const searchTerm = request.search.toLowerCase();
        filteredProviders = filteredProviders.filter(p =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.description.toLowerCase().includes(searchTerm) ||
          p.id.toLowerCase().includes(searchTerm)
        );
      }

      // Sort providers (active first, then by name)
      const sortedProviders = filteredProviders.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === ProviderStatus.ACTIVE ? -1 : 1; // Active providers first
        }
        return a.name.localeCompare(b.name); // Then by name
      });

      // Apply pagination if requested
      const total = sortedProviders.length;
      let pagedProviders = sortedProviders;
      
      if (request.limit || request.offset) {
        const offset = request.offset || 0;
        const limit = request.limit || total;
        pagedProviders = sortedProviders.slice(offset, offset + limit);
      }

      // Collect available filter values for the response
      const availableCategories = Array.from(new Set(
        allProviders
          .map(p => p.category)
          .filter(c => c !== undefined && c !== null)
      )) as ProviderCategory[];

      const response: GetProvidersResponse = {
        providers: pagedProviders,
        total,
        filters: {
          categories: availableCategories,
          statuses: [ProviderStatus.ACTIVE, ProviderStatus.INACTIVE]
        }
      };

      // Add pagination info if applicable
      if (request.limit || request.offset) {
        const offset = request.offset || 0;
        const limit = request.limit || total;
        
        response.pagination = {
          limit,
          offset,
          hasMore: offset + limit < total
        };
      }

      this.logger.info('Providers retrieved successfully', { 
        total,
        filtered: pagedProviders.length,
        activeProviders: pagedProviders.filter(p => p.status === ProviderStatus.ACTIVE).length
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

      const response: GetProviderResponse = {
        provider
      };

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