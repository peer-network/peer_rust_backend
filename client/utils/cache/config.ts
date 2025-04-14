import { getIntEnv } from '../config/validators';
import { CacheConfig } from './types';

// Default cache configuration values
const DEFAULT_CONFIG: CacheConfig = {
  TTL: 300,           // 5 minutes
  CHECK_PERIOD: 60    // 1 minute
};

// Create Cache configuration
export function createCacheConfig(): CacheConfig {
  return {
    TTL: getIntEnv('CACHE_TTL', DEFAULT_CONFIG.TTL),
    CHECK_PERIOD: getIntEnv('CACHE_CHECK_PERIOD', DEFAULT_CONFIG.CHECK_PERIOD)
  };
}

// Export the cache configuration
export const cacheConfig = createCacheConfig(); 