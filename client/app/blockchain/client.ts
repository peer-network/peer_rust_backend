import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

/**
 * Loads wallet from the keypair file
 */
export function loadWallet(): Keypair {
  try {
    const keypairFile = process.env.KEYPAIR_FILE || 'wallet/keypair.json';
    logger.info(`Loading wallet from: ${keypairFile}`);
    
    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(keypairFile, 'utf-8')));
    const wallet = Keypair.fromSecretKey(secretKey);
    
    logger.info(`Wallet loaded with public key: ${wallet.publicKey.toString()}`);
    return wallet;
  } catch (error: unknown) {
    logger.error('Error loading wallet:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to load wallet: ${error.message}`);
    }
    throw new Error('Failed to load wallet: Unknown error');
  }
}

/**
 * Creates a connection to the Solana network
 */
export function connectToSolana(): Connection {
  const network = process.env.SOLANA_NETWORK || 'https://api.devnet.solana.com';
  logger.info(`Connecting to Solana network: ${network}`);
  return new Connection(network, 'confirmed');
}

/**
 * Initializes the Anchor program
 */
export async function initializeProgram(wallet: Keypair, connection: Connection): Promise<Program> {
  try {
    const programId = process.env.PROGRAM_ID;
    if (!programId) {
      throw new Error('PROGRAM_ID not found in environment variables');
    }
    
    const pubKey = new PublicKey(programId);
    logger.info(`Initializing program with ID: ${pubKey.toString()}`);
    
    // Use absolute path to the api_integration directory
    const idlPath = path.resolve(__dirname, '../../target/idl/api_integration.json');
    logger.info(`Using IDL path: ${idlPath}`);
    logger.info(`Current working directory: ${process.cwd()}`);
    
    // Check if IDL file exists
    if (!fs.existsSync(idlPath)) {
      logger.error(`IDL file not found at path: ${idlPath}`);
      logger.error(`Directory contents of ${path.dirname(idlPath)}:`);
      try {
        const files = fs.readdirSync(path.dirname(idlPath));
        logger.error(`Files: ${files.join(', ')}`);
      } catch (dirError) {
        logger.error(`Error reading directory: ${dirError}`);
      }
      throw new Error(`IDL file not found at path: ${idlPath}`);
    }
    
    // Create AnchorProvider
    logger.info('Creating AnchorProvider...');
    const provider = new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: async (tx) => {
          if (tx instanceof VersionedTransaction) {
            tx.sign([wallet]);
          } else {
            tx.partialSign(wallet);
          }
          return tx;
        },
        signAllTransactions: async (txs) => {
          for (const tx of txs) {
            if (tx instanceof VersionedTransaction) {
              tx.sign([wallet]);
            } else {
              tx.partialSign(wallet);
            }
          }
          return txs;
        },
      },
      { commitment: 'confirmed' }
    );
    logger.info('AnchorProvider created successfully');
    
    // Load the IDL file
    logger.info(`Loading IDL from: ${idlPath}`);
    try {
      const idlContent = fs.readFileSync(idlPath, 'utf-8');
      logger.info('IDL file content:', idlContent);
      const idl = JSON.parse(idlContent);
      logger.info('IDL loaded successfully');
      
      // Initialize and return the program
      logger.info('Creating Program instance...');
      const program = new Program(idl, pubKey, provider);
      logger.info('Program initialized successfully');
      return program;
    } catch (idlError) {
      logger.error('Error loading IDL:', idlError);
      if (idlError instanceof Error) {
        logger.error(`Error details: ${idlError.message}`);
        logger.error(`Error stack: ${idlError.stack}`);
      }
      throw new Error(`Failed to load IDL: ${idlError instanceof Error ? idlError.message : 'Unknown error'}`);
    }
  } catch (error) {
    logger.error('Error initializing program:', error);
    if (error instanceof Error) {
      logger.error(`Error details: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      throw new Error(`Failed to initialize program: ${error.message}`);
    }
    throw new Error('Failed to initialize program: Unknown error');
  }
} 