import { PublicKey } from "@solana/web3.js";

// Simple Error Codes
export enum ErrorCode {
  UNKNOWN_ERROR = 1,
  CONNECTION_FAILED = 101,
  WALLET_NOT_FOUND = 201,
  MINT_NOT_FOUND = 301,
  TOKEN_ACCOUNT_NOT_FOUND = 302,
  INSUFFICIENT_BALANCE = 303,
  METADATA_NOT_FOUND = 401,
  TRANSACTION_FAILED = 601,
  ALREADY_MINTED_TODAY = 602,
  VALIDATION_ERROR = 701,
  AUTHENTICATION_FAILED = 702,
  AUTHORIZATION_DENIED = 703,
  TOKEN_EXPIRED = 704,
  MISSING_REQUIRED_FIELD = 705,
  INVALID_FORMAT = 706,
  OPERATION_NOT_ALLOWED = 707,
  DAILY_LIMIT_EXCEEDED = 708,
  RESOURCE_NOT_FOUND = 709,
  RESOURCE_ALREADY_EXISTS = 710,
  RESOURCE_LOCKED = 711,
  CONNECTION_TIMEOUT = 712,
  EXTERNAL_SERVICE_ERROR = 713,
  RATE_LIMIT_EXCEEDED = 714,
  WALLET_NOT_CONNECTED = 715,
  INTERNAL_SERVER_ERROR = 716,
  CONFIGURATION_ERROR = 717,
  MAINTENANCE_MODE = 718,
}

// On-chain error codes from the Rust program
export enum OnChainErrorCode {
  INVALID_MINT = 6000,
  INVALID_MINT_AUTHORITY = 6001,
  INVALID_OWNER = 6002,
  INVALID_TRANSFER_AMOUNT = 6003,
  INSUFFICIENT_PEER_TOKENS = 6004,
  INVALID_TOKEN_DECIMALS = 6005,
  INVALID_TOKEN_METADATA = 6006,
  METADATA_CREATION_FAILED = 6007
}

// Simple Error Response Interface
export interface ErrorResponse {
  code: number;
  message: string;
  details?: any;
  onChainCode?: number; // Add on-chain error code tracking
}

// Helper function to get human-readable messages for on-chain errors
function getOnChainErrorMessage(code: number): string {
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
    default:
      return `Unknown on-chain error: ${code}`;
  }
}

// Helper function to detect on-chain error codes
function extractOnChainErrorCode(error: any): number | null {
  // Check if error object has a code property (direct Anchor error)
  if (error?.code && typeof error.code === 'number' && error.code >= 6000) {
    return error.code;
  }
  
  // Check in logs for error numbers
  if (error?.logs && Array.isArray(error.logs)) {
    for (const log of error.logs) {
      const match = log.match(/Error Number: (\d+)/);
      if (match) {
        const code = parseInt(match[1]);
        if (code >= 6000) return code;
      }
    }
  }
  
  // Check in nested error structures
  if (error?.error?.code && typeof error.error.code === 'number' && error.error.code >= 6000) {
    return error.error.code;
  }
  
  return null;
}

// Production-level Error Factory
export const ErrorFactory = {
  // Authentication & Authorization
  authenticationFailed: (reason?: string): ErrorResponse => ({
    code: ErrorCode.AUTHENTICATION_FAILED,
    message: `Authentication failed${reason ? `: ${reason}` : ''}`,
    details: { reason, timestamp: new Date().toISOString() }
  }),

  authorizationDenied: (resource: string, action: string): ErrorResponse => ({
    code: ErrorCode.AUTHORIZATION_DENIED,
    message: `Access denied: insufficient permissions to ${action} ${resource}`,
    details: { resource, action, timestamp: new Date().toISOString() }
  }),

  tokenExpired: (): ErrorResponse => ({
    code: ErrorCode.TOKEN_EXPIRED,
    message: 'Authentication token has expired. Please log in again.',
    details: { timestamp: new Date().toISOString() }
  }),

  // Input Validation
  validationError: (field: string, value?: any, constraint?: string): ErrorResponse => ({
    code: ErrorCode.VALIDATION_ERROR,
    message: `Invalid ${field}${constraint ? `: ${constraint}` : ''}`,
    details: { field, value, constraint, timestamp: new Date().toISOString() }
  }),

  missingRequiredField: (field: string): ErrorResponse => ({
    code: ErrorCode.MISSING_REQUIRED_FIELD,
    message: `Required field '${field}' is missing`,
    details: { field, timestamp: new Date().toISOString() }
  }),

  invalidFormat: (field: string, expectedFormat: string): ErrorResponse => ({
    code: ErrorCode.INVALID_FORMAT,
    message: `Invalid format for '${field}'. Expected: ${expectedFormat}`,
    details: { field, expectedFormat, timestamp: new Date().toISOString() }
  }),

  // Business Logic
  insufficientBalance: (required: number, available: number, currency: string = 'tokens'): ErrorResponse => ({
    code: ErrorCode.INSUFFICIENT_BALANCE,
    message: `Insufficient ${currency}. Required: ${required}, Available: ${available}`,
    details: { required, available, currency, timestamp: new Date().toISOString() }
  }),

  operationNotAllowed: (operation: string, reason: string): ErrorResponse => ({
    code: ErrorCode.OPERATION_NOT_ALLOWED,
    message: `Operation '${operation}' is not allowed: ${reason}`,
    details: { operation, reason, timestamp: new Date().toISOString() }
  }),

  dailyLimitExceeded: (limit: number, attempted: number): ErrorResponse => ({
    code: ErrorCode.DAILY_LIMIT_EXCEEDED,
    message: `Daily limit exceeded. Limit: ${limit}, Attempted: ${attempted}`,
    details: { limit, attempted, resetTime: 'tomorrow', timestamp: new Date().toISOString() }
  }),

  // Resource Management
  resourceNotFound: (resource: string, identifier: string): ErrorResponse => ({
    code: ErrorCode.RESOURCE_NOT_FOUND,
    message: `${resource} not found: ${identifier}`,
    details: { resource, identifier, timestamp: new Date().toISOString() }
  }),

  resourceAlreadyExists: (resource: string, identifier: string): ErrorResponse => ({
    code: ErrorCode.RESOURCE_ALREADY_EXISTS,
    message: `${resource} already exists: ${identifier}`,
    details: { resource, identifier, timestamp: new Date().toISOString() }
  }),

  resourceLocked: (resource: string, identifier: string, lockReason?: string): ErrorResponse => ({
    code: ErrorCode.RESOURCE_LOCKED,
    message: `${resource} is locked: ${identifier}${lockReason ? ` (${lockReason})` : ''}`,
    details: { resource, identifier, lockReason, timestamp: new Date().toISOString() }
  }),

  // Network & External Services
  connectionTimeout: (service: string, timeoutMs: number): ErrorResponse => ({
    code: ErrorCode.CONNECTION_TIMEOUT,
    message: `Connection to ${service} timed out after ${timeoutMs}ms`,
    details: { service, timeoutMs, timestamp: new Date().toISOString() }
  }),

  externalServiceError: (service: string, statusCode?: number, message?: string): ErrorResponse => ({
    code: ErrorCode.EXTERNAL_SERVICE_ERROR,
    message: `External service error from ${service}${statusCode ? ` (${statusCode})` : ''}${message ? `: ${message}` : ''}`,
    details: { service, statusCode, externalMessage: message, timestamp: new Date().toISOString() }
  }),

  rateLimitExceeded: (service: string, retryAfter?: number): ErrorResponse => ({
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    message: `Rate limit exceeded for ${service}${retryAfter ? `. Retry after ${retryAfter} seconds` : ''}`,
    details: { service, retryAfter, timestamp: new Date().toISOString() }
  }),

  // Blockchain-specific Errors  
  mintNotFound: (mintAddress: PublicKey): ErrorResponse => ({
    code: ErrorCode.MINT_NOT_FOUND,
    message: `Token mint not found: ${mintAddress.toString()}`,
    details: { mintAddress: mintAddress.toString(), timestamp: new Date().toISOString() }
  }),

  tokenAccountNotFound: (tokenAddress: PublicKey, owner: PublicKey): ErrorResponse => ({
    code: ErrorCode.TOKEN_ACCOUNT_NOT_FOUND,
    message: `Token account not found for owner: ${owner.toString()}`,
    details: { tokenAddress: tokenAddress.toString(), owner: owner.toString(), timestamp: new Date().toISOString() }
  }),

  transactionFailed: (operation: string, error: any, txSignature?: string): ErrorResponse => ({
    code: ErrorCode.TRANSACTION_FAILED,
    message: `Transaction failed during ${operation}: ${error?.message || 'Unknown blockchain error'}`,
    details: { 
      operation, 
      originalError: error?.message, 
      txSignature,
      logs: error?.logs,
      timestamp: new Date().toISOString() 
    }
  }),

  walletNotConnected: (): ErrorResponse => ({
    code: ErrorCode.WALLET_NOT_CONNECTED,
    message: 'Wallet is not connected. Please connect your wallet to continue.',
    details: { timestamp: new Date().toISOString() }
  }),

  // System Errors
  internalServerError: (operation: string, error?: any): ErrorResponse => ({
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message: `Internal server error during ${operation}`,
    details: { 
      operation, 
      errorId: Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString()
    }
  }),

  configurationError: (setting: string, issue: string): ErrorResponse => ({
    code: ErrorCode.CONFIGURATION_ERROR,
    message: `Configuration error for '${setting}': ${issue}`,
    details: { setting, issue, timestamp: new Date().toISOString() }
  }),

  maintenanceMode: (estimatedEndTime?: string): ErrorResponse => ({
    code: ErrorCode.MAINTENANCE_MODE,
    message: `Service is currently under maintenance${estimatedEndTime ? `. Expected completion: ${estimatedEndTime}` : ''}`,
    details: { estimatedEndTime, timestamp: new Date().toISOString() }
  }),

  // Legacy compatibility methods
  alreadyMintedToday: (): ErrorResponse => ({
    code: ErrorCode.DAILY_LIMIT_EXCEEDED,
    message: "Tokens have already been minted today. Try again tomorrow.",
    details: { timestamp: new Date().toISOString() }
  }),

  walletNotFound: (path: string): ErrorResponse => ({
    code: ErrorCode.WALLET_NOT_FOUND,
    message: `Wallet file not found: ${path}`,
    details: { path, timestamp: new Date().toISOString() }
  }),

  connectionFailed: (endpoint: string): ErrorResponse => ({
    code: ErrorCode.CONNECTION_FAILED,
    message: `Failed to connect to Solana RPC: ${endpoint}`,
    details: { endpoint, timestamp: new Date().toISOString() }
  })
};

// Simple Error Handler Class
export class ErrorHandler {
  static handle(error: any): ErrorResponse {
    // Handle our ErrorFactory responses
    if (error && typeof error === 'object' && error.code && error.message) {
      console.error(`Error [${error.code}]: ${error.message}`);
      if (error.details) {
        console.error("Details:", JSON.stringify(error.details, null, 2));
      }
      return error;
    }

    // Check for on-chain error codes first
    const onChainCode = extractOnChainErrorCode(error);
    if (onChainCode !== null) {
      const message = getOnChainErrorMessage(onChainCode);
      
      // Map specific on-chain errors to our error codes
      let errorCode = ErrorCode.TRANSACTION_FAILED;
      if (onChainCode === OnChainErrorCode.INSUFFICIENT_PEER_TOKENS) {
        errorCode = ErrorCode.INSUFFICIENT_BALANCE;
      }
      
      const response: ErrorResponse = {
        code: errorCode,
        message: message,
        onChainCode: onChainCode,
        details: { 
          originalError: error?.message,
          logs: error?.logs 
        }
      };
      
      console.error(`On-Chain Error [${onChainCode}]: ${message}`);
      if (error?.logs) {
        console.error("Transaction logs:", error.logs);
      }
      
      return response;
    }

    // Handle standard Error objects with user-friendly messages
    if (error instanceof Error) {
      // Check for specific error patterns
      const message = error.message.toLowerCase();
      
      if (message.includes('already minted today') || message.includes('alreadymintedtoday')) {
        const response = ErrorFactory.dailyLimitExceeded(1, 1);
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      // Solana-specific error patterns with user-friendly messages
      if (message.includes('timeout') && (message.includes('transaction') || message.includes('confirmation'))) {
        const response = {
          code: ErrorCode.TRANSACTION_FAILED,
          message: "Transaction is taking longer than expected. Please try again.",
          details: { originalError: error.message, errorType: "timeout" }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      if (message.includes('blockhash not found') || (message.includes('blockhash') && message.includes('not found'))) {
        const response = {
          code: ErrorCode.TRANSACTION_FAILED,
          message: "Network is busy. Please try your transaction again.",
          details: { originalError: error.message, errorType: "blockhash" }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      if (message.includes('insufficient funds for fee') || (message.includes('insufficient') && message.includes('fee'))) {
        const response = {
          code: ErrorCode.INSUFFICIENT_BALANCE,
          message: "You don't have enough SOL to pay for this transaction. Please add some SOL to your wallet.",
          details: { originalError: error.message, errorType: "insufficient_sol" }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      if (message.includes('out of compute budget') || message.includes('compute units')) {
        const response = {
          code: ErrorCode.TRANSACTION_FAILED,
          message: "Transaction is too complex. Please try breaking it into smaller steps.",
          details: { originalError: error.message, errorType: "compute_budget" }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      if (message.includes('mint') && message.includes('not found')) {
        const response = {
          code: ErrorCode.MINT_NOT_FOUND,
          message: "The token you're trying to use doesn't exist or is invalid.",
          details: { originalError: error.message }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      if (message.includes('token account') && message.includes('not found')) {
        const response = {
          code: ErrorCode.TOKEN_ACCOUNT_NOT_FOUND,
          message: "Your wallet doesn't have an account for this token yet.",
          details: { originalError: error.message }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      if (message.includes('metadata') && message.includes('not found')) {
        const response = {
          code: ErrorCode.METADATA_NOT_FOUND,
          message: "Token information is missing or invalid.",
          details: { originalError: error.message }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }
      
      if (message.includes('connection') || message.includes('network') || message.includes('rpc')) {
        const response = {
          code: ErrorCode.CONNECTION_FAILED,
          message: "Unable to connect to the Solana network. Please check your internet connection and try again.",
          details: { originalError: error.message }
        };
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }

      // Client-specific error patterns
      if (message.includes('object contents') && message.includes('invalid')) {
        const response = ErrorFactory.validationError('object contents', error.message, 'must be valid');
        console.error(`Error [${response.code}]: ${response.message}`);
        return response;
      }

      // Default transaction failed with generic user-friendly message
      const response = {
        code: ErrorCode.TRANSACTION_FAILED,
        message: "Transaction failed. Please try again or contact support if the problem persists.",
        details: { originalError: error.message }
      };
      console.error(`Error [${response.code}]: ${response.message}`);
      return response;
    }

    // Handle unknown error types
    const response = {
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'An unknown error occurred',
      details: error
    };
    console.error(`Error [${response.code}]: ${response.message}`);
    console.error('Unknown error:', error);
    return response;
  }

  // Simple logging method
  static log(error: any): void {
    const errorResponse = this.handle(error);
    // Already logged in handle method, this is just for consistency
  }
}

// Simple validation helpers
export const Validators = {
  required: <T>(value: T | null | undefined, fieldName: string): T => {
    if (value === null || value === undefined) {
      throw {
        code: ErrorCode.VALIDATION_ERROR,
        message: `Missing required field: ${fieldName}`,
        details: { fieldName }
      };
    }
    return value;
  },

  publicKey: (value: string | PublicKey, fieldName: string): PublicKey => {
    try {
      return typeof value === 'string' ? new PublicKey(value) : value;
    } catch (error) {
      throw {
        code: ErrorCode.VALIDATION_ERROR,
        message: `Invalid public key for ${fieldName}`,
        details: { value, fieldName }
      };
    }
  },

  positiveNumber: (amount: number | string, fieldName: string = 'amount'): number => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || numAmount <= 0) {
      throw {
        code: ErrorCode.VALIDATION_ERROR,
        message: `Invalid ${fieldName}: must be a positive number`,
        details: { amount, fieldName }
      };
    }
    
    return numAmount;
  }
}; 