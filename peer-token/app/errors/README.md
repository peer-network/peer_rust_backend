# Error Handling System for Peer Token

This directory contains a centralized error handling system for the Peer Token application. The system provides a standardized way to handle errors, making debugging easier and providing better feedback for both developers and users.

## Features

- **Standardized Error Codes**: All errors are categorized and have unique error codes
- **On-Chain Error Mapping**: Automatically maps Solana program errors to client-side error codes
- **Specialized Error Types**: Different error types for different parts of the application
- **Error Factories**: Helper functions to create common errors
- **Error Handler**: Central facility for logging and processing errors
- **Validation Utilities**: Functions to validate input data and prevent errors before they occur

## Error Structure

All errors extend from the base `PeerTokenError` class and include:
- **Error Code**: A unique identifier for the type of error
- **Error Message**: A descriptive message about what went wrong
- **Error Details**: Additional context about the error (optional)
- **On-Chain Code**: For Solana program errors, the original on-chain error code (optional)

## Error Categories

### Client-Side Error Codes (1-700)
- **General Errors** (1-100): Basic errors like invalid parameters
- **Connection Errors** (101-200): Issues connecting to Solana
- **Wallet Errors** (201-300): Wallet and keypair issues
- **Token Operation Errors** (301-400): Token-specific errors
- **Metadata Errors** (401-500): Issues with token metadata
- **Data Format Errors** (501-600): Data structure and parsing errors
- **Transaction Errors** (601-700): Solana transaction failures

### On-Chain Error Codes (6000+)
The system also handles standard Peer Token on-chain errors defined in the Rust program's `error.rs` file. These errors are mapped to the appropriate client-side error codes for consistency.

## How to Use

### Throwing Errors

Use the `ErrorFactory` to create and throw standardized errors:

```typescript
// Example: Mint account not found
throw ErrorFactory.mintNotFound(mintPda);

// Example: Transaction failure
throw ErrorFactory.transactionFailed(
  "Mint creation", 
  { originalError: error instanceof Error ? error.message : String(error) }
);
```

### Handling On-Chain Errors

The system automatically detects and maps on-chain error codes:

```typescript
try {
  // Your code calling a Solana program
} catch (error) {
  // This will detect and properly format any on-chain error
  throw ErrorFactory.transactionFailed("token transfer", error);
}
```

### Validating Input

Use the `Validators` to check input values:

```typescript
// Validate a required field
const userWallet = Validators.publicKey(walletAddress, "user wallet address");

// Validate token amount
const amount = Validators.tokenAmount(tokenInput, "token transfer amount");
```

### Handling Errors

Use the `ErrorHandler` to process errors in a catch block:

```typescript
try {
  // Your code here
} catch (error) {
  const errorDetails = ErrorHandler.handle(error);
  console.error(`Error code: ${errorDetails.code}, Message: ${errorDetails.message}`);
  if (errorDetails.details) {
    console.error("Error details:", errorDetails.details);
  }
  if (errorDetails.onChainCode) {
    console.error(`On-chain error code: ${errorDetails.onChainCode}`);
  }
}
```

Or just log the error without handling it:

```typescript
try {
  // Your code here
} catch (error) {
  ErrorHandler.logError(error);
  // Continue execution...
}
```

## Error Demo Tool

The error handling system includes an interactive demo script `error-demo.ts` that can be used to test and understand different error scenarios:

```bash
# Run all error scenarios
ts-node error-demo.ts

# Or run a specific error scenario
ts-node error-demo.ts validation-pubkey
```

Available error scenarios:

- `validation-pubkey`: Invalid public key format
- `validation-amount`: Invalid token amount
- `insufficient`: Insufficient token balance (on-chain)
- `unauthorized`: Unauthorized transfer (on-chain)
- `connection`: Network connection failure
- `sol-timeout`: Solana transaction timeout
- `sol-compute`: Compute budget exceeded
- `sol-fee`: Insufficient SOL for transaction fee
- `sol-blockhash`: Blockhash not found error
- `success`: Successful token transfer
- `all`: Run all error scenarios (default)

You can also use `run-demo.ts` as a simple wrapper to run all error scenarios.

## Examples

For more examples of how to use the error handling system, see the `examples.ts` file. It includes:

1. Basic error handling
2. Handling on-chain errors
3. Implementing error handling in a Solana program interaction

## Best Practices

1. Always use the standardized error system instead of throwing generic errors
2. Include useful details in error objects to help with debugging
3. Validate inputs early to prevent errors from occurring
4. Handle errors at the appropriate level - don't catch errors if you can't do anything useful with them
5. Log all errors for debugging purposes
6. When handling Solana program interactions, use the `transactionFailed` factory to capture on-chain errors 