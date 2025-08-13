// Dedicated mapper for provider response objects
// Extracted from ProviderService to separate mapping concerns

import {
  Provider,
  EnhancedProvider,
  ProviderMetadata,
  ProviderCategory,
  GetProvidersResponse,
  GetProviderResponse,
  GetProvidersRequest,
} from '../shared/types/provider.types';
import { StatusType } from '../shared/types/domain.types';
import { ProviderFilter } from '../filters/provider.filter';

export class ProviderMapper {
  /**
   * Convert Provider to EnhancedProvider with additional metadata
   */
  static toEnhancedProvider(provider: Provider): EnhancedProvider {
    return {
      ...provider,
      fullName: provider.name, // Use name as fullName for now
      status: StatusType.ACTIVE, // Default to active status
      website: '', // Default empty website
      logoUrl: '', // Default empty logo URL
      category: 'cloud' as ProviderCategory, // Default category
      certifications: [], // Default empty certifications
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }
    };
  }

  /**
   * Convert array of Providers to EnhancedProviders
   */
  static toEnhancedProviders(providers: Provider[]): EnhancedProvider[] {
    return providers.map(provider => this.toEnhancedProvider(provider));
  }

  /**
   * Create GetProvidersResponse from filtered providers and request
   */
  static toGetProvidersResponse(
    filteredProviders: Provider[],
    totalFiltered: number,
    allProviders: Provider[],
    request: GetProvidersRequest
  ): GetProvidersResponse {
    // Apply pagination if requested
    const pagedProviders =
      request.limit || request.offset
        ? ProviderFilter.paginate(filteredProviders, request.limit, request.offset)
        : filteredProviders;

    // Convert to EnhancedProviders
    const enhancedProviders = this.toEnhancedProviders(pagedProviders);

    // Extract available filter options
    const filterOptions = ProviderFilter.extractFilterOptions(allProviders);

    const response: GetProvidersResponse = {
      providers: enhancedProviders,
      total: totalFiltered,
      filters: filterOptions,
    };

    // Add pagination info if applicable
    if (request.limit || request.offset) {
      const offset = request.offset || 0;
      const limit = request.limit || totalFiltered;

      response.pagination = {
        limit,
        offset,
        hasMore: offset + limit < totalFiltered,
      };
    }

    return response;
  }

  /**
   * Create GetProviderResponse from provider
   */
  static toGetProviderResponse(provider: Provider): GetProviderResponse {
    return {
      provider: this.toEnhancedProvider(provider),
    };
  }
}
