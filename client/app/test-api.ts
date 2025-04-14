import { connectToGraphQL, fetchHelloData } from './api/client';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testApiFunctions() {
  try {
    // Test connectToGraphQL
    logger.info('Testing connectToGraphQL...');
    const client = connectToGraphQL();
    logger.info('GraphQL Client created successfully');

    // Test fetchHelloData
    logger.info('\nTesting fetchHelloData...');
    const helloData = await fetchHelloData();
    logger.info('Hello data fetched successfully:');
    logger.info('Response:', helloData);

  } catch (error) {
    logger.error('Error testing API functions:', error);
    process.exit(1);
  }
}

// Run the tests
testApiFunctions()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  }); 