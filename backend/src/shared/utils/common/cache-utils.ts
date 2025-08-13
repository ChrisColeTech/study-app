/**
 * Cache management utility functions
 * 
 * Single Responsibility: In-memory caching utilities and cache key generation
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

/**
 * Simple in-memory cache with TTL support
 */
export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupTimer?: NodeJS.Timeout | undefined;
  
  constructor(private config: CacheConfig) {
    // Start periodic cleanup
    this.startCleanup();
  }
  
  /**
   * Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set item in cache
   */
  set(key: string, data: T, customTtl?: number): void {
    // Remove old entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }
    
    const ttl = customTtl || this.config.ttl;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * Get cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let valid = 0;
    
    for (const entry of this.cache.values()) {
      if (this.isExpired(entry, now)) {
        expired++;
      } else {
        valid++;
      }
    }
    
    return {
      size: this.cache.size,
      valid,
      expired,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
    };
  }
  
  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry, now)) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
  
  /**
   * Destroy cache and cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.cache.clear();
  }
  
  private isExpired(entry: CacheEntry<T>, now = Date.now()): boolean {
    return (now - entry.timestamp) >= entry.ttl;
  }
  
  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}

/**
 * Generate cache key from multiple components
 */
export function generateCacheKey(...components: (string | number)[]): string {
  return components
    .filter(component => component !== null && component !== undefined)
    .map(component => String(component))
    .join(':');
}

/**
 * Generate cache key with namespace
 */
export function generateNamespacedCacheKey(namespace: string, ...components: (string | number)[]): string {
  return generateCacheKey(namespace, ...components);
}

/**
 * Create a cache key from object properties
 */
export function createCacheKeyFromObject(obj: Record<string, any>, keyOrder?: string[]): string {
  const keys = keyOrder || Object.keys(obj).sort();
  const keyParts = keys
    .filter(key => obj[key] !== undefined && obj[key] !== null)
    .map(key => `${key}=${obj[key]}`);
  
  return keyParts.join('|');
}

/**
 * Extract cache namespace from key
 */
export function extractNamespace(cacheKey: string): string {
  const parts = cacheKey.split(':');
  return parts[0] || '';
}

/**
 * Check if cache key matches pattern
 */
export function matchesCacheKeyPattern(key: string, pattern: string): boolean {
  // Simple pattern matching with * wildcard
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(key);
}

/**
 * Default cache configurations for different use cases
 */
export const CACHE_CONFIGS = {
  SHORT: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    cleanupInterval: 60 * 1000, // 1 minute
  },
  MEDIUM: {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 500,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  },
  LONG: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxSize: 100,
    cleanupInterval: 10 * 60 * 1000, // 10 minutes
  },
} as const;