import { PublicKey } from "@solana/web3.js";

// On-chain Error Codes from error.rs (6000+)
export enum OnChainErrorCode {
  // 6000-6019 align with backend error.rs file
  INVALID_AUTHORITY = 6000,
  INVALID_MINT = 6001,
  INVALID_TOKEN_ACCOUNT = 6002,
  INSUFFICIENT_PEER_TOKENS = 6003,
  DAILY_MINT_LIMIT_EXCEEDED = 6004,
  TOO_EARLY_FOR_DAILY_MINT = 6005,
  INVALID_TRANSFER_AMOUNT = 6006,
  METADATA_CREATION_FAILED = 6007,
  UNAUTHORIZED_TRANSFER = 6008,
  INVALID_TOKEN_DECIMALS = 6009,
  INVALID_TOKEN_METADATA = 6010,
  INVALID_OWNER = 6011,
  INVALID_TOKEN_ACCOUNT_INIT = 6012,
  INVALID_METADATA_ACCOUNT = 6013,
  INVALID_MINT_AUTHORITY = 6014,
  INVALID_FREEZE_AUTHORITY = 6015,
  INVALID_ASSOCIATED_TOKEN_ACCOUNT = 6016,
  ALREADY_MINTED_TODAY = 6017,
  INVALID_PEER_TOKEN_ACCOUNT = 6018,
  INSUFFICIENT_AMOUNT = 6019,
}

// Client-side Error Codes (1-700)
export enum ErrorCode {
  // General Errors (1-100)
  UNKNOWN_ERROR = 1,
  INVALID_PARAMETER = 2,
  CONFIGURATION_ERROR = 3,
  ENVIRONMENT_ERROR = 4,
  FILE_NOT_FOUND = 5,

  // Solana Connection Errors (101-200)
  CONNECTION_FAILED = 101,
  RPC_ERROR = 102,
  NETWORK_TIMEOUT = 103,

  // Wallet and Key Management Errors (201-300)
  WALLET_FILE_NOT_FOUND = 201,
  INVALID_KEYPAIR = 202,
  UNAUTHORIZED_ACCESS = 203,
  
  // Token Operation Errors (301-400)
  MINT_ACCOUNT_NOT_FOUND = 301,
  TOKEN_ACCOUNT_NOT_FOUND = 302,
  INSUFFICIENT_BALANCE = 303,
  INVALID_TOKEN_AMOUNT = 304,
  MINT_CREATION_FAILED = 305,
  TOKEN_ACCOUNT_CREATION_FAILED = 306,
  TOKEN_TRANSFER_FAILED = 307,

  // Metadata Errors (401-500)
  METADATA_ACCOUNT_NOT_FOUND = 401,
  METADATA_CREATION_FAILED = 402,
  METADATA_UPDATE_FAILED = 403,

  // Data Format Errors (501-600)
  INVALID_JSON_FORMAT = 501,
  MISSING_REQUIRED_FIELD = 502,
  INVALID_DATA_STRUCTURE = 503,
  
  // Transaction Errors (601-700)
  TRANSACTION_FAILED = 601,
  TRANSACTION_TIMEOUT = 602,
  TRANSACTION_SIMULATION_FAILED = 603,
  TRANSACTION_CONFIRMATION_FAILED = 604,
  ON_CHAIN_ERROR = 605,
}

// Map on-chain error codes to client error codes
export const mapOnChainErrorToClientError = (onChainCode: number | undefined): ErrorCode => {
  if (onChainCode === undefined) {
    return ErrorCode.ON_CHAIN_ERROR;
  }
  
  switch (onChainCode) {
    case OnChainErrorCode.INVALID_AUTHORITY:
      return ErrorCode.UNAUTHORIZED_ACCESS;
    case OnChainErrorCode.INVALID_MINT:
      return ErrorCode.MINT_ACCOUNT_NOT_FOUND;
    case OnChainErrorCode.INVALID_TOKEN_ACCOUNT:
    case OnChainErrorCode.INVALID_PEER_TOKEN_ACCOUNT:
    case OnChainErrorCode.INVALID_ASSOCIATED_TOKEN_ACCOUNT:
      return ErrorCode.TOKEN_ACCOUNT_NOT_FOUND;
    case OnChainErrorCode.INSUFFICIENT_PEER_TOKENS:
    case OnChainErrorCode.INSUFFICIENT_AMOUNT:
      return ErrorCode.INSUFFICIENT_BALANCE;
    case OnChainErrorCode.INVALID_TRANSFER_AMOUNT:
      return ErrorCode.INVALID_TOKEN_AMOUNT;
    case OnChainErrorCode.METADATA_CREATION_FAILED:
      return ErrorCode.METADATA_CREATION_FAILED;
    case OnChainErrorCode.DAILY_MINT_LIMIT_EXCEEDED:
    case OnChainErrorCode.TOO_EARLY_FOR_DAILY_MINT:
    case OnChainErrorCode.ALREADY_MINTED_TODAY:
      return ErrorCode.TRANSACTION_FAILED;
    case OnChainErrorCode.UNAUTHORIZED_TRANSFER:
      return ErrorCode.UNAUTHORIZED_ACCESS;
    case OnChainErrorCode.INVALID_TOKEN_DECIMALS:
    case OnChainErrorCode.INVALID_TOKEN_METADATA:
    case OnChainErrorCode.INVALID_METADATA_ACCOUNT:
      return ErrorCode.INVALID_PARAMETER;
    case OnChainErrorCode.INVALID_OWNER:
    case OnChainErrorCode.INVALID_MINT_AUTHORITY:
    case OnChainErrorCode.INVALID_FREEZE_AUTHORITY:
      return ErrorCode.UNAUTHORIZED_ACCESS;
    case OnChainErrorCode.INVALID_TOKEN_ACCOUNT_INIT:
      return ErrorCode.TOKEN_ACCOUNT_CREATION_FAILED;
    default:
      return ErrorCode.ON_CHAIN_ERROR;
  }
};

// Get human-readable error message for on-chain errors
export const getOnChainErrorMessage = (code: number | undefined): string => {
  if (code === undefined) {
    return "Unknown on-chain error";
  }
  
  switch (code) {
    case OnChainErrorCode.INVALID_AUTHORITY:
      return "Invalid authority to perform this operation";
    case OnChainErrorCode.INVALID_MINT:
      return "Invalid token mint address";
    case OnChainErrorCode.INVALID_TOKEN_ACCOUNT:
      return "Invalid token account";
    case OnChainErrorCode.INSUFFICIENT_PEER_TOKENS:
      return "Insufficient token balance";
    case OnChainErrorCode.DAILY_MINT_LIMIT_EXCEEDED:
      return "Maximum daily mint limit exceeded";
    case OnChainErrorCode.TOO_EARLY_FOR_DAILY_MINT:
      return "Too early for next daily mint";
    case OnChainErrorCode.INVALID_TRANSFER_AMOUNT:
      return "Invalid transfer amount";
    case OnChainErrorCode.METADATA_CREATION_FAILED:
      return "Metadata creation failed";
    case OnChainErrorCode.UNAUTHORIZED_TRANSFER:
      return "Unauthorized token transfer";
    case OnChainErrorCode.INVALID_TOKEN_DECIMALS:
      return "Invalid token decimals";
    case OnChainErrorCode.INVALID_TOKEN_METADATA:
      return "Invalid token metadata";
    case OnChainErrorCode.INVALID_OWNER:
      return "Invalid token account owner";
    case OnChainErrorCode.INVALID_TOKEN_ACCOUNT_INIT:
      return "Invalid token account initialization";
    case OnChainErrorCode.INVALID_METADATA_ACCOUNT:
      return "Invalid metadata account";
    case OnChainErrorCode.INVALID_MINT_AUTHORITY:
      return "Invalid mint authority";
    case OnChainErrorCode.INVALID_FREEZE_AUTHORITY:
      return "Invalid freeze authority";
    case OnChainErrorCode.INVALID_ASSOCIATED_TOKEN_ACCOUNT:
      return "Invalid associated token account";
    case OnChainErrorCode.ALREADY_MINTED_TODAY:
      return "Tokens have already been minted today";
    case OnChainErrorCode.INVALID_PEER_TOKEN_ACCOUNT:
      return "Invalid peer token account";
    case OnChainErrorCode.INSUFFICIENT_AMOUNT:
      return "Cannot transfer zero or insufficient amount";
    default:
      return "Unknown on-chain error";
  }
};

// Base Error Class
export class PeerTokenError extends Error {
  code: ErrorCode;
  details?: Record<string, any>;
  onChainCode?: number;

  constructor(code: ErrorCode, message: string, details?: Record<string, any>, onChainCode?: number) {
    super(message);
    this.name = 'PeerTokenError';
    this.code = code;
    this.details = details;
    this.onChainCode = onChainCode;
  }
}

// Specialized Error Classes
export class ConnectionError extends PeerTokenError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'ConnectionError';
  }
}

export class WalletError extends PeerTokenError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'WalletError';
  }
}

export class TokenError extends PeerTokenError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>, onChainCode?: number) {
    super(code, message, details, onChainCode);
    this.name = 'TokenError';
  }
}

export class MetadataError extends PeerTokenError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>, onChainCode?: number) {
    super(code, message, details, onChainCode);
    this.name = 'MetadataError';
  }
}

export class DataError extends PeerTokenError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>) {
    super(code, message, details);
    this.name = 'DataError';
  }
}

export class TransactionError extends PeerTokenError {
  constructor(code: ErrorCode, message: string, details?: Record<string, any>, onChainCode?: number) {
    super(code, message, details, onChainCode);
    this.name = 'TransactionError';
  }
}

// Helper Error Factory Functions
export const ErrorFactory = {
  // On-chain errors
  onChainError: (code: number | undefined, additionalDetails?: Record<string, any>) => {
    if (code === undefined) {
      return new TransactionError(
        ErrorCode.TRANSACTION_FAILED,
        "Transaction failed with unknown on-chain error",
        additionalDetails
      );
    }
    
    const clientCode = mapOnChainErrorToClientError(code);
    const message = getOnChainErrorMessage(code);
    return new TransactionError(clientCode, message, { ...additionalDetails, onChainCode: code }, code);
  },
  
  // Connection errors
  connectionFailed: (message: string, details?: Record<string, any>) => 
    new ConnectionError(ErrorCode.CONNECTION_FAILED, message, details),
  
  rpcError: (message: string, details?: Record<string, any>) => 
    new ConnectionError(ErrorCode.RPC_ERROR, message, details),
  
  // Wallet errors
  walletNotFound: (path: string) => 
    new WalletError(ErrorCode.WALLET_FILE_NOT_FOUND, `Wallet file not found: ${path}`, { path }),
  
  invalidKeypair: (details?: Record<string, any>) => 
    new WalletError(ErrorCode.INVALID_KEYPAIR, "Invalid keypair data", details),
  
  // Token errors
  mintNotFound: (mintAddress: PublicKey) => 
    new TokenError(ErrorCode.MINT_ACCOUNT_NOT_FOUND, `Mint account not found: ${mintAddress.toString()}`, 
    { mintAddress: mintAddress.toString() }, OnChainErrorCode.INVALID_MINT),
  
  tokenAccountNotFound: (tokenAddress: PublicKey, owner: PublicKey) => 
    new TokenError(ErrorCode.TOKEN_ACCOUNT_NOT_FOUND, `Token account not found for ${owner.toString()}`, 
    { tokenAddress: tokenAddress.toString(), owner: owner.toString() }, OnChainErrorCode.INVALID_TOKEN_ACCOUNT),
  
  insufficientBalance: (tokenAddress: PublicKey, required: string, available: string) => 
    new TokenError(ErrorCode.INSUFFICIENT_BALANCE, `Insufficient token balance`, 
    { tokenAddress: tokenAddress.toString(), required, available }, OnChainErrorCode.INSUFFICIENT_PEER_TOKENS),
  
  // Data errors
  invalidJson: (error: Error) => 
    new DataError(ErrorCode.INVALID_JSON_FORMAT, `Invalid JSON format: ${error.message}`, { originalError: error.message }),
  
  missingRequiredField: (fieldName: string) => 
    new DataError(ErrorCode.MISSING_REQUIRED_FIELD, `Missing required field: ${fieldName}`, { fieldName }),
  
  invalidDataStructure: (expected: string, received?: any) => 
    new DataError(ErrorCode.INVALID_DATA_STRUCTURE, `Invalid data structure, expected ${expected}`, { expected, received }),
  
  // Transaction errors
  transactionFailed: (operation: string, error: any) => {
    // Check if this is an on-chain error
    let onChainCode: number | undefined;
    let errorMsg = error?.message || 'Unknown error';
    
    // Try to extract on-chain error code from various error formats
    if (typeof error === 'object') {
      // Format from Anchor error logs
      if (error.logs && Array.isArray(error.logs)) {
        const errorLog = error.logs.find((log: string) => log.includes('Error Number:'));
        if (errorLog) {
          const match = errorLog.match(/Error Number: (\d+)/);
          if (match && match[1]) {
            onChainCode = parseInt(match[1], 10);
            errorMsg = getOnChainErrorMessage(onChainCode);
          }
        }
      }
      
      // Format from error.code
      if (error.code && typeof error.code === 'number' && error.code >= 6000 && error.code < 7000) {
        onChainCode = error.code;
        errorMsg = getOnChainErrorMessage(onChainCode);
      }
    }
    
    if (onChainCode !== undefined && onChainCode >= 6000 && onChainCode < 7000) {
      return ErrorFactory.onChainError(onChainCode, { operation, originalError: error });
    }
    
    return new TransactionError(
      ErrorCode.TRANSACTION_FAILED, 
      `Transaction failed during ${operation}: ${errorMsg}`, 
      { operation, originalError: error }
    );
  },
  
  transactionTimeout: (signature: string) => 
    new TransactionError(ErrorCode.TRANSACTION_TIMEOUT, `Transaction confirmation timeout`, { signature }),
};

// Error Handler class for global error handling
export class ErrorHandler {
  static handle(error: any): { message: string, code: number, details?: any, onChainCode?: number } {
    // Handle our custom error types
    if (error instanceof PeerTokenError) {
      console.error(`${error.name} [${error.code}${error.onChainCode ? `, on-chain: ${error.onChainCode}` : ''}]: ${error.message}`, error.details);
      return {
        message: error.message,
        code: error.code,
        details: error.details,
        onChainCode: error.onChainCode
      };
    }
    
    // Check if it's an on-chain error we can interpret
    if (typeof error === 'object') {
      // Try to extract on-chain error code from various error formats
      let onChainCode: number | undefined;
      
      // Format from Anchor error logs
      if (error.logs && Array.isArray(error.logs)) {
        const errorLog = error.logs.find((log: string) => log.includes('Error Number:'));
        if (errorLog) {
          const match = errorLog.match(/Error Number: (\d+)/);
          if (match && match[1]) {
            onChainCode = parseInt(match[1], 10);
            if (onChainCode >= 6000 && onChainCode < 7000) {
              const onChainError = ErrorFactory.onChainError(onChainCode, { originalError: error });
              console.error(`${onChainError.name} [${onChainError.code}, on-chain: ${onChainError.onChainCode}]: ${onChainError.message}`, onChainError.details);
              return {
                message: onChainError.message,
                code: onChainError.code,
                details: onChainError.details,
                onChainCode: onChainError.onChainCode
              };
            }
          }
        }
      }
      
      // Format from error.code
      if (error.code && typeof error.code === 'number' && error.code >= 6000 && error.code < 7000) {
        const onChainError = ErrorFactory.onChainError(error.code, { originalError: error });
        console.error(`${onChainError.name} [${onChainError.code}, on-chain: ${onChainError.onChainCode}]: ${onChainError.message}`, onChainError.details);
        return {
          message: onChainError.message,
          code: onChainError.code,
          details: onChainError.details,
          onChainCode: onChainError.onChainCode
        };
      }
    }
    
    // Handle standard Error objects
    if (error instanceof Error) {
      console.error(`Unhandled Error: ${error.message}`, error.stack);
      return {
        message: error.message,
        code: ErrorCode.UNKNOWN_ERROR
      };
    }
    
    // Handle unknown error types
    console.error('Unknown error type:', error);
    return {
      message: 'An unknown error occurred',
      code: ErrorCode.UNKNOWN_ERROR,
      details: error
    };
  }

  static logError(error: any): void {
    if (error instanceof PeerTokenError) {
      console.error(`${error.name} [${error.code}${error.onChainCode ? `, on-chain: ${error.onChainCode}` : ''}]: ${error.message}`, error.details);
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`, error.stack);
    } else {
      console.error('Unknown error type:', error);
    }
  }
}

// Validation utilities to prevent errors
export const Validators = {
  // Check if a value exists and is not null/undefined
  required: <T>(value: T | null | undefined, fieldName: string): T => {
    if (value === null || value === undefined) {
      throw ErrorFactory.missingRequiredField(fieldName);
    }
    return value;
  },
  
  // Validate public key
  publicKey: (value: string | PublicKey, fieldName: string): PublicKey => {
    try {
      return typeof value === 'string' ? new PublicKey(value) : value;
    } catch (error) {
      throw new PeerTokenError(
        ErrorCode.INVALID_PARAMETER, 
        `Invalid public key for ${fieldName}`, 
        { value, error: (error as Error).message }
      );
    }
  },
  
  // Validate token amount (positive number)
  tokenAmount: (amount: number | string, fieldName: string = 'amount'): number => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount)) {
      throw new TokenError(
        ErrorCode.INVALID_TOKEN_AMOUNT,
        `Invalid token amount: ${amount} is not a number`,
        { amount },
        OnChainErrorCode.INVALID_TRANSFER_AMOUNT
      );
    }
    
    if (numAmount <= 0) {
      throw new TokenError(
        ErrorCode.INVALID_TOKEN_AMOUNT,
        `Invalid token amount: ${amount} must be positive`,
        { amount },
        OnChainErrorCode.INSUFFICIENT_AMOUNT
      );
    }
    
    return numAmount;
  }
}; 