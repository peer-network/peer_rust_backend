import {
  AppError,
  ValidationError,
  NetworkError,
  CacheError,
  ConfigurationError,
  GraphQLError,
  DatabaseError,
  AuthenticationError,
  RateLimitError,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext
} from './types';

export class ErrorFactory {
  private static createBaseError(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: ErrorContext,
    originalError?: Error
  ): AppError {
    const error = new Error(message) as AppError;
    error.category = category;
    error.severity = severity;
    error.context = context;
    error.timestamp = Date.now();
    error.originalError = originalError;
    return error;
  }

  static validationError(
    message: string,
    field?: string,
    value?: any,
    constraint?: string,
    context?: ErrorContext
  ): ValidationError {
    const error = this.createBaseError(
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.MEDIUM,
      context
    ) as ValidationError;
    error.field = field;
    error.value = value;
    error.constraint = constraint;
    return error;
  }

  static networkError(
    message: string,
    statusCode?: number,
    endpoint?: string,
    method?: string,
    context?: ErrorContext
  ): NetworkError {
    const error = this.createBaseError(
      message,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      context
    ) as NetworkError;
    error.statusCode = statusCode;
    error.endpoint = endpoint;
    error.method = method;
    return error;
  }

  static cacheError(
    message: string,
    operation: 'get' | 'set' | 'delete' | 'clear',
    key?: string,
    context?: ErrorContext
  ): CacheError {
    const error = this.createBaseError(
      message,
      ErrorCategory.CACHE,
      ErrorSeverity.MEDIUM,
      context
    ) as CacheError;
    error.operation = operation;
    error.key = key;
    return error;
  }

  static configurationError(
    message: string,
    configKey?: string,
    expectedType?: string,
    actualValue?: any,
    context?: ErrorContext
  ): ConfigurationError {
    const error = this.createBaseError(
      message,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.HIGH,
      context
    ) as ConfigurationError;
    error.configKey = configKey;
    error.expectedType = expectedType;
    error.actualValue = actualValue;
    return error;
  }

  static graphQLError(
    message: string,
    operation?: string,
    variables?: Record<string, any>,
    path?: string[],
    context?: ErrorContext
  ): GraphQLError {
    const error = this.createBaseError(
      message,
      ErrorCategory.GRAPHQL,
      ErrorSeverity.HIGH,
      context
    ) as GraphQLError;
    error.operation = operation;
    error.variables = variables;
    error.path = path;
    return error;
  }

  static databaseError(
    message: string,
    operation: 'query' | 'insert' | 'update' | 'delete',
    table?: string,
    query?: string,
    params?: any[],
    context?: ErrorContext
  ): DatabaseError {
    const error = this.createBaseError(
      message,
      ErrorCategory.DATABASE,
      ErrorSeverity.HIGH,
      context
    ) as DatabaseError;
    error.operation = operation;
    error.table = table;
    error.query = query;
    error.params = params;
    return error;
  }

  static authenticationError(
    message: string,
    type: 'invalid_credentials' | 'token_expired' | 'unauthorized' | 'forbidden',
    userId?: string,
    token?: string,
    context?: ErrorContext
  ): AuthenticationError {
    const error = this.createBaseError(
      message,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      context
    ) as AuthenticationError;
    error.type = type;
    error.userId = userId;
    error.token = token;
    return error;
  }

  static rateLimitError(
    message: string,
    limit: number,
    remaining: number,
    resetTime: number,
    endpoint?: string,
    context?: ErrorContext
  ): RateLimitError {
    const error = this.createBaseError(
      message,
      ErrorCategory.RATE_LIMIT,
      ErrorSeverity.MEDIUM,
      context
    ) as RateLimitError;
    error.limit = limit;
    error.remaining = remaining;
    error.resetTime = resetTime;
    error.endpoint = endpoint;
    return error;
  }

  static unknownError(
    message: string,
    context?: ErrorContext,
    originalError?: Error
  ): AppError {
    return this.createBaseError(
      message,
      ErrorCategory.UNKNOWN,
      ErrorSeverity.CRITICAL,
      context,
      originalError
    );
  }
} 