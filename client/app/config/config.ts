import { Config, GraphQLConfig, AppConfig } from './types';
import { getRequiredEnvNumber, getRequiredEnvString } from './validators';
import dotenv from 'dotenv';

dotenv.config();

// Default configuration values
const DEFAULT_CONFIG = {
  GRAPHQL: {
    REQUEST_TIMEOUT: 30000,  // 30 seconds
    MAX_RETRIES: 3
  },
  APP: {
    NODE_ENV: 'development' as const,
    LOG_LEVEL: 'info' as const
  }
};

// Create GraphQL configuration
export function createGraphQLConfig(): GraphQLConfig {
  return {
    APP_NAME: getRequiredEnvString('APP_NAME'), 
    APP_URL: getRequiredEnvString('APP_URL'),
    APP_PORT: getRequiredEnvNumber('APP_PORT'),
    GRAPHQL_ENDPOINT: getRequiredEnvString('GRAPHQL_ENDPOINT'),
    PEER_BACKEND_GRAPHQL_ENDPOINT: getRequiredEnvString('PEER_BACKEND_GRAPHQL_ENDPOINT'),
    // API_TOKEN: getRequiredEnv('GRAPHQL_API_TOKEN'),
    // REQUEST_TIMEOUT: getIntEnv('GRAPHQL_REQUEST_TIMEOUT', DEFAULT_CONFIG.GRAPHQL.REQUEST_TIMEOUT),
    // MAX_RETRIES: getIntEnv('GRAPHQL_MAX_RETRIES', DEFAULT_CONFIG.GRAPHQL.MAX_RETRIES)
  };
}

// Create App configuration
export function createAppConfig(): AppConfig {
  return {
    // NODE_ENV: getEnumEnv('NODE_ENV', DEFAULT_CONFIG.APP.NODE_ENV, ['development', 'production', 'test']),
    // LOG_LEVEL: getEnumEnv('LOG_LEVEL', DEFAULT_CONFIG.APP.LOG_LEVEL, ['debug', 'info', 'warn', 'error'])
  };
}

// Create full configuration
export function createConfig(): Config {
  return {
    APP: createAppConfig(),
    GRAPHQL: createGraphQLConfig()
  };
}

// Create and merge configurations
export const baseConfig = createConfig();

