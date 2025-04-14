import { fetchHelloData } from '../api';
import { logger } from '../../utils/logger';

/**
 * Test the GraphQL API connection
 */
async function testApiConnection() {
  try {
    logger.info('Testing GraphQL API connection...');
    const data = await fetchHelloData();
    logger.info('API connection successful!');
    logger.info('Response data:', data);
    return true;
  } catch (error) {
    logger.error('API connection failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testApiConnection()
    .then(success => {
      if (success) {
        logger.info('✅ API test passed');
        process.exit(0);
      } else {
        logger.error('❌ API test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('❌ API test failed with error:', error);
      process.exit(1);
    });
} 