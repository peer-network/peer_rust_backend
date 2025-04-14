import { fetchHelloData } from './api';
import { 
  loadWallet, 
  connectToSolana, 
  initializeProgram,
  storeAllData,
  readDataFromAccount
} from './blockchain';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Log environment variables to verify they are loaded
logger.info('Environment variables loaded:');
logger.info(`SOLANA_NETWORK: ${process.env.SOLANA_NETWORK}`);
logger.info(`PROGRAM_ID: ${process.env.PROGRAM_ID}`);
logger.info(`KEYPAIR_FILE: ${process.env.KEYPAIR_FILE}`);

/**
 * Main function to run the integration
 */
async function runIntegration() {
  logger.info('Starting GraphQL to Solana integration process...');
  
  try {
    // Step 1: Set up Solana connection
    logger.info('Step 1: Setting up Solana connection...');
    const wallet = loadWallet();
    const connection = connectToSolana();
    const program = await initializeProgram(wallet, connection);
    logger.info('✅ Solana connection established');
    
    // Step 2: Fetch data from GraphQL API
    logger.info('Step 2: Fetching data from GraphQL API...');
    const helloData = await fetchHelloData();
    logger.info(`✅ Successfully fetched data from GraphQL: ${helloData.hello.currentuserid}`);
    
    // Step 3: Store data on Solana blockchain
    logger.info('Step 3: Storing data on Solana blockchain...');
    const storeResult = await storeAllData(program, wallet, [{
      currentuserid: helloData.hello.currentuserid
    }]);
    
    logger.info('✅ Successfully stored data on Solana');
    logger.info('Stored data account addresses:');
    
    // Step 4: Read and display the stored data
    logger.info('Step 4: Reading stored data from Solana...');
    
    for (const result of storeResult.results) {
      if (result.success) {
        logger.info(`  ${result.accountAddress}`);
        
        // Read the data from the account
        const storedData = await readDataFromAccount(program, result.accountAddress);
        if (storedData) {
          logger.info('  Stored data:', storedData);
        } else {
          logger.error(`  Failed to read data from account ${result.accountAddress}`);
        }
      } else {
        logger.error(`  Failed: ${result.accountAddress} - ${result.error}`);
      }
    }
    
    // Success message
    logger.info('🎉 Integration completed successfully!');
    
  } catch (error) {
    logger.error('❌ Integration failed:', error);
    process.exit(1);
  }
}

// Run the integration
runIntegration()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });