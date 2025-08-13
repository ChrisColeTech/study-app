// Validation Cache Manager - Extracted from ValidationMiddleware monster class
// Focused responsibility: Managing validation result caching for performance
// Part of Objective 30 ValidationMiddleware decomposition

import { ApiResponse } from '../types/api.types';

/**
 * Focused ValidationCache class for managing validation result caching
 * Extracted from ValidationMiddleware to achieve SRP compliance
 */
export class ValidationCache {
  // Performance optimization: Cache validation results for repeated validations
  private static validationCache = new Map<
    string,
    { result: ApiResponse | null; timestamp: number }
  >();
  
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_CACHE_SIZE = 1000; // Prevent memory leaks

  /**
   * Generate cache key for validation results
   */
  static generateCacheKey(
    fields: Record<string, any>,
    schemaRules: string[]
  ): string {
    const fieldsHash = JSON.stringify(fields);
    const rulesHash = schemaRules.sort().join('|');
    return `${fieldsHash}:${rulesHash}`;
  }

  /**
   * Get cached validation result
   */
  static getCachedValidation(cacheKey: string): ApiResponse | null {
    const cached = this.validationCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.validationCache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache validation result
   */
  static cacheValidation(cacheKey: string, result: ApiResponse | null): void {
    // Limit cache size to prevent memory leaks
    if (this.validationCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entries (simple FIFO approach)
      const oldestKey = this.validationCache.keys().next().value;
      if (oldestKey) {
        this.validationCache.delete(oldestKey);
      }
    }

    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear entire validation cache
   */
  static clearValidationCache(): void {
    this.validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.validationCache.size,
      hitRate: 0, // Simplified for now, could track hits/misses in future
    };
  }

  /**
   * Remove expired cache entries (maintenance method)
   */
  static cleanExpiredEntries(): number {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, value] of this.validationCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.validationCache.delete(key);
        removedCount++;
      }
    }
    
    return removedCount;
  }

  /**
   * Check if caching is enabled (could be configurable in future)
   */
  static isCachingEnabled(): boolean {
    return true; // Could be made configurable via environment variable
  }
}