import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Program, BN, web3 } from '@coral-xyz/anchor';
import { DataItem, StoreResult, StoreAllResult } from '../types/index';
import { logger } from '../../utils/logger';

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to retry an operation
async function retry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 5,
  delayMs: number = 1000
): Promise<T> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        logger.info(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }
  
  throw lastError;
}

/**
 * Stores a single data item on the Solana blockchain
 */
export async function storeDataItem(
  program: Program,
  wallet: Keypair,
  item: DataItem
): Promise<StoreResult> {
  logger.info('Storing item with data:', item);
  
  let dataAccountPublicKey = '';
  
  try {
    // Convert the data item to a JSON string
    const dataJson = JSON.stringify(item);
    logger.info('Data JSON:', dataJson);
    
    // Generate PDA for the data account
    const [dataAccountPda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('data'), wallet.publicKey.toBuffer()],
      program.programId
    );
    
    dataAccountPublicKey = dataAccountPda.toString();
    logger.info(`Storing item ${item.currentuserid} in account ${dataAccountPublicKey} with bump ${bump}`);
    
    // Initialize the account with data using Anchor's built-in account initialization
    logger.info('Building and sending transaction...');
    
    // Use Anchor's built-in methods to initialize the account
    const tx = await program.methods
      .initialize(dataJson)
      .accounts({
        dataAccount: dataAccountPda,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: 'confirmed', skipPreflight: true });
    
    logger.info(`Transaction sent: ${tx}`);
    
    // Wait for confirmation with retries
    logger.info('Waiting for confirmation...');
    const confirmation = await retry(async () => {
      const conf = await program.provider.connection.confirmTransaction(tx, 'confirmed');
      if (conf.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(conf.value.err)}`);
      }
      return conf;
    }, 5, 2000);
    
    logger.info('Transaction confirmed');
    
    // Add a small delay to ensure the account is fully initialized
    await sleep(2000);
    
    // Verify the account exists and has data with retries
    logger.info('Verifying account data...');
    
    // First, check if the account exists at all
    const accountInfo = await program.provider.connection.getAccountInfo(dataAccountPda);
    logger.info('Account info:', accountInfo ? 'Account exists' : 'Account does not exist');
    
    if (!accountInfo) {
      throw new Error('Account does not exist after initialization');
    }
    
    // Now try to fetch the account data
    const account = await retry(async () => {
      try {
        logger.info(`Attempting to fetch account ${dataAccountPda.toString()}`);
        const acc = await program.account.dataAccount.fetch(dataAccountPda);
        logger.info('Raw account data:', acc);
        
        if (!acc) {
          logger.error('Account fetch returned null');
          throw new Error('Account data not ready - null account');
        }
        
        if (!acc.data) {
          logger.error('Account data field is empty:', acc);
          throw new Error('Account data not ready - empty data');
        }
        
        return acc;
      } catch (error: any) {
        logger.error('Error during account verification:', {
          error: error.message,
          stack: error.stack,
          code: error.code,
          logs: error.logs,
          details: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        
        if (error.message && error.message.includes('Account does not exist')) {
          throw new Error('Account does not exist');
        }
        throw error;
      }
    }, 10, 2000);
    
    logger.info('Account data verified:', account);
    
    return {
      accountAddress: dataAccountPublicKey,
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error storing item ${item.currentuserid}:`, error);
    
    return {
      accountAddress: dataAccountPublicKey,
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Stores multiple data items on the Solana blockchain
 */
export async function storeAllData(
  program: Program,
  wallet: Keypair,
  items: DataItem[]
): Promise<StoreAllResult> {
  logger.info(`Preparing to store ${items.length} items on Solana`);
  
  const results: StoreResult[] = [];
  
  for (const item of items) {
    const result = await storeDataItem(program, wallet, item);
    results.push(result);
  }
  
  const successfulItems = results.filter(r => r.success).length;
  const failedItems = results.filter(r => !r.success).length;
  
  logger.info(`Successfully stored ${successfulItems} out of ${items.length} items`);
  
  return {
    results,
    totalItems: items.length,
    successfulItems,
    failedItems
  };
}

/**
 * Reads data from a Solana account
 */
export async function readDataFromAccount(
  program: Program,
  accountAddress: string
): Promise<DataItem | null> {
  try {
    logger.info(`Reading data from account: ${accountAddress}`);
    
    // Convert string address to PublicKey
    const accountPublicKey = new PublicKey(accountAddress);
    
    // Fetch the account data with retries
    const account = await retry(async () => {
      try {
        const acc = await program.account.dataAccount.fetch(accountPublicKey);
        if (!acc || !acc.data) {
          throw new Error('Account data not ready');
        }
        return acc;
      } catch (error: any) {
        if (error.message && error.message.includes('Account does not exist')) {
          throw new Error('Account does not exist');
        }
        throw error;
      }
    }, 10, 2000); // 10 retries with 2 second delay
    
    logger.info('Account fetched:', account);
    
    // Parse the JSON string back to DataItem
    const data = JSON.parse(account.data as string) as DataItem;
    logger.info('Successfully read data:', data);
    
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error reading from account ${accountAddress}:`, error);
    logger.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return null;
  }
} 