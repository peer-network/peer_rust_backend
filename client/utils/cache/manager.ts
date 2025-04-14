import { logger } from '../logger';
import { ErrorFactory } from '../errors';
import { CacheItem, CacheStats, CacheOptions } from './types';

export class CacheManager<T> {
  private static instance: CacheManager<any>;
  private cache: Map<string, CacheItem<T>>;
  private stats: CacheStats;
  private readonly options: CacheOptions;
  private cleanupInterval?: NodeJS.Timeout;

  private constructor(options: CacheOptions) {
    this.cache = new Map();
    this.options = options;
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0
    };

    if (options.cleanupInterval) {
      this.startCleanupInterval();
    }
  }

  public static getInstance<T>(options: CacheOptions): CacheManager<T> {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager<T>(options);
    }
    return CacheManager.instance as CacheManager<T>;
  }

  public set(key: string, data: T): void {
    if (this.options.maxSize && this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    this.stats.size = this.cache.size;
    logger.debug('Cache entry set', { key });
  }

  public get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      this.stats.misses++;
      logger.debug('Cache miss', { key });
      return null;
    }

    if (Date.now() - item.timestamp > this.options.ttl * 1000) {
      this.cache.delete(key);
      this.stats.misses++;
      logger.debug('Cache entry expired', { key });
      return null;
    }

    this.stats.hits++;
    logger.debug('Cache hit', { key });
    return item.data;
  }

  public delete(key: string): void {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
    logger.debug('Cache entry deleted', { key });
  }

  public clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.lastCleared = Date.now();
    logger.debug('Cache cleared');
  }

  public getStats(): CacheStats {
    return { ...this.stats };
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Cache entry evicted', { key: oldestKey });
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, item] of this.cache.entries()) {
        if (now - item.timestamp > this.options.ttl * 1000) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.stats.size = this.cache.size;
        logger.debug('Cache cleanup completed', { cleaned });
      }
    }, this.options.cleanupInterval);
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
} 