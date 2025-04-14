import { getNumberEnv } from './validators';

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  enableLogging: boolean;
}

const DEFAULT_CONFIG: CacheConfig = {
  ttl: 300, // 5 minutes in seconds
  maxSize: 1000,
  enableLogging: true
};

export function createCacheConfig(): CacheConfig {
  return {
    ttl: getNumberEnv('CACHE_TTL', DEFAULT_CONFIG.ttl),
    maxSize: getNumberEnv('CACHE_MAX_SIZE', DEFAULT_CONFIG.maxSize),
    enableLogging: process.env.CACHE_ENABLE_LOGGING === 'true' || DEFAULT_CONFIG.enableLogging
  };
}

export const cacheConfig = createCacheConfig(); 