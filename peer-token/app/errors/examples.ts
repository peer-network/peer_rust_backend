// Example showing how to use the error handling system
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { ErrorHandler, ErrorFactory, Validators, OnChainErrorCode } from './index';

/**
 * Example 1: Basic Error Handling
 */
async function handleBasicErrors() {
  try {
    // Example validating a public key
    const addressStr = "Not a valid public key";
    const validatedAddress = Validators.publicKey(addressStr, "recipient address");
    
    // This line won't be reached due to the error above
    console.log("Public key is valid:", validatedAddress.toString());
  } catch (error) {
    // Use the error handler to process the error
    const errorDetails = ErrorHandler.handle(error);
    console.error(`Error (code ${errorDetails.code}): ${errorDetails.message}`);
  }
}

/**
 * Example 2: Handling On-Chain Errors (simulated)
 */
async function handleOnChainErrors() {
  try {
    // Simulate an on-chain error (e.g., insufficient token balance)
    const simulatedOnChainError = {
      code: OnChainErrorCode.INSUFFICIENT_PEER_TOKENS,
      logs: [
        "Program log: Instruction: TransferTokens",
        "Program log: Error Number: 6003",
        "Program log: Insufficient token balance"
      ]
    };
    
    // This is how you would typically handle a transaction error
    throw ErrorFactory.transactionFailed("token transfer", simulatedOnChainError);
  } catch (error) {
    // The error handler will recognize and properly format the on-chain error
    const errorDetails = ErrorHandler.handle(error);
    console.error(`Error (code ${errorDetails.code}): ${errorDetails.message}`);
    
    if (errorDetails.onChainCode) {
      console.error(`On-chain error code: ${errorDetails.onChainCode}`);
    }
    
    if (errorDetails.details) {
      console.error("Operation:", errorDetails.details.operation);
    }
  }
}

/**
 * Example 3: Error handling in an async function calling a Solana program
 */
async function transferTokensExample(
  connection: Connection,
  senderWallet: Keypair,
  recipientAddress: string,
  amount: number
) {
  try {
    // Validate inputs before proceeding
    const recipient = Validators.publicKey(recipientAddress, "recipient address");
    const validAmount = Validators.tokenAmount(amount, "transfer amount");
    
    console.log(`Transferring ${validAmount} tokens to ${recipient.toString()}`);
    
    // Simulate a transaction call to a Solana program
    // In a real app, this would be a call to a program using anchor.js
    const mockTransaction = async () => {
      // Simulate different error scenarios based on amount
      if (amount <= 0) {
        const error = {
          code: OnChainErrorCode.INVALID_TRANSFER_AMOUNT,
          message: "Cannot transfer zero or negative amount"
        };
        throw error;
      } else if (amount > 1000) {
        const error = {
          code: OnChainErrorCode.INSUFFICIENT_PEER_TOKENS,
          message: "Insufficient balance for transfer"
        };
        throw error;
      }
      
      return "transaction_signature_123";
    };
    
    // Execute the transaction
    const signature = await mockTransaction();
    console.log(`Transfer successful! Signature: ${signature}`);
    
    return signature;
  } catch (error) {
    // Use the transaction failed factory to properly categorize the error
    throw ErrorFactory.transactionFailed("token transfer", error);
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log("===== Example 1: Basic Error Handling =====");
  await handleBasicErrors();
  
  console.log("\n===== Example 2: On-Chain Error Handling =====");
  await handleOnChainErrors();
  
  console.log("\n===== Example 3: Solana Program Interaction =====");
  try {
    const mockConnection = {} as Connection;
    const mockWallet = {} as Keypair;
    
    // This should fail with INVALID_TRANSFER_AMOUNT
    await transferTokensExample(mockConnection, mockWallet, "valid_pubkey", 0);
  } catch (error) {
    const errorDetails = ErrorHandler.handle(error);
    console.error(`Transfer error (code ${errorDetails.code}): ${errorDetails.message}`);
    
    if (errorDetails.onChainCode) {
      console.error(`On-chain error code: ${errorDetails.onChainCode}`);
    }
  }
  
  try {
    const mockConnection = {} as Connection;
    const mockWallet = {} as Keypair;
    
    // This should fail with INSUFFICIENT_PEER_TOKENS
    await transferTokensExample(mockConnection, mockWallet, "valid_pubkey", 2000);
  } catch (error) {
    const errorDetails = ErrorHandler.handle(error);
    console.error(`Transfer error (code ${errorDetails.code}): ${errorDetails.message}`);
    
    if (errorDetails.onChainCode) {
      console.error(`On-chain error code: ${errorDetails.onChainCode}`);
    }
  }
}

// Uncomment to run the examples
// runExamples().catch(console.error);

export { handleBasicErrors, handleOnChainErrors, transferTokensExample }; 