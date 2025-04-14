import { CacheManager } from './manager';
import { cacheConfig } from './config';
import { CacheOptions, CacheStats } from './types';

// Export types
export * from './types';

// Export configuration
export { cacheConfig };

// Create singleton instance
const cacheManager = CacheManager.getInstance({
  ttl: cacheConfig.TTL,
  cleanupInterval: cacheConfig.CHECK_PERIOD * 1000
});

// Export cache operations
export const cache = {
  set: <T>(key: string, data: T) => cacheManager.set(key, data),
  get: <T>(key: string) => cacheManager.get(key),
  delete: (key: string) => cacheManager.delete(key),
  clear: () => cacheManager.clear(),
  getStats: (): CacheStats => cacheManager.getStats(),
  stop: () => cacheManager.stop()
}; 