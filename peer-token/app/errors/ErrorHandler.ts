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
}

// On-chain error codes from the Rust program
export enum OnChainErrorCode {
  INVALID_MINT = 6000,
  INVALID_MINT_AUTHORITY = 6001,
  INVALID_OWNER = 6002,
  INVALID_TRANSFER_AMOUNT = 6003,
  INSUFFICIENT_PEER_TOKENS = 6004,
  ALREADY_MINTED_TODAY = 6005,
  INVALID_TOKEN_DECIMALS = 6006,
  INVALID_TOKEN_METADATA = 6007,
  METADATA_CREATION_FAILED = 6008
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
    case OnChainErrorCode.ALREADY_MINTED_TODAY:
      return "Already minted tokens today";
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

// Simple Error Factory - only the most common ones
export const ErrorFactory = {
  mintNotFound: (mintAddress: PublicKey): ErrorResponse => ({
    code: ErrorCode.MINT_NOT_FOUND,
    message: `Mint account not found: ${mintAddress.toString()}`,
    details: { mintAddress: mintAddress.toString() }
  }),

  tokenAccountNotFound: (tokenAddress: PublicKey, owner: PublicKey): ErrorResponse => ({
    code: ErrorCode.TOKEN_ACCOUNT_NOT_FOUND,
    message: `Token account not found for owner: ${owner.toString()}`,
    details: { tokenAddress: tokenAddress.toString(), owner: owner.toString() }
  }),

  metadataNotFound: (mintAddress: PublicKey): ErrorResponse => ({
    code: ErrorCode.METADATA_NOT_FOUND,
    message: `Metadata account not found for mint: ${mintAddress.toString()}`,
    details: { mintAddress: mintAddress.toString() }
  }),

  transactionFailed: (operation: string, error: any): ErrorResponse => ({
    code: ErrorCode.TRANSACTION_FAILED,
    message: `Transaction failed during ${operation}: ${error?.message || 'Unknown error'}`,
    details: { operation, originalError: error?.message }
  }),

  alreadyMintedToday: (): ErrorResponse => ({
    code: ErrorCode.ALREADY_MINTED_TODAY,
    message: "Tokens have already been minted today. Try again tomorrow.",
    details: null
  }),

  connectionFailed: (endpoint: string): ErrorResponse => ({
    code: ErrorCode.CONNECTION_FAILED,
    message: `Failed to connect to Solana RPC: ${endpoint}`,
    details: { endpoint }
  }),

  walletNotFound: (path: string): ErrorResponse => ({
    code: ErrorCode.WALLET_NOT_FOUND,
    message: `Wallet file not found: ${path}`,
    details: { path }
  }),
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
      if (onChainCode === OnChainErrorCode.ALREADY_MINTED_TODAY) {
        errorCode = ErrorCode.ALREADY_MINTED_TODAY;
      } else if (onChainCode === OnChainErrorCode.INSUFFICIENT_PEER_TOKENS) {
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
        const response = ErrorFactory.alreadyMintedToday();
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