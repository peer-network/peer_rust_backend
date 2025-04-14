import { wsClient } from './websocket-listener';
import { logger } from '../../utils/logger';
import { handleDataReady } from '../api/dataready';

async function main() {
  try {
    // Set up event handlers
    wsClient.on('connected', () => {
      logger.info('WebSocket client connected and ready');
    });

    wsClient.on('ping-received', async () => {
      logger.info('Ping received and responded');
      try {
        await handleDataReady();
      } catch (error) {
        logger.error('Failed to handle data ready', { error });
      }
    });

    wsClient.on('disconnected', (details) => {
      logger.warn('WebSocket client disconnected', details);
    });

    wsClient.on('error', (error) => {
      logger.error('WebSocket client error', { error });
    });

    wsClient.on('max-retries-reached', () => {
      logger.error('WebSocket client failed to connect after maximum retries');
      process.exit(1);
    });

    // Start the WebSocket client
    await wsClient.connect();
  } catch (error) {
    logger.error('Failed to start WebSocket client', { error });
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error in main', { error });
  process.exit(1);
}); 