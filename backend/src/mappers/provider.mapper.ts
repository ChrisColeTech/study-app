// Dedicated mapper for provider response objects
// Extracted from ProviderService to separate mapping concerns

import {
  Provider,
  GetProvidersResponse,
  GetProviderResponse,
  GetProvidersRequest,
} from '../shared/types/provider.types';
import { ProviderFilter } from '../filters/provider.filter';

export class ProviderMapper {
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

    // Extract available filter options
    const filterOptions = ProviderFilter.extractFilterOptions(allProviders);

    const response: GetProvidersResponse = {
      providers: pagedProviders,
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
      provider,
    };
  }
}
