import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  TransactionInstruction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { DataItem } from '../types/index';
import { logger } from '../../utils/logger';

/**
 * Stores a single data item on the Solana blockchain using a simple approach
 */
export async function simpleStoreDataItem(
  program: Program,
  wallet: Keypair,
  item: DataItem
): Promise<{ accountAddress: string; success: boolean; error?: string }> {
  logger.info('Storing item with data (simple approach):', item);
  
  try {
    // Convert the data item to a JSON string
    const dataJson = JSON.stringify(item);
    logger.info('Data JSON:', dataJson);
    
    // Generate PDA for the data account
    const [dataAccountPda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from('data'), wallet.publicKey.toBuffer()],
      program.programId
    );
    
    const dataAccountPublicKey = dataAccountPda.toString();
    logger.info(`Storing item ${item.currentuserid} in account ${dataAccountPublicKey} with bump ${bump}`);
    
    // Use Anchor's built-in methods to initialize the account
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
    
    // Wait for confirmation
    logger.info('Waiting for confirmation...');
    const confirmation = await program.provider.connection.confirmTransaction(tx, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }
    
    logger.info('Transaction confirmed');
    
    // Verify the account exists
    const accountInfo = await program.provider.connection.getAccountInfo(dataAccountPda);
    logger.info('Account info:', accountInfo ? 'Account exists' : 'Account does not exist');
    
    if (!accountInfo) {
      throw new Error('Account does not exist after initialization');
    }
    
    // Fetch the account data
    const account = await program.account.dataAccount.fetch(dataAccountPda);
    logger.info('Account data:', account);
    
    return {
      accountAddress: dataAccountPublicKey,
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error storing item ${item.currentuserid}:`, error);
    
    return {
      accountAddress: '',
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Reads data from a Solana account using the simple approach
 */
export async function simpleReadDataFromAccount(
  program: Program,
  accountAddress: string
): Promise<DataItem | null> {
  try {
    logger.info(`Reading data from account: ${accountAddress}`);
    
    // Convert string address to PublicKey
    const accountPublicKey = new PublicKey(accountAddress);
    
    // Fetch the account data
    const account = await program.account.dataAccount.fetch(accountPublicKey);
    
    // Parse the data
    const data = JSON.parse(account.data as string) as DataItem;
    logger.info('Data read successfully:', data);
    
    return data;
  } catch (error) {
    logger.error(`Error reading from account ${accountAddress}:`, error);
    return null;
  }
} 