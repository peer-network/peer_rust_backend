import dotenv from 'dotenv';
import { createConfig } from './helpers';
import { cacheConfig } from '../cache/config';

// Load environment variables
dotenv.config();

// Create and merge configurations
const baseConfig = createConfig();
const config = {
  ...baseConfig,
  CACHE: cacheConfig
};

// Export the validated configuration
export { config };

// For backwards compatibility and easier access, export specific sections
export const GRAPHQL_CONFIG = config.GRAPHQL;
export const CACHE_CONFIG = config.CACHE;
export const APP_CONFIG = config.APP; 