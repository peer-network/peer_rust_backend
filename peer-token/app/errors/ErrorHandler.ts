import { PublicKey } from "@solana/web3.js";

// ===== ERROR SEVERITY LEVELS =====
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// ===== ERROR CATEGORIES =====
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  NETWORK = 'network',
  BLOCKCHAIN = 'blockchain',
  SYSTEM = 'system',
  EXTERNAL_SERVICE = 'external_service',
  CONFIGURATION = 'configuration',
  DATA = 'data'
}

// ===== ENHANCED ERROR CODES =====
export enum ErrorCode {
  // Authentication & Authorization (700-799)
  AUTHENTICATION_FAILED = 701,
  AUTHORIZATION_DENIED = 702,
  TOKEN_EXPIRED = 703,
  INVALID_CREDENTIALS = 704,
  SESSION_EXPIRED = 705,
  ACCESS_TOKEN_INVALID = 706,
  REFRESH_TOKEN_EXPIRED = 707,
  PERMISSION_DENIED = 708,

  // Validation Errors (800-899)
  VALIDATION_ERROR = 801,
  MISSING_REQUIRED_FIELD = 802,
  INVALID_FORMAT = 803,
  INVALID_RANGE = 804,
  INVALID_TYPE = 805,
  CONSTRAINT_VIOLATION = 806,
  DUPLICATE_VALUE = 807,
  INVALID_ENUM_VALUE = 808,

  // Business Logic (900-999)
  INSUFFICIENT_BALANCE = 901,
  DAILY_LIMIT_EXCEEDED = 902,
  OPERATION_NOT_ALLOWED = 903,
  RESOURCE_LOCKED = 904,
  ALREADY_MINTED_TODAY = 905,
  INVALID_OPERATION_STATE = 906,
  BUSINESS_RULE_VIOLATION = 907,
  QUOTA_EXCEEDED = 908,

  // Blockchain Specific (1000-1099)
  MINT_NOT_FOUND = 1001,
  TOKEN_ACCOUNT_NOT_FOUND = 1002,
  TRANSACTION_FAILED = 1003,
  WALLET_NOT_CONNECTED = 1004,
  METADATA_NOT_FOUND = 1005,
  INVALID_MINT = 1006,
  INSUFFICIENT_SOL = 1007,
  BLOCKHASH_NOT_FOUND = 1008,
  TRANSACTION_TIMEOUT = 1009,
  COMPUTE_BUDGET_EXCEEDED = 1010,
  PROGRAM_ERROR = 1011,

  // Network & Connection (1100-1199)
  CONNECTION_FAILED = 1101,
  CONNECTION_TIMEOUT = 1102,
  NETWORK_ERROR = 1103,
  RPC_ERROR = 1104,
  RATE_LIMIT_EXCEEDED = 1105,
  SERVICE_UNAVAILABLE = 1106,

  // System Errors (1200-1299)
  INTERNAL_SERVER_ERROR = 1201,
  CONFIGURATION_ERROR = 1202,
  MAINTENANCE_MODE = 1203,
  RESOURCE_NOT_FOUND = 1204,
  RESOURCE_ALREADY_EXISTS = 1205,
  FILE_NOT_FOUND = 1206,
  DISK_SPACE_ERROR = 1207,
  MEMORY_ERROR = 1208,

  // External Service Errors (1300-1399)
  EXTERNAL_SERVICE_ERROR = 1301,
  API_ERROR = 1302,
  THIRD_PARTY_SERVICE_DOWN = 1303,
  INTEGRATION_ERROR = 1304,

  // Wallet/File System (1400-1499)
  WALLET_NOT_FOUND = 1401,
  INVALID_WALLET_FORMAT = 1402,
  WALLET_LOCKED = 1403,
  KEYPAIR_GENERATION_FAILED = 1404,

  // Unknown (9999)
  UNKNOWN_ERROR = 9999
}

// ===== ON-CHAIN ERROR CODES =====
export enum OnChainErrorCode {
  INVALID_MINT = 6000,
  INVALID_MINT_AUTHORITY = 6001,
  INVALID_OWNER = 6002,
  INVALID_TRANSFER_AMOUNT = 6003,
  INSUFFICIENT_PEER_TOKENS = 6004,
  INVALID_TOKEN_DECIMALS = 6005,
  INVALID_TOKEN_METADATA = 6006,
  METADATA_CREATION_FAILED = 6007,
  ALREADY_MINTED_TODAY = 6008,
  INVALID_DAILY_MINT_AMOUNT = 6009,
  UNAUTHORIZED_MINT_OPERATION = 6010
}

// ===== ERROR CONTEXT INTERFACE =====
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  transactionId?: string;
  operationId?: string;
  walletAddress?: string;
  mintAddress?: string;
  tokenAccount?: string;
  amount?: number | string;
  [key: string]: any;
}

// ===== ENHANCED ERROR RESPONSE INTERFACE =====
export interface ErrorResponse {
  // Core Error Info
  code: number;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  
  // Technical Details
  onChainCode?: number;
  originalError?: string;
  stackTrace?: string;
  
  // Context & Metadata
  context?: ErrorContext;
  timestamp: string;
  
  // Recovery & Support
  recoverable: boolean;
  retryable: boolean;
  retryAfter?: number;
  supportReferenceId: string;
  
  // User Guidance
  userMessage: string;
  suggestedActions?: string[];
  
  // Monitoring
  correlationId?: string;
  tags?: string[];
}

// ===== ERROR METRICS INTERFACE =====
export interface ErrorMetrics {
  errorCode: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  count: number;
  timestamp: string;
  responseTime?: number;
}

// ===== CIRCUIT BREAKER STATE =====
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

// ===== CIRCUIT BREAKER CLASS =====
class CircuitBreaker {
  private failureCount = 0;
  private state = CircuitBreakerState.CLOSED;
  private lastFailureTime?: number;

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - (this.lastFailureTime || 0) > this.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
      } else {
        throw ErrorFactory.serviceUnavailable('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  private reset(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
  }
}

// ===== RETRY STRATEGY =====
class RetryStrategy {
  static async exponentialBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Check if error is retryable
        const errorResponse = ErrorHandler.handle(error);
        if (!errorResponse.retryable) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

// ===== ADVANCED ERROR FACTORY =====
class ErrorFactory {
  private static generateSupportReferenceId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  public static createBaseError(
    code: ErrorCode,
    message: string,
    userMessage: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    options: {
      recoverable?: boolean;
      retryable?: boolean;
      retryAfter?: number;
      context?: ErrorContext;
      onChainCode?: number;
      originalError?: string;
      suggestedActions?: string[];
      tags?: string[];
    } = {}
  ): ErrorResponse {
    return {
      code,
      message,
      userMessage,
      category,
      severity,
               onChainCode: options.onChainCode ?? undefined,
      originalError: options.originalError,
      context: options.context,
      timestamp: new Date().toISOString(),
      recoverable: options.recoverable ?? false,
      retryable: options.retryable ?? false,
      retryAfter: options.retryAfter,
      supportReferenceId: this.generateSupportReferenceId(),
      suggestedActions: options.suggestedActions,
      tags: options.tags
    };
  }

  // ===== AUTHENTICATION ERRORS =====
  static authenticationFailed(reason?: string, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.AUTHENTICATION_FAILED,
      `Authentication failed${reason ? `: ${reason}` : ''}`,
      'Authentication failed. Please check your credentials and try again.',
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      {
        context,
        recoverable: true,
        suggestedActions: ['Check your credentials', 'Try logging in again', 'Contact support if the issue persists']
      }
    );
  }

  static tokenExpired(context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.TOKEN_EXPIRED,
      'Authentication token has expired',
      'Your session has expired. Please log in again.',
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.MEDIUM,
      {
        context,
        recoverable: true,
        suggestedActions: ['Log in again', 'Refresh your session']
      }
    );
  }

  // ===== VALIDATION ERRORS =====
  static validationError(
    field: string, 
    value?: any, 
    constraint?: string,
    context?: ErrorContext
  ): ErrorResponse {
    return this.createBaseError(
      ErrorCode.VALIDATION_ERROR,
      `Invalid ${field}${constraint ? `: ${constraint}` : ''}`,
      `Please check the ${field} field and correct any errors.`,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      {
        context: { ...context, field, value, constraint },
        recoverable: true,
        suggestedActions: [`Correct the ${field} field`, 'Check the required format', 'Try again']
      }
    );
  }

  static missingRequiredField(field: string, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.MISSING_REQUIRED_FIELD,
      `Required field '${field}' is missing`,
      `The ${field} field is required. Please provide a value.`,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      {
        context: { ...context, field },
        recoverable: true,
        suggestedActions: [`Provide a value for ${field}`, 'Check all required fields']
      }
    );
  }

  // ===== BLOCKCHAIN ERRORS =====
  static transactionFailed(
    operation: string, 
    error: any, 
    txSignature?: string,
    context?: ErrorContext
  ): ErrorResponse {
    const isRetryable = this.isRetryableBlockchainError(error);
    
    return this.createBaseError(
      ErrorCode.TRANSACTION_FAILED,
      `Transaction failed during ${operation}`,
      this.getUserFriendlyBlockchainMessage(error),
      ErrorCategory.BLOCKCHAIN,
      ErrorSeverity.HIGH,
      {
        context: { ...context, operation, txSignature },
        originalError: error?.message,
        recoverable: true,
        retryable: isRetryable,
        retryAfter: isRetryable ? 5 : undefined,
        suggestedActions: this.getBlockchainErrorActions(error)
      }
    );
  }

  static insufficientBalance(
    required: number, 
    available: number, 
    currency: string = 'tokens',
    context?: ErrorContext
  ): ErrorResponse {
    return this.createBaseError(
      ErrorCode.INSUFFICIENT_BALANCE,
      `Insufficient ${currency}. Required: ${required}, Available: ${available}`,
      `You don't have enough ${currency}. You need ${required} but only have ${available}.`,
      ErrorCategory.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      {
        context: { ...context, required, available, currency },
        recoverable: true,
        suggestedActions: [
          `Add more ${currency} to your account`,
          'Reduce the transaction amount',
          'Check your balance'
        ]
      }
    );
  }

  static dailyLimitExceeded(limit: number, attempted: number, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.DAILY_LIMIT_EXCEEDED,
      `Daily limit exceeded. Limit: ${limit}, Attempted: ${attempted}`,
      'You have reached your daily limit. Please try again tomorrow.',
      ErrorCategory.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      {
        context: { ...context, limit, attempted },
        recoverable: false,
        retryAfter: this.getSecondsUntilTomorrow(),
        suggestedActions: ['Wait until tomorrow', 'Contact support for limit increase']
      }
    );
  }

  // ===== NETWORK ERRORS =====
  static connectionFailed(endpoint: string, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.CONNECTION_FAILED,
      `Failed to connect to ${endpoint}`,
      'Unable to connect to the network. Please check your internet connection.',
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      {
        context: { ...context, endpoint },
        recoverable: true,
        retryable: true,
        retryAfter: 5,
        suggestedActions: [
          'Check your internet connection',
          'Try again in a few seconds',
          'Switch to a different network'
        ]
      }
    );
  }

  static rateLimitExceeded(service: string, retryAfter?: number, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded for ${service}`,
      'Too many requests. Please wait a moment before trying again.',
      ErrorCategory.NETWORK,
      ErrorSeverity.MEDIUM,
      {
        context: { ...context, service },
        recoverable: true,
        retryable: true,
        retryAfter: retryAfter || 60,
        suggestedActions: ['Wait before trying again', 'Reduce request frequency']
      }
    );
  }

  // ===== BLOCKCHAIN LEGACY METHODS =====
  static mintNotFound(mintAddress: any, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.MINT_NOT_FOUND,
      `Token mint not found: ${mintAddress?.toString?.() || mintAddress}`,
      "The token you're trying to use doesn't exist or is invalid.",
      ErrorCategory.BLOCKCHAIN,
      ErrorSeverity.HIGH,
      {
        context: { ...context, mintAddress: mintAddress?.toString?.() || mintAddress },
        recoverable: false,
        suggestedActions: ['Check the token address', 'Verify the token exists', 'Contact support']
      }
    );
  }

  static tokenAccountNotFound(tokenAddress: any, owner: any, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.TOKEN_ACCOUNT_NOT_FOUND,
      `Token account not found for owner: ${owner?.toString?.() || owner}`,
      "Your wallet doesn't have an account for this token yet.",
      ErrorCategory.BLOCKCHAIN,
      ErrorSeverity.MEDIUM,
      {
        context: { 
          ...context, 
          tokenAddress: tokenAddress?.toString?.() || tokenAddress, 
          owner: owner?.toString?.() || owner 
        },
        recoverable: true,
        suggestedActions: ['Create a token account', 'Check wallet connection', 'Try the operation again']
      }
    );
  }

  // ===== SYSTEM ERRORS =====
  static internalServerError(operation: string, error?: any, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      `Internal server error during ${operation}`,
      'An unexpected error occurred. Our team has been notified.',
      ErrorCategory.SYSTEM,
      ErrorSeverity.CRITICAL,
      {
        context: { ...context, operation },
        originalError: error?.message,
        recoverable: false,
        retryable: true,
        retryAfter: 30,
        suggestedActions: [
          'Try again in a few minutes',
          'Contact support with reference ID',
          'Check service status'
        ]
      }
    );
  }

  static serviceUnavailable(reason?: string, context?: ErrorContext): ErrorResponse {
    return this.createBaseError(
      ErrorCode.SERVICE_UNAVAILABLE,
      `Service unavailable${reason ? `: ${reason}` : ''}`,
      'The service is temporarily unavailable. Please try again later.',
      ErrorCategory.SYSTEM,
      ErrorSeverity.HIGH,
      {
        context,
        recoverable: true,
        retryable: true,
        retryAfter: 60,
        suggestedActions: [
          'Try again later',
          'Check service status',
          'Contact support if problem persists'
        ]
      }
    );
  }

  // ===== HELPER METHODS =====
  private static isRetryableBlockchainError(error: any): boolean {
    if (!error?.message) return false;
    
    const retryablePatterns = [
      'timeout',
      'blockhash not found',
      'network',
      'connection',
      'temporary'
    ];
    
    return retryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  private static getUserFriendlyBlockchainMessage(error: any): string {
    if (!error?.message) return 'Transaction failed. Please try again.';
    
    const message = error.message.toLowerCase();
    
    if (message.includes('insufficient funds for fee')) {
      return "You don't have enough SOL to pay for this transaction. Please add some SOL to your wallet.";
    }
    if (message.includes('blockhash not found')) {
      return "Network is busy. Please try your transaction again.";
    }
    if (message.includes('timeout')) {
      return "Transaction is taking longer than expected. Please try again.";
    }
    if (message.includes('compute budget')) {
      return "Transaction is too complex. Please try breaking it into smaller steps.";
    }
    
    return 'Transaction failed. Please try again or contact support if the problem persists.';
  }

  private static getBlockchainErrorActions(error: any): string[] {
    if (!error?.message) return ['Try again', 'Contact support'];
    
    const message = error.message.toLowerCase();
    
    if (message.includes('insufficient funds for fee')) {
      return ['Add SOL to your wallet', 'Check your SOL balance'];
    }
    if (message.includes('blockhash not found')) {
      return ['Try again in a few seconds', 'Check network status'];
    }
    if (message.includes('timeout')) {
      return ['Try again', 'Check your connection', 'Wait a moment'];
    }
    
    return ['Try again', 'Check transaction details', 'Contact support'];
  }

  private static getSecondsUntilTomorrow(): number {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
  }
}

// ===== ERROR LOGGER =====
class ErrorLogger {
  private static metrics: ErrorMetrics[] = [];

  static log(error: ErrorResponse, duration?: number): void {
    // Console logging with proper formatting
    console.error(`\n🚨 ERROR [${error.code}] - ${error.category.toUpperCase()}`);
    console.error(`📝 Message: ${error.message}`);
    console.error(`👤 User Message: ${error.userMessage}`);
    console.error(`🏷️  Severity: ${error.severity.toUpperCase()}`);
    console.error(`🔄 Recoverable: ${error.recoverable ? 'Yes' : 'No'}`);
    console.error(`🔁 Retryable: ${error.retryable ? 'Yes' : 'No'}`);
    console.error(`🆔 Reference: ${error.supportReferenceId}`);
    console.error(`🕐 Timestamp: ${error.timestamp}`);
    
    if (error.context) {
      console.error(`📋 Context:`, JSON.stringify(error.context, null, 2));
    }
    
    if (error.suggestedActions) {
      console.error(`💡 Suggested Actions:`);
      error.suggestedActions.forEach((action, index) => {
        console.error(`   ${index + 1}. ${action}`);
      });
    }
    
    if (error.originalError) {
      console.error(`🔍 Original Error: ${error.originalError}`);
    }
    
    console.error('─'.repeat(80));

    // Record metrics
    this.recordMetrics(error, duration);
  }

  private static recordMetrics(error: ErrorResponse, duration?: number): void {
    this.metrics.push({
      errorCode: error.code,
      category: error.category,
      severity: error.severity,
      count: 1,
      timestamp: error.timestamp,
      responseTime: duration
    });
  }

  static getMetrics(): ErrorMetrics[] {
    return [...this.metrics];
  }

  static clearMetrics(): void {
    this.metrics = [];
  }
}

// ===== MAIN ERROR HANDLER =====
export class ErrorHandler {
  private static circuitBreaker = new CircuitBreaker();

  static handle(error: any, context?: ErrorContext): ErrorResponse {
    const startTime = Date.now();
    
    try {
      let errorResponse: ErrorResponse;

      // Handle our ErrorResponse objects
      if (this.isErrorResponse(error)) {
        errorResponse = error;
      }
      // Handle on-chain errors
      else if (this.hasOnChainError(error)) {
        errorResponse = this.handleOnChainError(error, context);
      }
      // Handle standard errors
      else if (error instanceof Error) {
        errorResponse = this.handleStandardError(error, context);
      }
      // Handle unknown errors
      else {
        errorResponse = this.handleUnknownError(error, context);
      }

      // Log the error
      const duration = Date.now() - startTime;
      ErrorLogger.log(errorResponse, duration);

      return errorResponse;
    } catch (handlingError) {
      // Fallback error if error handling itself fails
      const fallbackError = ErrorFactory.internalServerError(
        'error handling',
        handlingError,
        context
      );
      ErrorLogger.log(fallbackError);
      return fallbackError;
    }
  }

  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    context?: ErrorContext,
    maxRetries: number = 3
  ): Promise<T> {
    return RetryStrategy.exponentialBackoff(async () => {
      try {
        return await this.circuitBreaker.execute(operation);
      } catch (error) {
        const errorResponse = this.handle(error, context);
        throw errorResponse;
      }
    }, maxRetries);
  }

  private static isErrorResponse(error: any): error is ErrorResponse {
    return error && 
           typeof error === 'object' && 
           typeof error.code === 'number' && 
           typeof error.message === 'string' &&
           typeof error.category === 'string';
  }

  private static hasOnChainError(error: any): boolean {
    return this.extractOnChainErrorCode(error) !== null;
  }

  private static extractOnChainErrorCode(error: any): number | null {
    if (error?.code && typeof error.code === 'number' && error.code >= 6000) {
      return error.code;
    }
    
    if (error?.logs && Array.isArray(error.logs)) {
      for (const log of error.logs) {
        const match = log.match(/Error Number: (\d+)/);
        if (match) {
          const code = parseInt(match[1]);
          if (code >= 6000) return code;
        }
      }
    }
    
    if (error?.error?.code && typeof error.error.code === 'number' && error.error.code >= 6000) {
      return error.error.code;
    }
    
    return null;
  }

  private static handleOnChainError(error: any, context?: ErrorContext): ErrorResponse {
    const onChainCode = this.extractOnChainErrorCode(error);
    const message = this.getOnChainErrorMessage(onChainCode!);
    
    let errorCode = ErrorCode.PROGRAM_ERROR;
    let severity = ErrorSeverity.HIGH;
    
    switch (onChainCode) {
      case OnChainErrorCode.INSUFFICIENT_PEER_TOKENS:
        errorCode = ErrorCode.INSUFFICIENT_BALANCE;
        severity = ErrorSeverity.MEDIUM;
        break;
      case OnChainErrorCode.ALREADY_MINTED_TODAY:
        errorCode = ErrorCode.ALREADY_MINTED_TODAY;
        severity = ErrorSeverity.LOW;
        break;
      default:
        errorCode = ErrorCode.PROGRAM_ERROR;
    }
    
    return ErrorFactory.createBaseError(
      errorCode,
      message,
      this.getUserFriendlyOnChainMessage(onChainCode!),
      ErrorCategory.BLOCKCHAIN,
      severity,
             {
         context,
         onChainCode: onChainCode ?? undefined,
         originalError: error?.message,
         recoverable: true,
         retryable: this.isRetryableOnChainError(onChainCode!),
         suggestedActions: this.getOnChainErrorActions(onChainCode!)
       }
    );
  }

  private static getOnChainErrorMessage(code: number): string {
    switch (code) {
      case OnChainErrorCode.INVALID_MINT:
        return "Invalid mint address provided";
      case OnChainErrorCode.INVALID_MINT_AUTHORITY:
        return "Invalid mint authority";
      case OnChainErrorCode.INVALID_OWNER:
        return "Invalid token account owner";
      case OnChainErrorCode.INVALID_TRANSFER_AMOUNT:
        return "Invalid transfer amount";
      case OnChainErrorCode.INSUFFICIENT_PEER_TOKENS:
        return "Insufficient PEER token balance";
      case OnChainErrorCode.INVALID_TOKEN_DECIMALS:
        return "Invalid token decimals";
      case OnChainErrorCode.INVALID_TOKEN_METADATA:
        return "Invalid token metadata";
      case OnChainErrorCode.METADATA_CREATION_FAILED:
        return "Failed to create token metadata";
      case OnChainErrorCode.ALREADY_MINTED_TODAY:
        return "Tokens have already been minted today";
      default:
        return `Unknown on-chain error: ${code}`;
    }
  }

  private static getUserFriendlyOnChainMessage(code: number): string {
    switch (code) {
      case OnChainErrorCode.INSUFFICIENT_PEER_TOKENS:
        return "You don't have enough PEER tokens for this operation.";
      case OnChainErrorCode.ALREADY_MINTED_TODAY:
        return "Daily tokens have already been minted. Try again tomorrow.";
      case OnChainErrorCode.INVALID_MINT:
        return "The token you're trying to use is invalid.";
      case OnChainErrorCode.METADATA_CREATION_FAILED:
        return "Failed to create token information. Please try again.";
      default:
        return "A blockchain error occurred. Please try again.";
    }
  }

  private static isRetryableOnChainError(code: number): boolean {
    const retryableCodes = [
      OnChainErrorCode.METADATA_CREATION_FAILED
    ];
    return retryableCodes.includes(code);
  }

  private static getOnChainErrorActions(code: number): string[] {
    switch (code) {
      case OnChainErrorCode.INSUFFICIENT_PEER_TOKENS:
        return ['Check your PEER token balance', 'Add more PEER tokens', 'Reduce transaction amount'];
      case OnChainErrorCode.ALREADY_MINTED_TODAY:
        return ['Wait until tomorrow', 'Check daily mint schedule'];
      case OnChainErrorCode.INVALID_MINT:
        return ['Check token address', 'Contact support'];
      default:
        return ['Try again', 'Contact support with error details'];
    }
  }

  private static handleStandardError(error: Error, context?: ErrorContext): ErrorResponse {
    const message = error.message.toLowerCase();
    
    // Blockchain-specific patterns
    if (message.includes('already minted today') || message.includes('alreadymintedtoday')) {
      return ErrorFactory.dailyLimitExceeded(1, 1, context);
    }
    
    if (message.includes('insufficient funds for fee')) {
      return ErrorFactory.insufficientBalance(0, 0, 'SOL', context);
    }
    
    if (message.includes('timeout')) {
      return ErrorFactory.transactionFailed('operation', error, undefined, context);
    }
    
    if (message.includes('connection') || message.includes('network')) {
      return ErrorFactory.connectionFailed('Solana network', context);
    }

    // Generic error
    return ErrorFactory.internalServerError('unknown operation', error, context);
  }

  private static handleUnknownError(error: any, context?: ErrorContext): ErrorResponse {
    return ErrorFactory.internalServerError('unknown operation', error, context);
  }
}

// ===== ENHANCED VALIDATORS =====
export class Validators {
  static required<T>(value: T | null | undefined, fieldName: string): T {
    if (value === null || value === undefined) {
      throw ErrorFactory.missingRequiredField(fieldName);
    }
    return value;
  }

  static publicKey(value: string | PublicKey, fieldName: string): PublicKey {
    try {
      return typeof value === 'string' ? new PublicKey(value) : value;
    } catch (error) {
      throw ErrorFactory.validationError(fieldName, value, 'must be a valid public key');
    }
  }

  static positiveNumber(amount: number | string, fieldName: string = 'amount'): number {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || numAmount <= 0) {
      throw ErrorFactory.validationError(fieldName, amount, 'must be a positive number');
    }
    
    return numAmount;
  }

  static range(value: number, min: number, max: number, fieldName: string): number {
    if (value < min || value > max) {
      throw ErrorFactory.validationError(fieldName, value, `must be between ${min} and ${max}`);
    }
    return value;
  }

  static email(email: string, fieldName: string = 'email'): string {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw ErrorFactory.validationError(fieldName, email, 'must be a valid email address');
    }
    return email;
  }

  static url(url: string, fieldName: string = 'url'): string {
    try {
      new URL(url);
      return url;
    } catch {
      throw ErrorFactory.validationError(fieldName, url, 'must be a valid URL');
    }
  }

  static minLength(value: string, minLength: number, fieldName: string): string {
    if (value.length < minLength) {
      throw ErrorFactory.validationError(fieldName, value, `must be at least ${minLength} characters`);
    }
    return value;
  }

  static maxLength(value: string, maxLength: number, fieldName: string): string {
    if (value.length > maxLength) {
      throw ErrorFactory.validationError(fieldName, value, `must be no more than ${maxLength} characters`);
    }
    return value;
  }
}

// ===== EXPORTS =====
export { 
  ErrorFactory, 
  ErrorLogger, 
  RetryStrategy, 
  CircuitBreaker
}; 