import { loadWallet, connectToSolana, initializeProgram } from '../blockchain/client';
import { storeDataItem, readDataFromAccount } from '../blockchain/store';
import { fetchHelloData } from '../api/client';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testWorkflow() {
  try {
    // Step 1: Fetch data from GraphQL API
    logger.info('Step 1: Fetching data from GraphQL API...');
    const apiData = await fetchHelloData();
    logger.info('Data fetched from API:', apiData);

    // Step 2: Set up Solana connection
    logger.info('Step 2: Setting up Solana connection...');
    const wallet = loadWallet();
    const connection = connectToSolana();
    const program = await initializeProgram(wallet, connection);
    logger.info('✅ Solana connection established');
    
    // Step 3: Store data on Solana
    logger.info('Step 3: Storing data on Solana...');
    const storeResult = await storeDataItem(program, wallet, apiData.hello);
    
    if (!storeResult.success) {
      throw new Error(`Failed to store data: ${storeResult.error}`);
    }
    logger.info('✅ Data stored successfully on Solana');
    
    // Step 4: Read data back from Solana
    logger.info('Step 4: Reading data from Solana...');
    const storedData = await readDataFromAccount(program, storeResult.accountAddress);
    
    if (!storedData) {
      throw new Error('Failed to read data from Solana');
    }
    logger.info('✅ Data read successfully from Solana:', storedData);
    
    // Step 5: Verify data matches
    logger.info('Step 5: Verifying data integrity...');
    const originalData = JSON.stringify(apiData.hello);
    const retrievedData = JSON.stringify(storedData);
    
    if (originalData === retrievedData) {
      logger.info('✅ Data integrity verified - API data matches Solana data');
    } else {
      logger.error('❌ Data mismatch detected:');
      logger.error('Original:', originalData);
      logger.error('Retrieved:', retrievedData);
    }
    
  } catch (error) {
    logger.error('Workflow test failed:', error);
    process.exit(1);
  }
}

// Run the workflow test
testWorkflow()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }); 