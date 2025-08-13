// Dedicated provider filtering logic
// Extracted from ProviderService to separate filtering concerns

import {
  Provider,
  GetProvidersRequest,
  ProviderCategory,
  ProviderStatus,
  ProviderStatusEnum,
} from '../shared/types/provider.types';

export interface FilterResult<T> {
  filtered: T[];
  total: number;
}

export class ProviderFilter {
  /**
   * Apply all filters to provider list based on request
   */
  static applyFilters(providers: Provider[], request: GetProvidersRequest): FilterResult<Provider> {
    let filtered = [...providers]; // Create copy to avoid mutating original array

    // Apply status filter
    filtered = this.filterByStatus(filtered, request.status, request.includeInactive);

    // Apply category filter
    if (request.category !== undefined) {
      filtered = this.filterByCategory(filtered, request.category);
    }

    // Apply search filter
    if (request.search) {
      filtered = this.filterBySearch(filtered, request.search);
    }

    return {
      filtered,
      total: filtered.length,
    };
  }

  /**
   * Filter providers by status
   */
  static filterByStatus(
    providers: Provider[],
    status?: ProviderStatus,
    includeInactive = false
  ): Provider[] {
    if (status !== undefined) {
      return providers.filter(p => p.status === status);
    } else if (!includeInactive) {
      // Default: only show active providers unless explicitly requested
      return providers.filter(p => p.status === ProviderStatusEnum.ACTIVE);
    }

    return providers;
  }

  /**
   * Filter providers by category
   */
  static filterByCategory(providers: Provider[], category: ProviderCategory): Provider[] {
    return providers.filter(p => p.category?.toLowerCase() === category.toLowerCase());
  }

  /**
   * Filter providers by search term (searches name, description, id)
   */
  static filterBySearch(providers: Provider[], searchTerm: string): Provider[] {
    const search = searchTerm.toLowerCase();
    return providers.filter(
      p =>
        p.name.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search)
    );
  }

  /**
   * Sort providers (active first, then alphabetically by name)
   */
  static sortProviders(providers: Provider[]): Provider[] {
    return providers.sort((a, b) => {
      // Active providers first
      if (a.status !== b.status) {
        return a.status === ProviderStatusEnum.ACTIVE ? -1 : 1;
      }
      // Then alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Apply pagination to provider list
   */
  static paginate<T>(items: T[], limit?: number, offset?: number): T[] {
    const start = offset || 0;
    const end = limit ? start + limit : items.length;
    return items.slice(start, end);
  }

  /**
   * Extract available filter values from provider list
   */
  static extractFilterOptions(providers: Provider[]): {
    categories: ProviderCategory[];
    statuses: ProviderStatus[];
  } {
    const categories = Array.from(
      new Set(providers.map(p => p.category).filter(c => c !== undefined && c !== null))
    ) as ProviderCategory[];

    return {
      categories,
      statuses: [ProviderStatusEnum.ACTIVE, ProviderStatusEnum.INACTIVE],
    };
  }
}
