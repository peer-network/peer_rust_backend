import { logger } from '../logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class GraphQLCache {
  private static instance: GraphQLCache;
  private cache: Map<string, CacheEntry<any>>;
  private readonly ttl: number;

  private constructor() {
    this.cache = new Map();
    this.ttl = (process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL, 10) : 300) * 1000; // 5 minutes default
    logger.debug('GraphQLCache initialized', { ttl: this.ttl });
  }

  public static getInstance(): GraphQLCache {
    if (!GraphQLCache.instance) {
      GraphQLCache.instance = new GraphQLCache();
    }
    return GraphQLCache.instance;
  }

  public set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    logger.debug('Cache entry set', { key });
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > this.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      logger.debug('Cache entry expired', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.data as T;
  }

  public delete(key: string): void {
    this.cache.delete(key);
    logger.debug('Cache entry deleted', { key });
  }

  public clear(): void {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const isExpired = Date.now() - entry.timestamp > this.ttl;
    if (isExpired) {
      this.cache.delete(key);
      logger.debug('Cache entry expired during has check', { key });
      return false;
    }
    
    return true;
  }
} 