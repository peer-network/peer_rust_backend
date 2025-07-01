import { ErrorResponse, ErrorCode, ErrorCategory, ErrorSeverity } from './ErrorHandler';

// ===== RECOVERY STRATEGY TYPES =====
export enum RecoveryStrategyType {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  CIRCUIT_BREAKER = 'circuit_breaker',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  SKIP = 'skip',
  MANUAL_INTERVENTION = 'manual_intervention'
}

// ===== RECOVERY STRATEGY INTERFACE =====
export interface RecoveryStrategy {
  type: RecoveryStrategyType;
  maxAttempts?: number;
  backoffMultiplier?: number;
  baseDelay?: number;
  fallbackFunction?: () => Promise<any>;
  shouldRecover?: (error: ErrorResponse, attempt: number) => boolean;
  onRecoverySuccess?: (error: ErrorResponse, result: any) => void;
  onRecoveryFailure?: (error: ErrorResponse, attempts: number) => void;
}

// ===== RECOVERY CONFIGURATION =====
export interface RecoveryConfig {
  errorCodes: number[];
  categories?: ErrorCategory[];
  severities?: ErrorSeverity[];
  strategy: RecoveryStrategy;
}

// ===== RECOVERY RESULT =====
export interface RecoveryResult<T = any> {
  success: boolean;
  result?: T;
  error?: ErrorResponse;
  attempts: number;
  totalTime: number;
  strategyUsed: RecoveryStrategyType;
}

// ===== ERROR RECOVERY MANAGER =====
export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private recoveryConfigs: RecoveryConfig[] = [];
  private recoveryHistory = new Map<string, RecoveryResult[]>();

  private constructor() {
    this.initializeDefaultStrategies();
  }

  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  // ===== CONFIGURATION =====
  addRecoveryConfig(config: RecoveryConfig): void {
    this.recoveryConfigs.push(config);
  }

  addRecoveryConfigs(configs: RecoveryConfig[]): void {
    this.recoveryConfigs.push(...configs);
  }

  clearRecoveryConfigs(): void {
    this.recoveryConfigs = [];
    this.initializeDefaultStrategies();
  }

  // ===== RECOVERY EXECUTION =====
  async attemptRecovery<T>(
    operation: () => Promise<T>,
    error: ErrorResponse,
    context?: any
  ): Promise<RecoveryResult<T>> {
    const startTime = Date.now();
    const config = this.findRecoveryConfig(error);

    if (!config) {
      return {
        success: false,
        error,
        attempts: 0,
        totalTime: Date.now() - startTime,
        strategyUsed: RecoveryStrategyType.MANUAL_INTERVENTION
      };
    }

    const result = await this.executeRecoveryStrategy(
      operation,
      error,
      config.strategy,
      context
    );

    result.totalTime = Date.now() - startTime;

    // Record recovery attempt
    this.recordRecoveryAttempt(error, result);

    return result;
  }

  private async executeRecoveryStrategy<T>(
    operation: () => Promise<T>,
    originalError: ErrorResponse,
    strategy: RecoveryStrategy,
    context?: any
  ): Promise<RecoveryResult<T>> {
    switch (strategy.type) {
      case RecoveryStrategyType.RETRY:
        return this.executeRetryStrategy(operation, originalError, strategy);
      
      case RecoveryStrategyType.FALLBACK:
        return this.executeFallbackStrategy(operation, originalError, strategy);
      
      case RecoveryStrategyType.CIRCUIT_BREAKER:
        return this.executeCircuitBreakerStrategy(operation, originalError, strategy);
      
      case RecoveryStrategyType.GRACEFUL_DEGRADATION:
        return this.executeGracefulDegradationStrategy(operation, originalError, strategy);
      
      case RecoveryStrategyType.SKIP:
        return this.executeSkipStrategy(originalError);
      
      default:
        return {
          success: false,
          error: originalError,
          attempts: 0,
          totalTime: 0,
          strategyUsed: RecoveryStrategyType.MANUAL_INTERVENTION
        };
    }
  }

  private async executeRetryStrategy<T>(
    operation: () => Promise<T>,
    originalError: ErrorResponse,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult<T>> {
    const maxAttempts = strategy.maxAttempts || 3;
    const baseDelay = strategy.baseDelay || 1000;
    const backoffMultiplier = strategy.backoffMultiplier || 2;

    let lastError = originalError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Check if we should attempt recovery
        if (strategy.shouldRecover && !strategy.shouldRecover(lastError, attempt)) {
          break;
        }

        // Wait before retrying (except first attempt)
        if (attempt > 1) {
          const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 2);
          await this.sleep(delay);
        }

        console.log(`🔄 Recovery attempt ${attempt}/${maxAttempts} for error ${lastError.code}`);
        
        const result = await operation();
        
        if (strategy.onRecoverySuccess) {
          strategy.onRecoverySuccess(originalError, result);
        }

        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: 0, // Will be set by caller
          strategyUsed: RecoveryStrategyType.RETRY
        };

      } catch (error: any) {
        lastError = error instanceof Error 
          ? { ...originalError, message: error.message }
          : error;
        
        console.log(`❌ Recovery attempt ${attempt} failed:`, lastError.message);
      }
    }

    if (strategy.onRecoveryFailure) {
      strategy.onRecoveryFailure(originalError, maxAttempts);
    }

    return {
      success: false,
      error: lastError,
      attempts: maxAttempts,
      totalTime: 0,
      strategyUsed: RecoveryStrategyType.RETRY
    };
  }

  private async executeFallbackStrategy<T>(
    operation: () => Promise<T>,
    originalError: ErrorResponse,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult<T>> {
    try {
      console.log(`🔄 Attempting fallback for error ${originalError.code}`);
      
      if (!strategy.fallbackFunction) {
        throw new Error('No fallback function provided');
      }

      const result = await strategy.fallbackFunction();
      
      if (strategy.onRecoverySuccess) {
        strategy.onRecoverySuccess(originalError, result);
      }

      return {
        success: true,
        result,
        attempts: 1,
        totalTime: 0,
        strategyUsed: RecoveryStrategyType.FALLBACK
      };

    } catch (fallbackError: any) {
      if (strategy.onRecoveryFailure) {
        strategy.onRecoveryFailure(originalError, 1);
      }

      return {
        success: false,
        error: originalError,
        attempts: 1,
        totalTime: 0,
        strategyUsed: RecoveryStrategyType.FALLBACK
      };
    }
  }

  private async executeCircuitBreakerStrategy<T>(
    operation: () => Promise<T>,
    originalError: ErrorResponse,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult<T>> {
    const errorKey = `${originalError.code}-${originalError.category}`;
    const recentFailures = this.getRecentFailures(errorKey, 5 * 60 * 1000); // 5 minutes

    if (recentFailures.length >= 5) {
      console.log(`🚫 Circuit breaker OPEN for error ${originalError.code}`);
      
      return {
        success: false,
        error: {
          ...originalError,
          message: 'Circuit breaker is open - too many recent failures'
        },
        attempts: 0,
        totalTime: 0,
        strategyUsed: RecoveryStrategyType.CIRCUIT_BREAKER
      };
    }

    // Circuit is closed, try the operation
    try {
      const result = await operation();
      
      return {
        success: true,
        result,
        attempts: 1,
        totalTime: 0,
        strategyUsed: RecoveryStrategyType.CIRCUIT_BREAKER
      };
    } catch (error: any) {
      return {
        success: false,
        error: originalError,
        attempts: 1,
        totalTime: 0,
        strategyUsed: RecoveryStrategyType.CIRCUIT_BREAKER
      };
    }
  }

  private async executeGracefulDegradationStrategy<T>(
    operation: () => Promise<T>,
    originalError: ErrorResponse,
    strategy: RecoveryStrategy
  ): Promise<RecoveryResult<T>> {
    console.log(`🔄 Attempting graceful degradation for error ${originalError.code}`);
    
    try {
      // Try a simplified/cached version
      if (strategy.fallbackFunction) {
        const result = await strategy.fallbackFunction();
        
        return {
          success: true,
          result,
          attempts: 1,
          totalTime: 0,
          strategyUsed: RecoveryStrategyType.GRACEFUL_DEGRADATION
        };
      }
    } catch (degradationError) {
      console.log('❌ Graceful degradation failed');
    }

    return {
      success: false,
      error: originalError,
      attempts: 1,
      totalTime: 0,
      strategyUsed: RecoveryStrategyType.GRACEFUL_DEGRADATION
    };
  }

  private async executeSkipStrategy<T>(
    originalError: ErrorResponse
  ): Promise<RecoveryResult<T>> {
    console.log(`⏭️ Skipping operation due to error ${originalError.code}`);
    
    return {
      success: true,
      result: undefined as any,
      attempts: 0,
      totalTime: 0,
      strategyUsed: RecoveryStrategyType.SKIP
    };
  }

  // ===== HELPER METHODS =====
  private findRecoveryConfig(error: ErrorResponse): RecoveryConfig | null {
    return this.recoveryConfigs.find(config => {
      // Check error codes
      if (!config.errorCodes.includes(error.code)) {
        return false;
      }

      // Check categories if specified
      if (config.categories && !config.categories.includes(error.category)) {
        return false;
      }

      // Check severities if specified
      if (config.severities && !config.severities.includes(error.severity)) {
        return false;
      }

      return true;
    }) || null;
  }

  private recordRecoveryAttempt(error: ErrorResponse, result: RecoveryResult): void {
    const key = `${error.code}-${error.category}`;
    
    if (!this.recoveryHistory.has(key)) {
      this.recoveryHistory.set(key, []);
    }

    const history = this.recoveryHistory.get(key)!;
    history.push({
      ...result,
      result: undefined // Don't store actual results to save memory
    });

    // Keep only last 100 attempts
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private getRecentFailures(errorKey: string, timeWindow: number): RecoveryResult[] {
    const history = this.recoveryHistory.get(errorKey) || [];
    const cutoffTime = Date.now() - timeWindow;
    
    return history.filter(result => 
      !result.success && (Date.now() - result.totalTime) > cutoffTime
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== DEFAULT STRATEGIES =====
  private initializeDefaultStrategies(): void {
    // Retry strategy for network errors
    this.addRecoveryConfig({
      errorCodes: [1101, 1102, 1103, 1104], // Network errors
      strategy: {
        type: RecoveryStrategyType.RETRY,
        maxAttempts: 3,
        baseDelay: 1000,
        backoffMultiplier: 2,
        shouldRecover: (error, attempt) => error.retryable && attempt <= 3
      }
    });

    // Retry strategy for blockchain timeouts
    this.addRecoveryConfig({
      errorCodes: [1009], // Transaction timeout
      strategy: {
        type: RecoveryStrategyType.RETRY,
        maxAttempts: 2,
        baseDelay: 5000,
        backoffMultiplier: 1.5
      }
    });

    // Skip strategy for already minted today
    this.addRecoveryConfig({
      errorCodes: [905], // Already minted today
      strategy: {
        type: RecoveryStrategyType.SKIP,
        onRecoverySuccess: (error, result) => {
          console.log('ℹ️ Skipped duplicate daily mint operation');
        }
      }
    });

    // Circuit breaker for critical system errors
    this.addRecoveryConfig({
      errorCodes: [1201], // Internal server error
      severities: [ErrorSeverity.CRITICAL],
      strategy: {
        type: RecoveryStrategyType.CIRCUIT_BREAKER,
        maxAttempts: 1
      }
    });
  }

  // ===== ANALYTICS =====
  getRecoveryStats(): {
    totalAttempts: number;
    successRate: number;
    avgAttempts: number;
    strategiesUsed: Record<RecoveryStrategyType, number>;
    topFailedErrors: Array<{ errorCode: number; failures: number }>;
  } {
    let totalAttempts = 0;
    let successfulRecoveries = 0;
    let totalRecoveryAttempts = 0;
    const strategiesUsed = {} as Record<RecoveryStrategyType, number>;
    const errorFailures = new Map<number, number>();

    for (const history of this.recoveryHistory.values()) {
      for (const result of history) {
        totalAttempts++;
        totalRecoveryAttempts += result.attempts;
        
        if (result.success) {
          successfulRecoveries++;
        } else if (result.error) {
          const count = errorFailures.get(result.error.code) || 0;
          errorFailures.set(result.error.code, count + 1);
        }

        strategiesUsed[result.strategyUsed] = (strategiesUsed[result.strategyUsed] || 0) + 1;
      }
    }

    const topFailedErrors = Array.from(errorFailures.entries())
      .map(([errorCode, failures]) => ({ errorCode, failures }))
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 10);

    return {
      totalAttempts,
      successRate: totalAttempts > 0 ? successfulRecoveries / totalAttempts : 0,
      avgAttempts: totalAttempts > 0 ? totalRecoveryAttempts / totalAttempts : 0,
      strategiesUsed,
      topFailedErrors
    };
  }

  // ===== UTILITIES =====
  reset(): void {
    this.recoveryHistory.clear();
  }
}

// ===== SINGLETON INSTANCE =====
export const errorRecoveryManager = ErrorRecoveryManager.getInstance();

// ===== HELPER FUNCTIONS =====
export async function withRecovery<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: any) => ErrorResponse,
  context?: any
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorResponse = errorHandler 
      ? errorHandler(error)
      : { code: 9999, message: error.message || 'Unknown error' } as ErrorResponse;

    const recoveryResult = await errorRecoveryManager.attemptRecovery(
      operation,
      errorResponse,
      context
    );

    if (recoveryResult.success) {
      return recoveryResult.result!;
    }

    throw recoveryResult.error || error;
  }
}

// ===== BLOCKCHAIN-SPECIFIC RECOVERY STRATEGIES =====
export const blockchainRecoveryStrategies: RecoveryConfig[] = [
  {
    errorCodes: [1001, 1002], // Mint/token account not found
    strategy: {
      type: RecoveryStrategyType.FALLBACK,
      fallbackFunction: async () => {
        console.log('🔄 Attempting to create missing accounts...');
        // Implementation would create the missing accounts
        return { created: true };
      }
    }
  },
  {
    errorCodes: [1007], // Insufficient SOL
    strategy: {
      type: RecoveryStrategyType.GRACEFUL_DEGRADATION,
      fallbackFunction: async () => {
        console.log('💰 Suggesting user to add SOL to wallet');
        return { suggestion: 'Please add SOL to your wallet for transaction fees' };
      }
    }
  }
]; 