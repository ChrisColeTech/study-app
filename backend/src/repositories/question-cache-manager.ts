// Question cache management with TTL and performance optimization

import { createLogger } from '../shared/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class QuestionCacheManager {
  private logger = createLogger({ component: 'QuestionCacheManager' });
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
  private readonly SEARCH_TTL = 10 * 60 * 1000; // 10 minutes for search data

  /**
   * Get data from cache if it exists and is not expired
   */
  getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry) {
      const now = Date.now();
      if (now - entry.timestamp < entry.ttl) {
        return entry.data;
      } else {
        // Cache expired, remove it
        this.cache.delete(key);
      }
    }
    return null;
  }

  /**
   * Store data in cache with TTL
   */
  setCache<T>(key: string, data: T, customTtl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl || this.DEFAULT_TTL,
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Question cache cleared');
  }

  /**
   * Generate cache key for provider questions
   */
  getProviderCacheKey(provider: string): string {
    return `questions-provider-${provider}`;
  }

  /**
   * Generate cache key for exam questions
   */
  getExamCacheKey(provider: string, exam: string): string {
    return `questions-exam-${provider}-${exam}`;
  }

  /**
   * Generate cache key for individual questions
   */
  getQuestionCacheKey(questionId: string): string {
    return `question-${questionId}`;
  }

  /**
   * Generate cache key for all questions (expensive operation cache)
   */
  getAllQuestionsCacheKey(): string {
    return 'all-questions';
  }

  /**
   * Generate cache key for searchable questions
   */
  getSearchableCacheKey(): string {
    return 'searchable-questions';
  }

  /**
   * Get search-specific TTL (shorter for search data)
   */
  getSearchTtl(): number {
    return this.SEARCH_TTL;
  }

  /**
   * Get default TTL
   */
  getDefaultTtl(): number {
    return this.DEFAULT_TTL;
  }
}
