// Cache configuration interface
export interface CacheConfig {
  TTL: number;              // Time to live in seconds
  CHECK_PERIOD: number;     // Cache cleanup check period in seconds
}

// Cache entry interface
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Cache options interface
export interface CacheOptions {
  ttl: number;
  maxSize?: number;
  cleanupInterval?: number;
}

// Cache statistics interface
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  lastCleared?: number;
}

export interface CacheItem<T> {
  data: T;
  timestamp: number;
} 