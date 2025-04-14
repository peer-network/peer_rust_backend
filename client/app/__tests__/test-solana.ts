import { 
  loadWallet, 
  connectToSolana, 
  initializeProgram 
} from '../blockchain';
import { logger } from '../../utils/logger';

/**
 * Test the Solana blockchain connection
 */
async function testSolanaConnection() {
  try {
    logger.info('Testing Solana blockchain connection...');
    
    // Step 1: Load wallet
    logger.info('Loading wallet...');
    const wallet = loadWallet();
    logger.info(`Wallet loaded: ${wallet.publicKey.toString()}`);
    
    // Step 2: Connect to Solana
    logger.info('Connecting to Solana...');
    const connection = connectToSolana();
    logger.info('Connected to Solana');
    
    // Step 3: Initialize program
    logger.info('Initializing program...');
    const program = await initializeProgram(wallet, connection);
    logger.info(`Program initialized: ${program.programId.toString()}`);
    
    return true;
  } catch (error) {
    logger.error('Solana connection failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSolanaConnection()
    .then(success => {
      if (success) {
        logger.info('✅ Solana test passed');
        process.exit(0);
      } else {
        logger.error('❌ Solana test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('❌ Solana test failed with error:', error);
      process.exit(1);
    });
} 