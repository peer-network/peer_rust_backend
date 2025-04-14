import { loadWallet, connectToSolana, initializeProgram } from '../blockchain/client';
import { storeAllData } from '../blockchain/store';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testStore() {
  try {
    // Step 1: Set up Solana connection
    logger.info('Step 1: Setting up Solana connection...');
    const wallet = loadWallet();
    const connection = connectToSolana();
    const program = await initializeProgram(wallet, connection);
    logger.info('✅ Solana connection established');
    
    // Step 2: Test data
    const testData = [{
      currentuserid: 'test-user-123'
    }];
    
    // Step 3: Store data
    logger.info('Step 3: Storing test data...');
    const result = await storeAllData(program, wallet, testData);
    
    // Log results
    logger.info('Store results:');
    logger.info(`Total items: ${result.totalItems}`);
    logger.info(`Successful: ${result.successfulItems}`);
    logger.info(`Failed: ${result.failedItems}`);
    
    result.results.forEach(r => {
      if (r.success) {
        logger.info(`✅ Successfully stored in account: ${r.accountAddress}`);
      } else {
        logger.error(`❌ Failed to store in account: ${r.accountAddress}`);
        logger.error(`Error: ${r.error}`);
      }
    });
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testStore()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }); 