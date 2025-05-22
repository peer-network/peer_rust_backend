#!/usr/bin/env ts-node
/**
 * Comprehensive Solana Error Demo Script
 * ======================================
 * 
 * This script demonstrates various types of errors that can occur when working with 
 * Solana blockchain and peer token transactions. It provides a unified way to test
 * error handling in different scenarios.
 * 
 * IMPORTANT: This demo is designed to showcase how the real error handling utilities
 * from ErrorHandler.ts are used in practice. It imports and uses the actual error classes,
 * factories, and validation utilities from the codebase rather than duplicating functionality.
 * 
 * Usage: ts-node error-demo.ts [error-type]
 * 
 * Available error types:
 * - validation-pubkey: Invalid public key format
 * - validation-amount: Invalid token amount
 * - insufficient: Insufficient token balance (on-chain)
 * - unauthorized: Unauthorized transfer (on-chain)
 * - invalid-mint: Invalid token mint address (on-chain)
 * - invalid-token-account: Invalid token account (on-chain)
 * - invalid-owner: Invalid token account owner (on-chain)
 * - invalid-mint-authority: Invalid mint authority (on-chain)
 * - already-minted-today: Already minted tokens today (on-chain)
 * - invalid-metadata: Invalid token metadata (on-chain)
 * - invalid-decimals: Invalid token decimals (on-chain)
 * - connection: Network connection failure
 * - rpc-error: RPC endpoint returned an error
 * - network-timeout: Network request timed out
 * - sol-timeout: Solana transaction timeout
 * - sol-compute: Compute budget exceeded
 * - sol-fee: Insufficient SOL for transaction fee
 * - sol-blockhash: Blockhash not found error
 * - success: Successful token transfer
 * - all: Run all error scenarios (default)
 * - anchor: Run all Anchor custom errors
 * - client: Run all client-side errors
 */

import { PublicKey } from '@solana/web3.js';
import { 
  ErrorHandler, 
  ErrorCode, 
  OnChainErrorCode, 
  ErrorFactory,
  getOnChainErrorMessage as getRealOnChainErrorMessage,
  Validators as RealValidators,
  ConnectionError,
  PeerTokenError,
  TokenError
} from './index';

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
 * Note: These are now replaced by using the actual Validators from ErrorHandler.ts
 * This is kept for reference but is no longer used
 */
/* 
const Validators = {
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
*/

// ============================
// Error Factory
// ============================

/**
 * Using ErrorFactory directly from ErrorHandler.ts
 * The local wrapper has been removed for simplicity
 */

// ============================
// Helper Functions
// ============================

/**
 * Get human-readable error message for on-chain errors
 */
function getOnChainErrorMessage(code: number): string {
  return getRealOnChainErrorMessage(code);
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
      `Program log: Error Number: ${errorCode}`
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
      // Use the real validators from ErrorHandler
      let sender: PublicKey;
      let recipient: PublicKey;
      
      try {
        sender = RealValidators.publicKey(fromWallet, "sender wallet");
      } catch (error) {
        // All validation errors through ErrorFactory
        throw ErrorFactory.transactionFailed("input validation", {
          code: ErrorCode.INVALID_PARAMETER,
          message: `Invalid sender wallet: ${fromWallet} is not a valid Solana address`,
          details: { field: "sender wallet", value: fromWallet }
        });
      }
      
      try {
        recipient = RealValidators.publicKey(toWallet, "recipient wallet");
      } catch (error) {
        // All validation errors through ErrorFactory
        throw ErrorFactory.transactionFailed("input validation", {
          code: ErrorCode.INVALID_PARAMETER,
          message: `Invalid recipient wallet: ${toWallet} is not a valid Solana address`,
          details: { field: "recipient wallet", value: toWallet }
        });
      }
      
      // Use the real validator for amount
      let validAmount: number;
      try {
        validAmount = RealValidators.tokenAmount(amount, "transfer amount");
      } catch (error) {
        // Simply pass through the TokenError created by the validator
        throw error;
      }
      
      // Check if sender and recipient are the same
      if (sender.equals(recipient)) {
        throw ErrorFactory.transactionFailed("input validation", {
          code: ErrorCode.INVALID_PARAMETER,
          message: "Sender and recipient cannot be the same",
          details: { 
            sender: sender.toString(),
            recipient: recipient.toString() 
          }
        });
      }
      
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
        } else if (simulateError.code === ErrorCode.RPC_ERROR) {
          throw ErrorFactory.rpcError("RPC endpoint returned an error", { 
            endpoint: "https://api.mainnet-beta.solana.com", 
            timestamp: new Date().toISOString() 
          });
        } else if (simulateError.code === ErrorCode.NETWORK_TIMEOUT) {
          throw ErrorFactory.transactionFailed("network request", {
            code: ErrorCode.NETWORK_TIMEOUT,
            message: "Network request timed out",
            details: { timeout: 30000, operation: "getRecentBlockhash" }
          });
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
  
  // 3. Client-side validation error - zero amount
  console.log("\n📋 SCENARIO 3: Client-side validation error (Zero amount)");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, 0);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 4. On-chain error - insufficient balance
  console.log("\n📋 SCENARIO 4: On-chain error (Insufficient balance)");
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
  
  // 5. On-chain error - unauthorized transfer
  console.log("\n📋 SCENARIO 5: On-chain error (Unauthorized transfer)");
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
  
  // 6. On-chain error - invalid mint
  console.log("\n📋 SCENARIO 6: On-chain error (Invalid mint)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.INVALID_MINT }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain code: ${errorInfo.onChainCode}, Details:`, errorInfo.details);
  }
  
  // 7. On-chain error - invalid token account
  console.log("\n📋 SCENARIO 7: On-chain error (Invalid token account)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.INVALID_TOKEN_ACCOUNT }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain code: ${errorInfo.onChainCode}, Details:`, errorInfo.details);
  }
  
  // 8. On-chain error - invalid owner
  console.log("\n📋 SCENARIO 8: On-chain error (Invalid owner)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.INVALID_OWNER }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain code: ${errorInfo.onChainCode}, Details:`, errorInfo.details);
  }
  
  // 9. On-chain error - already minted today
  console.log("\n📋 SCENARIO 9: On-chain error (Already minted today)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.ALREADY_MINTED_TODAY }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain code: ${errorInfo.onChainCode}, Details:`, errorInfo.details);
  }
  
  // 10. Client infrastructure error - connection failed
  console.log("\n📋 SCENARIO 10: Client infrastructure error (Connection failed)");
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
  
  // 11. Solana transaction error - timeout
  console.log("\n📋 SCENARIO 11: Solana transaction error (Timeout)");
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
  
  // 12. Solana transaction error - insufficient SOL for fee
  console.log("\n📋 SCENARIO 12: Solana transaction error (Insufficient SOL for fee)");
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
  
  // 13. Solana transaction error - compute budget exceeded
  console.log("\n📋 SCENARIO 13: Solana transaction error (Compute budget exceeded)");
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
  
  // 14. Successful transfer
  console.log("\n📋 SCENARIO 14: Successful transfer");
  try {
    const signature = await mockTokenTransfer(validPubkey1, validPubkey2, 100);
    console.log(`📣 USER SEES: Transfer successful! Transaction: ${signature}`);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
  }
}

/**
 * Demonstrate all Anchor custom errors
 */
async function demonstrateAnchorErrors() {
  const validPubkey1 = "HYEWs3HBPYrZx7NLq5V1mNyUR2nNgBjQRLnrMX1j1TJJ";
  const validPubkey2 = "9JXq6CGU7J8J5TXt1rYQMJMpNbZ9TG4G8MSvvMwxgKv9";
  
  console.log("========== ANCHOR CUSTOM ERROR DEMONSTRATION ==========");
  
  // Test all on-chain errors
  const anchorErrors = [
    { code: OnChainErrorCode.INVALID_AUTHORITY, name: "Invalid Authority" },
    { code: OnChainErrorCode.INVALID_MINT, name: "Invalid Mint" },
    { code: OnChainErrorCode.INVALID_TOKEN_ACCOUNT, name: "Invalid Token Account" },
    { code: OnChainErrorCode.INSUFFICIENT_PEER_TOKENS, name: "Insufficient Peer Tokens" },
    { code: OnChainErrorCode.DAILY_MINT_LIMIT_EXCEEDED, name: "Daily Mint Limit Exceeded" },
    { code: OnChainErrorCode.TOO_EARLY_FOR_DAILY_MINT, name: "Too Early For Daily Mint" },
    { code: OnChainErrorCode.INVALID_TRANSFER_AMOUNT, name: "Invalid Transfer Amount" },
    { code: OnChainErrorCode.METADATA_CREATION_FAILED, name: "Metadata Creation Failed" },
    { code: OnChainErrorCode.UNAUTHORIZED_TRANSFER, name: "Unauthorized Transfer" },
    { code: OnChainErrorCode.INVALID_TOKEN_DECIMALS, name: "Invalid Token Decimals" },
    { code: OnChainErrorCode.INVALID_TOKEN_METADATA, name: "Invalid Token Metadata" },
    { code: OnChainErrorCode.INVALID_OWNER, name: "Invalid Owner" },
    { code: OnChainErrorCode.INVALID_TOKEN_ACCOUNT_INIT, name: "Invalid Token Account Init" },
    { code: OnChainErrorCode.INVALID_METADATA_ACCOUNT, name: "Invalid Metadata Account" },
    { code: OnChainErrorCode.INVALID_MINT_AUTHORITY, name: "Invalid Mint Authority" },
    { code: OnChainErrorCode.INVALID_FREEZE_AUTHORITY, name: "Invalid Freeze Authority" },
    { code: OnChainErrorCode.INVALID_ASSOCIATED_TOKEN_ACCOUNT, name: "Invalid Associated Token Account" },
    { code: OnChainErrorCode.ALREADY_MINTED_TODAY, name: "Already Minted Today" },
    { code: OnChainErrorCode.INVALID_PEER_TOKEN_ACCOUNT, name: "Invalid Peer Token Account" },
    { code: OnChainErrorCode.INSUFFICIENT_AMOUNT, name: "Insufficient Amount" }
  ];
  
  for (const err of anchorErrors) {
    console.log(`\n📋 TESTING ANCHOR ERROR: ${err.name} (${err.code})`);
    try {
      await mockTokenTransfer(
        validPubkey1, 
        validPubkey2, 
        100, 
        { type: 'on-chain', code: err.code }
      );
    } catch (error) {
      const errorInfo = ErrorHandler.handle(error);
      console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
      console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain code: ${errorInfo.onChainCode}, Details:`, errorInfo.details);
    }
  }
}

/**
 * Demonstrate all client-side errors
 */
async function demonstrateClientErrors() {
  const validPubkey1 = "HYEWs3HBPYrZx7NLq5V1mNyUR2nNgBjQRLnrMX1j1TJJ";
  const validPubkey2 = "9JXq6CGU7J8J5TXt1rYQMJMpNbZ9TG4G8MSvvMwxgKv9";
  
  console.log("========== CLIENT-SIDE ERROR DEMONSTRATION ==========");
  
  // 1. Invalid public key format
  console.log("\n📋 CLIENT ERROR: Invalid Public Key Format");
  try {
    await mockTokenTransfer("not-a-valid-pubkey", validPubkey2, 100);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 2. Negative token amount
  console.log("\n📋 CLIENT ERROR: Negative Token Amount");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, -100);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 3. Zero token amount
  console.log("\n📋 CLIENT ERROR: Zero Token Amount");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, 0);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 4. Invalid recipient (same as sender)
  console.log("\n📋 CLIENT ERROR: Self-Transfer (Same Sender and Recipient)");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey1, 100);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 5. Connection error
  console.log("\n📋 CLIENT ERROR: Network Connection Failure");
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
  
  // 6. RPC error
  console.log("\n📋 CLIENT ERROR: RPC Error");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'client', code: ErrorCode.RPC_ERROR }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 7. Network timeout
  console.log("\n📋 CLIENT ERROR: Network Timeout");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'client', code: ErrorCode.NETWORK_TIMEOUT }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: Error: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
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
        
      case 'invalid-mint':
        // Test on-chain error - invalid mint
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_MINT }
        );
        break;
        
      case 'invalid-token-account':
        // Test on-chain error - invalid token account
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_TOKEN_ACCOUNT }
        );
        break;
        
      case 'invalid-owner':
        // Test on-chain error - invalid owner
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_OWNER }
        );
        break;
        
      case 'invalid-mint-authority':
        // Test on-chain error - invalid mint authority
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_MINT_AUTHORITY }
        );
        break;
        
      case 'already-minted-today':
        // Test on-chain error - already minted today
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.ALREADY_MINTED_TODAY }
        );
        break;
        
      case 'invalid-metadata':
        // Test on-chain error - invalid token metadata
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_TOKEN_METADATA }
        );
        break;
        
      case 'invalid-decimals':
        // Test on-chain error - invalid token decimals
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_TOKEN_DECIMALS }
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
        
      case 'rpc-error':
        // Test client error - RPC error
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'client', code: ErrorCode.RPC_ERROR }
        );
        break;
        
      case 'network-timeout':
        // Test client error - network timeout
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'client', code: ErrorCode.NETWORK_TIMEOUT }
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
        
      case 'anchor':
        // Run all Anchor custom errors
        await demonstrateAnchorErrors();
        return;
        
      case 'client':
        // Run all client-side errors
        await demonstrateClientErrors();
        return;
        
      default:
        console.log(`❌ Unknown error type: ${errorType}`);
        console.log(`
Available error types:
- Client-side validation errors:
  • validation-pubkey: Invalid public key format
  • validation-amount: Invalid token amount

- On-chain errors:
  • insufficient: Insufficient token balance
  • unauthorized: Unauthorized transfer
  • invalid-mint: Invalid token mint address
  • invalid-token-account: Invalid token account
  • invalid-owner: Invalid token account owner
  • invalid-mint-authority: Invalid mint authority
  • already-minted-today: Already minted tokens today
  • invalid-metadata: Invalid token metadata
  • invalid-decimals: Invalid token decimals

- Network/RPC errors:
  • connection: Network connection failure
  • rpc-error: RPC endpoint returned an error
  • network-timeout: Network request timed out

- Solana transaction errors:
  • sol-timeout: Solana transaction timeout
  • sol-compute: Compute budget exceeded
  • sol-fee: Insufficient SOL for transaction fee
  • sol-blockhash: Blockhash not found error

- Other options:
  • success: Successful token transfer
  • all: Run all error scenarios (default)
  • anchor: Run all Anchor custom errors
  • client: Run all client-side errors
`);
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

// ============================
// Error Handling Strategy
// ============================

/**
 * This demo script demonstrates the centralized error handling approach:
 * 
 * For creating/throwing errors:
 * 1. Use Validators for input validation (they throw appropriate error objects)
 * 2. Use ErrorFactory methods for all other error creation
 * 
 * For handling/processing errors:
 * 1. Use ErrorHandler.handle() to process all caught errors 
 * 2. This provides a consistent format for displaying errors to users
 * 
 * This approach ensures:
 * - All errors across the codebase are created consistently
 * - All errors are processed consistently
 * - Users see meaningful error messages
 * - Developers have access to detailed error information
 */ 