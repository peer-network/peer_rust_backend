import { connectToGraphQL, fetchHelloData } from './api/client';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testApiLogs() {
  try {
    // Test 1: connectToGraphQL function
    logger.info('\n=== Testing connectToGraphQL function ===');
    logger.info('1. Creating GraphQL client...');
    const client = connectToGraphQL();
    logger.info('2. GraphQL client created with:');
    logger.info('   - Endpoint:', process.env.GRAPHQL_ENDPOINT);
    logger.info('   - Headers:', {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer [REDACTED]' // Don't log the actual token
    });

    // Test 2: fetchHelloData function
    logger.info('\n=== Testing fetchHelloData function ===');
    logger.info('1. Starting hello data fetch...');
    const helloData = await fetchHelloData();
    logger.info('2. Hello data response:');
    logger.info('   - Raw response:', helloData);
    logger.info('   - Current user ID:', helloData.hello.currentuserid);

    // Test 3: Error handling
    logger.info('\n=== Testing error handling ===');
    logger.info('1. Testing with invalid token...');
    const originalToken = process.env.API_TOKEN;
    process.env.API_TOKEN = 'invalid_token';
    
    try {
      await fetchHelloData();
    } catch (error: unknown) {
      logger.info('2. Expected error caught:');
      if (error instanceof Error) {
        logger.info('   - Error type:', error.constructor.name);
        logger.info('   - Error message:', error.message);
        if (error.stack) {
          logger.info('   - Error stack:', error.stack);
        }
      } else {
        logger.info('   - Unknown error type:', error);
      }
    }

    // Restore original token
    process.env.API_TOKEN = originalToken;

    // Test 4: Log statistics
    logger.info('\n=== Log Statistics ===');
    const stats = logger.getStats();
    logger.info('Log counts by level:');
    logger.info('   - Debug:', stats.debugCount);
    logger.info('   - Info:', stats.infoCount);
    logger.info('   - Warn:', stats.warnCount);
    logger.info('   - Error:', stats.errorCount);
    logger.info('   - Last log time:', stats.lastLogTime);

  } catch (error: unknown) {
    logger.error('Unexpected error in test:', error);
    if (error instanceof Error) {
      logger.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  } finally {
    // Clean up
    logger.stop();
  }
}

// Run the tests
testApiLogs().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 