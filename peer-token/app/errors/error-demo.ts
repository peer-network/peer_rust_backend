#!/usr/bin/env ts-node
/**
 * Comprehensive Solana Error Demo Script
 * ======================================
 * 
 * This script demonstrates various types of errors that can occur when working with 
 * Solana blockchain and peer token transactions. It provides a unified way to test
 * error handling in different scenarios.
 * 
 * Usage: ts-node error-demo.ts [error-type]
 * 
 * Available error types:
 * - validation-pubkey: Invalid public key format
 * - validation-amount: Invalid token amount
 * - insufficient: Insufficient token balance (on-chain)
 * - unauthorized: Unauthorized transfer (on-chain)
 * - connection: Network connection failure
 * - sol-timeout: Solana transaction timeout
 * - sol-compute: Compute budget exceeded
 * - sol-fee: Insufficient SOL for transaction fee
 * - sol-blockhash: Blockhash not found error
 * - success: Successful token transfer
 * - all: Run all error scenarios (default)
 */

import { PublicKey } from '@solana/web3.js';
import { ErrorHandler, ErrorCode, OnChainErrorCode } from './index';

// ============================
// Error Type Enums
// ============================

/**
 * Common Solana transaction error types
 */
enum SolanaTransactionErrorType {
  // RPC/Network related errors
  TIMEOUT = 'timeout',
  BLOCKHASH_NOT_FOUND = 'blockhash_not_found',
  
  // Compute budget errors
  OUT_OF_COMPUTE_BUDGET = 'out_of_compute_budget',
  
  // Account-related errors
  INSUFFICIENT_FUNDS = 'insufficient_funds' // SOL for tx fee
}

// ============================
// Validators
// ============================

/**
 * Input validators
 */
const Validators = {
  /**
   * Validate a public key string
   */
  publicKey: (value: string, fieldName: string): PublicKey => {
    try {
      return new PublicKey(value);
    } catch (error) {
      throw {
        code: ErrorCode.INVALID_PARAMETER,
        message: `Invalid ${fieldName}: ${value} is not a valid Solana address`,
        details: { field: fieldName, value }
      };
    }
  },
  
  /**
   * Validate a token amount
   */
  tokenAmount: (value: number, fieldName: string): number => {
    if (isNaN(value) || value <= 0) {
      throw {
        code: ErrorCode.INVALID_TOKEN_AMOUNT,
        message: `Invalid ${fieldName}: Must be a positive number`,
        details: { field: fieldName, value }
      };
    }
    return value;
  }
};

// ============================
// Error Factory
// ============================

/**
 * Error Factory to create consistent error objects
 */
const ErrorFactory = {
  connectionFailed: (message: string) => {
    return {
      code: ErrorCode.CONNECTION_FAILED,
      message: message || "Failed to connect to Solana network",
      details: { timestamp: new Date().toISOString() }
    };
  },
  
  transactionFailed: (operation: string, error: any) => {
    // If this is an on-chain error with a code, map it
    if (error && typeof error.code === 'number' && error.code >= 6000) {
      return {
        code: ErrorCode.ON_CHAIN_ERROR,
        message: error.message || getOnChainErrorMessage(error.code),
        details: { operation },
        onChainCode: error.code
      };
    }
    
    // For Solana-specific errors
    if (error) {
      if (error.timeout) {
        return {
          code: ErrorCode.TRANSACTION_TIMEOUT,
          message: "Transaction confirmation timed out",
          details: { operation }
        };
      }
      
      if (error.logs && error.logs.some((log: string) => log.includes("compute budget"))) {
        return {
          code: ErrorCode.TRANSACTION_FAILED,
          message: "Transaction failed: Compute budget exceeded",
          details: { operation, logs: error.logs }
        };
      }
      
      if (error.logs && error.logs.some((log: string) => log.includes("Insufficient funds"))) {
        return {
          code: ErrorCode.TRANSACTION_FAILED,
          message: "Transaction failed: Insufficient SOL for transaction fee",
          details: { operation }
        };
      }
      
      if (error.code === "BlockhashNotFound" || (error.logs && error.logs.some((log: string) => log.includes("Blockhash not found")))) {
        return {
          code: ErrorCode.TRANSACTION_FAILED,
          message: "Transaction failed: Blockhash not found or expired",
          details: { operation }
        };
      }
    }
    
    // Generic transaction error
    return {
      code: ErrorCode.TRANSACTION_FAILED,
      message: `Failed to ${operation}`,
      details: { originalError: error }
    };
  }
};

// ============================
// Helper Functions
// ============================

/**
 * Get human-readable error message for on-chain errors
 */
function getOnChainErrorMessage(code: number): string {
  switch (code) {
    case OnChainErrorCode.INVALID_AUTHORITY:
      return "Invalid authority to perform this operation";
    case OnChainErrorCode.INVALID_MINT:
      return "Invalid token mint address";
    case OnChainErrorCode.INVALID_TOKEN_ACCOUNT:
      return "Invalid token account";
    case OnChainErrorCode.INSUFFICIENT_PEER_TOKENS:
      return "Insufficient token balance";
    case OnChainErrorCode.UNAUTHORIZED_TRANSFER:
      return "Unauthorized token transfer";
    default:
      return "Unknown on-chain error";
  }
}

/**
 * Create a mock on-chain error
 */
function createMockOnChainError(errorCode: number = OnChainErrorCode.INSUFFICIENT_PEER_TOKENS): any {
  return {
    code: errorCode,
    message: getOnChainErrorMessage(errorCode),
    logs: [
      "Program log: Instruction: TransferTokens",
      `Program log: Error: ${getOnChainErrorMessage(errorCode)}`,
      `Program log: Error code: ${errorCode}`
    ]
  };
}

/**
 * Create a mock Solana transaction error
 */
function createMockSolanaError(errorType: SolanaTransactionErrorType): any {
  switch (errorType) {
    case SolanaTransactionErrorType.TIMEOUT:
      return {
        message: "Transaction confirmation timeout",
        timeout: true
      };
      
    case SolanaTransactionErrorType.BLOCKHASH_NOT_FOUND:
      return {
        message: "Blockhash not found",
        code: "BlockhashNotFound"
      };
      
    case SolanaTransactionErrorType.OUT_OF_COMPUTE_BUDGET:
      return {
        message: "Transaction simulation failed: Error processing Instruction 0: Program failed to complete",
        logs: [
          "Program log: Instruction: TransferTokens",
          "Program log: Out of compute budget",
          "Program exceeded maximum compute units"
        ]
      };
      
    case SolanaTransactionErrorType.INSUFFICIENT_FUNDS:
      return {
        message: "Transaction simulation failed: Insufficient funds for fee",
        logs: ["Insufficient funds for fee"]
      };
      
    default:
      return {
        message: "Unknown Solana error",
        logs: ["Unknown error"]
      };
  }
}

// ============================
// Mock Token Transfer Function
// ============================

/**
 * Mock function to simulate a token transfer
 */
async function mockTokenTransfer(
  fromWallet: string,
  toWallet: string,
  amount: number,
  simulateError?: { 
    type: string, 
    code?: number,
    solanaErrorType?: SolanaTransactionErrorType 
  }
): Promise<string> {
  try {
    console.log(`\n🔄 Attempting to transfer ${amount} tokens from ${fromWallet} to ${toWallet}...`);
    
    // 1. Validate inputs
    try {
      const sender = Validators.publicKey(fromWallet, "sender wallet");
      const recipient = Validators.publicKey(toWallet, "recipient wallet");
      const validAmount = Validators.tokenAmount(amount, "transfer amount");
      
      console.log(`✅ Input validation passed: ${validAmount} tokens from ${sender.toString()} to ${recipient.toString()}`);
    } catch (error) {
      console.log(`❌ Input validation failed`);
      throw error;
    }
    
    // 2. Simulate different error scenarios
    if (simulateError) {
      console.log(`⚠️ Simulating error: ${simulateError.type}`);
      
      // Simulate client-side errors
      if (simulateError.type === 'client') {
        if (simulateError.code === ErrorCode.CONNECTION_FAILED) {
          throw ErrorFactory.connectionFailed("Failed to connect to Solana network");
        }
      }
      
      // Simulate on-chain errors
      if (simulateError.type === 'on-chain') {
        // Create a mock on-chain error response
        const mockOnChainError = createMockOnChainError(simulateError.code);
        throw ErrorFactory.transactionFailed("token transfer", mockOnChainError);
      }
      
      // Simulate Solana transaction errors
      if (simulateError.type === 'solana' && simulateError.solanaErrorType) {
        const solanaError = createMockSolanaError(simulateError.solanaErrorType);
        throw ErrorFactory.transactionFailed("token transfer", solanaError);
      }
    }
    
    // 3. Success case
    console.log(`✅ Transaction successful!`);
    return "mock_transaction_signature_123456789";
  } catch (error) {
    // If it's not already a categorized error, wrap it in a transaction error
    if (!error || typeof error !== 'object' || !('code' in error)) {
      throw ErrorFactory.transactionFailed("token transfer", error);
    }
    throw error;
  }
}

// ============================
// Demonstration Functions
// ============================

/**
 * Run all error demonstration scenarios
 */
async function demonstrateAllErrors() {
  const validPubkey1 = "HYEWs3HBPYrZx7NLq5V1mNyUR2nNgBjQRLnrMX1j1TJJ";
  const validPubkey2 = "9JXq6CGU7J8J5TXt1rYQMJMpNbZ9TG4G8MSvvMwxgKv9";
  
  console.log("========== ERROR HANDLING DEMONSTRATION ==========");
  
  // 1. Client-side validation error - invalid public key
  console.log("\n📋 SCENARIO 1: Client-side validation error (Invalid public key)");
  try {
    await mockTokenTransfer("not-a-valid-pubkey", validPubkey2, 100);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 2. Client-side validation error - negative amount
  console.log("\n📋 SCENARIO 2: Client-side validation error (Negative amount)");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, -50);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 3. On-chain error - insufficient balance
  console.log("\n📋 SCENARIO 3: On-chain error (Insufficient balance)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.INSUFFICIENT_PEER_TOKENS }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain code: ${errorInfo.onChainCode}, Details:`, errorInfo.details);
  }
  
  // 4. On-chain error - unauthorized transfer
  console.log("\n📋 SCENARIO 4: On-chain error (Unauthorized transfer)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.UNAUTHORIZED_TRANSFER }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain code: ${errorInfo.onChainCode}, Details:`, errorInfo.details);
  }
  
  // 5. Client infrastructure error - connection failed
  console.log("\n📋 SCENARIO 5: Client infrastructure error (Connection failed)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'client', code: ErrorCode.CONNECTION_FAILED }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 6. Solana transaction error - timeout
  console.log("\n📋 SCENARIO 6: Solana transaction error (Timeout)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'solana', solanaErrorType: SolanaTransactionErrorType.TIMEOUT }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 7. Solana transaction error - insufficient SOL for fee
  console.log("\n📋 SCENARIO 7: Solana transaction error (Insufficient SOL for fee)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'solana', solanaErrorType: SolanaTransactionErrorType.INSUFFICIENT_FUNDS }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 8. Solana transaction error - compute budget exceeded
  console.log("\n📋 SCENARIO 8: Solana transaction error (Compute budget exceeded)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'solana', solanaErrorType: SolanaTransactionErrorType.OUT_OF_COMPUTE_BUDGET }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 9. Successful transfer
  console.log("\n📋 SCENARIO 9: Successful transfer");
  try {
    const signature = await mockTokenTransfer(validPubkey1, validPubkey2, 100);
    console.log(`📣 USER SEES: Transfer successful! Transaction: ${signature}`);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
  }
}

// ============================
// Main Script Execution
// ============================

// Valid test addresses
const validPubkey1 = "HYEWs3HBPYrZx7NLq5V1mNyUR2nNgBjQRLnrMX1j1TJJ";
const validPubkey2 = "9JXq6CGU7J8J5TXt1rYQMJMpNbZ9TG4G8MSvvMwxgKv9";

// Get the error type from command line
const errorType = process.argv[2] || 'all';

async function runScript() {
  console.log(`🚀 Running Solana token error demo: ${errorType}`);
  
  try {
    switch (errorType) {
      case 'validation-pubkey':
        // Test validation error - invalid public key
        await mockTokenTransfer("not-a-valid-pubkey", validPubkey2, 100);
        break;
        
      case 'validation-amount':
        // Test validation error - negative amount
        await mockTokenTransfer(validPubkey1, validPubkey2, -50);
        break;
        
      case 'insufficient':
        // Test on-chain error - insufficient balance
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INSUFFICIENT_PEER_TOKENS }
        );
        break;
        
      case 'unauthorized':
        // Test on-chain error - unauthorized transfer
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.UNAUTHORIZED_TRANSFER }
        );
        break;
        
      case 'connection':
        // Test client error - connection failed
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'client', code: ErrorCode.CONNECTION_FAILED }
        );
        break;
        
      // Solana transaction errors
      case 'sol-timeout':
        // Test Solana transaction timeout
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'solana', solanaErrorType: SolanaTransactionErrorType.TIMEOUT }
        );
        break;
        
      case 'sol-compute':
        // Test Solana compute budget exceeded
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'solana', solanaErrorType: SolanaTransactionErrorType.OUT_OF_COMPUTE_BUDGET }
        );
        break;
        
      case 'sol-fee':
        // Test insufficient SOL for fee
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'solana', solanaErrorType: SolanaTransactionErrorType.INSUFFICIENT_FUNDS }
        );
        break;
        
      case 'sol-blockhash':
        // Test blockhash not found error
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'solana', solanaErrorType: SolanaTransactionErrorType.BLOCKHASH_NOT_FOUND }
        );
        break;
        
      case 'success':
        // Test successful transfer
        const signature = await mockTokenTransfer(validPubkey1, validPubkey2, 100);
        console.log(`✅ Transaction successful! Signature: ${signature}`);
        return;
        
      case 'all':
        // Run all scenarios
        await demonstrateAllErrors();
        return;
        
      default:
        console.log(`❌ Unknown error type: ${errorType}`);
        console.log("Available types: validation-pubkey, validation-amount, insufficient, unauthorized, connection, sol-timeout, sol-compute, sol-fee, sol-blockhash, success, all");
        return;
    }
  } catch (error) {
    // Handle and display the error
    const errorInfo = ErrorHandler.handle(error);
    
    console.log("\n📊 ERROR DETAILS:");
    console.log(`📣 USER WOULD SEE: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER INFO:`);
    console.log(`  - Error code: ${errorInfo.code}`);
    
    if (errorInfo.onChainCode) {
      console.log(`  - On-chain code: ${errorInfo.onChainCode}`);
    }
    
    if (errorInfo.details) {
      console.log("  - Error details:", JSON.stringify(errorInfo.details, null, 2));
    }
  }
}

// Run the script
runScript()
  .then(() => console.log("\n✅ Demo completed"))
  .catch(console.error); 