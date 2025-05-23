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
 * - invalid-mint: Invalid token mint address (on-chain)
 * - invalid-mint-authority: Invalid mint authority (on-chain)
 * - invalid-owner: Invalid token account owner (on-chain)
 * - invalid-transfer-amount: Invalid transfer amount (on-chain)
 * - already-minted-today: Already minted tokens today (on-chain)
 * - invalid-metadata: Invalid token metadata (on-chain)
 * - invalid-decimals: Invalid token decimals (on-chain)
 * - metadata-creation-failed: Metadata creation failed (on-chain)
 * - connection: Network connection failure
 * - transaction-failed: General transaction failure
 * - sol-timeout: Solana transaction timeout  
 * - sol-compute: Compute budget exceeded
 * - sol-fee: Insufficient SOL for transaction fee
 * - sol-blockhash: Blockhash not found error
 * - success: Successful token transfer
 * - all: Run all error scenarios (default)
 * - anchor: Run all Anchor custom errors
 * - client: Run all client-side errors
 * - solana: Run all Solana-specific errors
 */

import { PublicKey } from '@solana/web3.js';
import { 
  ErrorHandler, 
  ErrorCode, 
  OnChainErrorCode,
  ErrorFactory,
  Validators as RealValidators
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
// Helper Functions
// ============================

/**
 * Helper function to get human-readable messages for on-chain errors
 * (This duplicates the function in ErrorHandler for demo purposes)
 */
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
      return new Error("Transaction confirmation timeout");
      
    case SolanaTransactionErrorType.BLOCKHASH_NOT_FOUND:
      return new Error("Blockhash not found");
      
    case SolanaTransactionErrorType.OUT_OF_COMPUTE_BUDGET:
      return new Error("Transaction simulation failed: out of compute budget");
      
    case SolanaTransactionErrorType.INSUFFICIENT_FUNDS:
      return new Error("Transaction simulation failed: Insufficient funds for fee");
      
    default:
      return new Error("Unknown Solana error");
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
          code: ErrorCode.VALIDATION_ERROR,
          message: `Invalid sender wallet: ${fromWallet} is not a valid Solana address`,
          details: { field: "sender wallet", value: fromWallet }
        });
      }
      
      try {
        recipient = RealValidators.publicKey(toWallet, "recipient wallet");
      } catch (error) {
        // All validation errors through ErrorFactory
        throw ErrorFactory.transactionFailed("input validation", {
          code: ErrorCode.VALIDATION_ERROR,
          message: `Invalid recipient wallet: ${toWallet} is not a valid Solana address`,
          details: { field: "recipient wallet", value: toWallet }
        });
      }
      
      // Use the real validator for amount
      let validAmount: number;
      try {
        validAmount = RealValidators.positiveNumber(amount, "transfer amount");
      } catch (error) {
        // Simply pass through the validation error created by the validator
        throw error;
      }
      
      // Check if sender and recipient are the same
      if (sender.equals(recipient)) {
        throw ErrorFactory.transactionFailed("input validation", {
          code: ErrorCode.VALIDATION_ERROR,
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
          throw ErrorFactory.connectionFailed("https://api.mainnet-beta.solana.com");
        } else if (simulateError.code === ErrorCode.TRANSACTION_FAILED) {
          throw ErrorFactory.transactionFailed("network request", new Error("Network request timed out"));
        }
      }
      
      // Simulate on-chain errors
      if (simulateError.type === 'on-chain') {
        // Create a mock on-chain error response
        const mockOnChainError = createMockOnChainError(simulateError.code);
        throw mockOnChainError; // Throw the error directly so ErrorHandler can process it
      }
      
      // Simulate Solana transaction errors
      if (simulateError.type === 'solana' && simulateError.solanaErrorType) {
        const solanaError = createMockSolanaError(simulateError.solanaErrorType);
        throw solanaError; // Throw the error directly so ErrorHandler can process it
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
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 2. Client-side validation error - negative amount
  console.log("\n📋 SCENARIO 2: Client-side validation error (Negative amount)");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, -50);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 3. Client-side validation error - zero amount
  console.log("\n📋 SCENARIO 3: Client-side validation error (Zero amount)");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, 0);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
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
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 5. On-chain error - invalid mint authority
  console.log("\n📋 SCENARIO 5: On-chain error (Invalid mint authority)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.INVALID_MINT_AUTHORITY }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 6. On-chain error - already minted today
  console.log("\n📋 SCENARIO 6: On-chain error (Already minted today)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'on-chain', code: OnChainErrorCode.ALREADY_MINTED_TODAY }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 7. Solana error - timeout
  console.log("\n📋 SCENARIO 7: Solana error (Transaction timeout)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'solana', solanaErrorType: SolanaTransactionErrorType.TIMEOUT }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 8. Solana error - insufficient SOL for fee
  console.log("\n📋 SCENARIO 8: Solana error (Insufficient SOL for fee)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'solana', solanaErrorType: SolanaTransactionErrorType.INSUFFICIENT_FUNDS }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 9. Solana error - compute budget exceeded
  console.log("\n📋 SCENARIO 9: Solana error (Compute budget exceeded)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'solana', solanaErrorType: SolanaTransactionErrorType.OUT_OF_COMPUTE_BUDGET }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 10. Solana error - blockhash not found
  console.log("\n📋 SCENARIO 10: Solana error (Blockhash not found)");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'solana', solanaErrorType: SolanaTransactionErrorType.BLOCKHASH_NOT_FOUND }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 11. Connection error
  console.log("\n📋 SCENARIO 11: Connection error");
  try {
    await mockTokenTransfer(
      validPubkey1, 
      validPubkey2, 
      100, 
      { type: 'client', code: ErrorCode.CONNECTION_FAILED }
    );
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
    if (errorInfo.onChainCode) {
      console.log(`🔧 ON-CHAIN CODE: ${errorInfo.onChainCode}`);
    }
  }
  
  // 12. Successful transfer
  console.log("\n📋 SCENARIO 12: Successful transfer");
  try {
    const signature = await mockTokenTransfer(validPubkey1, validPubkey2, 100);
    console.log(`📣 USER SEES: Transfer successful! Transaction: ${signature}`);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
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
    { code: OnChainErrorCode.INVALID_MINT, name: "Invalid Mint" },
    { code: OnChainErrorCode.INVALID_MINT_AUTHORITY, name: "Invalid Mint Authority" },
    { code: OnChainErrorCode.INVALID_OWNER, name: "Invalid Owner" },
    { code: OnChainErrorCode.INVALID_TRANSFER_AMOUNT, name: "Invalid Transfer Amount" },
    { code: OnChainErrorCode.INSUFFICIENT_PEER_TOKENS, name: "Insufficient Peer Tokens" },
    { code: OnChainErrorCode.ALREADY_MINTED_TODAY, name: "Already Minted Today" },
    { code: OnChainErrorCode.INVALID_TOKEN_DECIMALS, name: "Invalid Token Decimals" },
    { code: OnChainErrorCode.INVALID_TOKEN_METADATA, name: "Invalid Token Metadata" },
    { code: OnChainErrorCode.METADATA_CREATION_FAILED, name: "Metadata Creation Failed" }
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
      console.log(`📣 USER SEES: ${errorInfo.message}`);
      console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, On-chain: ${errorInfo.onChainCode}`);
    }
  }
}

/**
 * Demonstrate all Solana-specific errors
 */
async function demonstrateSolanaErrors() {
  const validPubkey1 = "HYEWs3HBPYrZx7NLq5V1mNyUR2nNgBjQRLnrMX1j1TJJ";
  const validPubkey2 = "9JXq6CGU7J8J5TXt1rYQMJMpNbZ9TG4G8MSvvMwxgKv9";
  
  console.log("========== SOLANA-SPECIFIC ERROR DEMONSTRATION ==========");
  
  const solanaErrors = [
    { type: SolanaTransactionErrorType.TIMEOUT, name: "Transaction Timeout" },
    { type: SolanaTransactionErrorType.BLOCKHASH_NOT_FOUND, name: "Blockhash Not Found" },
    { type: SolanaTransactionErrorType.OUT_OF_COMPUTE_BUDGET, name: "Out of Compute Budget" },
    { type: SolanaTransactionErrorType.INSUFFICIENT_FUNDS, name: "Insufficient SOL for Fee" }
  ];
  
  for (const err of solanaErrors) {
    console.log(`\n📋 TESTING SOLANA ERROR: ${err.name}`);
    try {
      await mockTokenTransfer(
        validPubkey1, 
        validPubkey2, 
        100, 
        { type: 'solana', solanaErrorType: err.type }
      );
    } catch (error) {
      const errorInfo = ErrorHandler.handle(error);
      console.log(`📣 USER SEES: ${errorInfo.message}`);
      console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Error type: ${errorInfo.details?.errorType || 'N/A'}`);
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
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 2. Negative token amount
  console.log("\n📋 CLIENT ERROR: Negative Token Amount");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, -100);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 3. Zero token amount
  console.log("\n📋 CLIENT ERROR: Zero Token Amount");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey2, 0);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER SEES: Error code: ${errorInfo.code}, Details:`, errorInfo.details);
  }
  
  // 4. Invalid recipient (same as sender)
  console.log("\n📋 CLIENT ERROR: Self-Transfer (Same Sender and Recipient)");
  try {
    await mockTokenTransfer(validPubkey1, validPubkey1, 100);
  } catch (error) {
    const errorInfo = ErrorHandler.handle(error);
    console.log(`📣 USER SEES: ${errorInfo.message}`);
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
    console.log(`📣 USER SEES: ${errorInfo.message}`);
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
        
      case 'invalid-mint-authority':
        // Test on-chain error - invalid mint authority
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_MINT_AUTHORITY }
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
        
      case 'invalid-transfer-amount':
        // Test on-chain error - invalid transfer amount
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.INVALID_TRANSFER_AMOUNT }
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
        
      case 'metadata-creation-failed':
        // Test on-chain error - metadata creation failed
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'on-chain', code: OnChainErrorCode.METADATA_CREATION_FAILED }
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
        
      case 'transaction-failed':
        // Test client error - transaction failed
        await mockTokenTransfer(
          validPubkey1, 
          validPubkey2, 
          100, 
          { type: 'client', code: ErrorCode.TRANSACTION_FAILED }
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
        
      case 'solana':
        // Run all Solana-specific errors
        await demonstrateSolanaErrors();
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
  • invalid-mint: Invalid token mint address
  • invalid-mint-authority: Invalid mint authority
  • invalid-owner: Invalid token account owner
  • invalid-transfer-amount: Invalid transfer amount
  • already-minted-today: Already minted tokens today
  • invalid-metadata: Invalid token metadata
  • invalid-decimals: Invalid token decimals
  • metadata-creation-failed: Metadata creation failed

- Network/Client errors:
  • connection: Network connection failure
  • transaction-failed: General transaction failure

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
  • solana: Run all Solana-specific errors
`);
        return;
    }
  } catch (error) {
    // Handle and display the error
    const errorInfo = ErrorHandler.handle(error);
    
    console.log("\n📊 ERROR DETAILS:");
    console.log(`📣 USER WOULD SEE: ${errorInfo.message}`);
    console.log(`🔍 DEVELOPER INFO:`);
    console.log(`  - Error code: ${errorInfo.code}`);
    
    if (errorInfo.onChainCode) {
      console.log(`  - On-chain error code: ${errorInfo.onChainCode}`);
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
 * This demo script demonstrates the enhanced error handling approach:
 * 
 * For creating/throwing errors:
 * 1. Use Validators for input validation (they throw appropriate error objects)
 * 2. Use ErrorFactory methods for all other error creation
 * 3. Throw raw errors directly for on-chain and Solana errors (let ErrorHandler process them)
 * 
 * For handling/processing errors:
 * 1. Use ErrorHandler.handle() to process all caught errors 
 * 2. This provides a consistent format with user-friendly messages
 * 3. Access onChainCode for specific on-chain error handling
 * 
 * This approach ensures:
 * - All errors across the codebase are created consistently
 * - All errors are processed consistently with user-friendly messages
 * - Users see meaningful, actionable error messages instead of technical jargon
 * - Developers have access to detailed error information including on-chain codes
 * - On-chain errors are properly detected and mapped to appropriate client error codes
 */ 