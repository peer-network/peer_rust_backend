import { loadWallet, connectToSolana, initializeProgram } from '../blockchain/client';
import { readAccountData } from '../blockchain/read-service';
import { logger } from '../../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testRead(accountAddress: string) {
  try {
    // Set up Solana connection
    const wallet = loadWallet();
    const connection = connectToSolana();
    const program = await initializeProgram(wallet, connection);
    
    // Read data
    const data = await readAccountData(program, accountAddress);
    
    if (data) {
      logger.info('Successfully read data:', data);
    } else {
      logger.error('Failed to read data from account');
    }
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

// If account address is provided as argument, use it
const accountAddress = process.argv[2];
if (!accountAddress) {
  logger.error('Please provide an account address as argument');
  process.exit(1);
}

// Run the test
testRead(accountAddress)
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }); 