// Base filtering infrastructure for all domains
// Provides standardized filtering patterns and pagination utilities

/**
 * Generic filter result interface for all domain filters
 */
export interface FilterResult<T> {
  filtered: T[];
  total: number;
  executionTimeMs?: number;
}

/**
 * Generic pagination parameters for consistency across filters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Generic sorting parameters for consistency across filters
 */
export interface SortingParams {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

/**
 * Base filter request interface that all domain filters extend
 */
export interface BaseFilterRequest extends PaginationParams, SortingParams {
  search?: string;
}

/**
 * Base filter class providing common filtering utilities
 */
export abstract class BaseFilter {
  /**
   * Apply pagination to filtered results
   */
  static paginate<T>(items: T[], limit?: number, offset?: number): T[] {
    const start = offset || 0;
    const end = limit ? start + limit : items.length;
    return items.slice(start, end);
  }

  /**
   * Filter items by search term across specified fields
   */
  static filterBySearch<T>(
    items: T[],
    searchTerm: string,
    searchFields: (keyof T)[]
  ): T[] {
    if (!searchTerm?.trim()) return items;
    
    const search = searchTerm.toLowerCase();
    return items.filter(item =>
      searchFields.some(field => {
        const value = item[field];
        return typeof value === 'string' && value.toLowerCase().includes(search);
      })
    );
  }

  /**
   * Filter items by enum/string values
   */
  static filterByEnum<T, K extends keyof T>(
    items: T[],
    field: K,
    values?: T[K] | T[K][]
  ): T[] {
    if (!values) return items;
    
    const valueArray = Array.isArray(values) ? values : [values];
    return items.filter(item => valueArray.includes(item[field]));
  }

  /**
   * Filter items by date range
   */
  static filterByDateRange<T>(
    items: T[],
    dateField: keyof T,
    startDate?: string,
    endDate?: string
  ): T[] {
    if (!startDate && !endDate) return items;
    
    return items.filter(item => {
      const itemDate = new Date(item[dateField] as string);
      if (startDate && itemDate < new Date(startDate)) return false;
      if (endDate && itemDate > new Date(endDate)) return false;
      return true;
    });
  }

  /**
   * Sort items by field with direction
   */
  static sortItems<T>(
    items: T[],
    sortBy?: string,
    sortOrder: string = 'asc'
  ): T[] {
    if (!sortBy) return items;
    
    return [...items].sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      
      let comparison = 0;
      if (aVal > bVal) comparison = 1;
      else if (aVal < bVal) comparison = -1;
      
      return sortOrder.toLowerCase() === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Extract unique values from array for filter options
   */
  static extractUniqueValues<T>(
    items: T[],
    field: keyof T,
    filter?: (value: any) => boolean
  ): any[] {
    const values = items.map(item => item[field]);
    const unique = Array.from(new Set(values));
    return filter ? unique.filter(filter) : unique;
  }

  /**
   * Performance timing utility for filter operations
   */
  static withTiming<T>(
    operation: () => FilterResult<T>
  ): FilterResult<T> {
    const startTime = Date.now();
    const result = operation();
    const executionTimeMs = Date.now() - startTime;
    
    return {
      ...result,
      executionTimeMs
    };
  }
}