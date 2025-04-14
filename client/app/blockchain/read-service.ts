import { PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { DataItem } from '../types/index';
import { logger } from '../../utils/logger';

/**
 * Read data from a Solana account
 */
export async function readAccountData(
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