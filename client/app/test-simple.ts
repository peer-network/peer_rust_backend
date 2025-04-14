import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { simpleStoreDataItem, simpleReadDataFromAccount } from './blockchain/simple-store';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { DataItem } from './types';

async function testSimpleStore() {
  try {
    // Setup Solana connection
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    logger.info('Connected to Solana devnet');

    // Load wallet
    const walletPath = path.join(process.env.HOME || '', 'Solana/keys/main.json');
    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
    );
    logger.info('Wallet loaded from:', walletPath);

    // Load IDL
    const idlPath = path.join(process.cwd(), 'target/idl/api_integration.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8')) as Idl;
    logger.info('IDL loaded from:', idlPath);

    // Setup provider and program
    const wallet = new NodeWallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

    const programId = new PublicKey('ByB8NvWuXWG5KCw5MPY2kV478UY9VnVzhyss9bXPGYkb');
    const program = new Program(idl, programId, provider);
    logger.info('Program initialized with ID:', programId.toString());

    // Create test data
    const testData: DataItem = {
      currentuserid: `test-${Date.now()}`,
      // Add other required fields with test data
    };

    // Store the data
    logger.info('Storing test data...');
    const storeResult = await simpleStoreDataItem(program, walletKeypair, testData);
    
    if (!storeResult.success) {
      throw new Error(`Failed to store data: ${storeResult.error}`);
    }

    logger.info('Data stored successfully in account:', storeResult.accountAddress);

    // Read the data back
    logger.info('Reading data back...');
    const readResult = await simpleReadDataFromAccount(program, storeResult.accountAddress);
    
    if (!readResult) {
      throw new Error('Failed to read data back');
    }

    logger.info('Data read successfully:', readResult);
    logger.info('Test completed successfully!');

  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

testSimpleStore(); 