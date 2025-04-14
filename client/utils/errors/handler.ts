import { logger } from '../logger';
import { AppError, ErrorCategory, ErrorSeverity } from './types';

interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffFactor: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCounts: Map<ErrorCategory, number>;
  private errorCountsBySeverity: Map<ErrorSeverity, number>;
  private retryConfigs: Map<ErrorCategory, RetryConfig>;

  private constructor() {
    this.errorCounts = new Map();
    this.errorCountsBySeverity = new Map();
    this.retryConfigs = new Map();
    this.initializeRetryConfigs();
  }

  private initializeRetryConfigs(): void {
    // Network errors: 3 attempts with exponential backoff
    this.retryConfigs.set(ErrorCategory.NETWORK, {
      maxAttempts: 3,
      delayMs: 1000,
      backoffFactor: 2
    });

    // Database errors: 2 attempts with linear backoff
    this.retryConfigs.set(ErrorCategory.DATABASE, {
      maxAttempts: 2,
      delayMs: 500,
      backoffFactor: 1
    });

    // Rate limit errors: 1 attempt with fixed delay
    this.retryConfigs.set(ErrorCategory.RATE_LIMIT, {
      maxAttempts: 1,
      delayMs: 5000,
      backoffFactor: 1
    });
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public handleError(error: AppError): void {
    // Update error counts
    this.updateErrorCounts(error);

    // Log the error based on severity
    this.logError(error);

    // Handle critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.handleCriticalError(error);
    }
  }

  private updateErrorCounts(error: AppError): void {
    // Update category counts
    const categoryCount = this.errorCounts.get(error.category) || 0;
    this.errorCounts.set(error.category, categoryCount + 1);

    // Update severity counts
    const severityCount = this.errorCountsBySeverity.get(error.severity) || 0;
    this.errorCountsBySeverity.set(error.severity, severityCount + 1);
  }

  private logError(error: AppError): void {
    const logContext = {
      category: error.category,
      severity: error.severity,
      timestamp: error.timestamp,
      ...error.context
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(error.message, logContext);
        break;
      case ErrorSeverity.HIGH:
        logger.error(error.message, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(error.message, logContext);
        break;
      case ErrorSeverity.LOW:
        logger.info(error.message, logContext);
        break;
    }
  }

  private handleCriticalError(error: AppError): void {
    // Log critical error details
    logger.error('Critical error occurred', {
      message: error.message,
      category: error.category,
      context: error.context,
      originalError: error.originalError
    });

    // Handle different types of critical errors
    switch (error.category) {
      case ErrorCategory.DATABASE:
        this.handleDatabaseCriticalError(error);
        break;
      case ErrorCategory.AUTHENTICATION:
        this.handleAuthCriticalError(error);
        break;
      default:
        this.handleGenericCriticalError(error);
    }
  }

  private handleDatabaseCriticalError(error: AppError): void {
    // Implement database-specific critical error handling
    logger.error('Database critical error', {
      ...error.context,
      timestamp: error.timestamp
    });
  }

  private handleAuthCriticalError(error: AppError): void {
    // Implement authentication-specific critical error handling
    logger.error('Authentication critical error', {
      ...error.context,
      timestamp: error.timestamp
    });
  }

  private handleGenericCriticalError(error: AppError): void {
    // Implement generic critical error handling
    logger.error('Generic critical error', {
      ...error.context,
      timestamp: error.timestamp
    });
  }

  public getErrorStats(): {
    byCategory: Map<ErrorCategory, number>;
    bySeverity: Map<ErrorSeverity, number>;
  } {
    return {
      byCategory: new Map(this.errorCounts),
      bySeverity: new Map(this.errorCountsBySeverity)
    };
  }

  public resetErrorCounts(): void {
    this.errorCounts.clear();
    this.errorCountsBySeverity.clear();
  }

  public async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    errorCategory: ErrorCategory,
    context?: Record<string, any>
  ): Promise<T> {
    const retryConfig = this.retryConfigs.get(errorCategory);
    if (!retryConfig) {
      return operation();
    }

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt === retryConfig.maxAttempts) {
          break;
        }

        const delay = retryConfig.delayMs * Math.pow(retryConfig.backoffFactor, attempt - 1);
        logger.warn(`Retrying operation after error`, {
          attempt,
          maxAttempts: retryConfig.maxAttempts,
          delay,
          error: lastError.message,
          ...context
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  public setRetryConfig(category: ErrorCategory, config: RetryConfig): void {
    this.retryConfigs.set(category, config);
  }
} 