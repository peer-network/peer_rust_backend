export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  NETWORK = 'NETWORK',
  CACHE = 'CACHE',
  CONFIGURATION = 'CONFIGURATION',
  GRAPHQL = 'GRAPHQL',
  DATABASE = 'DATABASE',
  AUTHENTICATION = 'AUTHENTICATION',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ErrorContext {
  [key: string]: any;
}

export interface AppError extends Error {
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: ErrorContext;
  timestamp: number;
  code?: string;
  originalError?: Error;
}

export interface ValidationError extends AppError {
  field?: string;
  value?: any;
  constraint?: string;
}

export interface NetworkError extends AppError {
  statusCode?: number;
  endpoint?: string;
  method?: string;
}

export interface CacheError extends AppError {
  operation: 'get' | 'set' | 'delete' | 'clear';
  key?: string;
}

export interface ConfigurationError extends AppError {
  configKey?: string;
  expectedType?: string;
  actualValue?: any;
}

export interface GraphQLError extends AppError {
  operation?: string;
  variables?: Record<string, any>;
  path?: string[];
}

export interface DatabaseError extends AppError {
  operation: 'query' | 'insert' | 'update' | 'delete';
  table?: string;
  query?: string;
  params?: any[];
}

export interface AuthenticationError extends AppError {
  type: 'invalid_credentials' | 'token_expired' | 'unauthorized' | 'forbidden';
  userId?: string;
  token?: string;
}

export interface RateLimitError extends AppError {
  limit: number;
  remaining: number;
  resetTime: number;
  endpoint?: string;
} 